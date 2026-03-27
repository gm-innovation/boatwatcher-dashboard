const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let rendererReady = false;
let startupWatchdog = null;
const WATCHDOG_TIMEOUT_MS = 15000;
let localServerUrl = 'http://localhost:3001';
const devServerUrl = process.env.DOCKCHECK_DESKTOP_DEV_URL || 'http://localhost:8080';
let updateHandlersRegistered = false;

let updateStatus = {
  configured: false,
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  version: null,
  progress: 0,
  error: null,
};

function getConfigPath() {
  return path.join(app.getPath('userData'), 'server-config.json');
}

function emitUpdaterStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', updateStatus);
  }
}

function loadAppConfig() {
  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) return;

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.serverUrl) localServerUrl = config.serverUrl;
  } catch {
    // use defaults
  }
}

function saveAppConfig(nextConfig = {}) {
  const mergedConfig = {
    serverUrl: localServerUrl,
    ...nextConfig,
  };

  fs.writeFileSync(getConfigPath(), JSON.stringify(mergedConfig, null, 2));
  localServerUrl = mergedConfig.serverUrl;
}

function getWindowIconPath() {
  return app.isPackaged
    ? path.join(__dirname, '../dist/favicon-512.png')
    : path.join(__dirname, '../public/favicon-512.png');
}

// Proxy IPC calls to local server REST API
async function apiCall(method, endpoint, body) {
  const url = `${localServerUrl}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  const res = await fetch(url, {
    ...options,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

function getAppVersion() {
  try { return app.getVersion(); } catch { return 'desconhecida'; }
}

function getLogPath() {
  return path.join(app.getPath('userData'), 'renderer-errors.log');
}

function appendLog(message) {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(getLogPath(), line);
  } catch { /* best effort */ }
}

function loadFallback(reason) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  appendLog('Loading fallback: ' + reason);
  const fallbackPath = path.join(__dirname, 'fallback.html');
  const encodedReason = encodeURIComponent(reason);
  const version = getAppVersion();
  mainWindow.loadFile(fallbackPath, {
    hash: encodedReason,
    query: { version },
  }).catch(() => {});
}

function startWatchdog() {
  rendererReady = false;
  if (startupWatchdog) clearTimeout(startupWatchdog);
  startupWatchdog = setTimeout(() => {
    if (!rendererReady) {
      console.error('[desktop] Renderer did not signal ready within', WATCHDOG_TIMEOUT_MS, 'ms');
      appendLog('Watchdog timeout – renderer not ready after ' + WATCHDOG_TIMEOUT_MS + 'ms');
      loadFallback('O aplicativo não sinalizou prontidão em ' + (WATCHDOG_TIMEOUT_MS / 1000) + 's. Possível erro de inicialização.');
    }
  }, WATCHDOG_TIMEOUT_MS);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dock Check Desktop',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[desktop] renderer loaded', mainWindow.webContents.getURL());
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    const msg = `did-fail-load: code=${errorCode} desc=${errorDescription} url=${validatedURL}`;
    console.error('[desktop]', msg);
    appendLog(msg);
    loadFallback(`Falha ao carregar: ${errorDescription} (código ${errorCode}) | URL: ${validatedURL}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const msg = `render-process-gone: reason=${details.reason} exitCode=${details.exitCode}`;
    console.error('[desktop]', msg);
    appendLog(msg);
    loadFallback(`Processo de renderização encerrado: ${details.reason}`);
  });

  mainWindow.webContents.on('unresponsive', () => {
    appendLog('Renderer became unresponsive');
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3) {
      appendLog(`[renderer error] ${message} (${sourceId}:${line})`);
    }
    if (level < 2) return;
    const log = level >= 3 ? console.error : console.warn;
    log('[renderer]', { message, line, sourceId });
  });

  // Start the watchdog before loading
  startWatchdog();

  // Runtime diagnostics: verify dist/index.html exists before loading
  const indexPath = path.join(__dirname, '../dist/index.html');
  if (app.isPackaged) {
    appendLog(`Attempting to load: ${indexPath}`);
    appendLog(`File exists: ${fs.existsSync(indexPath)}`);
    try {
      const parentDir = path.join(__dirname, '..');
      const contents = fs.readdirSync(parentDir);
      appendLog(`App root contents: ${contents.join(', ')}`);
    } catch (e) {
      appendLog(`Cannot list app root: ${e.message}`);
    }
    try {
      const distDir = path.join(__dirname, '../dist');
      if (fs.existsSync(distDir)) {
        const distContents = fs.readdirSync(distDir);
        appendLog(`dist/ contents: ${distContents.join(', ')}`);
      } else {
        appendLog('dist/ directory does NOT exist');
      }
    } catch (e) {
      appendLog(`Cannot list dist/: ${e.message}`);
    }
  }

  const loadPromise = app.isPackaged
    ? mainWindow.loadFile(indexPath)
    : mainWindow.loadURL(devServerUrl);

  loadPromise.catch((error) => {
    const msg = `Failed to start renderer: ${error?.message || error}`;
    console.error('[desktop]', msg);
    appendLog(msg);
    loadFallback(error?.message || 'Falha ao carregar a aplicação');
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  emitUpdaterStatus();
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function promptForUpdateDownload(version) {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Instalar agora', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    title: 'Atualização disponível',
    message: `Nova versão disponível: ${version}`,
    detail: 'O sistema encontrou uma atualização. Ela só será baixada e instalada com a autorização do operador.',
    noLink: true,
  });

  if (response !== 0) return;

  updateStatus = {
    ...updateStatus,
    downloading: true,
    progress: 0,
    error: null,
  };
  emitUpdaterStatus();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(0);
  }

  await autoUpdater.downloadUpdate();
}

