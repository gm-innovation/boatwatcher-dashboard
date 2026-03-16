const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let localServerUrl = 'http://localhost:3001';
const devServerUrl = process.env.DOCKCHECK_DESKTOP_DEV_URL || 'http://localhost:8080';

// Load server URL from config file
function loadServerConfig() {
  const configPath = path.join(app.getPath('userData'), 'server-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.serverUrl) localServerUrl = config.serverUrl;
    }
  } catch { /* use default */ }
}

function saveServerConfig(url) {
  const configPath = path.join(app.getPath('userData'), 'server-config.json');
  fs.writeFileSync(configPath, JSON.stringify({ serverUrl: url }));
  localServerUrl = url;
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Dock Check Desktop',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
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
  ipcMain.handle('sync:trigger', () => apiCall('POST', '/api/sync/trigger'));

  // === Agent operations (proxied) ===
  ipcMain.handle('agent:getStatus', () => apiCall('GET', '/api/sync/agent/status'));
  ipcMain.handle('agent:start', () => apiCall('POST', '/api/sync/agent/start'));
  ipcMain.handle('agent:stop', () => apiCall('POST', '/api/sync/agent/stop'));

  // === Server config ===
  ipcMain.handle('config:getServerUrl', () => localServerUrl);
  ipcMain.handle('config:setServerUrl', (_, url) => { saveServerConfig(url); return true; });

  // === Connectivity (check if local server is reachable) ===
  ipcMain.handle('app:isOnline', async () => {
    try {
      await fetch(`${localServerUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      return true;
    } catch {
      return false;
    }
  });
}

app.whenReady().then(async () => {
  loadServerConfig();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
