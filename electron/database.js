const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

let db;

const SQLITE_UUID_EXPR = "(lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))))";

function safeParseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeCompanyRow(row) {
  if (!row) return null;
  return {
    ...row,
    vessels: safeParseJson(row.vessels, []),
    project_managers: safeParseJson(row.project_managers, []),
  };
}

function normalizeWorkerRow(row) {
  if (!row) return null;
  return {
    ...row,
    allowed_project_ids: safeParseJson(row.allowed_project_ids, []),
    devices_enrolled: safeParseJson(row.devices_enrolled, []),
  };
}

function normalizeDeviceRow(row) {
  if (!row) return null;
  return {
    ...row,
    configuration: safeParseJson(row.configuration, {}),
  };
}

function normalizeWorkerDocumentRow(row) {
  if (!row) return null;
  return {
    ...row,
    extracted_data: safeParseJson(row.extracted_data, null),
  };
}

function initDatabase(userDataPath) {
  const dbPath = path.join(userDataPath, 'dockcheck.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
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

    CREATE TABLE IF NOT EXISTS user_companies (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
      user_id TEXT NOT NULL UNIQUE,
      company_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS company_documents (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
      company_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
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
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
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

    CREATE TABLE IF NOT EXISTS worker_documents (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
      worker_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      document_url TEXT,
      expiry_date TEXT,
      issue_date TEXT,
      filename TEXT,
      extracted_data TEXT,
      status TEXT DEFAULT 'valid',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
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
      agent_id TEXT,
      api_credentials TEXT DEFAULT '{}',
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
    CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_worker_documents_worker ON worker_documents(worker_id);
  `);

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

      return db.prepare(sql).all(...params).map((row) => ({
        ...normalizeWorkerRow(row),
        company: row.company_name || 'N/A',
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
        ...normalizeWorkerRow(row),
        company: row.company_name || 'N/A',
      };
    },

    createWorker(data) {
      const id = uuidv4();
      const code = nextWorkerCode++;
      db.prepare(`
        INSERT INTO workers (id, code, name, company_id, role, status, document_number, photo_url, job_function_id, birth_date, gender, blood_type, observations, allowed_project_ids, devices_enrolled, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        code,
        data.name,
        data.company_id || null,
        data.role || null,
        data.status || 'active',
        data.document_number || null,
        data.photo_url || null,
        data.job_function_id || null,
        data.birth_date || null,
        data.gender || null,
        data.blood_type || null,
        data.observations || null,
        JSON.stringify(data.allowed_project_ids || []),
        JSON.stringify(data.devices_enrolled || []),
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
          params.push(JSON.stringify(value || []));
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
      db.prepare('DELETE FROM worker_documents WHERE worker_id = ?').run(id);
      db.prepare('DELETE FROM workers WHERE id = ?').run(id);
    },

    // === Companies ===
    getCompanies() {
      return db.prepare('SELECT * FROM companies ORDER BY name').all().map(normalizeCompanyRow);
    },

    getCompanyById(id) {
      const row = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
      return normalizeCompanyRow(row);
    },

    getCompanyByUserId(userId) {
      const row = db.prepare(`
        SELECT uc.company_id, c.*
        FROM user_companies uc
        INNER JOIN companies c ON c.id = uc.company_id
        WHERE uc.user_id = ?
        LIMIT 1
      `).get(userId);

      if (!row) return null;

      return {
        company_id: row.company_id,
        companies: normalizeCompanyRow(row),
      };
    },

    createCompany(data) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO companies (id, name, cnpj, contact_email, logo_url_light, logo_url_dark, status, vessels, project_managers, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        data.name,
        data.cnpj || null,
        data.contact_email || null,
        data.logo_url_light || null,
        data.logo_url_dark || null,
        data.status || 'active',
        JSON.stringify(data.vessels || []),
        JSON.stringify(data.project_managers || []),
      );

      if (data.user_id) {
        db.prepare(`
          INSERT INTO user_companies (id, user_id, company_id)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET company_id = excluded.company_id
        `).run(uuidv4(), data.user_id, id);
      }

      if (Array.isArray(data.documents) && data.documents.length > 0) {
        const insertDoc = db.prepare(`
          INSERT INTO company_documents (id, company_id, document_type, filename, file_url, synced)
          VALUES (?, ?, ?, ?, ?, 0)
        `);

        for (const doc of data.documents) {
          insertDoc.run(
            uuidv4(),
            id,
            doc.document_type || 'Institucional',
            doc.filename,
            doc.file_url || null,
          );
        }
      }

      return this.getCompanyById(id);
    },

    updateCompany(id, data) {
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at', 'cloud_id', 'documents', 'user_id'].includes(key)) continue;
        if (key === 'vessels' || key === 'project_managers') {
          sets.push(`${key} = ?`);
          params.push(JSON.stringify(value || []));
        } else {
          sets.push(`${key} = ?`);
          params.push(value);
        }
      }
      sets.push("updated_at = datetime('now')");
      sets.push('synced = 0');
      params.push(id);
      db.prepare(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return this.getCompanyById(id);
    },

    deleteCompany(id) {
      db.prepare('DELETE FROM company_documents WHERE company_id = ?').run(id);
      db.prepare('DELETE FROM user_companies WHERE company_id = ?').run(id);
      db.prepare('DELETE FROM companies WHERE id = ?').run(id);
    },

    getCompanyDocuments(companyId) {
      return db.prepare('SELECT * FROM company_documents WHERE company_id = ? ORDER BY created_at DESC').all(companyId);
    },

    createCompanyDocument(data) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO company_documents (id, company_id, document_type, filename, file_url, synced)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(id, data.company_id, data.document_type, data.filename, data.file_url || null);
      return db.prepare('SELECT * FROM company_documents WHERE id = ?').get(id);
    },

    updateCompanyDocument(id, data) {
      const existing = db.prepare('SELECT * FROM company_documents WHERE id = ?').get(id);
      if (!existing) return null;

      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at', 'cloud_id'].includes(key)) continue;
        sets.push(`${key} = ?`);
        params.push(value ?? null);
      }
      if (!sets.length) return existing;

      sets.push('synced = 0');
      params.push(id);
      db.prepare(`UPDATE company_documents SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return db.prepare('SELECT * FROM company_documents WHERE id = ?').get(id);
    },

    deleteCompanyDocument(id) {
      db.prepare('DELETE FROM company_documents WHERE id = ?').run(id);
    },

    // === Projects ===
    getProjects() {
      return db.prepare(`
        SELECT p.*, c.name as client_name, c.logo_url_light, c.logo_url_dark, c.vessels, c.project_managers
        FROM projects p
        LEFT JOIN companies c ON p.client_id = c.id
        ORDER BY p.created_at DESC
      `).all().map((row) => ({
        ...row,
        client: row.client_name ? {
          name: row.client_name,
          logo_url_light: row.logo_url_light,
          logo_url_dark: row.logo_url_dark,
          vessels: safeParseJson(row.vessels, []),
          project_managers: safeParseJson(row.project_managers, []),
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
          vessels: safeParseJson(row.vessels, []),
          project_managers: safeParseJson(row.project_managers, []),
        } : null,
      };
    },

    createProject(data) {
      const id = data.id || uuidv4();
      db.prepare(`
        INSERT INTO projects (id, name, client_id, status, location, commander, chief_engineer, project_type, armador, crew_size, start_date, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        data.name,
        data.client_id || null,
        data.status || 'active',
        data.location || null,
        data.commander || null,
        data.chief_engineer || null,
        data.project_type || null,
        data.armador || null,
        data.crew_size || 0,
        data.start_date || null,
      );
      return this.getProjectById(id);
    },

    updateProject(id, data) {
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at', 'cloud_id'].includes(key)) continue;
        sets.push(`${key} = ?`);
        params.push(value);
      }
      sets.push("updated_at = datetime('now')");
      sets.push('synced = 0');
      params.push(id);
      db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return this.getProjectById(id);
    },

    deleteProject(id) {
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    },

    // === Worker Documents ===
    getWorkerDocuments(filters = {}) {
      let sql = 'SELECT * FROM worker_documents';
      const conditions = [];
      const params = [];

      if (filters.worker_id) {
        conditions.push('worker_id = ?');
        params.push(filters.worker_id);
      }

      const workerIds = Array.isArray(filters.worker_ids)
        ? filters.worker_ids.filter(Boolean)
        : typeof filters.worker_ids === 'string'
          ? filters.worker_ids.split(',').filter(Boolean)
          : [];

      if (workerIds.length > 0) {
        conditions.push(`worker_id IN (${workerIds.map(() => '?').join(',')})`);
        params.push(...workerIds);
      }

      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY created_at DESC';

      return db.prepare(sql).all(...params).map(normalizeWorkerDocumentRow);
    },

    getWorkersWithExpiringDocuments(daysAhead = 30) {
      const today = new Date().toISOString().split('T')[0];
      const future = new Date();
      future.setDate(future.getDate() + Number(daysAhead || 30));
      const futureDate = future.toISOString().split('T')[0];

      return db.prepare(`
        SELECT wd.*, w.id as worker_ref_id, w.name as worker_name, w.company_id, w.document_number
        FROM worker_documents wd
        LEFT JOIN workers w ON w.id = wd.worker_id
        WHERE wd.expiry_date IS NOT NULL
          AND wd.expiry_date >= ?
          AND wd.expiry_date <= ?
        ORDER BY wd.expiry_date ASC
      `).all(today, futureDate).map((row) => ({
        ...normalizeWorkerDocumentRow(row),
        worker: {
          id: row.worker_ref_id,
          name: row.worker_name,
          company_id: row.company_id,
          document_number: row.document_number,
        },
      }));
    },

    getExpiredDocuments() {
      const today = new Date().toISOString().split('T')[0];

      return db.prepare(`
        SELECT wd.*, w.id as worker_ref_id, w.name as worker_name, w.company_id, w.document_number
        FROM worker_documents wd
        LEFT JOIN workers w ON w.id = wd.worker_id
        WHERE wd.expiry_date IS NOT NULL
          AND wd.expiry_date < ?
        ORDER BY wd.expiry_date ASC
      `).all(today).map((row) => ({
        ...normalizeWorkerDocumentRow(row),
        worker: {
          id: row.worker_ref_id,
          name: row.worker_name,
          company_id: row.company_id,
          document_number: row.document_number,
        },
      }));
    },

    createWorkerDocument(data) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO worker_documents (id, worker_id, document_type, document_url, expiry_date, issue_date, filename, extracted_data, status, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        data.worker_id,
        data.document_type,
        data.document_url || null,
        data.expiry_date || null,
        data.issue_date || null,
        data.filename || null,
        data.extracted_data ? JSON.stringify(data.extracted_data) : null,
        data.status || 'valid',
      );
      return normalizeWorkerDocumentRow(db.prepare('SELECT * FROM worker_documents WHERE id = ?').get(id));
    },

    updateWorkerDocument(id, data) {
      const existing = db.prepare('SELECT * FROM worker_documents WHERE id = ?').get(id);
      if (!existing) return null;

      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at', 'cloud_id', 'workerId'].includes(key)) continue;
        if (key === 'extracted_data') {
          sets.push('extracted_data = ?');
          params.push(value ? JSON.stringify(value) : null);
        } else {
          sets.push(`${key} = ?`);
          params.push(value ?? null);
        }
      }
      if (!sets.length) return normalizeWorkerDocumentRow(existing);

      sets.push("updated_at = datetime('now')");
      sets.push('synced = 0');
      params.push(id);
      db.prepare(`UPDATE worker_documents SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return normalizeWorkerDocumentRow(db.prepare('SELECT * FROM worker_documents WHERE id = ?').get(id));
    },

    deleteWorkerDocument(id) {
      db.prepare('DELETE FROM worker_documents WHERE id = ?').run(id);
    },

    // === Access Logs ===
    getAccessLogs(filters = {}) {
      let sql = `
        SELECT al.*
        FROM access_logs al
        LEFT JOIN devices d ON d.id = al.device_id
      `;
      const conditions = [];
      const params = [];

      if (filters.projectId) {
        conditions.push('d.project_id = ?');
        params.push(filters.projectId);
      }
      if (filters.startDate) {
        conditions.push('al.timestamp >= ?');
        params.push(`${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        conditions.push('al.timestamp <= ?');
        params.push(`${filters.endDate}T23:59:59`);
      }
      if (filters.since) {
        conditions.push('al.timestamp >= ?');
        params.push(filters.since);
      }
      if (filters.direction) {
        conditions.push('al.direction = ?');
        params.push(filters.direction);
      }
      if (filters.access_status) {
        conditions.push('al.access_status = ?');
        params.push(filters.access_status);
      }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

      const limit = Number(filters.limit || 100);
      sql += ` ORDER BY al.timestamp DESC LIMIT ${Number.isFinite(limit) && limit > 0 ? limit : 100}`;

      return db.prepare(sql).all(...params);
    },

    insertAccessLog(data) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO access_logs (id, worker_id, device_id, timestamp, access_status, direction, reason, score, worker_name, worker_document, device_name, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        id,
        data.worker_id || null,
        data.device_id || null,
        data.timestamp || new Date().toISOString(),
        data.access_status,
        data.direction || 'unknown',
        data.reason || null,
        data.score || null,
        data.worker_name || null,
        data.worker_document || null,
        data.device_name || null,
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

      return rows.map((r) => ({
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
      const rows = projectId ? db.prepare(sql).all(projectId) : db.prepare(sql).all();
      return rows.map(normalizeDeviceRow);
    },

    getDeviceById(id) {
      return normalizeDeviceRow(db.prepare('SELECT * FROM devices WHERE id = ?').get(id));
    },

    createDevice(data) {
      const id = data.id || uuidv4();
      db.prepare(`
        INSERT INTO devices (id, name, controlid_serial_number, controlid_ip_address, type, status, location, project_id, configuration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.controlid_serial_number || null,
        data.controlid_ip_address || null,
        data.type || 'facial_reader',
        data.status || 'offline',
        data.location || null,
        data.project_id || null,
        JSON.stringify(data.configuration || {}),
      );
      return this.getDeviceById(id);
    },

    updateDevice(id, data) {
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at'].includes(key)) continue;
        if (key === 'configuration') {
          sets.push('configuration = ?');
          params.push(JSON.stringify(value || {}));
        } else {
          sets.push(`${key} = ?`);
          params.push(value);
        }
      }
      sets.push("updated_at = datetime('now')");
      params.push(id);
      db.prepare(`UPDATE devices SET ${sets.join(', ')} WHERE id = ?`).run(...params);
      return this.getDeviceById(id);
    },

    // === Job Functions ===
    getJobFunctions() {
      return db.prepare('SELECT * FROM job_functions ORDER BY name').all();
    },

    createJobFunction(data) {
      const id = data.id || uuidv4();
      db.prepare(`
        INSERT INTO job_functions (id, name, description)
        VALUES (?, ?, ?)
      `).run(id, data.name, data.description || null);
      return db.prepare('SELECT * FROM job_functions WHERE id = ?').get(id);
    },

    updateJobFunction(id, data) {
      db.prepare(`
        UPDATE job_functions
        SET name = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.name, data.description || null, id);
      return db.prepare('SELECT * FROM job_functions WHERE id = ?').get(id);
    },

    deleteJobFunction(id) {
      db.prepare('DELETE FROM job_functions WHERE id = ?').run(id);
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
        `).run(
          data.name,
          data.company_id,
          data.role,
          data.status,
          data.document_number,
          data.photo_url,
          JSON.stringify(data.allowed_project_ids || []),
          data.id,
        );
      } else {
        db.prepare(`
          INSERT INTO workers (id, code, name, company_id, role, status, document_number, photo_url, allowed_project_ids, cloud_id, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          uuidv4(),
          data.code || 0,
          data.name,
          data.company_id,
          data.role,
          data.status,
          data.document_number,
          data.photo_url,
          JSON.stringify(data.allowed_project_ids || []),
          data.id,
        );
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
