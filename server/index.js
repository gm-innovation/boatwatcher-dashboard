const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../electron/database');
const { SyncEngine } = require('../electron/sync');
const { AgentController } = require('../electron/agent');
const { BackupManager } = require('./backup');

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['\"]|['\"]$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadRuntimeEnvironment() {
  const envCandidates = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '../.env'),
    typeof process.resourcesPath === 'string' ? path.join(process.resourcesPath, '.env') : null,
  ].filter(Boolean);

  const visited = new Set();
  for (const candidate of envCandidates) {
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    loadEnvFile(candidate);
  }
}

loadRuntimeEnvironment();

const CLOUD_URL_FALLBACK = 'https://qdscawiwjhzgiqroqkik.supabase.co';
const CLOUD_PUBLISHABLE_KEY_FALLBACK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkc2Nhd2l3amh6Z2lxcm9xa2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMDU0MzIsImV4cCI6MjA4MjU4MTQzMn0.mAafTW0F94MGywqhrf8Q2mhXl4F2btKKGNPSALBLy18';
const DEFAULT_HOST = process.env.BW_HOST || '0.0.0.0';
const DEFAULT_PORT = Number(process.env.BW_PORT || 3001);
const DEFAULT_DATA_DIR = process.env.BW_DATA_DIR || path.join(__dirname, 'data');
const DEFAULT_BACKUP_DIR = process.env.BW_BACKUP_DIR || path.join(__dirname, 'backups');

if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL || CLOUD_URL_FALLBACK;
}

if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || CLOUD_PUBLISHABLE_KEY_FALLBACK;
}

// Routes
const workersRoutes = require('./routes/workers');
const companiesRoutes = require('./routes/companies');
const companyDocumentsRoutes = require('./routes/company-documents');
const workerDocumentsRoutes = require('./routes/worker-documents');
const projectsRoutes = require('./routes/projects');
const accessLogsRoutes = require('./routes/access-logs');
const devicesRoutes = require('./routes/devices');
const jobFunctionsRoutes = require('./routes/job-functions');
const storageRoutes = require('./routes/storage');
const syncRoutes = require('./routes/sync');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createLocalServer(options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  const dataDir = options.dataDir || DEFAULT_DATA_DIR;
  const backupDir = options.backupDir || DEFAULT_BACKUP_DIR;

  ensureDirectory(dataDir);
  ensureDirectory(backupDir);
  ensureDirectory(path.join(dataDir, 'files'));

  const serverApp = express();
  serverApp.use(cors());
  serverApp.use(express.json({ limit: '50mb' }));

  const db = initDatabase(dataDir);
  const syncEngine = new SyncEngine(db);
  syncEngine.start();

  const agentController = new AgentController(db);
  syncEngine.setAgentController(agentController);
  const backupManager = new BackupManager(dataDir, backupDir);
  backupManager.start();

  serverApp.use((req, _res, next) => {
    req.db = db;
    req.syncEngine = syncEngine;
    req.agentController = agentController;
    next();
  });

  serverApp.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      uptime: process.uptime(),
      database: 'connected',
      runtime: {
        host,
        port,
        dataDir,
        backupDir,
        mode: 'dedicated-local-server',
      },
      sync: syncEngine.getStatus(),
      agent: agentController.getStatus(),
    });
  });

  serverApp.use('/api/workers', workersRoutes);
  serverApp.use('/api/companies', companiesRoutes);
  serverApp.use('/api/company-documents', companyDocumentsRoutes);
  serverApp.use('/api/worker-documents', workerDocumentsRoutes);
  serverApp.use('/api/projects', projectsRoutes);
  serverApp.use('/api/access-logs', accessLogsRoutes);
  serverApp.use('/api/devices', devicesRoutes);
  serverApp.use('/api/job-functions', jobFunctionsRoutes);
  serverApp.use('/api/storage', storageRoutes);
  serverApp.use('/api/sync', syncRoutes);
  serverApp.use('/files', express.static(path.join(dataDir, 'files')));

  return {
    app: serverApp,
    db,
    syncEngine,
    agentController,
    backupManager,
    host,
    port,
    dataDir,
    backupDir,
  };
}

function startLocalServer(options = {}) {
  const runtime = createLocalServer(options);
  const server = runtime.app.listen(runtime.port, runtime.host, () => {
    console.log(`[Dock Check Server] Running on http://${runtime.host}:${runtime.port}`);
    console.log(`[Dock Check Server] Data dir: ${runtime.dataDir}`);
    console.log(`[Dock Check Server] Backup dir: ${runtime.backupDir}`);
  });

  const stop = () => {
    runtime.syncEngine.stop();
    runtime.agentController.stop();
    runtime.backupManager.stop();
    if (server.listening) {
      server.close();
    }
  };

  return {
    ...runtime,
    server,
    stop,
  };
}

if (require.main === module) {
  startLocalServer();
}

module.exports = {
  createLocalServer,
  startLocalServer,
};