async function promptForUpdateInstall(version) {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Reiniciar e instalar', 'Depois'],
    defaultId: 0,
    cancelId: 1,
    title: 'Atualização pronta',
    message: `A versão ${version} foi baixada com sucesso.`,
    detail: 'Deseja reiniciar agora para concluir a atualização?',
    noLink: true,
  });

  if (response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
}

function registerUpdaterHandlers() {
  if (updateHandlersRegistered) return;
  updateHandlersRegistered = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    updateStatus = {
      ...updateStatus,
      configured: app.isPackaged,
      checking: true,
      error: null,
    };
    emitUpdaterStatus();
  });

  autoUpdater.on('update-available', async (info) => {
    updateStatus = {
      ...updateStatus,
      checking: false,
      available: true,
      downloaded: false,
      downloading: false,
      version: info.version,
      progress: 0,
      error: null,
    };
    emitUpdaterStatus();

    try {
      await promptForUpdateDownload(info.version);
    } catch (error) {
      updateStatus = {
        ...updateStatus,
        downloading: false,
        error: error instanceof Error ? error.message : 'Falha ao baixar a atualização.',
      };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
      emitUpdaterStatus();
      dialog.showErrorBox('Falha na atualização', updateStatus.error);
    }
  });

  autoUpdater.on('update-not-available', () => {
    updateStatus = {
      ...updateStatus,
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      progress: 0,
      error: null,
    };
    emitUpdaterStatus();
  });

  autoUpdater.on('download-progress', (progress) => {
    updateStatus = {
      ...updateStatus,
      checking: false,
      downloading: true,
      progress: progress.percent ?? 0,
      error: null,
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar((progress.percent ?? 0) / 100);
    }
    emitUpdaterStatus();
  });

  autoUpdater.on('update-downloaded', async (info) => {
    updateStatus = {
      ...updateStatus,
      checking: false,
      downloading: false,
      downloaded: true,
      available: true,
      version: info.version,
      progress: 100,
      error: null,
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    emitUpdaterStatus();

    try {
      await promptForUpdateInstall(info.version);
    } catch {
      // keep update ready for later installation
    }
  });

  autoUpdater.on('error', (error) => {
    updateStatus = {
      ...updateStatus,
      checking: false,
      downloading: false,
      error: error?.message || 'Falha ao verificar atualização.',
    };
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
    }
    emitUpdaterStatus();
  });
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    return { ok: false, reason: 'not_packaged' };
  }

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'error', message: error?.message || 'Erro desconhecido' };
  }
}

