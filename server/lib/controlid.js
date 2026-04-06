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
  let session;
  try {
    session = await loginToDevice(device);
  } catch (loginErr) {
    const err = new Error(`[phase=login.fcgi] ${loginErr.message}`);
    err.phase = 'login.fcgi';
    throw err;
  }

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
    const detail = typeof data === 'string' ? data : (data?.error || `HTTP ${response.status}`);
    const err = new Error(`[phase=${endpoint}] ${detail}`);
    err.phase = endpoint;
    throw err;
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

function isUniqueConstraintError(error, constraintToken) {
  const message = String(error?.message || '');
  if (!message.toLowerCase().includes('unique')) return false;
  return constraintToken ? message.includes(constraintToken) : true;
}

async function enrollUserOnDevice(device, worker, photoBase64) {
  if (!device.controlid_ip_address) {
    return { success: false, error: 'Dispositivo sem IP configurado.' };
  }

  const controlIdCode = getWorkerControlIdCode(worker);
  const registration = String(worker.document_number || worker.code || worker.id);

  // Step 1: Create/update user via upsert (create_or_modify_objects.fcgi)
  // This avoids UNIQUE constraint errors when re-syncing existing workers
  try {
    await controlIdRequest(device, 'create_or_modify_objects.fcgi', 'POST', {
      object: 'users',
      values: [{
        id: controlIdCode,
        name: worker.name,
        registration: registration,
      }],
    });
  } catch (upsertErr) {
    // Fallback: if firmware doesn't support upsert, try create with duplicate tolerance
    console.warn(`[controlid] create_or_modify_objects failed, falling back to create_objects: ${upsertErr.message}`);
    try {
      await controlIdRequest(device, 'create_objects.fcgi', 'POST', {
        object: 'users',
        values: [{
          id: controlIdCode,
          name: worker.name,
          registration: registration,
        }],
      });
    } catch (createErr) {
      // Ignore any duplicate/unique error — user already exists
      const msg = String(createErr?.message || '').toLowerCase();
      if (!msg.includes('unique') && !msg.includes('duplicate') && !msg.includes('already')) {
        throw createErr;
      }
    }
  }

  // Step 1.5: Assign access rule so device authorises passage (idempotent)
  const configuredAccessRuleId = Number(device?.configuration?.access_rule_id);
  const accessRuleId = Number.isInteger(configuredAccessRuleId) && configuredAccessRuleId > 0
    ? configuredAccessRuleId
    : 1;

  try {
    await controlIdRequest(device, 'create_or_modify_objects.fcgi', 'POST', {
      object: 'user_access_rules',
      values: [{
        user_id: controlIdCode,
        access_rule_id: accessRuleId,
      }],
    });
  } catch (upsertErr) {
    // Fallback for firmware without upsert support
    try {
      await controlIdRequest(device, 'create_objects.fcgi', 'POST', {
        object: 'user_access_rules',
        values: [{
          user_id: controlIdCode,
          access_rule_id: accessRuleId,
        }],
      });
    } catch (createErr) {
      const msg = String(createErr?.message || '').toLowerCase();
      if (!msg.includes('unique') && !msg.includes('duplicate') && !msg.includes('already')) {
        throw createErr;
      }
    }
  }

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

/**
 * Reverse Sync helpers — read users and photos FROM the device
 */

async function listDeviceUsers(device) {
  const data = await controlIdRequest(device, 'load_objects.fcgi', 'POST', {
    object: 'users',
  });
  // Response: { users: [ { id, name, registration, ... }, ... ] }
  return data?.users || [];
}

async function listDeviceUserImages(device) {
  const data = await controlIdRequest(device, 'user_list_images.fcgi', 'POST', {});
  // Response: { user_ids: [1, 2, 3, ...] }
  return data?.user_ids || [];
}

async function getDeviceUserImage(device, userId) {
  let session;
  try {
    session = await loginToDevice(device);
  } catch (loginErr) {
    const err = new Error(`[phase=login.fcgi] ${loginErr.message}`);
    err.phase = 'login.fcgi';
    throw err;
  }

  const url = buildDeviceUrl(device, 'user_get_image.fcgi', session, `user_id=${userId}`);

  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Failed to get image for user ${userId} (HTTP ${response.status})`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Clear ALL users from a device (for full re-sync scenarios).
 * Steps: load all user IDs, then destroy them all.
 */
async function clearAllUsersFromDevice(device) {
  if (!device.controlid_ip_address) {
    return { success: false, error: 'Dispositivo sem IP configurado.' };
  }

  // Step 1: List all users
  const users = await listDeviceUsers(device);
  if (!Array.isArray(users) || users.length === 0) {
    console.log(`[controlid] clearAll: no users found on device ${device.name}`);
    return { success: true, removed: 0 };
  }

  const userIds = users.map(u => Number(u.id));
  console.log(`[controlid] clearAll: removing ${userIds.length} users from device ${device.name}`);

  // Step 2: Remove photos for all users (best-effort)
  for (const uid of userIds) {
    try {
      await controlIdRequest(device, 'user_destroy_image.fcgi', 'POST', { user_id: uid });
    } catch (err) {
      // Ignore photo removal errors — user may not have a photo
    }
  }

  // Step 3: Remove all users via destroy_objects
  // Process in batches to avoid overwhelming the device
  const BATCH_SIZE = 100;
  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);
    for (const uid of batch) {
      try {
        await controlIdRequest(device, 'destroy_objects.fcgi', 'POST', {
          object: 'users',
          where: { users: { id: uid } },
        });
      } catch (err) {
        console.warn(`[controlid] clearAll: failed to remove user ${uid}: ${err.message}`);
      }
    }
  }

  console.log(`[controlid] clearAll: completed for device ${device.name}, removed up to ${userIds.length} users`);
  return { success: true, removed: userIds.length };
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
  listDeviceUsers,
  listDeviceUserImages,
  getDeviceUserImage,
  clearAllUsersFromDevice,
};
