const https = require('https');
const os = require('os');

class SyncEngine {
  constructor(db) {
    this.db = db;
    this.interval = null;
    this.listeners = [];
    this.syncIntervalMs = 60000;
    this.agentController = null;
    this._fastLaneTimer = null;
    this._fastLaneThrottleMs = 3000; // min 3s between fast-lane syncs
    this._lastFastLane = 0;
    this._lastUploadLogsError = null;
    this._lastDownloadLogsError = null;
    this._uploadLogsCount = 0;
    this._downloadLogsCount = 0;
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

  setAgentController(controller) {
    this.agentController = controller;
  }

  /**
   * Fast-lane: called when the agent captures a new access event.
   * Debounces to avoid flooding, then uploads logs immediately.
   */
  triggerFastLaneSync() {
    if (!this.isConfigured()) return;

    const now = Date.now();
    const elapsed = now - this._lastFastLane;

    if (this._fastLaneTimer) clearTimeout(this._fastLaneTimer);

    const delay = elapsed >= this._fastLaneThrottleMs ? 500 : this._fastLaneThrottleMs - elapsed + 100;

    this._fastLaneTimer = setTimeout(async () => {
      this._lastFastLane = Date.now();
      try {
        const online = await this.checkConnectivity();
        if (!online) return;
        await this.uploadLogs();
        console.log('[sync] Fast-lane upload completed');
      } catch (err) {
        console.error('[sync] Fast-lane error:', err.message);
      }
    }, delay);
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

    // Dedicated high-frequency command polling loop (every 5s)
    this.commandPollInterval = setInterval(() => this.pollCommands(), 5000);
    // First poll after 3s (before full sync completes)
    setTimeout(() => this.pollCommands(), 3000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    if (this.commandPollInterval) clearInterval(this.commandPollInterval);
  }

  /** Fast command polling — independent from the 60s sync cycle */
  async pollCommands() {
    if (!this.isConfigured() || this._isProcessingCommands) return;

    const online = await this.checkConnectivity();
    if (!online) return;

    this._isProcessingCommands = true;
    try {
      await this.downloadAndExecuteCommands();
    } catch (err) {
      console.error('[command-poll] Error:', err.message);
    } finally {
      this._isProcessingCommands = false;
    }
  }

  getStatus() {
    const configured = this.isConfigured();
    const unsyncedLogs = this.db.getUnsyncedLogs?.()?.length || 0;
    this.status.pendingCount =
      (this.db.getUnsyncedWorkers?.()?.length || 0) +
      unsyncedLogs +
      (this.db.getPendingSyncCount?.() || 0);
    this.status.configured = configured;
    this.status.mode = configured ? 'cloud-sync' : 'local-only';
    this.status.message = configured
      ? (this.status.online ? 'Sincronização online.' : 'Sem conexão com a internet.')
      : 'Sincronização não configurada. Operando apenas localmente.';

    // Unsynced logs diagnostics (queue age/range)
    let unsyncedDiag = null;
    try {
      unsyncedDiag = this.db.getUnsyncedLogsDiagnostics?.() || null;
    } catch { /* ignore */ }

    return {
      ...this.status,
      unsyncedLogsCount: unsyncedLogs,
      unsyncedLogsDiagnostics: unsyncedDiag,
      uploadLogsCount: this._uploadLogsCount,
      downloadLogsCount: this._downloadLogsCount,
      lastUploadLogsError: this._lastUploadLogsError,
      lastDownloadLogsError: this._lastDownloadLogsError,
    };
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

    // Always trigger sync when online — the sync is idempotent
    // (checkpoints prevent re-downloading unchanged data).
    // Previously this only ran when there were pending local changes,
    // which caused downloads (workers, devices, companies) to stop
    // entirely when the agent wasn't capturing events locally.
    await this.triggerSync();

    this.notifyListeners();
  }

  async triggerSync() {
    if (!this.isConfigured() || this.status.syncing) return;

    this.status.syncing = true;
    this._reverseSyncCycleCount = (this._reverseSyncCycleCount || 0) + 1;
    this.notifyListeners();

    try {
      await this.uploadQueuedOperations(['company']);
      await this.uploadWorkers();
      await this.uploadQueuedOperations(['user_company', 'company_document', 'worker_document']);
      await this.uploadLogs();
      await this.downloadUpdates();
      await this.downloadAccessLogs();
      await this.downloadAndExecuteCommands();
      await this.uploadLogs();
      await this.downloadUpdates();

      // Reverse sync: import workers from devices → cloud (every cycle ≈ 60s)
      // DISABLED during recovery: reverse sync is paused when reverse_sync_paused flag is set
      // to prevent contamination from dirty devices overwriting correct cloud data.
      const reverseSyncPaused = this.db.getSyncMeta?.('reverse_sync_paused');
      if (reverseSyncPaused === 'true') {
        if (this._reverseSyncCycleCount % 10 === 0) {
          console.log('[sync] reverseSync PAUSED (reverse_sync_paused=true). Skipping to prevent device contamination.');
        }
      } else {
        await this.reverseSync().catch(err => console.error('[sync] reverseSync error:', err.message));
      }

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

  /**
   * Reverse Sync: import workers registered directly on ControlID devices
   * back into the cloud database. Runs isolated — errors here never affect
   * the main sync cycle.
   */
  async reverseSync() {
    const { listDeviceUsers, listDeviceUserImages, getDeviceUserImage } = require('../server/lib/controlid');

    // Get all known worker codes from local DB for fast filtering
    const knownCodes = this.db.getWorkerCodes?.() || new Set();

    // Get all devices from local DB
    const devices = this.db.getDevices?.() || [];
    if (devices.length === 0) return;

    const newWorkers = [];

    for (const device of devices) {
      if (!device.controlid_ip_address) continue;

      try {
        // Step 1: Get all users from device
        const deviceUsers = await listDeviceUsers(device);
        if (!Array.isArray(deviceUsers) || deviceUsers.length === 0) continue;

        // Step 2: Filter unknown users (not in our DB by code)
        const unknownUsers = deviceUsers.filter(u => !knownCodes.has(Number(u.id)));
        if (unknownUsers.length === 0) continue;

        console.log(`[reverse-sync] Device ${device.name}: ${unknownUsers.length} unknown users found`);

        // Step 3: Get list of users with photos
        let userIdsWithPhoto = new Set();
        try {
          const photoIds = await listDeviceUserImages(device);
          userIdsWithPhoto = new Set(photoIds.map(Number));
        } catch (err) {
          console.warn(`[reverse-sync] Could not list images from ${device.name}: ${err.message}`);
        }

        // Step 4: For each unknown user, optionally download photo
        for (const user of unknownUsers) {
          const userId = Number(user.id);
          let photoBase64 = null;

          if (userIdsWithPhoto.has(userId)) {
            try {
              const imageBuffer = await getDeviceUserImage(device, userId);
              photoBase64 = imageBuffer.toString('base64');
            } catch (err) {
              console.warn(`[reverse-sync] Photo download failed for user ${userId} on ${device.name}: ${err.message}`);
            }
          }

          newWorkers.push({
            code: userId,
            name: user.name || `Usuário ${userId}`,
            registration: user.registration || null,
            photo_base64: photoBase64,
            source_device_id: device.id,
            source_device_name: device.name,
          });
        }
      } catch (err) {
        console.warn(`[reverse-sync] Error reading device ${device.name}: ${err.message}`);
      }
    }

    if (newWorkers.length === 0) {
      console.log('[reverse-sync] No new workers to import');
      return;
    }

    console.log(`[reverse-sync] Uploading ${newWorkers.length} new workers to cloud...`);

    try {
      const response = await this.callEdgeFunction('agent-sync/reverse-sync-workers', 'POST', {
        workers: newWorkers,
      });

      if (response.success) {
        console.log(`[reverse-sync] Imported ${response.imported || 0} workers, skipped ${response.skipped || 0}`);
        // After successful import, trigger a download to get the new workers into local DB
        if (response.imported > 0) {
          this.db.setSyncMeta?.('last_download_workers', '1970-01-01T00:00:00Z');
        }
      } else {
        console.warn('[reverse-sync] Cloud rejected import:', response.error || 'unknown error');
      }
    } catch (err) {
      console.error('[reverse-sync] Upload to cloud failed:', err.message);
    }
  }

  async resetAndFullSync() {
    // Reset all download checkpoints to epoch
    const checkpoints = [
      'last_download', 'last_download_companies', 'last_download_projects',
      'last_download_devices', 'last_download_workers', 'last_download_user_companies',
      'last_download_company_documents', 'last_download_worker_documents',
      'last_download_access_logs',
    ];
    for (const key of checkpoints) {
      this.db.setSyncMeta?.(key, '1970-01-01T00:00:00Z');
    }
    console.log('[sync] All checkpoints reset to epoch. Starting full sync...');
    await this.triggerSync();
    return this.getStatus();
  }

  /**
   * Execute cursor alignment: set each device's lastEventId to the max event on hardware,
   * then clear stale unsynced logs. Called locally or via remote cloud signaling.
   */
  async executeAlignCursors(agentId) {
    const { loginToDevice } = require('../server/lib/controlid');

    const devices = this.db.getDevices?.() || [];
    const results = [];

    for (const device of devices) {
      if (!device.controlid_ip_address) continue;
      try {
        const session = await loginToDevice(device);
        const maxId = await this.agentController?.fetchMaxEventId?.(device, session, this.agentController.parseApiCredentials?.(device.api_credentials));
        const currentCursor = this.agentController?.getLastEventId?.(device) || 0;
        if (maxId != null && maxId > 0) {
          this.agentController?.setLastEventId?.(device, maxId);
          results.push({ device: device.name, previousCursor: currentCursor, newCursor: maxId, status: 'aligned' });
        } else {
          results.push({ device: device.name, previousCursor: currentCursor, status: 'no_max_id' });
        }
      } catch (err) {
        results.push({ device: device.name, status: 'error', error: err.message });
      }
    }

    const cleared = this.db.markAllLogsSynced?.() || 0;
    console.log(`[sync] Cursor alignment complete: ${results.length} devices processed, ${cleared} stale logs cleared`);

    // Clear the remote flag
    if (agentId) {
      try {
        await this.callEdgeFunction('agent-sync/clear-align-flag', 'POST', { agentId });
      } catch (err) {
        // Fallback: try to clear via download-devices next cycle
        console.warn('[sync] Could not clear align flag:', err.message);
      }
    }

    return { results, staleLogsCleared: cleared };
  }

  async uploadOperations(entityTypes) {
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
    const rawLogs = this.db.getUnsyncedLogs?.() || [];
    if (rawLogs.length === 0) return;

    // Sanitize: remove SQLite-internal fields and ensure canonical ENUM values
    const VALID_ACCESS_STATUS = ['granted', 'denied'];
    const VALID_DIRECTION = ['entry', 'exit', 'unknown'];

    const logs = rawLogs.map(({ synced, created_at, cloud_id, ...rest }) => ({
      ...rest,
      access_status: VALID_ACCESS_STATUS.includes(rest.access_status) ? rest.access_status : 'granted',
      direction: VALID_DIRECTION.includes(rest.direction) ? rest.direction : 'unknown',
    }));

    // Keep local IDs for marking as synced after success
    const localIds = rawLogs.map((l) => l.id);

    // Telemetry: log batch timestamp range for debugging backlog replay
    const timestamps = rawLogs.map(l => l.timestamp).filter(Boolean).sort();
    const batchMinTs = timestamps[0] || 'N/A';
    const batchMaxTs = timestamps[timestamps.length - 1] || 'N/A';
    console.log(`[sync] Upload batch: count=${logs.length} ts_range=[${batchMinTs} → ${batchMaxTs}] token=${this.agentToken?.slice(0,8)}...`);

    try {
      const response = await this.callEdgeFunction('agent-sync/upload-logs', 'POST', { logs });
      if (response.success) {
        this.db.markLogsSynced(localIds);
        this._uploadLogsCount += logs.length;
        this._lastUploadLogsError = null;
        console.log(`[sync] Uploaded ${logs.length} access logs successfully`);
      } else {
        const errDetail = response.error || response.message || JSON.stringify(response);
        this._lastUploadLogsError = `${new Date().toISOString()}: server returned success=false — ${errDetail}`;
        console.error('[sync] Upload logs rejected by server:', errDetail);
      }
    } catch (err) {
      // Retry on 401: reload token from sync_meta and try once more
      if (err.message && err.message.includes('401')) {
        console.warn(`[sync] Upload logs got 401 — attempting token reload and retry...`);
        const storedToken = this.db.getSyncMeta?.('agent_token');
        if (storedToken && storedToken !== process.env.AGENT_TOKEN) {
          console.log(`[sync] Token mismatch detected: env=${process.env.AGENT_TOKEN?.slice(0,8)}... db=${storedToken.slice(0,8)}... — syncing`);
          process.env.AGENT_TOKEN = storedToken;
        }
        try {
          const retryResponse = await this.callEdgeFunction('agent-sync/upload-logs', 'POST', { logs });
          if (retryResponse.success) {
            this.db.markLogsSynced(localIds);
            this._uploadLogsCount += logs.length;
            this._lastUploadLogsError = null;
            console.log(`[sync] Retry succeeded: uploaded ${logs.length} access logs`);
            return;
          }
        } catch (retryErr) {
          console.error('[sync] Retry also failed:', retryErr.message);
        }
      }
      this._lastUploadLogsError = `${new Date().toISOString()}: ${err.message}`;
      console.error('[sync] Upload logs error:', err.message);
    }
  }

  async downloadAccessLogs() {
    try {
      const since = this.db.getSyncMeta('last_download_access_logs') || '1970-01-01T00:00:00Z';
      const response = await this.callEdgeFunction(`agent-sync/download-access-logs?since=${encodeURIComponent(since)}`, 'GET');
      if (response.access_logs && Array.isArray(response.access_logs)) {
        let count = 0;
        let maxCreatedAt = since;
        for (const log of response.access_logs) {
          try {
            this.db.upsertAccessLogFromCloud?.(log);
            count++;
            // Track the latest created_at to enable incremental pagination
            if (log.created_at && log.created_at > maxCreatedAt) {
              maxCreatedAt = log.created_at;
            }
          } catch (err) {
            console.error(`[sync] access_log upsert failed for ${log.id}:`, err.message);
          }
        }
        if (count > 0) {
          this._downloadLogsCount += count;
          console.log(`[sync] Downloaded ${count} access logs from cloud`);
        }
        this._lastDownloadLogsError = null;
        // Use the last record's created_at instead of now() to support pagination
        // for datasets larger than the 500-row limit per request
        this.db.setSyncMeta('last_download_access_logs', maxCreatedAt);
      }
    } catch (err) {
      this._lastDownloadLogsError = `${new Date().toISOString()}: ${err.message}`;
      console.error('[sync] Download access logs error:', err.message);
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
    // Use per-stage checkpoints for resilience — if one stage fails, others aren't skipped
    let allSucceeded = true;

    // Companies
    try {
      const since = this.db.getSyncMeta('last_download_companies') || this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';
      const companiesRes = await this.callEdgeFunction(`agent-sync/download-companies?since=${since}`, 'GET');
      if (companiesRes.companies) {
        for (const company of companiesRes.companies) {
          this.db.upsertCompanyFromCloud(company);
        }
        console.log(`[sync] Downloaded ${companiesRes.companies.length} companies`);
      }
      this.db.setSyncMeta('last_download_companies', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download companies error:', e.message);
      allSucceeded = false;
    }

    // User Companies
    try {
      const since = this.db.getSyncMeta('last_download_user_companies') || this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';
      const userCompaniesRes = await this.callEdgeFunction(`agent-sync/download-user-companies?since=${since}`, 'GET');
      if (userCompaniesRes.user_companies) {
        for (const association of userCompaniesRes.user_companies) {
          try {
            this.db.upsertUserCompanyFromCloud(association);
          } catch (err) {
            console.error(`[sync] user_company upsert failed for ${association.id}:`, err.message);
          }
        }
        console.log(`[sync] Downloaded ${userCompaniesRes.user_companies.length} user_companies`);
      }
      this.db.setSyncMeta('last_download_user_companies', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download user_companies error:', e.message);
      allSucceeded = false;
    }

    // Company Documents
    try {
      const since = this.db.getSyncMeta('last_download_company_documents') || this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';
      const companyDocumentsRes = await this.callEdgeFunction(`agent-sync/download-company-documents?since=${since}`, 'GET');
      if (companyDocumentsRes.company_documents) {
        for (const document of companyDocumentsRes.company_documents) {
          try {
            this.db.upsertCompanyDocumentFromCloud(document);
          } catch (err) {
            console.error(`[sync] company_document upsert failed for ${document.id}:`, err.message);
          }
        }
        console.log(`[sync] Downloaded ${companyDocumentsRes.company_documents.length} company_documents`);
      }
      this.db.setSyncMeta('last_download_company_documents', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download company_documents error:', e.message);
      allSucceeded = false;
    }

    // Projects
    try {
      const since = this.db.getSyncMeta('last_download_projects') || this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';
      const projectsRes = await this.callEdgeFunction(`agent-sync/download-projects?since=${since}`, 'GET');
      if (projectsRes.projects) {
        for (const project of projectsRes.projects) {
          this.db.upsertProjectFromCloud(project);
        }
        console.log(`[sync] Downloaded ${projectsRes.projects.length} projects`);
      }
      this.db.setSyncMeta('last_download_projects', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download projects error:', e.message);
      allSucceeded = false;
    }

    // Devices — NEW: download devices in every sync cycle
    try {
      const devicesRes = await this.callEdgeFunction('agent-sync/download-devices', 'GET');
      if (devicesRes.devices) {
        for (const device of devicesRes.devices) {
          this.db.upsertDeviceFromCloud?.(device);
        }
        console.log(`[sync] Downloaded ${devicesRes.devices.length} devices`);
        // Reload agent controller to pick up new/changed devices
        this.agentController?.reloadDevices?.();
      }
      // Save agent/project info if available
      if (devicesRes.agent) {
        this.db.setSyncMeta?.('agent_name', devicesRes.agent.name || '');
        this.db.setSyncMeta?.('project_name', devicesRes.agent.project_name || '');

        // Check for remote align_cursors_requested signal
        const agentConfig = devicesRes.agent.configuration || {};
        if (agentConfig.align_cursors_requested === true) {
          console.log('[sync] Remote align_cursors_requested detected — executing alignment...');
          await this.executeAlignCursors(devicesRes.agent.id);
        }
      }
      this.db.setSyncMeta('last_download_devices', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download devices error:', e.message);
      allSucceeded = false;
    }

    // Workers
    try {
      const since = this.db.getSyncMeta('last_download_workers') || this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';
      const workersRes = await this.callEdgeFunction(`agent-sync/download-workers?since=${since}`, 'GET');
      if (workersRes.workers) {
        for (const worker of workersRes.workers) {
          try {
            this.db.upsertWorkerFromCloud(worker);
            // Skip auto-enrollment during bulk download or in read-only mode
            const isReadOnly = this.db.getSyncMeta?.('read_only_mode') === 'true';
            if (!this._bulkDownloadMode && !isReadOnly && worker.photo_signed_url) {
              await this.autoEnrollWorkerPhoto(worker);
            }
          } catch (workerErr) {
            console.error(`[sync] Worker upsert failed for ${worker.id}:`, workerErr.message);
          }
        }
        console.log(`[sync] Downloaded ${workersRes.workers.length} workers`);
      }
      this.db.setSyncMeta('last_download_workers', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download workers error:', e.message);
      allSucceeded = false;
    }

    // Worker Documents
    try {
      const since = this.db.getSyncMeta('last_download_worker_documents') || this.db.getSyncMeta('last_download') || '1970-01-01T00:00:00Z';
      const workerDocumentsRes = await this.callEdgeFunction(`agent-sync/download-worker-documents?since=${since}`, 'GET');
      if (workerDocumentsRes.worker_documents) {
        for (const document of workerDocumentsRes.worker_documents) {
          try {
            this.db.upsertWorkerDocumentFromCloud(document);
          } catch (err) {
            console.error(`[sync] worker_document upsert failed for ${document.id}:`, err.message);
          }
        }
        console.log(`[sync] Downloaded ${workerDocumentsRes.worker_documents.length} worker_documents`);
      }
      this.db.setSyncMeta('last_download_worker_documents', new Date().toISOString());
    } catch (e) {
      console.error('[sync] Download worker_documents error:', e.message);
      allSucceeded = false;
    }

    // Manual Access Points
    try {
      const manualRes = await this.callEdgeFunction('agent-sync/download-manual-access-points', 'GET');
      if (manualRes.manual_access_points) {
        for (const point of manualRes.manual_access_points) {
          try {
            this.db.upsertManualAccessPointFromCloud?.(point);
          } catch (err) {
            console.error(`[sync] manual_access_point upsert failed for ${point.id}:`, err.message);
          }
        }
        console.log(`[sync] Downloaded ${manualRes.manual_access_points.length} manual_access_points`);

        // If manual points exist but we haven't done a full re-sync yet, reset access logs checkpoint
        if (manualRes.manual_access_points.length > 0) {
          const hadManualBefore = this.db.getSyncMeta?.('has_manual_points');
          if (!hadManualBefore) {
            this.db.setSyncMeta?.('has_manual_points', 'true');
            this.db.setSyncMeta?.('last_download_access_logs', '1970-01-01T00:00:00Z');
            console.log('[sync] Manual access points detected — resetting access logs checkpoint for full re-download');
          }
          // Also check if we still have pending batches (pagination not yet complete)
          const currentCheckpoint = this.db.getSyncMeta?.('last_download_access_logs') || '';
          if (currentCheckpoint && currentCheckpoint < new Date(Date.now() - 60000).toISOString()) {
            console.log('[sync] Access logs checkpoint is behind — will continue pagination on next cycle');
          }
        }
      }
    } catch (e) {
      console.error('[sync] Download manual_access_points error:', e.message);
      allSucceeded = false;
    }

    // Only update the global checkpoint if all stages succeeded
    if (allSucceeded) {
      this.db.setSyncMeta('last_download', new Date().toISOString());
    } else {
      console.warn('[sync] Some download stages failed — global checkpoint NOT advanced');
    }
  }

  async sendHeartbeat() {
    try {
      let devices = this.agentController?.getDeviceConnectivityReport?.() || [];

      // If report is empty but agent has devices, force reload and retry
      if (devices.length === 0 && this.agentController) {
        const reloaded = this.agentController.reloadDevices?.() || [];
        if (reloaded.length > 0) {
          devices = this.agentController.getDeviceConnectivityReport?.() || [];
        }
      }

      // Normalize serial numbers
      devices = devices.map(d => ({
        ...d,
        serial_number: (d.serial_number || '').trim(),
      })).filter(d => d.serial_number);

      console.log(`[sync] Heartbeat: devices_sent=${devices.length}`);

      // Collect device telemetry (lastError, lastPollAt, lastEventPayload) for cloud diagnostics
      const deviceTelemetry = this.agentController?.getStatus?.()?.devices || null;

      // Collect pipeline metrics for remote diagnostics
      const agentStatus = this.agentController?.getStatus?.() || {};
      const unsyncedLogs = this.db.getUnsyncedLogs?.() || [];
      const unsyncedDiag = this.db.getUnsyncedLogsDiagnostics?.() || {};
      const pipelineMetrics = {
        capturedEventsCount: agentStatus.capturedEventsCount || 0,
        ignoredInvalidCount: agentStatus.ignoredInvalidCount || 0,
        ignoredDedupeCount: agentStatus.ignoredDedupeCount || 0,
        lastCapturedAt: agentStatus.lastCapturedAt || null,
        lastIgnoreReason: agentStatus.lastIgnoreReason || null,
        unsyncedLogsCount: unsyncedDiag.count || unsyncedLogs.length,
        unsyncedMinTimestamp: unsyncedDiag.min_ts || null,
        unsyncedMaxTimestamp: unsyncedDiag.max_ts || null,
        uploadLogsCount: this._uploadLogsCount,
        lastUploadLogsError: this._lastUploadLogsError,
      };

      await this.callEdgeFunction('agent-sync/status', 'POST', {
        heartbeatSchemaVersion: 2,
        version: (() => { try { return require('../server/package.json').version; } catch { try { return require('./package.json').version; } catch { return '1.3.0'; } } })(),
        sync_status: this.status.syncing ? 'syncing' : 'idle',
        pending_count: this.status.pendingCount,
        devices,
        deviceTelemetry,
        pipelineMetrics,
      });
    } catch (err) {
      console.error('Heartbeat error:', err.message);
    }
  }

  async autoEnrollWorkerPhoto(worker) {
    let devicesEnrolled = Array.isArray(worker.devices_enrolled) ? worker.devices_enrolled : [];

    // Fallback: if devices_enrolled is empty, auto-enroll in ALL project devices
    if (devicesEnrolled.length === 0) {
      const projectDeviceIds = this.db.getProjectDeviceIds?.() || [];
      if (projectDeviceIds.length === 0) return;
      devicesEnrolled = projectDeviceIds;
      console.log(`[auto-enroll] Worker ${worker.name} (code=${worker.code}) has no devices_enrolled — using all ${projectDeviceIds.length} project device(s)`);
    }

    let photoBase64 = null;
    if (worker.photo_signed_url) {
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
        console.warn(`[auto-enroll] Photo download failed for worker ${worker.name} (code=${worker.code}): ${err.message} — enrolling without photo`);
      }
    }

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

  async downloadAndExecuteCommands() {
    try {
      const response = await this.callEdgeFunction('agent-sync/download-commands', 'GET');
      const commands = response?.commands || [];
      if (commands.length === 0) return;

      console.log(`[commands] Claimed ${commands.length} command(s) (remaining: ${response.remainingPending ?? '?'})`);
      const { enrollUserOnDevice, removeUserFromDevice, loadPhotoAsBase64 } = require('../server/lib/controlid');

      // Group commands by device for parallel-per-device, serial-within-device execution
      const deviceGroups = new Map();
      for (const cmd of commands) {
        const group = deviceGroups.get(cmd.device_id) || [];
        group.push(cmd);
        deviceGroups.set(cmd.device_id, group);
      }

      // Photo cache: avoid downloading the same photo multiple times in a batch
      const photoCache = new Map();

      const isReadOnly = this.db.getSyncMeta?.('read_only_mode') === 'true';

      const processDeviceCommands = async (deviceCmds) => {
        for (const cmd of deviceCmds) {
          const resultPayload = { command_id: cmd.id, status: 'completed', result: null, error_message: null };

          try {
            // In read-only mode, skip hardware-write commands
            if (isReadOnly && (cmd.command === 'enroll_worker' || cmd.command === 'remove_worker')) {
              console.log(`[commands] SKIPPED ${cmd.command} (read-only mode active)`);
              resultPayload.status = 'skipped';
              resultPayload.error_message = 'Modo somente-leitura ativo — comando ignorado.';
              try {
                await this.callEdgeFunction('agent-sync/upload-command-result', 'POST', resultPayload);
              } catch {}
              continue;
            }

            const device = this.db.getDeviceById?.(cmd.device_id);
            if (!device || !device.controlid_ip_address) {
              throw new Error(`Dispositivo ${cmd.device_id} não encontrado ou sem IP.`);
            }

            const payload = cmd.payload || {};

            if (cmd.command === 'enroll_worker') {
              let photoBase64 = null;
              if (payload.photo_url) {
                if (photoCache.has(payload.photo_url)) {
                  photoBase64 = photoCache.get(payload.photo_url);
                } else {
                  try {
                    photoBase64 = await loadPhotoAsBase64(payload.photo_url);
                    photoCache.set(payload.photo_url, photoBase64);
                  } catch (photoErr) {
                    console.warn(`[commands] Photo download failed for ${payload.worker_name}: ${photoErr.message}`);
                  }
                }
              }

              const workerObj = {
                id: payload.worker_id,
                name: payload.worker_name,
                code: payload.worker_code,
                photo_url: payload.photo_url,
              };

              const enrollResult = await enrollUserOnDevice(device, workerObj, photoBase64);
              if (!enrollResult.success) {
                throw new Error(enrollResult.error || enrollResult.warning || 'Enrollment failed');
              }
              resultPayload.result = enrollResult;
              console.log(`[commands] Enrolled worker ${payload.worker_name} on device ${device.name}`);

            } else if (cmd.command === 'remove_worker') {
              const removeResult = await removeUserFromDevice(device, payload.worker_id, payload.worker_code);
              if (!removeResult.success) {
                throw new Error(removeResult.error || 'Removal failed');
              }
              resultPayload.result = removeResult;
              console.log(`[commands] Removed worker ${payload.worker_name} from device ${device.name}`);

            } else {
              throw new Error(`Comando desconhecido: ${cmd.command}`);
            }

          } catch (execErr) {
            console.error(`[commands] Command ${cmd.id} failed:`, execErr.message);
            resultPayload.status = 'failed';
            resultPayload.error_message = execErr.message;
          }

          // Report result back to cloud
          try {
            await this.callEdgeFunction('agent-sync/upload-command-result', 'POST', resultPayload);
          } catch (uploadErr) {
            console.error(`[commands] Failed to upload result for ${cmd.id}:`, uploadErr.message);
          }
        }
      };

      // Execute all device groups in parallel
      await Promise.all(
        Array.from(deviceGroups.values()).map(deviceCmds => processDeviceCommands(deviceCmds))
      );
    } catch (err) {
      console.error('[commands] Download commands error:', err.message);
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

  /**
   * Full device re-sync: downloads ALL workers from cloud first,
   * then clears the device and re-enrolls with correct codes.
   * 
   * Critical safety measures:
   * 1. Forces a fresh cloud download (resets worker checkpoint)
   * 2. Pauses reverse sync to prevent contamination
   * 3. Validates minimum worker count before clearing device
   * 4. Deduplicates workers by code to prevent duplicates on hardware
   */
  /**
   * Full device re-sync: downloads ALL workers from cloud INTO MEMORY,
   * deduplicates, then clears the device and re-enrolls from the
   * authoritative cloud snapshot — NEVER from the local SQLite table.
   *
   * This is the definitive fix for the "9 duplicates" problem:
   * the local SQLite can be contaminated with orphans/duplicates,
   * so we bypass it entirely for the enrollment source of truth.
   */
  async fullDeviceResync(deviceId) {
    // Block full resync in read-only mode
    const isReadOnly = this.db.getSyncMeta?.('read_only_mode') === 'true';
    if (isReadOnly) {
      throw new Error('Modo somente-leitura ativo — full resync bloqueado para evitar escrita no hardware.');
    }

    const { clearAllUsersFromDevice, enrollUserOnDevice, loadPhotoAsBase64 } = require('../server/lib/controlid');

    const device = this.db.getDeviceById?.(deviceId);
    if (!device || !device.controlid_ip_address) {
      throw new Error(`Dispositivo ${deviceId} não encontrado ou sem IP.`);
    }

    console.log(`[full-resync] Starting AUTHORITATIVE resync for device ${device.name}`);

    // Step 0: Pause reverse sync to prevent dirty device data from flowing back
    this.db.setSyncMeta?.('reverse_sync_paused', 'true');
    console.log('[full-resync] Reverse sync PAUSED to prevent contamination');

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: Download COMPLETE worker snapshot from cloud INTO MEMORY
    // We do NOT use the local SQLite table as source for enrollment.
    // ═══════════════════════════════════════════════════════════════════
    console.log('[full-resync] Downloading authoritative worker snapshot from cloud...');

    const cloudWorkers = [];
    const MAX_PAGES = 30; // Safety: 30 * 1000 = 30,000 workers max

    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        const offset = page * 1000;
        // download-workers already does internal pagination via fetchAllWorkers()
        // We call it once with since=epoch to get ALL active workers
        const workersRes = await this.callEdgeFunction(
          `agent-sync/download-workers?since=1970-01-01T00:00:00Z`,
          'GET'
        );

        if (workersRes.workers && Array.isArray(workersRes.workers)) {
          cloudWorkers.push(...workersRes.workers);
        }
        // The edge function already returns ALL workers in one call (internal pagination)
        // so we only need one request
        break;
      }
    } catch (err) {
      throw new Error(`Falha ao baixar trabalhadores da nuvem: ${err.message}. Dispositivo NÃO foi alterado.`);
    }

    console.log(`[full-resync] Downloaded ${cloudWorkers.length} workers from cloud`);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: Deduplicate IN MEMORY by cloud UUID, document, and code
    // ═══════════════════════════════════════════════════════════════════
    const seenCloudIds = new Set();
    const seenDocuments = new Set();
    const codeMap = new Map();
    const duplicates = [];
    const canonical = [];

    for (const worker of cloudWorkers) {
      // Skip if status is not active
      if (worker.status && worker.status !== 'active') continue;

      // Dedup by cloud UUID
      if (seenCloudIds.has(worker.id)) {
        duplicates.push({ reason: 'duplicate_cloud_id', id: worker.id, name: worker.name });
        continue;
      }
      seenCloudIds.add(worker.id);

      // Dedup by document_number (if present)
      if (worker.document_number) {
        const docKey = worker.document_number.trim().toLowerCase();
        if (seenDocuments.has(docKey)) {
          duplicates.push({ reason: 'duplicate_document', id: worker.id, name: worker.name, doc: worker.document_number });
          continue;
        }
        seenDocuments.add(docKey);
      }

      // Dedup by code (keep first occurrence from cloud, which is authoritative)
      const code = Number(worker.code);
      if (code > 0 && codeMap.has(code)) {
        duplicates.push({ reason: 'duplicate_code', id: worker.id, name: worker.name, code });
        continue;
      }
      if (code > 0) codeMap.set(code, worker);

      canonical.push(worker);
    }

    console.log(`[full-resync] Canonical: ${canonical.length} workers, ${duplicates.length} duplicates removed`);
    if (duplicates.length > 0) {
      console.warn('[full-resync] Duplicates removed:', JSON.stringify(duplicates.slice(0, 15)));
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: Safety validation — abort if too few workers
    // ═══════════════════════════════════════════════════════════════════
    const MIN_WORKERS = 50;
    if (canonical.length < MIN_WORKERS) {
      const msg = `ABORTADO: apenas ${canonical.length} trabalhadores canônicos (mínimo: ${MIN_WORKERS}). Snapshot da nuvem possivelmente incompleto. Dispositivo NÃO foi alterado.`;
      console.error(`[full-resync] ${msg}`);
      throw new Error(msg);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: Also reconstruct the local SQLite table from this snapshot
    // This ensures the agent's identity resolution uses canonical data
    // ═══════════════════════════════════════════════════════════════════
    console.log('[full-resync] Reconstructing local SQLite workers table from cloud snapshot...');
    const reconstructReport = this.db.reconstructWorkersFromSnapshot?.(canonical) || { kept: 0, removed: 0 };
    console.log(`[full-resync] SQLite reconstructed: kept=${reconstructReport.kept}, removed=${reconstructReport.removed}`);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: Clear device and re-enroll FROM MEMORY (not from SQLite!)
    // ═══════════════════════════════════════════════════════════════════
    console.log(`[full-resync] Clearing device ${device.name}...`);
    const clearResult = await clearAllUsersFromDevice(device);
    console.log(`[full-resync] Cleared ${clearResult.removed || 0} users from device`);

    let enrolled = 0;
    let failed = 0;
    const errors = [];
    const BATCH = 50;

    for (let i = 0; i < canonical.length; i += BATCH) {
      const batch = canonical.slice(i, i + BATCH);
      for (const worker of batch) {
        try {
          // Build worker object for enrollment (directly from cloud data)
          const workerObj = {
            id: worker.id,
            code: worker.code,
            name: worker.name,
            document_number: worker.document_number,
          };

          let photo = null;
          // Use signed URL from cloud response (NOT local photo_url)
          const photoUrl = worker.photo_signed_url;
          if (photoUrl) {
            try { photo = await loadPhotoAsBase64(photoUrl); } catch {}
          }

          const r = await enrollUserOnDevice(device, workerObj, photo);
          if (r.success) enrolled++; else {
            failed++;
            errors.push({ code: worker.code, name: worker.name, error: r.warning || r.error });
          }
        } catch (err) {
          failed++;
          errors.push({ code: worker.code, name: worker.name, error: err.message });
        }
      }
      console.log(`[full-resync] Progress: ${Math.min(i + BATCH, canonical.length)}/${canonical.length}`);
    }

    // Update checkpoint after successful resync
    this.db.setSyncMeta('last_download_workers', new Date().toISOString());

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 6: Align event cursors for ALL devices (not just the one being resynced)
    // This prevents other devices from replaying their entire history
    // and contaminating the upload queue with stale backlog.
    // ═══════════════════════════════════════════════════════════════════
    try {
      const agentCtrl = this.agentController;
      if (agentCtrl) {
        const allDevices = this.db.getDevices?.() || [];
        for (const dev of allDevices) {
          if (!dev.controlid_ip_address) continue;
          try {
            const session = await agentCtrl.loginToDevice(dev);
            const creds = agentCtrl.parseApiCredentials(dev.api_credentials);
            const maxIdOnDevice = await agentCtrl.fetchMaxEventId(dev, session, creds);
            const currentCursor = agentCtrl.getLastEventId(dev);
            if (maxIdOnDevice != null && maxIdOnDevice > 0 && maxIdOnDevice > currentCursor) {
              agentCtrl.setLastEventId(dev, maxIdOnDevice);
              console.log(`[full-resync] Cursor aligned for ${dev.name}: ${currentCursor} → ${maxIdOnDevice}`);
            } else {
              console.log(`[full-resync] Cursor OK for ${dev.name}: current=${currentCursor}, deviceMax=${maxIdOnDevice}`);
            }
          } catch (devErr) {
            console.warn(`[full-resync] Cursor alignment failed for ${dev.name}: ${devErr.message}`);
          }
        }
      }
    } catch (cursorErr) {
      console.error(`[full-resync] Cursor alignment failed: ${cursorErr.message} — agent may replay old events`);
    }

    // Also mark all existing unsynced local logs as synced to prevent
    // re-uploading stale backlog that was already in the cloud
    try {
      const staleCount = this.db.markAllLogsSynced?.() || 0;
      if (staleCount > 0) {
        console.log(`[full-resync] Marked ${staleCount} stale local logs as synced to clear backlog`);
      }
    } catch (e) {
      console.warn(`[full-resync] Could not clear stale logs: ${e.message}`);
    }

    // Unpause reverse sync now that the device has been rebuilt with canonical data
    this.db.setSyncMeta?.('reverse_sync_paused', 'false');
    console.log('[full-resync] Reverse sync UNPAUSED');

    console.log(`[full-resync] Done: ${enrolled} enrolled, ${failed} failed out of ${canonical.length} canonical workers`);
    return {
      success: true,
      enrolled,
      failed,
      total: canonical.length,
      totalDownloaded: cloudWorkers.length,
      duplicatesRemoved: duplicates.length,
      reconstructReport,
      errors: errors.slice(0, 20),
    };
  }
}

module.exports = { SyncEngine };
