const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BW_DATA_DIR || path.join(__dirname, '..', 'data');

// Session cache: ip:port -> { session, expiry }
const sessionCache = new Map();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function parseApiCredentials(apiCredentials) {
  let raw = {};
  if (!apiCredentials) return { username: 'admin', password: 'admin', port: 80 };
  if (typeof apiCredentials === 'string') {
    try { raw = JSON.parse(apiCredentials); } catch { raw = {}; }
  } else {
    raw = apiCredentials;
  }
  return {
    username: raw.username || raw.user || raw.login || 'admin',
    password: raw.password || 'admin',
    port: raw.port || 80,
  };
}

function getDeviceKey(device) {
  const creds = parseApiCredentials(device.api_credentials);
  return `${device.controlid_ip_address}:${creds.port}`;
}

function getBaseUrl(device) {
  const creds = parseApiCredentials(device.api_credentials);
  return `http://${device.controlid_ip_address}:${creds.port}`;
}

async function loginToDevice(device) {
  const key = getDeviceKey(device);
  const cached = sessionCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.session;

  const creds = parseApiCredentials(device.api_credentials);
  const baseUrl = getBaseUrl(device);

  console.log(`[controlid] Login attempt: ${baseUrl}/login.fcgi (user=${creds.username})`);

  const response = await fetch(`${baseUrl}/login.fcgi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: creds.username, password: creds.password }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Login falhou no dispositivo (HTTP ${response.status})`);
  }

  const data = await response.json();
  if (!data.session) {
    throw new Error('Login falhou: dispositivo não retornou sessão');
  }

  sessionCache.set(key, { session: data.session, expiry: Date.now() + SESSION_TTL_MS });
  return data.session;
}

function invalidateSession(device) {
  sessionCache.delete(getDeviceKey(device));
}

function buildDeviceUrl(device, endpoint, session, queryParams = '') {
  const baseUrl = getBaseUrl(device);
  const params = [`session=${session}`];
  if (queryParams) params.push(queryParams);
  return `${baseUrl}/${endpoint}?${params.join('&')}`;
}

async function controlIdRequest(device, endpoint, method = 'GET', body, _retried = false) {
  let session;
  try {
    session = await loginToDevice(device);
  } catch (loginErr) {
    const err = new Error(`[phase=login.fcgi] ${loginErr.message}`);
    err.phase = 'login.fcgi';
    throw err;
  }

  const url = buildDeviceUrl(device, endpoint, session);
  const headers = { 'Content-Type': 'application/json' };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  // Retry once on 401
  if (response.status === 401 && !_retried) {
    invalidateSession(device);
    return controlIdRequest(device, endpoint, method, body, true);
  }

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    const detail = typeof data === 'string' ? data : (data?.error || `HTTP ${response.status}`);
    const err = new Error(`[phase=${endpoint}] ${detail}`);
    err.phase = endpoint;
    throw err;
  }

  return data;
}

async function controlIdRequestBinary(device, endpoint, queryParams, imageBuffer, _retried = false) {
  const session = await loginToDevice(device);
  const url = buildDeviceUrl(device, endpoint, session, queryParams);
  const headers = { 'Content-Type': 'application/octet-stream' };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: imageBuffer,
    signal: AbortSignal.timeout(15000),
  });

  // Retry once on 401
  if (response.status === 401 && !_retried) {
    invalidateSession(device);
    return controlIdRequestBinary(device, endpoint, queryParams, imageBuffer, true);
  }

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    throw new Error(typeof data === 'string' ? data : `HTTP ${response.status}`);
  }

  return data;
}

async function loadPhotoAsBase64(photoUrl) {
  if (!photoUrl) return null;

  if (photoUrl.startsWith('data:')) {
    const [, base64 = ''] = photoUrl.split(',');
    return base64 || null;
  }

  if (photoUrl.startsWith('/files/')) {
    const localFilePath = path.join(DATA_DIR, photoUrl.replace(/^\//, ''));
    if (fs.existsSync(localFilePath)) {
      return fs.readFileSync(localFilePath).toString('base64');
    }
  }

  const response = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Falha ao obter foto do trabalhador (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

function getWorkerControlIdCode(worker) {
  return Number(worker.code || worker.id);
}

async function enrollUserOnDevice(device, worker, photoBase64) {
  if (!device.controlid_ip_address) {
    return { success: false, error: 'Dispositivo sem IP configurado.' };
  }

  const controlIdCode = getWorkerControlIdCode(worker);
  const registration = String(worker.document_number || worker.code || worker.id);

  // Step 1: Create user via /create_objects.fcgi
  await controlIdRequest(device, 'create_objects.fcgi', 'POST', {
    object: 'users',
    values: [{
      id: controlIdCode,
      name: worker.name,
      registration: registration,
    }],
  });

  // Step 2: Send photo via /user_set_image.fcgi (binary octet-stream)
  if (!photoBase64) {
    return {
      success: true,
      warning: 'Trabalhador cadastrado sem foto biométrica.',
    };
  }

  try {
    const imageBuffer = Buffer.from(photoBase64, 'base64');
    const timestamp = Math.floor(Date.now() / 1000);
    const queryParams = `user_id=${controlIdCode}&timestamp=${timestamp}&match=0`;

    const photoResult = await controlIdRequestBinary(device, 'user_set_image.fcgi', queryParams, imageBuffer);

    if (photoResult && photoResult.success === false) {
      const errors = (photoResult.errors || []).map(e => e.message).join('; ');
      return {
        success: true,
        warning: `Usuário cadastrado, mas a foto biométrica foi rejeitada: ${errors}`,
        photoScores: photoResult.scores,
      };
    }

    return { success: true, photoScores: photoResult?.scores };
  } catch (error) {
    return {
      success: true,
      warning: `Usuário cadastrado, mas a foto biométrica falhou: ${error.message}`,
    };
  }
}

async function removeUserFromDevice(device, workerId, workerCode) {
  if (!device.controlid_ip_address) {
    return { success: false, error: 'Dispositivo sem IP configurado.' };
  }

  const controlIdCode = Number(workerCode || workerId);

  // Step 1: Remove photo via /user_destroy_image.fcgi
  try {
    await controlIdRequest(device, 'user_destroy_image.fcgi', 'POST', {
      user_id: controlIdCode,
    });
  } catch (err) {
    console.warn(`Aviso: falha ao remover foto do dispositivo: ${err.message}`);
  }

  // Step 2: Remove user via /destroy_objects.fcgi
  await controlIdRequest(device, 'destroy_objects.fcgi', 'POST', {
    object: 'users',
    where: {
      users: {
        id: controlIdCode,
      },
    },
  });

  return { success: true };
}

module.exports = {
  parseApiCredentials,
  controlIdRequest,
  controlIdRequestBinary,
  loadPhotoAsBase64,
  enrollUserOnDevice,
  removeUserFromDevice,
  getWorkerControlIdCode,
  loginToDevice,
  invalidateSession,
};
