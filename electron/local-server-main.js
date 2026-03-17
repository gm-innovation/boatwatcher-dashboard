const { app, Tray, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setName('Dock Check Local Server');

// --- Robust logging (works even before app is ready) ---
function resolveLogDir() {
  const candidates = [];

  try { candidates.push(app.getPath('userData')); } catch (_) { /* not ready yet */ }

  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'Dock Check Local Server'));
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Dock Check Local Server'));
  }
  candidates.push(os.tmpdir());

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (_) { /* try next */ }
  }
  return os.tmpdir();
}

const LOG_DIR = resolveLogDir();
const LOG_PATH = path.join(LOG_DIR, 'error.log');

function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
  } catch (_) { /* ignore */ }
}

logToFile(`=== BOOT START === PID=${process.pid} argv=${JSON.stringify(process.argv)}`);
logToFile(`Log file location: ${LOG_PATH}`);
logToFile(`app.isPackaged: ${app.isPackaged}, appPath: ${(() => { try { return app.getAppPath(); } catch(e) { return 'N/A'; } })()}`);

// Catch uncaught exceptions early
process.on('uncaughtException', (err) => {
  logToFile(`UNCAUGHT EXCEPTION: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  logToFile(`UNHANDLED REJECTION: ${reason}`);
});

// --- Load server module ---
let startLocalServer;
try {
  startLocalServer = require('../server/index').startLocalServer;
  logToFile('server/index module loaded successfully');
} catch (err) {
  logToFile(`FAILED TO REQUIRE server/index: ${err.stack || err.message}`);
}

let tray = null;
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
    // Also try inside the asar (Electron can read from asar)
    try {
      const appPath = app.getAppPath();
      candidates.push(
        path.join(appPath, 'build', 'icon.png'),
        path.join(appPath, 'public', 'favicon-512.png'),
      );
    } catch (_) { /* ignore */ }
  } else {
    candidates.push(path.join(__dirname, '../public/favicon-512.png'));
  }

  for (const c of candidates) {
    logToFile(`Checking icon: ${c} — exists: ${fs.existsSync(c)}`);
    if (fs.existsSync(c)) return c;
  }

  logToFile('WARNING: No icon found, Tray may fail');
  return candidates[0]; // best-effort
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
      label: 'Abrir pasta de logs',
      click: () => shell.openPath(LOG_DIR),
    },
    {
      label: 'Abrir error.log',
      click: () => shell.openPath(LOG_PATH),
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
  logToFile('App quitting');
  serverRuntime?.stop?.();
});

app.whenReady().then(async () => {
  logToFile('app.whenReady fired');

  try {
    app.setAppUserModelId('com.dockcheck.localserver');
    app.setLoginItemSettings({ openAtLogin: true });

    // Create Tray inside try/catch
    const iconPath = findIcon();
    logToFile(`Creating Tray with icon: ${iconPath}`);
    tray = new Tray(iconPath);
    setTrayMenu('Inicializando...');
    logToFile('Tray created successfully');

    if (!startLocalServer) {
      throw new Error('server/index module failed to load — check error.log');
    }

    await bootLocalServer();
    logToFile('Server started successfully');
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
