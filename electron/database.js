const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

let db;

function initDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'dockcheck.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      name TEXT NOT NULL,
      cnpj TEXT,
      contact_email TEXT,
      logo_url_light TEXT,
      logo_url_dark TEXT,
      status TEXT DEFAULT 'active',
      vessels TEXT DEFAULT '[]',
      project_managers TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      cloud_id TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      name TEXT NOT NULL,
      client_id TEXT,
      status TEXT DEFAULT 'active',
      location TEXT,
      commander TEXT,
      chief_engineer TEXT,
      project_type TEXT,
      armador TEXT,
      crew_size INTEGER DEFAULT 0,
      start_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      FOREIGN KEY (client_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      code INTEGER,
      name TEXT NOT NULL,
      company_id TEXT,
      role TEXT,
      status TEXT DEFAULT 'active',
      document_number TEXT,
      photo_url TEXT,
      job_function_id TEXT,
      birth_date TEXT,
      gender TEXT,
      blood_type TEXT,
      observations TEXT,
      allowed_project_ids TEXT DEFAULT '[]',
      devices_enrolled TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      worker_id TEXT,
      device_id TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      access_status TEXT NOT NULL,
      direction TEXT DEFAULT 'unknown',
      reason TEXT,
      score REAL,
      worker_name TEXT,
      worker_document TEXT,
      device_name TEXT,
      photo_capture_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      controlid_serial_number TEXT,
      controlid_ip_address TEXT,
      type TEXT DEFAULT 'facial_reader',
      status TEXT DEFAULT 'offline',
      location TEXT,
      project_id TEXT,
      configuration TEXT DEFAULT '{}',
      last_event_timestamp TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS job_functions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_access_logs_worker ON access_logs(worker_id);
    CREATE INDEX IF NOT EXISTS idx_access_logs_synced ON access_logs(synced);
    CREATE INDEX IF NOT EXISTS idx_workers_synced ON workers(synced);
    CREATE INDEX IF NOT EXISTS idx_workers_company ON workers(company_id);
  `);

  // Auto-increment code for workers
  const maxCode = db.prepare('SELECT MAX(code) as max_code FROM workers').get();
  const nextCode = (maxCode?.max_code || 0) + 1;

  return createDatabaseAPI(db, nextCode);
}

function createDatabaseAPI(db, startCode) {
  let nextWorkerCode = startCode;

  return {
    // === Workers ===
    getWorkers(filters = {}) {
      let sql = `
        SELECT w.*, c.name as company_name 
        FROM workers w 
        LEFT JOIN companies c ON w.company_id = c.id
      `;
      const conditions = [];
      const params = [];

      if (filters.status) {
        conditions.push('w.status = ?');
        params.push(filters.status);
      }
      if (filters.company_id) {
        conditions.push('w.company_id = ?');
        params.push(filters.company_id);
      }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY w.name';

      return db.prepare(sql).all(...params).map(row => ({
        ...row,
        company: row.company_name || 'N/A',
        allowed_project_ids: JSON.parse(row.allowed_project_ids || '[]'),
        devices_enrolled: JSON.parse(row.devices_enrolled || '[]'),
      }));
    },

    getWorkerById(id) {
      const row = db.prepare(`
        SELECT w.*, c.name as company_name 
        FROM workers w 
        LEFT JOIN companies c ON w.company_id = c.id 
        WHERE w.id = ?
      `).get(id);
      if (!row) return null;
      return {
        ...row,
        company: row.company_name || 'N/A',
        allowed_project_ids: JSON.parse(row.allowed_project_ids || '[]'),
        devices_enrolled: JSON.parse(row.devices_enrolled || '[]'),
      };
    },

    createWorker(data) {
      const id = uuidv4();
      const code = nextWorkerCode++;
      db.prepare(`
        INSERT INTO workers (id, code, name, company_id, role, status, document_number, photo_url, job_function_id, birth_date, gender, blood_type, observations, allowed_project_ids, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id, code, data.name, data.company_id || null, data.role || null,
        data.status || 'active', data.document_number || null, data.photo_url || null,
        data.job_function_id || null, data.birth_date || null, data.gender || null,
        data.blood_type || null, data.observations || null,
        JSON.stringify(data.allowed_project_ids || [])
      );
      return this.getWorkerById(id);
    },

    updateWorker(id, data) {
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at', 'cloud_id'].includes(key)) continue;
        if (key === 'allowed_project_ids' || key === 'devices_enrolled') {
          sets.push(`${key} = ?`);
          params.push(JSON.stringify(value));
        } else {
          sets.push(`${key} = ?`);
          params.push(value);
        }
      }
      sets.push("updated_at = datetime('now')");
      sets.push('synced = 0');
      params.push(id);
      db.prepare(`UPDATE workers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return this.getWorkerById(id);
    },

    deleteWorker(id) {
      db.prepare('DELETE FROM workers WHERE id = ?').run(id);
    },

    // === Companies ===
    getCompanies() {
      return db.prepare('SELECT * FROM companies ORDER BY name').all().map(row => ({
        ...row,
        vessels: JSON.parse(row.vessels || '[]'),
        project_managers: JSON.parse(row.project_managers || '[]'),
      }));
    },

    getCompanyById(id) {
      const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
      if (!row) return null;
      return {
        ...row,
        vessels: JSON.parse(row.vessels || '[]'),
        project_managers: JSON.parse(row.project_managers || '[]'),
      };
    },

    // === Projects ===
    getProjects() {
      return db.prepare(`
        SELECT p.*, c.name as client_name, c.logo_url_light, c.logo_url_dark, c.vessels, c.project_managers
        FROM projects p
        LEFT JOIN companies c ON p.client_id = c.id
        ORDER BY p.created_at DESC
      `).all().map(row => ({
        ...row,
        client: row.client_name ? {
          name: row.client_name,
          logo_url_light: row.logo_url_light,
          logo_url_dark: row.logo_url_dark,
          vessels: JSON.parse(row.vessels || '[]'),
          project_managers: JSON.parse(row.project_managers || '[]'),
        } : null,
      }));
    },

    getProjectById(id) {
      const row = db.prepare(`
        SELECT p.*, c.name as client_name, c.logo_url_light, c.logo_url_dark, c.vessels, c.project_managers
        FROM projects p
        LEFT JOIN companies c ON p.client_id = c.id
        WHERE p.id = ?
      `).get(id);
      if (!row) return null;
      return {
        ...row,
        client: row.client_name ? {
          name: row.client_name,
          logo_url_light: row.logo_url_light,
          logo_url_dark: row.logo_url_dark,
          vessels: JSON.parse(row.vessels || '[]'),
          project_managers: JSON.parse(row.project_managers || '[]'),
        } : null,
      };
    },

    // === Access Logs ===
    getAccessLogs(filters = {}) {
      let sql = 'SELECT * FROM access_logs';
      const conditions = [];
      const params = [];

      if (filters.since) {
        conditions.push('timestamp >= ?');
        params.push(filters.since);
      }
      if (filters.direction) {
        conditions.push('direction = ?');
        params.push(filters.direction);
      }
      if (filters.access_status) {
        conditions.push('access_status = ?');
        params.push(filters.access_status);
      }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY timestamp DESC LIMIT 1000';

      return db.prepare(sql).all(...params);
    },

    insertAccessLog(data) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO access_logs (id, worker_id, device_id, timestamp, access_status, direction, reason, score, worker_name, worker_document, device_name, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id, data.worker_id || null, data.device_id || null,
        data.timestamp || new Date().toISOString(),
        data.access_status, data.direction || 'unknown',
        data.reason || null, data.score || null,
        data.worker_name || null, data.worker_document || null,
        data.device_name || null
      );
      return { id, ...data };
    },

    // === Workers On Board ===
    getWorkersOnBoard(projectId) {
      const today = new Date().toISOString().split('T')[0];
      const rows = db.prepare(`
        WITH last_events AS (
          SELECT worker_id, worker_name, device_name, direction, timestamp,
            ROW_NUMBER() OVER (PARTITION BY worker_id ORDER BY timestamp DESC) as rn
          FROM access_logs
          WHERE timestamp >= ? || 'T00:00:00'
            AND access_status = 'granted'
            AND worker_id IS NOT NULL
        )
        SELECT le.worker_id, le.worker_name, le.device_name, le.timestamp as entry_time,
          w.name, w.role, w.company_id, c.name as company_name
        FROM last_events le
        LEFT JOIN workers w ON le.worker_id = w.id
        LEFT JOIN companies c ON w.company_id = c.id
        WHERE le.rn = 1 AND le.direction = 'entry'
      `).all(today);

      return rows.map(r => ({
        id: r.worker_id,
        name: r.name || r.worker_name,
        location: r.device_name,
        role: r.role,
        company: r.company_name || 'N/A',
        company_id: r.company_id,
        entryTime: r.entry_time,
      }));
    },

    // === Devices ===
    getDevices(projectId) {
      let sql = 'SELECT * FROM devices';
      if (projectId) sql += ' WHERE project_id = ?';
      sql += ' ORDER BY name';
      return projectId ? db.prepare(sql).all(projectId) : db.prepare(sql).all();
    },

    // === Job Functions ===
    getJobFunctions() {
      return db.prepare('SELECT * FROM job_functions ORDER BY name').all();
    },

    // === Sync helpers ===
    getUnsyncedWorkers() {
      return db.prepare('SELECT * FROM workers WHERE synced = 0').all();
    },

    getUnsyncedLogs() {
      return db.prepare('SELECT * FROM access_logs WHERE synced = 0').all();
    },

    markWorkerSynced(id, cloudId) {
      db.prepare('UPDATE workers SET synced = 1, cloud_id = ? WHERE id = ?').run(cloudId, id);
    },

    markLogsSynced(ids) {
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE access_logs SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
    },

    upsertWorkerFromCloud(data) {
      const existing = db.prepare('SELECT id FROM workers WHERE cloud_id = ?').get(data.id);
      if (existing) {
        db.prepare(`
          UPDATE workers SET name = ?, company_id = ?, role = ?, status = ?, document_number = ?, 
          photo_url = ?, allowed_project_ids = ?, updated_at = datetime('now'), synced = 1
          WHERE cloud_id = ?
        `).run(data.name, data.company_id, data.role, data.status, data.document_number,
          data.photo_url, JSON.stringify(data.allowed_project_ids || []), data.id);
      } else {
        db.prepare(`
          INSERT INTO workers (id, code, name, company_id, role, status, document_number, photo_url, allowed_project_ids, cloud_id, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(uuidv4(), data.code || 0, data.name, data.company_id, data.role, data.status,
          data.document_number, data.photo_url, JSON.stringify(data.allowed_project_ids || []), data.id);
      }
    },

    upsertCompanyFromCloud(data) {
      const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(data.id);
      if (existing) {
        db.prepare(`UPDATE companies SET name = ?, cnpj = ?, status = ?, updated_at = datetime('now'), synced = 1 WHERE id = ?`)
          .run(data.name, data.cnpj, data.status, data.id);
      } else {
        db.prepare(`INSERT INTO companies (id, name, cnpj, status, synced) VALUES (?, ?, ?, ?, 1)`)
          .run(data.id, data.name, data.cnpj, data.status);
      }
    },

    upsertProjectFromCloud(data) {
      const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(data.id);
      if (existing) {
        db.prepare(`UPDATE projects SET name = ?, client_id = ?, status = ?, location = ?, crew_size = ?, updated_at = datetime('now'), synced = 1 WHERE id = ?`)
          .run(data.name, data.client_id, data.status, data.location, data.crew_size, data.id);
      } else {
        db.prepare(`INSERT INTO projects (id, name, client_id, status, location, crew_size, synced) VALUES (?, ?, ?, ?, ?, ?, 1)`)
          .run(data.id, data.name, data.client_id, data.status, data.location, data.crew_size);
      }
    },

    getSyncMeta(key) {
      const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
      return row ? row.value : null;
    },

    setSyncMeta(key, value) {
      db.prepare('INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, datetime("now"))').run(key, value);
    },

    getRawDb() {
      return db;
    },
  };
}

function getDatabase() {
  return db;
}

module.exports = { initDatabase, getDatabase };
