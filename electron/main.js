const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { initDatabase, getDatabase } = require('./database');
const { SyncEngine } = require('./sync');
const { AgentController } = require('./agent');

let mainWindow;
let syncEngine;
let agentController;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'BoatWatcher Desktop',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In production, load the built React app
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize() {
  // Initialize SQLite database
  const db = initDatabase(app.getPath('userData'));

  // Initialize sync engine
  syncEngine = new SyncEngine(db);
  syncEngine.onStatusChange((status) => {
    if (mainWindow) {
      mainWindow.webContents.send('sync-status-changed', status);
    }
  });

  // Initialize ControlID agent
  agentController = new AgentController(db);
  agentController.onNewEvent((event) => {
    if (mainWindow) {
      mainWindow.webContents.send('new-access-event', event);
    }
  });

  // Start sync check loop
  syncEngine.start();

  // Register IPC handlers
  registerIpcHandlers(db);
}

function registerIpcHandlers(db) {
  // === Database operations ===
  ipcMain.handle('db:getWorkers', (_, filters) => db.getWorkers(filters));
  ipcMain.handle('db:getWorkerById', (_, id) => db.getWorkerById(id));
  ipcMain.handle('db:createWorker', (_, data) => db.createWorker(data));
  ipcMain.handle('db:updateWorker', (_, id, data) => db.updateWorker(id, data));
  ipcMain.handle('db:deleteWorker', (_, id) => db.deleteWorker(id));
  ipcMain.handle('db:getCompanies', () => db.getCompanies());
  ipcMain.handle('db:getCompanyById', (_, id) => db.getCompanyById(id));
  ipcMain.handle('db:getProjects', () => db.getProjects());
  ipcMain.handle('db:getProjectById', (_, id) => db.getProjectById(id));
  ipcMain.handle('db:getAccessLogs', (_, filters) => db.getAccessLogs(filters));
  ipcMain.handle('db:insertAccessLog', (_, data) => db.insertAccessLog(data));
  ipcMain.handle('db:getWorkersOnBoard', (_, projectId) => db.getWorkersOnBoard(projectId));
  ipcMain.handle('db:getDevices', (_, projectId) => db.getDevices(projectId));
  ipcMain.handle('db:getJobFunctions', () => db.getJobFunctions());

  // === Sync operations ===
  ipcMain.handle('sync:getStatus', () => syncEngine.getStatus());
  ipcMain.handle('sync:trigger', () => syncEngine.triggerSync());

  // === Agent operations ===
  ipcMain.handle('agent:getStatus', () => agentController.getStatus());
  ipcMain.handle('agent:start', () => agentController.start());
  ipcMain.handle('agent:stop', () => agentController.stop());

  // === Connectivity ===
  ipcMain.handle('app:isOnline', () => require('dns').promises.resolve('google.com').then(() => true).catch(() => false));
}

app.whenReady().then(async () => {
  await initialize();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (agentController) agentController.stop();
  if (syncEngine) syncEngine.stop();
  if (process.platform !== 'darwin') app.quit();
});
