const { app, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function logToFile(message) {
  try {
    const logPath = path.join(app.getPath('userData'), 'error.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (_) { /* ignore */ }
}

// Catch uncaught exceptions early
process.on('uncaughtException', (err) => {
  logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
});

let startLocalServer;
try {
  startLocalServer = require('../server/index').startLocalServer;
} catch (err) {
  logToFile(`FAILED TO REQUIRE server/index: ${err.stack || err.message}`);
}

let tray = null;
let serverRuntime = null;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function ensureRuntimeDirectories() {
  const userDataPath = app.getPath('userData');

  process.env.BW_HOST = process.env.BW_HOST || '0.0.0.0';
  process.env.BW_PORT = process.env.BW_PORT || '3001';
  process.env.BW_DATA_DIR = process.env.BW_DATA_DIR || path.join(userDataPath, 'data');
  process.env.BW_BACKUP_DIR = process.env.BW_BACKUP_DIR || path.join(userDataPath, 'backups');

  fs.mkdirSync(process.env.BW_DATA_DIR, { recursive: true });
  fs.mkdirSync(process.env.BW_BACKUP_DIR, { recursive: true });
}

function getTrayIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'build', 'icon.png')
    : path.join(__dirname, '../public/favicon-512.png');
}

function setTrayMenu(statusText) {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    { label: statusText, enabled: false },
    { type: 'separator' },
    {
      label: 'Abrir pasta de dados',
      click: () => shell.openPath(process.env.BW_DATA_DIR || ''),
    },
    {
      label: 'Abrir pasta de backups',
      click: () => shell.openPath(process.env.BW_BACKUP_DIR || ''),
    },
    { type: 'separator' },
    {
      label: 'Encerrar servidor local',
      click: () => app.quit(),
    },
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

  const statusText = `Online em http://${serverRuntime.host}:${serverRuntime.port}`;
  setTrayMenu(statusText);
}

app.on('second-instance', () => {
  if (tray) {
    tray.popUpContextMenu();
  }
});

app.on('before-quit', () => {
  serverRuntime?.stop?.();
});

app.whenReady().then(async () => {
  app.setAppUserModelId('com.dockcheck.localserver');
  app.setLoginItemSettings({ openAtLogin: true });

  tray = new Tray(getTrayIconPath());
  setTrayMenu('Inicializando...');

  try {
    if (!startLocalServer) throw new Error('server/index module failed to load — check error.log');
    await bootLocalServer();
    logToFile('Server started successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao iniciar o servidor local.';
    logToFile(`BOOT ERROR: ${message}`);
    dialog.showErrorBox('Dock Check Local Server', message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Tray-only app — do not quit when no windows are open
});
