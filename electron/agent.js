const http = require('http');

/**
 * ControlID Agent Controller
 * Polls ControlID facial readers on the local network for access events.
 */

// ── Canonical normalizers ──────────────────────────────────────────────

const DIRECTION_MAP = {
  entry: 'entry', entrada: 'entry', in: 'entry', '1': 'entry', 1: 'entry',
  exit: 'exit', saida: 'exit', saída: 'exit', out: 'exit', '2': 'exit', 2: 'exit',
};

function normalizeDirection(raw, deviceConfig) {
  if (raw != null) {
    const key = String(raw).toLowerCase().trim();
    if (DIRECTION_MAP[key]) return DIRECTION_MAP[key];
  }
  // Fallback to device configuration
  const passDir = deviceConfig?.passage_direction || deviceConfig?.direction;
  if (passDir) {
    const key = String(passDir).toLowerCase().trim();
    if (DIRECTION_MAP[key]) return DIRECTION_MAP[key];
  }
  return 'unknown';
}

function normalizeAccessStatus(event) {
  // ControlID may use `event.access` (bool) or `event.event` (int: 7=granted, 3=denied)
  if (typeof event.access === 'boolean') return event.access ? 'granted' : 'denied';
  if (event.access === 1 || event.access === '1') return 'granted';
  if (event.access === 0 || event.access === '0') return 'denied';
  const evtCode = event.event ?? event.event_type;
  if (evtCode === 7 || evtCode === '7') return 'granted';
  if (evtCode === 3 || evtCode === '3') return 'denied';
  // Default to granted if there's any positive indication
  return 'granted';
}

function normalizeTimestamp(event) {
  // Try multiple field names the ControlID hardware might use
  const raw = event.timestamp || event.time || event.date || event.datetime;
  if (!raw) return null;

  // Store device timestamps AS-IS — no timezone conversion.
  // ControlID devices report wall-clock time; we preserve it directly.
  if (typeof raw === 'number') {
    // Unix timestamp — use directly without offset adjustment
    return new Date(raw * 1000).toISOString();
  }

  // String with timezone suffix — parse directly
  const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw.trim());
  if (hasTimezone) {
    const ms = Date.parse(raw);
    return isNaN(ms) ? null : new Date(ms).toISOString();
  }

  // No timezone — interpret as BRT (UTC-3), convert to true UTC by adding 3h
  // ControlID devices send local Brazilian time without timezone markers
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, yr, mo, dy, hr, mn, sc] = match.map(Number);
    const utcDate = new Date(Date.UTC(yr, mo - 1, dy, hr + 3, mn, sc));
    return utcDate.toISOString();
  }

  // Fallback
  const ms = Date.parse(raw);
  return isNaN(ms) ? null : new Date(ms).toISOString();
}

function parseControlIdEvent(rawEvent, device) {
  const timestamp = normalizeTimestamp(rawEvent);
  if (!timestamp) return null; // Cannot process without a valid timestamp

  return {
    timestamp,
    access: normalizeAccessStatus(rawEvent),
    direction: normalizeDirection(
      rawEvent.direction ?? rawEvent.passage_direction ?? rawEvent.sentido,
      device.configuration
    ),
    user_id: rawEvent.user_id ?? rawEvent.user ?? rawEvent.id_user ?? null,
    user_name: rawEvent.user_name ?? rawEvent.name ?? null,
    user_document: rawEvent.user_document ?? rawEvent.document ?? null,
    reason: rawEvent.reason ?? rawEvent.message ?? null,
    score: rawEvent.score ?? rawEvent.match_score ?? null,
  };
}

// ── Agent Controller ───────────────────────────────────────────────────

class AgentController {
  constructor(db) {
    this.db = db;
    this.running = false;
    this.pollInterval = null;
    this.devices = [];
    this.listeners = [];
    this.pollIntervalMs = 5000;
    this.deviceConnectivity = new Map();
    this.sessionCache = new Map();
    this.SESSION_TTL_MS = 10 * 60 * 1000;
    this.FAILURE_THRESHOLD = 6; // consecutive failures before marking offline (30s at 5s poll)
    this.RECOVERY_THRESHOLD = 2; // consecutive successes before marking online (hysteresis)

    // Telemetry
    this._capturedCount = 0;
    this._ignoredDedupeCount = 0;
    this._ignoredInvalidCount = 0;
    this._lastCapturedAt = null;
    this._lastIgnoreReason = null;
    this._startedAt = null;
  }

