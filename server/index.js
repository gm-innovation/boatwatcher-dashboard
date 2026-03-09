const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('../electron/database');
const { SyncEngine } = require('../electron/sync');
const { AgentController } = require('../electron/agent');
const { BackupManager } = require('./backup');

// Routes
const workersRoutes = require('./routes/workers');
const companiesRoutes = require('./routes/companies');
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
app.use('/api/projects', projectsRoutes);
app.use('/api/access-logs', accessLogsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/job-functions', jobFunctionsRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/sync', syncRoutes);

// Serve uploaded files
app.use('/files', express.static(path.join(DATA_DIR, 'files')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BoatWatcher Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[BoatWatcher Server] Data dir: ${DATA_DIR}`);
  console.log(`[BoatWatcher Server] Backup dir: ${BACKUP_DIR}`);
});
