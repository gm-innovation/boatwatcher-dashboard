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
      } catch (err) {
        if (device.controlid_serial_number) {
          this.deviceConnectivity.set(device.controlid_serial_number, { online: false });
        }
      }
    }
  }

  pollDevice(device) {
    return new Promise((resolve, reject) => {
      const ip = device.controlid_ip_address;
      if (!ip) return resolve();

      const url = `http://${ip}/api/access/last`;

      const req = http.get(url, { timeout: 3000 }, (res) => {
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

      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
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

    const accessLog = {
      worker_id: event.user_id || null,
      device_id: device.id,
      timestamp: event.timestamp,
      access_status: event.access ? 'granted' : 'denied',
      direction,
      reason: event.reason || null,
      score: event.score || null,
      worker_name: event.user_name || null,
      worker_document: event.user_document || null,
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
