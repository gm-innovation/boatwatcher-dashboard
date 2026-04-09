const express = require('express');
const path = require('path');
const router = express.Router();

const serverVersion = (() => {
  try { return require(path.join(__dirname, '..', 'package.json')).version; }
  catch { return 'unknown'; }
})();

router.get('/status', (req, res) => {
  try {
    const status = req.syncEngine.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bootstrap', async (req, res) => {
  try {
    const { accessToken } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    const status = await req.syncEngine.bootstrapFromAccessToken(accessToken);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/trigger', async (req, res) => {
  try {
    await req.syncEngine.triggerSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all checkpoints and do a full re-sync
router.post('/reset-and-full-sync', async (req, res) => {
  try {
    const status = await req.syncEngine.resetAndFullSync();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fast-lane: trigger immediate log upload
router.post('/fast-upload-logs', async (req, res) => {
  try {
    req.syncEngine.triggerFastLaneSync();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read-only mode status
router.get('/read-only-status', (req, res) => {
  try {
    const enabled = req.db.getSyncMeta?.('read_only_mode') === 'true';
    res.json({ enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle read-only mode
router.post('/read-only-mode', (req, res) => {
  try {
    const { enabled } = req.body || {};
    req.db.setSyncMeta?.('read_only_mode', enabled ? 'true' : 'false');
    console.log(`[read-only] Mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Flush stale unsynced logs (older than 24h) — manual cleanup endpoint
router.post('/flush-stale-logs', (req, res) => {
  try {
    const rawDb = req.db.getRawDb?.();
    if (!rawDb) {
      return res.status(500).json({ error: 'Raw DB not available' });
    }

    const hoursThreshold = Number(req.body?.hoursThreshold) || 24;
    const cutoff = new Date(Date.now() - hoursThreshold * 3600 * 1000).toISOString();

    const countRow = rawDb.prepare(
      "SELECT COUNT(*) as cnt FROM access_logs WHERE synced = 0 AND created_at < ?"
    ).get(cutoff);
    const staleCount = countRow?.cnt || 0;

    if (staleCount === 0) {
      return res.json({ success: true, flushed: 0, message: 'No stale logs found' });
    }

    const result = rawDb.prepare(
      "UPDATE access_logs SET synced = 1 WHERE synced = 0 AND created_at < ?"
    ).run(cutoff);

    console.log(`[flush-stale-logs] Marked ${result.changes} stale unsynced logs as synced (threshold=${hoursThreshold}h)`);
    res.json({ success: true, flushed: result.changes, cutoff, hoursThreshold });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agent control (includes telemetry: capturedEventsCount, ignoredDedupeCount, etc.)
router.get('/agent/status', (req, res) => {
  try {
    res.json(req.agentController.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agent/start', async (req, res) => {
  try {
    await req.agentController.start();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/agent/stop', (req, res) => {
  try {
    req.agentController.stop();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full diagnostics endpoint — deep inspection of local state
router.get('/diagnostics', (req, res) => {
  try {
    const syncStatus = req.syncEngine.getStatus();
    const agentStatus = req.agentController.getStatus();

    // Count unsynced logs in SQLite
    let unsyncedCount = 0;
    let unsyncedDiagnostics = null;
    try {
      const rawDb = req.db.getRawDb?.();
      if (rawDb) {
        const row = rawDb.prepare('SELECT COUNT(*) as count FROM access_logs WHERE synced = 0').get();
        unsyncedCount = row?.count || 0;
      }
      unsyncedDiagnostics = req.db.getUnsyncedLogsDiagnostics?.() || null;
    } catch { /* ignore */ }

    // Worker diagnostics — duplicate codes, orphans, etc.
    let workerDiagnostics = null;
    try {
      workerDiagnostics = req.db.getWorkerDiagnostics?.();
    } catch { /* ignore */ }

    // Check sync configuration
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'NOT SET';
    const hasToken = !!(req.syncEngine.agentToken);
    const reverseSyncPaused = req.db.getSyncMeta?.('reverse_sync_paused') || 'false';
    const readOnlyMode = req.db.getSyncMeta?.('read_only_mode') === 'true';

    // Recent sync meta
    let syncMeta = {};
    try {
      const rawDb = req.db.getRawDb?.();
      if (rawDb) {
        const rows = rawDb.prepare('SELECT key, value FROM sync_meta ORDER BY key').all();
        for (const row of rows) {
          // Don't expose tokens
          if (row.key === 'agent_token') continue;
          syncMeta[row.key] = row.value;
        }
      }
    } catch { /* ignore */ }

    // Event cursor diagnostics per device
    let cursorDiagnostics = [];
    try {
      const rawDb = req.db.getRawDb?.();
      if (rawDb) {
        const devices = req.db.getDevices?.() || [];
        for (const device of devices) {
          const key = `last_event_id_${device.id}`;
          const row = rawDb.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
          cursorDiagnostics.push({
            device_id: device.id,
            device_name: device.name,
            last_event_id: row ? parseInt(row.value, 10) || 0 : 0,
            last_event_timestamp: device.last_event_timestamp || null,
          });
        }
      }
    } catch { /* ignore */ }

    res.json({
      version: serverVersion,
      timestamp: new Date().toISOString(),
      sync: {
        ...syncStatus,
        lastUploadLogsError: req.syncEngine._lastUploadLogsError || null,
        lastDownloadLogsError: req.syncEngine._lastDownloadLogsError || null,
        uploadLogsCount: req.syncEngine._uploadLogsCount || 0,
        downloadLogsCount: req.syncEngine._downloadLogsCount || 0,
        reverseSyncPaused,
        readOnlyMode,
      },
      agent: agentStatus,
      local_db: {
        unsynced_access_logs: unsyncedCount,
        unsynced_diagnostics: unsyncedDiagnostics,
        workers: workerDiagnostics,
      },
      cursors: cursorDiagnostics,
      config: {
        supabase_url: supabaseUrl.replace(/\/\/(.{8}).*(@|\.supabase)/, '//$1***$2'),
        has_access_token: hasToken,
      },
      sync_meta: syncMeta,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deep worker diagnostics — standalone endpoint for debugging identity issues
router.get('/worker-diagnostics', (req, res) => {
  try {
    const diagnostics = req.db.getWorkerDiagnostics?.();
    if (!diagnostics) {
      return res.status(500).json({ error: 'Worker diagnostics not available' });
    }

    // Add sample workers for each duplicate code
    const enrichedDuplicates = diagnostics.duplicateCodes.map(d => ({
      ...d,
      workers: d.workers.map(w => ({
        id: w.id,
        name: w.name,
        cloud_id: w.cloud_id,
        synced: w.synced,
      })),
    }));

    res.json({
      timestamp: new Date().toISOString(),
      total: diagnostics.totalWorkers,
      active: diagnostics.activeWorkers,
      withCloudId: diagnostics.withCloudId,
      withoutCloudId: diagnostics.withoutCloudId,
      synced: diagnostics.synced,
      unsynced: diagnostics.unsynced,
      distinctCodes: diagnostics.distinctCodes,
      duplicateCodeCount: diagnostics.duplicateCodes.length,
      duplicates: enrichedDuplicates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual sanitization trigger
router.post('/sanitize-workers', (req, res) => {
  try {
    const report = req.db.sanitizeWorkers?.();
    if (!report) {
      return res.status(500).json({ error: 'Sanitize not available' });
    }
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Align event cursors to device max — skips backlog without full resync
router.post('/align-cursors', async (req, res) => {
  try {
    const agentCtrl = req.agentController;
    if (!agentCtrl) return res.status(500).json({ error: 'Agent controller not available' });

    const results = [];
    const devices = req.db.getDevices?.() || [];

    for (const device of devices) {
      if (!device.controlid_ip_address) continue;
      try {
        const session = await agentCtrl.loginToDevice(device);
        const creds = agentCtrl.parseApiCredentials(device.api_credentials);
        const maxId = await agentCtrl.fetchMaxEventId(device, session, creds);
        const currentCursor = agentCtrl.getLastEventId(device);
        if (maxId != null && maxId > 0) {
          agentCtrl.setLastEventId(device, maxId);
          results.push({ device: device.name, previousCursor: currentCursor, newCursor: maxId, status: 'aligned' });
        } else {
          results.push({ device: device.name, previousCursor: currentCursor, status: 'no_max_id' });
        }
      } catch (err) {
        results.push({ device: device.name, status: 'error', error: err.message });
      }
    }

    // Also clear stale unsynced logs
    const cleared = req.db.markAllLogsSynced?.() || 0;

    res.json({ success: true, results, staleLogsCleared: cleared });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
