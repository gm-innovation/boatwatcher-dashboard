const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BW_DATA_DIR || path.join(__dirname, '..', 'data');

function parseApiCredentials(apiCredentials) {
  if (!apiCredentials) return {};
  if (typeof apiCredentials === 'string') {
    try {
      return JSON.parse(apiCredentials);
    } catch {
      return {};
    }
  }
  return apiCredentials;
}

async function controlIdRequest(device, endpoint, method = 'GET', body) {
  const apiCredentials = parseApiCredentials(device.api_credentials);
  const url = `http://${device.controlid_ip_address}:${apiCredentials.port || 80}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  if (apiCredentials.username && apiCredentials.password) {
    const auth = Buffer.from(`${apiCredentials.username}:${apiCredentials.password}`).toString('base64');
    headers.Authorization = `Basic ${auth}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000),
  });

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

async function enrollUserOnDevice(device, worker, photoBase64) {
  if (!device.controlid_ip_address) {
    return { success: false, error: 'Dispositivo sem IP configurado.' };
  }

  await controlIdRequest(device, '/users.fcgi', 'POST', {
    object: 'users',
    values: [{
      id: worker.id,
      name: worker.name,
      registration: String(worker.code || worker.document_number || worker.id),
    }],
  });

  if (!photoBase64) {
    return {
      success: true,
      warning: 'Trabalhador cadastrado sem foto biométrica.',
    };
  }

  try {
    await controlIdRequest(device, '/user_images.fcgi', 'POST', {
      object: 'user_images',
      values: [{
        user_id: worker.id,
        image: photoBase64,
        timestamp: Date.now(),
      }],
    });

    return { success: true };
  } catch (error) {
    return {
      success: true,
      warning: `Usuário cadastrado, mas a foto biométrica falhou: ${error.message}`,
    };
  }
}

async function removeUserFromDevice(device, workerId) {
  if (!device.controlid_ip_address) {
    return { success: false, error: 'Dispositivo sem IP configurado.' };
  }

  await controlIdRequest(device, '/users.fcgi', 'POST', {
    object: 'users',
    where: {
      users: {
        id: workerId,
      },
    },
  });

  return { success: true };
}

module.exports = {
  parseApiCredentials,
  controlIdRequest,
  loadPhotoAsBase64,
  enrollUserOnDevice,
  removeUserFromDevice,
};