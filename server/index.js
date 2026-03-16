const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../electron/database');
const { SyncEngine } = require('../electron/sync');
const { AgentController } = require('../electron/agent');
const { BackupManager } = require('./backup');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

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

loadEnvFile(path.join(__dirname, '../.env'));

if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}

if (!process.env.SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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

const PORT = process.env.BW_PORT || 3001;
const DATA_DIR = process.env.BW_DATA_DIR || path.join(__dirname, 'data');
const BACKUP_DIR = process.env.BW_BACKUP_DIR || path.join(__dirname, 'backups');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize database
const db = initDatabase(DATA_DIR);

// Initialize sync engine
const syncEngine = new SyncEngine(db);
syncEngine.start();

// Initialize ControlID agent
const agentController = new AgentController(db);

// Initialize backup manager
const backupManager = new BackupManager(DATA_DIR, BACKUP_DIR);
backupManager.start();

// Attach db to request for route handlers
app.use((req, res, next) => {
  req.db = db;
  req.syncEngine = syncEngine;
  req.agentController = agentController;
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    database: 'connected',
    sync: syncEngine.getStatus(),
    agent: agentController.getStatus(),
  });
});

// Routes
app.use('/api/workers', workersRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/company-documents', companyDocumentsRoutes);
app.use('/api/worker-documents', workerDocumentsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/access-logs', accessLogsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/job-functions', jobFunctionsRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/sync', syncRoutes);

// Serve uploaded files
app.use('/files', express.static(path.join(DATA_DIR, 'files')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Dock Check Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Dock Check Server] Data dir: ${DATA_DIR}`);
  console.log(`[Dock Check Server] Backup dir: ${BACKUP_DIR}`);
});
