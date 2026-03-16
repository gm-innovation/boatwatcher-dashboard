const https = require('https');
const http = require('http');

const CLOUD_URL = process.env.SUPABASE_URL || '';
const CLOUD_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';

class SyncEngine {
  constructor(db) {
    this.db = db;
    this.interval = null;
    this.status = { online: false, lastSync: null, pendingCount: 0, syncing: false };
    this.listeners = [];
    this.syncIntervalMs = 60000; // 1 minute
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    for (const cb of this.listeners) cb({ ...this.status });
  }

  start() {
    this.interval = setInterval(() => this.checkAndSync(), this.syncIntervalMs);
    // Initial check
    setTimeout(() => this.checkAndSync(), 5000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  getStatus() {
    this.status.pendingCount =
      (this.db.getUnsyncedWorkers?.()?.length || 0) +
      (this.db.getUnsyncedLogs?.()?.length || 0) +
      (this.db.getPendingSyncCount?.() || 0);
    return { ...this.status };
  }

  async checkAndSync() {
    // Check connectivity
    const online = await this.checkConnectivity();
    const wasOffline = !this.status.online;
    this.status.online = online;

    if (!online) {
      this.notifyListeners();
      return;
    }

    // If we just came online or have pending data, sync
    const pendingWorkers = this.db.getUnsyncedWorkers?.() || [];
    const pendingLogs = this.db.getUnsyncedLogs?.() || [];

    if (pendingWorkers.length > 0 || pendingLogs.length > 0 || wasOffline) {
      await this.triggerSync();
    }

    this.notifyListeners();
  }

  async triggerSync() {
    if (this.status.syncing) return;
    this.status.syncing = true;
    this.notifyListeners();

    try {
      // Upload pending logs
      await this.uploadLogs();

      // Upload pending workers
      await this.uploadWorkers();

      // Download updates from cloud
      await this.downloadUpdates();

      this.status.lastSync = new Date().toISOString();
      this.db.setSyncMeta('last_sync', this.status.lastSync);
    } catch (err) {
      console.error('Sync error:', err.message);
    } finally {
      this.status.syncing = false;
      this.notifyListeners();
    }
  }

  async uploadLogs() {
    const logs = this.db.getUnsyncedLogs?.() || [];
    if (logs.length === 0) return;

    const response = await this.callEdgeFunction('agent-sync/upload-logs', 'POST', { logs });
    if (response.success) {
      this.db.markLogsSynced(logs.map(l => l.id));
    }
  }

  async uploadWorkers() {
    const workers = this.db.getUnsyncedWorkers?.() || [];
    if (workers.length === 0) return;

    const response = await this.callEdgeFunction('agent-sync/upload-workers', 'POST', { workers });
    if (response.success && response.mappings) {
      for (const mapping of response.mappings) {
        this.db.markWorkerSynced(mapping.localId, mapping.cloudId);
      }
    }
  }

  async downloadUpdates() {
    const lastSync = this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';

    // Download companies
    try {
      const companiesRes = await this.callEdgeFunction(`agent-sync/download-companies?since=${lastSync}`, 'GET');
      if (companiesRes.companies) {
        for (const company of companiesRes.companies) {
          this.db.upsertCompanyFromCloud(company);
        }
      }
    } catch (e) { console.error('Download companies error:', e.message); }

    // Download projects
    try {
      const projectsRes = await this.callEdgeFunction(`agent-sync/download-projects?since=${lastSync}`, 'GET');
      if (projectsRes.projects) {
        for (const project of projectsRes.projects) {
          this.db.upsertProjectFromCloud(project);
        }
      }
    } catch (e) { console.error('Download projects error:', e.message); }

    // Download workers
    try {
      const workersRes = await this.callEdgeFunction(`agent-sync/download-workers?since=${lastSync}`, 'GET');
      if (workersRes.workers) {
        for (const worker of workersRes.workers) {
          this.db.upsertWorkerFromCloud(worker);
        }
      }
    } catch (e) { console.error('Download workers error:', e.message); }

    this.db.setSyncMeta('last_download', new Date().toISOString());
  }

  async checkConnectivity() {
    return new Promise((resolve) => {
      const req = https.get('https://www.google.com', { timeout: 5000 }, () => resolve(true));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  callEdgeFunction(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${CLOUD_URL}/functions/v1/${path}`);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-agent-token': AGENT_TOKEN,
          'apikey': CLOUD_ANON_KEY,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON response')); }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = { SyncEngine };
