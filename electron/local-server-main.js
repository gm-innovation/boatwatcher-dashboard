const { app, BrowserWindow, Tray, Menu, shell, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

app.setName('Dock Check Local Server');

// --- Robust logging ---
function resolveLogDir() {
  const candidates = [];
  try { candidates.push(app.getPath('userData')); } catch (_) {}
  if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, 'Dock Check Local Server'));
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Dock Check Local Server'));
  candidates.push(os.tmpdir());
  for (const dir of candidates) {
    try { fs.mkdirSync(dir, { recursive: true }); return dir; } catch (_) {}
  }
  return os.tmpdir();
}

const LOG_DIR = resolveLogDir();
const LOG_PATH = path.join(LOG_DIR, 'error.log');

function logToFile(message) {
  try { fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`); } catch (_) {}
}

logToFile(`=== BOOT START === PID=${process.pid} argv=${JSON.stringify(process.argv)}`);
logToFile(`Log file location: ${LOG_PATH}`);

process.on('uncaughtException', (err) => logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`));
process.on('unhandledRejection', (reason) => logToFile(`UNHANDLED REJECTION: ${reason}`));

// --- Load server module ---
let startLocalServer;
try {
  startLocalServer = require('../server/index').startLocalServer;
  logToFile('server/index module loaded successfully');
} catch (err) {
  logToFile(`FAILED TO REQUIRE server/index: ${err.stack || err.message}`);
}

// --- Auto-updater setup ---
let updaterReady = false;
try {
  autoUpdater.channel = 'server';
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  updaterReady = true;
} catch (err) {
  logToFile(`Auto-updater init warning (app-update.yml missing?): ${err.message}`);
}

let updateStatus = { status: 'idle' }; // idle | checking | available | downloading | downloaded | error

function sendUpdaterStatus(data) {
  updateStatus = data;
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.webContents.send('updater-status', data);
  }
}