  onNewEvent(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(event) {
    for (const cb of this.listeners) cb(event);
  }

  reloadDevices() {
    this.devices = this.db.getDevices?.() || [];
    console.log(`[Agent] Loaded ${this.devices.length} devices`);
    return this.devices;
  }

  getStatus() {
    return {
      running: this.running,
      devicesCount: this.devices.length,
      capturedEventsCount: this._capturedCount,
      ignoredDedupeCount: this._ignoredDedupeCount,
      ignoredInvalidCount: this._ignoredInvalidCount,
      lastCapturedAt: this._lastCapturedAt,
      lastIgnoreReason: this._lastIgnoreReason,
      devices: this.devices.map(d => ({
        name: d.name,
        ip: d.controlid_ip_address,
        serial: d.controlid_serial_number,
        status: d._lastError ? 'error' : 'ok',
        lastError: d._lastError || null,
        lastPollAt: d._lastPollAt || null,
        lastEventId: this.getLastEventId(d),
        lastEventPayload: d._lastEventPayload || null,
        lastPollResponse: d._lastPollResponse || null,
      })),
    };
  }

  getDeviceConnectivityReport() {
    return this.devices
      .filter(d => d.controlid_serial_number)
      .map(d => ({
        serial_number: d.controlid_serial_number,
        online: this.deviceConnectivity.get(d.controlid_serial_number)?.online ?? false,
      }));
  }

  parseApiCredentials(apiCredentials) {
    if (!apiCredentials) return { username: 'admin', password: 'admin', port: 80 };
    let raw = {};
    if (typeof apiCredentials === 'string') {
      try { raw = JSON.parse(apiCredentials); } catch { raw = {}; }
    } else {
      raw = apiCredentials;
    }
    return {
      username: raw.username || raw.user || raw.login || 'admin',
      password: raw.password || 'admin',
      port: raw.port || 80,
    };
  }

  getDeviceKey(device) {
    const creds = this.parseApiCredentials(device.api_credentials);
    return `${device.controlid_ip_address}:${creds.port || 80}`;
  }

  async loginToDevice(device) {
    const key = this.getDeviceKey(device);
    const cached = this.sessionCache.get(key);
    if (cached && cached.expiry > Date.now()) return cached.session;

    const creds = this.parseApiCredentials(device.api_credentials);
    const ip = device.controlid_ip_address;

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ login: creds.username, password: creds.password });
      const req = http.request({
        hostname: ip,
        port: creds.port,
        path: '/login.fcgi',
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.session) {
              this.sessionCache.set(key, { session: parsed.session, expiry: Date.now() + this.SESSION_TTL_MS });
              resolve(parsed.session);
            } else {
              reject(new Error('Login failed: no session returned'));
            }
          } catch {
            reject(new Error('Login failed: invalid response'));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Login timeout')); });
      req.write(postData);
      req.end();
    });
  }

  invalidateSession(device) {
    this.sessionCache.delete(this.getDeviceKey(device));
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this._startedAt = Date.now();
    this.reloadDevices();
    this.pollInterval = setInterval(() => this.pollDevices(), this.pollIntervalMs);
    console.log(`[Agent] Started polling ${this.devices.length} devices`);
  }

  stop() {
    this.running = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    console.log('[Agent] Stopped');
  }

  async pollDevices() {
    await Promise.allSettled(this.devices.map(device => this.pollDeviceWithRetry(device)));

    // Auto-reset all cursors if 10+ minutes with zero captures
    if (this._startedAt && this._capturedCount === 0 && this._ignoredDedupeCount === 0) {
      const uptimeMs = Date.now() - this._startedAt;
      if (uptimeMs > 10 * 60 * 1000) {
        console.warn('[Agent] 10min+ with zero captures. Auto-resetting all event cursors.');
        for (const device of this.devices) {
          this.setLastEventId(device, 0);
        }
        // Reset timer so we don't spam resets every 5s
        this._startedAt = Date.now();
      }
    }
  }

  async pollDeviceWithRetry(device) {
    try {
      await this.pollDevice(device);
      // Success — increment consecutive successes, clear errors
      device._consecutiveSuccesses = (device._consecutiveSuccesses || 0) + 1;
      device._consecutiveFailures = 0;
      device._lastError = null;
      device._lastPollAt = new Date().toISOString();

      // Hysteresis: only mark online after RECOVERY_THRESHOLD consecutive successes
      if (device._consecutiveSuccesses >= this.RECOVERY_THRESHOLD) {
        if (device.controlid_serial_number) {
          this.deviceConnectivity.set(device.controlid_serial_number, { online: true });
        }
        this.persistDeviceStatus(device, 'online');
      }
    } catch (firstErr) {
      // Retry once before counting as failure
      try {
        this.invalidateSession(device);
        await this.pollDevice(device);
        device._consecutiveSuccesses = (device._consecutiveSuccesses || 0) + 1;
        device._consecutiveFailures = 0;
        device._lastError = null;
        device._lastPollAt = new Date().toISOString();

        if (device._consecutiveSuccesses >= this.RECOVERY_THRESHOLD) {
          if (device.controlid_serial_number) {
            this.deviceConnectivity.set(device.controlid_serial_number, { online: true });
          }
          this.persistDeviceStatus(device, 'online');
        }
      } catch (retryErr) {
        device._consecutiveFailures = (device._consecutiveFailures || 0) + 1;
        device._consecutiveSuccesses = 0;
        device._lastError = retryErr.message;
        device._lastPollAt = new Date().toISOString();

        // Only mark offline after FAILURE_THRESHOLD consecutive failures
        if (device._consecutiveFailures >= this.FAILURE_THRESHOLD) {
          if (device.controlid_serial_number) {
            this.deviceConnectivity.set(device.controlid_serial_number, { online: false });
          }
          this.persistDeviceStatus(device, 'offline');
          console.error(`[Agent][${device.name}] Offline after ${device._consecutiveFailures} consecutive failures: ${retryErr.message}`);
        } else {
          console.warn(`[Agent][${device.name}] Failure ${device._consecutiveFailures}/${this.FAILURE_THRESHOLD}: ${retryErr.message}`);
        }
      }
    }
  }

  persistDeviceStatus(device, status) {
    try {
      const rawDb = this.db.getRawDb?.();
      if (rawDb) {
        rawDb.prepare('UPDATE devices SET status = ? WHERE id = ?').run(status, device.id);
      }
    } catch { /* ignore */ }
  }

  getLastEventId(device) {
    try {
      const rawDb = this.db.getRawDb?.();
      if (rawDb) {
        const key = `last_event_id_${device.id}`;
        const row = rawDb.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
        return row ? parseInt(row.value, 10) || 0 : 0;
      }
    } catch { /* ignore */ }
    return 0;
  }

  setLastEventId(device, eventId) {
    try {
      const rawDb = this.db.getRawDb?.();
      if (rawDb) {
        const key = `last_event_id_${device.id}`;
        rawDb.prepare(
          "INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))"
        ).run(key, String(eventId));
      }
    } catch { /* ignore */ }
  }

  /**
   * Fetch the maximum event ID currently on the device (without any filter).
   * Used to detect stale cursors when the device has reset its event buffer.
   */
  async fetchMaxEventId(device, session, creds) {
    const ip = device.controlid_ip_address;
    const postData = JSON.stringify({ object: 'access_logs' });

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: ip,
        port: creds.port,
        path: `/load_objects.fcgi?session=${session}`,
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const events = response.access_logs || response.events || [];
            if (!Array.isArray(events) || events.length === 0) {
              resolve(null);
              return;
            }
            let maxId = 0;
            for (const evt of events) {
              const id = evt.id || 0;
              if (id > maxId) maxId = id;
            }
            resolve(maxId);
          } catch {
            reject(new Error('Failed to parse fallback response'));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(postData);
      req.end();
    });
  }

  async pollDevice(device, _retried = false) {
    const ip = device.controlid_ip_address;
    if (!ip) throw new Error('No IP');

    let session;
    try {
      session = await this.loginToDevice(device);
      console.log(`[Agent][${device.name}] Login OK (ip=${ip})`);
    } catch (err) {
      console.error(`[Agent][${device.name}] Login FAILED (ip=${ip}): ${err.message}`);
      throw new Error(`Login failed: ${err.message}`);
    }

    const creds = this.parseApiCredentials(device.api_credentials);
    const lastEventId = this.getLastEventId(device);

    // Use POST /load_objects.fcgi with documented ControlID API format
    const payload = { object: 'access_logs' };
    if (lastEventId > 0) {
      payload.where = [{ object: 'access_logs', field: 'id', operator: '>', value: lastEventId }];
    }
    const postData = JSON.stringify(payload);

    const pollResult = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: ip,
        port: creds.port,
        path: `/load_objects.fcgi?session=${session}`,
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        console.log(`[Agent][${device.name}] load_objects.fcgi responded status=${res.statusCode}`);

        if (res.statusCode === 401 && !_retried) {
          console.log(`[Agent][${device.name}] Got 401, retrying with fresh session...`);
          this.invalidateSession(device);
          this.pollDevice(device, true).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            // Save raw response for diagnostics (truncated to 2KB)
            device._lastPollResponse = data.length > 2048 ? data.slice(0, 2048) + '…[truncated]' : data;
            const events = response.access_logs || response.events || [];
            if (!Array.isArray(events)) {
              console.log(`[Agent][${device.name}] Response is not an array. Keys: ${Object.keys(response).join(', ')}. Checking single-event fallback.`);
              if (response && (response.timestamp || response.time || response.date)) {
                this.processEvent(device, response);
              }
              resolve({ events: [], session, lastEventId });
              return;
            }

            console.log(`[Agent][${device.name}] Received ${events.length} events (lastEventId=${lastEventId})`);

            let maxId = lastEventId;
            for (const rawEvent of events) {
              const eventId = rawEvent.id || 0;
              this.processEvent(device, rawEvent);
              if (eventId > maxId) maxId = eventId;
            }

            if (maxId > lastEventId) {
              this.setLastEventId(device, maxId);
            }

            if (events.length > 0) {
              console.log(`[Agent][${device.name}] Polled ${events.length} events (lastId: ${lastEventId} → ${maxId})`);
            }
            resolve({ events, session, lastEventId });
          } catch (parseErr) {
            console.error(`[Agent][${device.name}] Failed to parse response: ${parseErr.message}. Raw body (first 500 chars): ${data.slice(0, 500)}`);
            resolve({ events: [], session, lastEventId });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(postData);
      req.end();
    });

    // Stale cursor detection AFTER the promise resolves (proper async context)
    if (pollResult.events.length === 0 && pollResult.lastEventId > 0) {
      console.log(`[Agent][${device.name}] Zero events with lastEventId=${pollResult.lastEventId}. Checking for stale cursor...`);
      try {
        const creds2 = this.parseApiCredentials(device.api_credentials);
        const maxIdOnDevice = await this.fetchMaxEventId(device, pollResult.session, creds2);
        if (maxIdOnDevice !== null && maxIdOnDevice < pollResult.lastEventId) {
          console.warn(`[Agent][${device.name}] Stale cursor detected! Device maxId=${maxIdOnDevice} < lastEventId=${pollResult.lastEventId}. Resetting cursor to 0.`);
          this.setLastEventId(device, 0);
        } else {
          console.log(`[Agent][${device.name}] Cursor OK (device maxId=${maxIdOnDevice}, lastEventId=${pollResult.lastEventId}). No new events.`);
        }
      } catch (fallbackErr) {
        console.warn(`[Agent][${device.name}] Stale cursor check failed: ${fallbackErr.message}`);
      }
    }
  }

  processEvent(device, rawEvent) {
    // Store last raw payload for diagnostics
    device._lastEventPayload = rawEvent;

    // Parse and normalize the raw hardware event
    const event = parseControlIdEvent(rawEvent, device);
    if (!event) {
      this._ignoredInvalidCount++;
      this._lastIgnoreReason = 'invalid_payload: could not parse timestamp';
      console.log(`[Agent] Ignored event from ${device.name}: invalid payload (no parseable timestamp)`);
      return;
    }

    // Temporal deduplication: compare parsed timestamps numerically
    const eventMs = Date.parse(event.timestamp);
    const lastTimestamp = device.last_event_timestamp;
    if (lastTimestamp) {
      const lastMs = Date.parse(lastTimestamp);
      if (!isNaN(lastMs) && eventMs <= lastMs) {
        this._ignoredDedupeCount++;
        this._lastIgnoreReason = `dedupe: event ${event.timestamp} <= last ${lastTimestamp}`;
        return; // Already processed
      }
    }

    // Resolve worker UUID from integer code sent by ControlID device
    let workerId = null;
    let workerName = event.user_name || null;
    let workerDocument = event.user_document || null;
    if (event.user_id) {
      const isUuid = /^[0-9a-f]{8}-/.test(String(event.user_id));
      if (isUuid) {
        workerId = event.user_id;
      } else {
        try {
          const rawDb = this.db.getRawDb?.();
          if (rawDb) {
            const worker = rawDb.prepare('SELECT id, name, document_number FROM workers WHERE code = ?').get(Number(event.user_id));
            if (worker) {
              workerId = worker.id;
              workerName = workerName || worker.name;
              workerDocument = workerDocument || worker.document_number;
            }
          }
        } catch { /* ignore lookup errors */ }
      }
    }

    const accessLog = {
      worker_id: workerId,
      device_id: device.id,
      timestamp: event.timestamp,
      access_status: event.access,
      direction: event.direction,
      reason: event.reason || null,
      score: event.score || null,
      worker_name: workerName,
      worker_document: workerDocument,
      device_name: device.name,
    };

    // Insert into local database
    const inserted = this.db.insertAccessLog(accessLog);

    // Update device last event timestamp
    try {
      const db = this.db.getRawDb?.();
      if (db) {
        db.prepare('UPDATE devices SET last_event_timestamp = ?, status = ? WHERE id = ?')
          .run(event.timestamp, 'online', device.id);
      }
    } catch { /* ignore */ }

    // Update in-memory device
    device.last_event_timestamp = event.timestamp;

    // Telemetry
    this._capturedCount++;
    this._lastCapturedAt = new Date().toISOString();
    console.log(`[Agent] Captured event: worker=${workerId || 'unknown'} dir=${event.direction} status=${event.access} device=${device.name}`);

    // Notify UI
    this.notifyListeners(inserted);
  }
}

module.exports = { AgentController };