function registerIpcHandlers() {
  // === Database operations (proxied to local server) ===
  ipcMain.handle('db:getWorkers', (_, filters) => apiCall('GET', '/api/workers' + (filters ? '?' + new URLSearchParams(filters) : '')));
  ipcMain.handle('db:getWorkerById', (_, id) => apiCall('GET', `/api/workers/${id}`));
  ipcMain.handle('db:createWorker', (_, data) => apiCall('POST', '/api/workers', data));
  ipcMain.handle('db:updateWorker', (_, id, data) => apiCall('PUT', `/api/workers/${id}`, data));
  ipcMain.handle('db:deleteWorker', (_, id) => apiCall('DELETE', `/api/workers/${id}`));

  ipcMain.handle('db:getCompanies', () => apiCall('GET', '/api/companies'));
  ipcMain.handle('db:getCompanyById', (_, id) => apiCall('GET', `/api/companies/${id}`));
  ipcMain.handle('db:createCompany', (_, data) => apiCall('POST', '/api/companies', data));
  ipcMain.handle('db:updateCompany', (_, id, data) => apiCall('PUT', `/api/companies/${id}`, data));
  ipcMain.handle('db:deleteCompany', (_, id) => apiCall('DELETE', `/api/companies/${id}`));

  ipcMain.handle('db:getProjects', () => apiCall('GET', '/api/projects'));
  ipcMain.handle('db:getProjectById', (_, id) => apiCall('GET', `/api/projects/${id}`));
  ipcMain.handle('db:createProject', (_, data) => apiCall('POST', '/api/projects', data));
  ipcMain.handle('db:updateProject', (_, id, data) => apiCall('PUT', `/api/projects/${id}`, data));

  ipcMain.handle('db:getAccessLogs', (_, filters) => apiCall('GET', '/api/access-logs' + (filters ? '?' + new URLSearchParams(filters) : '')));
  ipcMain.handle('db:insertAccessLog', (_, data) => apiCall('POST', '/api/access-logs', data));
  ipcMain.handle('db:getWorkersOnBoard', (_, projectId) => apiCall('GET', `/api/projects/${projectId}/workers-on-board`));
  ipcMain.handle('db:getDevices', (_, projectId) => apiCall('GET', '/api/devices' + (projectId ? `?projectId=${projectId}` : '')));
  ipcMain.handle('db:getJobFunctions', () => apiCall('GET', '/api/job-functions'));

  // === Sync operations (proxied) ===
  ipcMain.handle('sync:getStatus', () => apiCall('GET', '/api/sync/status'));
  ipcMain.handle('sync:bootstrap', (_, accessToken) => apiCall('POST', '/api/sync/bootstrap', { accessToken }));
  ipcMain.handle('sync:trigger', () => apiCall('POST', '/api/sync/trigger'));

  // === Agent operations (proxied) ===
  ipcMain.handle('agent:getStatus', () => apiCall('GET', '/api/sync/agent/status'));
  ipcMain.handle('agent:start', () => apiCall('POST', '/api/sync/agent/start'));
  ipcMain.handle('agent:stop', () => apiCall('POST', '/api/sync/agent/stop'));

  // === App config ===
  ipcMain.on('config:getServerUrlSync', (event) => {
    event.returnValue = localServerUrl;
  });
  ipcMain.handle('config:setServerUrl', (_, url) => {
    saveAppConfig({ serverUrl: url });
    return true;
  });

  // === Updater ===
  ipcMain.handle('updater:getStatus', () => updateStatus);
  ipcMain.handle('updater:checkForUpdates', async () => checkForUpdates());
  ipcMain.handle('updater:installDownloadedUpdate', async () => {
    if (!updateStatus.downloaded) return false;
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  // === Connectivity (check if local server is reachable) ===
  ipcMain.handle('app:isOnline', async () => {
    try {
      await fetch(`${localServerUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      return true;
    } catch {
      return false;
    }
  });

  // === Renderer ready handshake ===
  ipcMain.on('app:renderer-ready', () => {
    rendererReady = true;
    if (startupWatchdog) {
      clearTimeout(startupWatchdog);
      startupWatchdog = null;
    }
    console.log('[desktop] Renderer signalled ready');
    appendLog('Renderer ready');
  });
}

app.whenReady().then(async () => {
  loadAppConfig();
  updateStatus = {
    ...updateStatus,
    configured: app.isPackaged,
  };

  registerUpdaterHandlers();
  registerIpcHandlers();
  createWindow();

  if (app.isPackaged) {
    setTimeout(() => {
      checkForUpdates().catch(() => undefined);
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
