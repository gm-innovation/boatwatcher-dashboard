const https = require('https');
const os = require('os');

class SyncEngine {
  constructor(db) {
    this.db = db;
    this.interval = null;
    this.listeners = [];
    this.syncIntervalMs = 60000;
    this.status = {
      online: false,
      lastSync: null,
      pendingCount: 0,
      syncing: false,
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'cloud-sync' : 'local-only',
      message: this.isConfigured()
        ? 'Sincronização com a nuvem disponível.'
        : 'Sincronização não configurada. Operando apenas localmente.',
    };
  }

  get cloudUrl() {
    return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  }

  get cloudAnonKey() {
    return process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  }

  get agentToken() {
    return process.env.AGENT_TOKEN || this.db.getSyncMeta?.('agent_token') || '';
  }

  isConfigured() {
    return Boolean(this.cloudUrl && this.cloudAnonKey && this.agentToken);
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    for (const cb of this.listeners) cb({ ...this.getStatus() });
  }

  start() {
    this.interval = setInterval(() => this.checkAndSync(), this.syncIntervalMs);
    setTimeout(() => this.checkAndSync(), 5000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  getStatus() {
    const configured = this.isConfigured();
    this.status.pendingCount =
      (this.db.getUnsyncedWorkers?.()?.length || 0) +
      (this.db.getUnsyncedLogs?.()?.length || 0) +
      (this.db.getPendingSyncCount?.() || 0);
    this.status.configured = configured;
    this.status.mode = configured ? 'cloud-sync' : 'local-only';
    this.status.message = configured
      ? (this.status.online ? 'Sincronização online.' : 'Sem conexão com a internet.')
      : 'Sincronização não configurada. Operando apenas localmente.';
    return { ...this.status };
  }

  async bootstrapFromAccessToken(accessToken) {
    if (!this.cloudUrl || !this.cloudAnonKey) {
      throw new Error('Sincronização em nuvem indisponível nesta instalação.');
    }

    // Skip bootstrap if agent_token already exists (configured via Server Local UI)
    const existingToken = this.db.getSyncMeta?.('agent_token');
    if (existingToken) {
      console.log('Bootstrap skipped: agent_token already configured.');
      process.env.AGENT_TOKEN = existingToken;
      this.status.configured = true;
      this.status.mode = 'cloud-sync';
      this.status.message = 'Sincronização já configurada. Usando token existente.';
      this.notifyListeners();
      await this.triggerSync();
      return this.getStatus();
    }

    const response = await this.callAuthenticatedEdgeFunction('agent-sync/bootstrap', 'POST', {
      stationName: os.hostname(),
      platform: process.platform,
      version: process.env.npm_package_version || null,
    }, accessToken);

    if (!response?.success || !response?.token) {
      throw new Error(response?.error || 'Falha ao configurar a sincronização.');
    }

    process.env.AGENT_TOKEN = response.token;
    this.db.setSyncMeta?.('agent_token', response.token);
    this.db.setSyncMeta?.('last_download', '1970-01-01T00:00:00Z');

    this.status.configured = true;
    this.status.mode = 'cloud-sync';
    this.status.message = 'Sincronização configurada. Baixando dados iniciais...';
    this.notifyListeners();

    await this.triggerSync();
    return this.getStatus();
  }

  async checkAndSync() {
    const configured = this.isConfigured();
    this.status.configured = configured;

    if (!configured) {
      this.status.online = false;
      this.status.syncing = false;
      this.notifyListeners();
      return;
    }

    const online = await this.checkConnectivity();
    const wasOffline = !this.status.online;
    this.status.online = online;

    if (!online) {
      this.notifyListeners();
      return;
    }

    await this.sendHeartbeat();

    const pendingWorkers = this.db.getUnsyncedWorkers?.() || [];
    const pendingLogs = this.db.getUnsyncedLogs?.() || [];
    const pendingOperations = this.db.getPendingSyncOperations?.() || [];

    if (pendingWorkers.length > 0 || pendingLogs.length > 0 || pendingOperations.length > 0 || wasOffline) {
      await this.triggerSync();
    }

    this.notifyListeners();
  }

  async triggerSync() {
    if (!this.isConfigured() || this.status.syncing) return;

    this.status.syncing = true;
    this.notifyListeners();

    try {
      await this.uploadQueuedOperations(['company']);
      await this.uploadWorkers();
      await this.uploadQueuedOperations(['user_company', 'company_document', 'worker_document']);
      await this.uploadLogs();
      await this.downloadUpdates();

      this.status.lastSync = new Date().toISOString();
      this.db.setSyncMeta('last_sync', this.status.lastSync);
    } catch (err) {
      console.error('Sync error:', err.message);
      this.status.message = `Erro de sincronização: ${err.message}`;
    } finally {
      this.status.syncing = false;
      this.notifyListeners();
    }
  }

  async uploadQueuedOperations(entityTypes = null) {
    let operations = this.db.getPendingSyncOperations?.() || [];
    if (Array.isArray(entityTypes) && entityTypes.length > 0) {
      operations = operations.filter((operation) => entityTypes.includes(operation.entity_type));
    }
    if (operations.length === 0) return;

    const response = await this.callEdgeFunction('agent-sync/upload-operations', 'POST', { operations });
    if (!response.success || !Array.isArray(response.results)) return;

    for (const result of response.results) {
      if (!result?.queueId) continue;

      if (result.success) {
        if (result.operation === 'delete') {
          this.db.removeSyncQueueEntry?.(result.queueId);
          continue;
        }

        this.db.markSyncEntitySynced?.(result.entityType, result.entityId, result.cloudId || null);
        this.db.removeSyncQueueEntry?.(result.queueId);
      }
    }
  }

  async uploadLogs() {
    const logs = this.db.getUnsyncedLogs?.() || [];
    if (logs.length === 0) return;

    const response = await this.callEdgeFunction('agent-sync/upload-logs', 'POST', { logs });
    if (response.success) {
      this.db.markLogsSynced(logs.map((l) => l.id));
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

    try {
      const companiesRes = await this.callEdgeFunction(`agent-sync/download-companies?since=${lastSync}`, 'GET');
      if (companiesRes.companies) {
        for (const company of companiesRes.companies) {
          this.db.upsertCompanyFromCloud(company);
        }
      }
    } catch (e) { console.error('Download companies error:', e.message); }

    try {
      const userCompaniesRes = await this.callEdgeFunction(`agent-sync/download-user-companies?since=${lastSync}`, 'GET');
      if (userCompaniesRes.user_companies) {
        for (const association of userCompaniesRes.user_companies) {
          this.db.upsertUserCompanyFromCloud(association);
        }
      }
    } catch (e) { console.error('Download user_companies error:', e.message); }

    try {
      const companyDocumentsRes = await this.callEdgeFunction(`agent-sync/download-company-documents?since=${lastSync}`, 'GET');
      if (companyDocumentsRes.company_documents) {
        for (const document of companyDocumentsRes.company_documents) {
          this.db.upsertCompanyDocumentFromCloud(document);
        }
      }
    } catch (e) { console.error('Download company_documents error:', e.message); }

    try {
      const projectsRes = await this.callEdgeFunction(`agent-sync/download-projects?since=${lastSync}`, 'GET');
      if (projectsRes.projects) {
        for (const project of projectsRes.projects) {
          this.db.upsertProjectFromCloud(project);
        }
      }
    } catch (e) { console.error('Download projects error:', e.message); }

    try {
      const workersRes = await this.callEdgeFunction(`agent-sync/download-workers?since=${lastSync}`, 'GET');
      if (workersRes.workers) {
        for (const worker of workersRes.workers) {
          this.db.upsertWorkerFromCloud(worker);
          if (worker.photo_signed_url) {
            await this.autoEnrollWorkerPhoto(worker);
          }
        }
      }
    } catch (e) { console.error('Download workers error:', e.message); }

    try {
      const workerDocumentsRes = await this.callEdgeFunction(`agent-sync/download-worker-documents?since=${lastSync}`, 'GET');
      if (workerDocumentsRes.worker_documents) {
        for (const document of workerDocumentsRes.worker_documents) {
          this.db.upsertWorkerDocumentFromCloud(document);
        }
      }
    } catch (e) { console.error('Download worker_documents error:', e.message); }

    this.db.setSyncMeta('last_download', new Date().toISOString());
  }

  async sendHeartbeat() {
    try {
      await this.callEdgeFunction('agent-sync/status', 'POST', {
        version: process.env.npm_package_version || '1.0.0',
        sync_status: this.status.syncing ? 'syncing' : 'idle',
        pending_count: this.status.pendingCount,
      });
    } catch (err) {
      console.error('Heartbeat error:', err.message);
    }
  }

  async autoEnrollWorkerPhoto(worker) {
    const devicesEnrolled = Array.isArray(worker.devices_enrolled) ? worker.devices_enrolled : [];
    if (devicesEnrolled.length === 0) return;

    let photoBase64 = null;
    try {
      const photoBuffer = await new Promise((resolve, reject) => {
        const url = new URL(worker.photo_signed_url);
        const mod = url.protocol === 'https:' ? https : require('http');
        const req = mod.get(worker.photo_signed_url, { timeout: 15000 }, (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      });
      photoBase64 = photoBuffer.toString('base64');
    } catch (err) {
      console.error(`Auto-enroll photo download failed for worker ${worker.id}:`, err.message);
      return;
    }

    if (!photoBase64) return;

    const { enrollUserOnDevice } = require('../server/lib/controlid');

    for (const deviceId of devicesEnrolled) {
      const device = this.db.getDeviceById?.(deviceId);
      if (!device || !device.controlid_ip_address) continue;

      try {
        // Pass full worker object — enrollUserOnDevice uses worker.code as ControlID integer ID
        const result = await enrollUserOnDevice(device, worker, photoBase64);
        if (result.success) {
          console.log(`Auto-enrolled worker ${worker.name} (code=${worker.code}) on device ${device.name}`);
        } else {
          console.warn(`Auto-enroll warning for ${worker.name} on ${device.name}:`, result.warning || result.error);
        }
      } catch (err) {
        console.error(`Auto-enroll failed for ${worker.name} on ${device.name}:`, err.message);
      }
    }
  }

  async checkConnectivity() {
    if (!this.cloudUrl || !this.cloudAnonKey) return false;

    return new Promise((resolve) => {
      const req = https.get('https://www.google.com', { timeout: 5000 }, () => resolve(true));
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  callEdgeFunction(path, method = 'GET', body = null) {
    if (!this.isConfigured()) {
      return Promise.reject(new Error('Sync not configured'));
    }

    return this.callFunction(path, method, body, {
      'x-agent-token': this.agentToken,
    });
  }

  callAuthenticatedEdgeFunction(path, method = 'GET', body = null, accessToken = '') {
    if (!this.cloudUrl || !this.cloudAnonKey) {
      return Promise.reject(new Error('Cloud sync unavailable'));
    }

    return this.callFunction(path, method, body, {
      Authorization: `Bearer ${accessToken}`,
    });
  }

  callFunction(path, method = 'GET', body = null, extraHeaders = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.cloudUrl}/functions/v1/${path}`);
      const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.cloudAnonKey,
          ...extraHeaders,
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}

module.exports = { SyncEngine };
