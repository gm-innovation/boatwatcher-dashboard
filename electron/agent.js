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
  const parsed = typeof raw === 'number' ? raw * 1000 : Date.parse(raw);
  if (isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
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

    // Telemetry
    this._capturedCount = 0;
    this._ignoredDedupeCount = 0;
    this._ignoredInvalidCount = 0;
    this._lastCapturedAt = null;
    this._lastIgnoreReason = null;
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
    for (const device of this.devices) {
      try {
        await this.pollDevice(device);
        if (device.controlid_serial_number) {
          this.deviceConnectivity.set(device.controlid_serial_number, { online: true });
        }
        this.persistDeviceStatus(device, 'online');
      } catch (err) {
        if (device.controlid_serial_number) {
          this.deviceConnectivity.set(device.controlid_serial_number, { online: false });
        }
        this.persistDeviceStatus(device, 'offline');
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

  async pollDevice(device, _retried = false) {
    const ip = device.controlid_ip_address;
    if (!ip) throw new Error('No IP');

    let session;
    try {
      session = await this.loginToDevice(device);
    } catch (err) {
      throw new Error(`Login failed: ${err.message}`);
    }

    const creds = this.parseApiCredentials(device.api_credentials);
    const lastEventId = this.getLastEventId(device);

    // Use POST /access_logs.fcgi with pagination (like the Python agent)
    const postData = JSON.stringify({
      where_args: lastEventId > 0
        ? { access_logs: { id: { '>': lastEventId } } }
        : {},
      limit: 100,
      order: 'id',
    });

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: ip,
        port: creds.port,
        path: `/access_logs.fcgi?session=${session}`,
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      }, (res) => {
        if (res.statusCode === 401 && !_retried) {
          this.invalidateSession(device);
          this.pollDevice(device, true).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const events = response.access_logs || response.events || [];
            if (!Array.isArray(events)) {
              // Fallback: single event response (legacy /api/access/last format)
              if (response && (response.timestamp || response.time || response.date)) {
                this.processEvent(device, response);
              }
              resolve();
              return;
            }

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
              console.log(`[Agent] Polled ${events.length} events from ${device.name} (lastId: ${lastEventId} → ${maxId})`);
            }
          } catch { /* ignore parse errors */ }
          resolve();
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(postData);
      req.end();
    });
  }

  processEvent(device, rawEvent) {
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
