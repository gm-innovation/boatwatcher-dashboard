const http = require('http');

/**
 * ControlID Agent Controller
 * Polls ControlID facial readers on the local network for access events.
 * Replaces the Python agent (controlid_agent.py) when running in Electron.
 */
class AgentController {
  constructor(db) {
    this.db = db;
    this.running = false;
    this.pollInterval = null;
    this.devices = [];
    this.listeners = [];
    this.pollIntervalMs = 5000; // 5 seconds
    this.deviceConnectivity = new Map(); // serial_number -> { online: boolean }
    this.sessionCache = new Map(); // ip:port -> { session, expiry }
    this.SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
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
    const port = creds.port || 80;
    return `${device.controlid_ip_address}:${port}`;
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

    // Load devices from local DB
    this.reloadDevices();

    // Start polling loop
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
        // Persist status to local SQLite
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

    return new Promise((resolve, reject) => {
      const req = http.get({
        hostname: ip,
        port: creds.port,
        path: `/api/access/last?session=${session}`,
        timeout: 3000,
      }, (res) => {
        // Retry once on 401
        if (res.statusCode === 401 && !_retried) {
          this.invalidateSession(device);
          this.pollDevice(device, true).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const event = JSON.parse(data);
            if (event && event.timestamp) {
              this.processEvent(device, event);
            }
          } catch { /* ignore parse errors */ }
          resolve();
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  processEvent(device, event) {
    // Check if we already have this event (dedup by timestamp + device)
    const lastTimestamp = device.last_event_timestamp;
    if (lastTimestamp && event.timestamp <= lastTimestamp) return;

    // Determine direction based on device config or event data
    const direction = event.direction || 
      (device.configuration?.direction) || 
      'unknown';

    // Resolve worker UUID from integer code sent by ControlID device
    let workerId = null;
    let workerName = event.user_name || null;
    let workerDocument = event.user_document || null;
    if (event.user_id) {
      const isUuid = /^[0-9a-f]{8}-/.test(String(event.user_id));
      if (isUuid) {
        workerId = event.user_id;
      } else {
        // Look up worker by integer code in local SQLite
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
      access_status: event.access ? 'granted' : 'denied',
      direction,
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

    // Notify UI
    this.notifyListeners(inserted);
  }
}

module.exports = { AgentController };