autoUpdater.on('checking-for-update', () => {
  sendUpdaterStatus({ status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  logToFile(`Update available: ${info.version}`);
  sendUpdaterStatus({ status: 'available', version: info.version, releaseDate: info.releaseDate });
});

autoUpdater.on('update-not-available', () => {
  sendUpdaterStatus({ status: 'idle', lastCheck: new Date().toISOString() });
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdaterStatus({ status: 'downloading', percent: Math.round(progress.percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  logToFile(`Update downloaded: ${info.version}`);
  sendUpdaterStatus({ status: 'downloaded', version: info.version });
});

autoUpdater.on('error', (err) => {
  logToFile(`Auto-updater error: ${err.message}`);
  const msg = err.message || '';
  // Detect 404 errors (server.yml not found in release)
  if (msg.includes('404') || msg.includes('Not Found') || msg.includes('HttpError') || msg.includes('net::ERR')) {
    sendUpdaterStatus({
      status: 'error',
      message: 'Nenhuma atualização disponível para o Servidor Local nesta versão. Baixe manualmente em github.com.',
      is404: true,
    });
  } else {
    sendUpdaterStatus({ status: 'error', message: msg });
  }
});

let tray = null;
let configWindow = null;
let serverRuntime = null;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  logToFile('Another instance is already running — quitting');
  app.quit();
}
const isSecondInstance = !singleInstanceLock;

function ensureRuntimeDirectories() {
  const userDataPath = app.getPath('userData');
  process.env.BW_HOST = process.env.BW_HOST || '0.0.0.0';
  process.env.BW_PORT = process.env.BW_PORT || '3001';
  process.env.BW_DATA_DIR = process.env.BW_DATA_DIR || path.join(userDataPath, 'data');
  process.env.BW_BACKUP_DIR = process.env.BW_BACKUP_DIR || path.join(userDataPath, 'backups');
  fs.mkdirSync(process.env.BW_DATA_DIR, { recursive: true });
  fs.mkdirSync(process.env.BW_BACKUP_DIR, { recursive: true });
}

function findIcon() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(
      path.join(process.resourcesPath, 'build', 'icon.png'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'icon.png'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'favicon-512.png'),
    );
    try {
      const appPath = app.getAppPath();
      candidates.push(path.join(appPath, 'build', 'icon.png'), path.join(appPath, 'public', 'favicon-512.png'));
    } catch (_) {}
  } else {
    candidates.push(path.join(__dirname, '../public/favicon-512.png'));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  logToFile('WARNING: No icon found, Tray may fail');
  return candidates[0];
}

// --- Config Window ---
function openConfigWindow() {
  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 920,
    height: 680,
    title: 'Dock Check Local Server',
    icon: findIcon(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'server-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  configWindow.loadFile(path.join(__dirname, 'server-ui.html'));
  configWindow.on('closed', () => { configWindow = null; });
}

// --- IPC Handlers ---
function registerIpcHandlers() {
  ipcMain.handle('server:get-health', async () => {
    try {
      const res = await fetch(`http://localhost:${process.env.BW_PORT || 3001}/api/health`);
      return await res.json();
    } catch {
      return { status: 'offline' };
    }
  });

  ipcMain.handle('server:get-agent-config', () => {
    if (!serverRuntime?.db) return null;
    const token = serverRuntime.db.getSyncMeta?.('agent_token') || '';
    const agentName = serverRuntime.db.getSyncMeta?.('agent_name') || '';
    const projectName = serverRuntime.db.getSyncMeta?.('project_name') || '';
    const syncStatus = serverRuntime.syncEngine?.getStatus?.() || {};

    return {
      token: token,
      tokenMasked: token ? token.slice(0, 8) + '...' + token.slice(-4) : '',
      agentName,
      projectName,
      syncOnline: syncStatus.online || false,
      syncConfigured: syncStatus.configured || false,
      lastSync: syncStatus.lastSync || null,
    };
  });

  ipcMain.handle('server:set-agent-token', async (_event, token) => {
    if (!serverRuntime?.db || !token) return { error: 'Servidor não inicializado.' };

    try {
      // Validate token by calling the cloud endpoint to download devices
      const syncEngine = serverRuntime.syncEngine;
      if (!syncEngine.cloudUrl || !syncEngine.cloudAnonKey) {
        return { error: 'Configuração de nuvem indisponível.' };
      }

      // First validate via heartbeat
      const heartbeatResult = await callCloudFunction(
        syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
        'agent-sync/status', 'POST', { version: '1.0.0' }
      );

      if (heartbeatResult.error) {
        return { error: `Token inválido: ${heartbeatResult.error}` };
      }

      // Download companies first (projects depend on them via FK)
      try {
        const companiesResult = await callCloudFunction(
          syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
          'agent-sync/download-companies?since=1970-01-01T00:00:00Z', 'GET', null
        );
        if (Array.isArray(companiesResult.companies)) {
          for (const company of companiesResult.companies) {
            try {
              serverRuntime.db.upsertCompanyFromCloud?.(company);
            } catch (compErr) {
              logToFile(`Failed to upsert company ${company.id} (${company.name}): ${compErr.message}`);
            }
          }
          logToFile(`Pre-synced ${companiesResult.companies.length} companies`);
        }
      } catch (err) {
        logToFile(`download-companies failed: ${err.message}`);
      }

      // Download projects (devices depend on them via FK)
      try {
        const projectsResult = await callCloudFunction(
          syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
          'agent-sync/download-projects?since=1970-01-01T00:00:00Z', 'GET', null
        );
        if (Array.isArray(projectsResult.projects)) {
          for (const project of projectsResult.projects) {
            try {
              serverRuntime.db.upsertProjectFromCloud?.(project);
            } catch (projErr) {
              logToFile(`Failed to upsert project ${project.id} (${project.name}, client_id=${project.client_id}): ${projErr.message}`);
            }
          }
          logToFile(`Pre-synced ${projectsResult.projects.length} projects`);
        }
      } catch (err) {
        logToFile(`download-projects failed: ${err.message}`);
      }

      // Download devices assigned to this agent
      let devicesResult;
      try {
        devicesResult = await callCloudFunction(
          syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
          'agent-sync/download-devices', 'GET', null
        );
      } catch (err) {
        logToFile(`download-devices failed: ${err.message}`);
        devicesResult = { devices: [] };
      }

      // Save token
      serverRuntime.db.setSyncMeta?.('agent_token', token);
      process.env.AGENT_TOKEN = token;

      // Save agent/project info
      if (devicesResult.agent) {
        serverRuntime.db.setSyncMeta?.('agent_name', devicesResult.agent.name || '');
        serverRuntime.db.setSyncMeta?.('project_name', devicesResult.agent.project_name || '');
      }

      // Save devices to local SQLite with per-record error handling
      let devicesSaved = 0;
      let devicesFailed = 0;
      if (Array.isArray(devicesResult.devices)) {
        for (const device of devicesResult.devices) {
          try {
            serverRuntime.db.upsertDeviceFromCloud?.(device);
            devicesSaved++;
          } catch (devErr) {
            devicesFailed++;
            logToFile(`Failed to upsert device ${device.id} (${device.name}, project_id=${device.project_id}): ${devErr.message}`);
          }
        }
        logToFile(`Devices: ${devicesSaved} saved, ${devicesFailed} failed out of ${devicesResult.devices.length}`);
      }

      // Reload agent controller devices
      serverRuntime.agentController?.reloadDevices?.();

      // Reset sync timestamp so full download happens
      serverRuntime.db.setSyncMeta?.('last_download', '1970-01-01T00:00:00Z');

      // Rebind devices in cloud to this agent
      try {
        await callCloudFunction(
          syncEngine.cloudUrl, syncEngine.cloudAnonKey, token,
          'agent-sync/rebind-devices', 'POST', {}
        );
        logToFile('Devices rebound to agent in cloud');
      } catch (rebindErr) {
        logToFile(`rebind-devices warning: ${rebindErr.message}`);
      }

      // Trigger sync
      serverRuntime.syncEngine?.triggerSync?.();

      return { success: true, devicesCount: devicesSaved };
    } catch (err) {
      logToFile(`set-agent-token error: ${err.stack || err.message}`);
      return { error: err.message };
    }
  });

  ipcMain.handle('server:remove-agent-token', () => {
    if (!serverRuntime?.db) return;
    serverRuntime.db.setSyncMeta?.('agent_token', '');
    serverRuntime.db.setSyncMeta?.('agent_name', '');
    serverRuntime.db.setSyncMeta?.('project_name', '');
    delete process.env.AGENT_TOKEN;
    logToFile('Agent token removed');
  });

  ipcMain.handle('server:get-devices', () => {
    if (!serverRuntime?.db) return [];
    return serverRuntime.db.getDevices?.() || [];
  });

  ipcMain.handle('server:add-device', (_event, data) => {
    if (!serverRuntime?.db) return { error: 'Servidor não inicializado.' };
    try {
      const { ip, device_id, name, serial, user, password } = data;
      if (!ip || !device_id || !name) return { error: 'IP, Device ID e Nome são obrigatórios.' };
      serverRuntime.db.upsertDeviceFromCloud({
        id: device_id,
        name,
        controlid_ip_address: ip,
        controlid_serial_number: serial || null,
        api_credentials: { user: user || 'admin', password: password || 'admin' },
        type: 'facial_reader',
        status: 'offline',
      });
      serverRuntime.agentController?.reloadDevices?.();
      logToFile(`Device added manually: ${name} (${ip})`);
      return { success: true };
    } catch (err) {
      logToFile(`add-device error: ${err.message}`);
      return { error: err.message };
    }
  });

  ipcMain.handle('server:remove-device', (_event, id) => {
    if (!serverRuntime?.db) return { error: 'Servidor não inicializado.' };
    try {
      serverRuntime.db.deleteDevice(id);
      serverRuntime.agentController?.reloadDevices?.();
      logToFile(`Device removed: ${id}`);
      return { success: true };
    } catch (err) {
      logToFile(`remove-device error: ${err.message}`);
      return { error: err.message };
    }
  });

  ipcMain.handle('server:test-device-connection', async (_event, ip) => {
    if (!ip) return { ok: false };
    return new Promise((resolve) => {
      const req = http.get(`http://${ip}/api/status`, { timeout: 3000 }, (res) => {
        resolve({ ok: res.statusCode < 500 });
      });
      req.on('error', () => resolve({ ok: false }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    });
  });

  ipcMain.handle('server:trigger-sync', async () => {
    try {
      await serverRuntime?.syncEngine?.triggerSync?.();
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('server:reset-and-full-sync', async () => {
    try {
      const status = await serverRuntime?.syncEngine?.resetAndFullSync?.();
      return { success: true, status };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('server:restart-service', async () => {
    try {
      logToFile('Restart requested via UI');
      serverRuntime?.stop?.();
      await bootLocalServer();
      logToFile('Service restarted successfully');
      return { success: true };
    } catch (err) {
      logToFile(`Restart error: ${err.message}`);
      return { error: err.message };
    }
  });

  ipcMain.handle('server:get-log-content', () => {
    try {
      const content = fs.readFileSync(LOG_PATH, 'utf-8');
      const lines = content.split('\n');
      return lines.slice(-100).join('\n');
    } catch {
      return 'Não foi possível ler o log.';
    }
  });

  ipcMain.handle('server:open-folder', (_event, type) => {
    const paths = {
      data: process.env.BW_DATA_DIR,
      backups: process.env.BW_BACKUP_DIR,
      logs: LOG_DIR,
    };
    const target = paths[type];
    if (target) shell.openPath(target);
  });

  // --- Auto-updater IPC ---
  ipcMain.handle('server:check-update', async () => {
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('server:download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('server:install-update', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('server:get-update-status', () => {
    return updateStatus;
  });
}

// --- Cloud HTTP helper ---
function callCloudFunction(cloudUrl, anonKey, agentToken, fnPath, method, body) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const url = new URL(`${cloudUrl}/functions/v1/${fnPath}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        'x-agent-token': agentToken,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            resolve({ error: parsed.error || `HTTP ${res.statusCode}` });
            return;
          }
          resolve(parsed);
        } catch { resolve({ error: 'Invalid JSON response' }); }
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// --- Tray Menu ---
function setTrayMenu(statusText) {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: statusText, enabled: false },
    { type: 'separator' },
    { label: 'Abrir painel de configuração', click: () => openConfigWindow() },
    { label: 'Verificar atualização', click: () => { try { autoUpdater.checkForUpdates(); } catch (_) {} openConfigWindow(); } },
    { type: 'separator' },
    { label: 'Abrir pasta de dados', click: () => shell.openPath(process.env.BW_DATA_DIR || '') },
    { label: 'Abrir pasta de backups', click: () => shell.openPath(process.env.BW_BACKUP_DIR || '') },
    { label: 'Abrir pasta de logs', click: () => shell.openPath(LOG_DIR) },
    { type: 'separator' },
    { label: 'Encerrar servidor local', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`Dock Check Local Server — ${statusText}`);
}

async function bootLocalServer() {
  ensureRuntimeDirectories();
  serverRuntime = startLocalServer({
    host: process.env.BW_HOST,
    port: process.env.BW_PORT,
    dataDir: process.env.BW_DATA_DIR,
    backupDir: process.env.BW_BACKUP_DIR,
  });

  const port = serverRuntime.port || process.env.BW_PORT || '3001';
  setTrayMenu(`Online em http://localhost:${port}`);
}

// --- App lifecycle ---
app.on('second-instance', () => {
  openConfigWindow();
});

app.on('before-quit', () => {
  logToFile('App quitting');
  serverRuntime?.stop?.();
});

app.whenReady().then(async () => {
  if (isSecondInstance) return;
  logToFile('app.whenReady fired');

  try {
    app.setAppUserModelId('com.dockcheck.localserver');
    app.setLoginItemSettings({ openAtLogin: true });

    registerIpcHandlers();

    const iconPath = findIcon();
    logToFile(`Creating Tray with icon: ${iconPath}`);
    tray = new Tray(iconPath);
    tray.on('double-click', () => openConfigWindow());
    setTrayMenu('Inicializando...');
    logToFile('Tray created successfully');

    if (!startLocalServer) {
      throw new Error('server/index module failed to load — check error.log');
    }

    await bootLocalServer();
    logToFile('Server started successfully');

    // Auto-open config window on first run if no token configured
    const token = serverRuntime?.db?.getSyncMeta?.('agent_token');
    if (!token) {
      openConfigWindow();
    }

    // Check for updates on startup and every 6 hours
    setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch (_) {} }, 10000);
    setInterval(() => { try { autoUpdater.checkForUpdates(); } catch (_) {} }, 6 * 60 * 60 * 1000);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    logToFile(`BOOT ERROR: ${message}`);
    dialog.showErrorBox('Dock Check Local Server', `Falha ao iniciar.\n\nDetalhes no log:\n${LOG_PATH}\n\n${message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Tray-only app — do not quit when no windows are open
});
