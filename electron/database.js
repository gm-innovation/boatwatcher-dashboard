const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const uuidv4 = () => crypto.randomUUID();

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

function resolveLocalEntityId(tableName, cloudId) {
  if (!cloudId || !db) return null;
  const row = db.prepare(`SELECT id FROM ${tableName} WHERE cloud_id = ? OR id = ?`).get(cloudId, cloudId);
  return row ? row.id : null;
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
    api_credentials: safeParseJson(row.api_credentials, {}),
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
  db.pragma('foreign_keys = ON');

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
      updated_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS company_documents (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
      company_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
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

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY DEFAULT ${SQLITE_UUID_EXPR},
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      operation TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_info (
      id TEXT PRIMARY KEY,
      name TEXT,
      project_ids TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      last_sync TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_access_logs_worker ON access_logs(worker_id);
    CREATE INDEX IF NOT EXISTS idx_access_logs_synced ON access_logs(synced);
    CREATE INDEX IF NOT EXISTS idx_workers_synced ON workers(synced);
    CREATE INDEX IF NOT EXISTS idx_workers_company ON workers(company_id);
    CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_companies_company ON user_companies(company_id);
    CREATE INDEX IF NOT EXISTS idx_user_companies_synced ON user_companies(synced);
    CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_documents_synced ON company_documents(synced);
    CREATE INDEX IF NOT EXISTS idx_worker_documents_worker ON worker_documents(worker_id);
    CREATE INDEX IF NOT EXISTS idx_worker_documents_synced ON worker_documents(synced);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
  `);

  const deviceColumns = db.prepare("PRAGMA table_info(devices)").all();
  const deviceColumnNames = new Set(deviceColumns.map((column) => column.name));

  if (!deviceColumnNames.has('agent_id')) {
    db.exec("ALTER TABLE devices ADD COLUMN agent_id TEXT");
  }

  if (!deviceColumnNames.has('api_credentials')) {
    db.exec("ALTER TABLE devices ADD COLUMN api_credentials TEXT DEFAULT '{}'");
  }

  // Ensure cloud_id columns exist on all sync-capable tables (handles older installs)
  const ensureCloudIdColumns = [
    { table: 'companies', extras: [] },
    { table: 'projects', extras: [] },
    { table: 'workers', extras: [] },
    { table: 'user_companies', extras: ['updated_at TEXT', 'synced INTEGER DEFAULT 0'] },
    { table: 'company_documents', extras: ['updated_at TEXT', 'synced INTEGER DEFAULT 0'] },
    { table: 'worker_documents', extras: ['updated_at TEXT', 'synced INTEGER DEFAULT 0'] },
  ];

  for (const { table, extras } of ensureCloudIdColumns) {
    const cols = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const extraDef of extras) {
      const colName = extraDef.split(' ')[0];
      if (!cols.has(colName)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${extraDef}`);
    }
    if (!cols.has('cloud_id')) db.exec(`ALTER TABLE ${table} ADD COLUMN cloud_id TEXT`);
    if (!cols.has('synced') && !extras.some((e) => e.startsWith('synced'))) {
      if (!cols.has('synced')) db.exec(`ALTER TABLE ${table} ADD COLUMN synced INTEGER DEFAULT 0`);
    }
  }

  db.exec("UPDATE user_companies SET updated_at = COALESCE(updated_at, created_at, datetime('now'))");
  db.exec("UPDATE company_documents SET updated_at = COALESCE(updated_at, created_at, datetime('now'))");
  db.exec("UPDATE worker_documents SET updated_at = COALESCE(updated_at, created_at, datetime('now'))");

  const maxCode = db.prepare('SELECT MAX(code) as max_code FROM workers').get();
  const nextCode = (maxCode?.max_code || 0) + 1;

  return createDatabaseAPI(db, nextCode);
}

function createDatabaseAPI(db, startCode) {
  let nextWorkerCode = startCode;

  const insertSyncQueue = db.prepare(`
    INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  const deleteSyncQueueByEntity = db.prepare('DELETE FROM sync_queue WHERE entity_type = ? AND entity_id = ?');
  const syncEntityTableMap = {
    company: 'companies',
    user_company: 'user_companies',
    company_document: 'company_documents',
    worker_document: 'worker_documents',
  };

  function parseQueueRow(row) {
    if (!row) return null;
    return {
      ...row,
      payload: safeParseJson(row.payload, null),
    };
  }

  function queueSyncOperation(entityType, operation, entityId, payload) {
    deleteSyncQueueByEntity.run(entityType, entityId);
    insertSyncQueue.run(
      uuidv4(),
      entityType,
      entityId,
      operation,
      payload ? JSON.stringify(payload) : null,
    );
  }

  function clearQueuedSyncOperation(entityType, entityId) {
    deleteSyncQueueByEntity.run(entityType, entityId);
  }

  function shouldDropQueuedSyncOperation(row) {
    const queueRow = parseQueueRow(row);
    if (!queueRow || queueRow.operation !== 'delete') return false;

    const table = syncEntityTableMap[queueRow.entity_type];
    if (!table) return false;

    if (queueRow.payload?.cloud_id) return false;

    const resolvedCloudId = resolveCloudEntityId(table, queueRow.entity_id);
    return !resolvedCloudId;
  }

  function resolveCloudEntityId(table, localId) {
    if (!localId) return null;
    const row = db.prepare(`SELECT id, cloud_id, synced FROM ${table} WHERE id = ? LIMIT 1`).get(localId);
    if (!row) return null;
    if (row.cloud_id) return row.cloud_id;
    return row.synced ? row.id : null;
  }

  function resolveLocalEntityId(table, cloudId) {
    if (!cloudId) return null;
    const row = db.prepare(`SELECT id FROM ${table} WHERE cloud_id = ? OR id = ? LIMIT 1`).get(cloudId, cloudId);
    return row?.id || null;
  }

  function prepareSyncOperationForUpload(row) {
    const queueRow = parseQueueRow(row);
    if (!queueRow) return null;
    const payload = queueRow.payload || {};

    if (queueRow.entity_type === 'company') {
      if (queueRow.operation === 'delete') {
        const cloudId = payload.cloud_id || resolveCloudEntityId('companies', queueRow.entity_id);
        if (!cloudId) return null;
        return { ...queueRow, payload: { cloud_id: cloudId } };
      }

      if (!payload.name) return null;
      return {
        ...queueRow,
        payload: {
          cloud_id: payload.cloud_id || resolveCloudEntityId('companies', queueRow.entity_id),
          name: payload.name,
          cnpj: payload.cnpj || null,
          contact_email: payload.contact_email || null,
          logo_url_light: payload.logo_url_light || null,
          logo_url_dark: payload.logo_url_dark || null,
          status: payload.status || 'active',
          vessels: payload.vessels || [],
          project_managers: payload.project_managers || [],
        },
      };
    }

    if (queueRow.entity_type === 'user_company') {
      if (queueRow.operation === 'delete') {
        const cloudId = payload.cloud_id || resolveCloudEntityId('user_companies', queueRow.entity_id);
        if (!cloudId) return null;
        return { ...queueRow, payload: { cloud_id: cloudId, user_id: payload.user_id || null } };
      }

      const cloudCompanyId = resolveCloudEntityId('companies', payload.company_id);
      if (!cloudCompanyId || !payload.user_id) return null;
      return {
        ...queueRow,
        payload: {
          user_id: payload.user_id,
          company_id: cloudCompanyId,
          cloud_id: payload.cloud_id || resolveCloudEntityId('user_companies', queueRow.entity_id),
        },
      };
    }

    if (queueRow.entity_type === 'company_document') {
      if (queueRow.operation === 'delete') {
        const cloudId = payload.cloud_id || resolveCloudEntityId('company_documents', queueRow.entity_id);
        if (!cloudId) return null;
        return { ...queueRow, payload: { cloud_id: cloudId } };
      }

      const cloudCompanyId = resolveCloudEntityId('companies', payload.company_id);
      if (!cloudCompanyId) return null;
      return {
        ...queueRow,
        payload: {
          cloud_id: payload.cloud_id || resolveCloudEntityId('company_documents', queueRow.entity_id),
          company_id: cloudCompanyId,
          document_type: payload.document_type,
          filename: payload.filename,
          file_url: payload.file_url || null,
        },
      };
    }

    if (queueRow.entity_type === 'worker_document') {
      if (queueRow.operation === 'delete') {
        const cloudId = payload.cloud_id || resolveCloudEntityId('worker_documents', queueRow.entity_id);
        if (!cloudId) return null;
        return { ...queueRow, payload: { cloud_id: cloudId } };
      }

      const cloudWorkerId = resolveCloudEntityId('workers', payload.worker_id);
      if (!cloudWorkerId) return null;
      return {
        ...queueRow,
        payload: {
          cloud_id: payload.cloud_id || resolveCloudEntityId('worker_documents', queueRow.entity_id),
          worker_id: cloudWorkerId,
          document_type: payload.document_type,
          document_url: payload.document_url || null,
          expiry_date: payload.expiry_date || null,
          issue_date: payload.issue_date || null,
          filename: payload.filename || null,
          extracted_data: payload.extracted_data || null,
          status: payload.status || 'valid',
        },
      };
    }

    return queueRow;
  }

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

      queueSyncOperation('company', 'upsert', id, {
        name: data.name,
        cnpj: data.cnpj || null,
        contact_email: data.contact_email || null,
        logo_url_light: data.logo_url_light || null,
        logo_url_dark: data.logo_url_dark || null,
        status: data.status || 'active',
        vessels: data.vessels || [],
        project_managers: data.project_managers || [],
        cloud_id: null,
      });

      if (data.user_id) {
        const associationId = uuidv4();
        db.prepare(`
          INSERT INTO user_companies (id, user_id, company_id, created_at, updated_at, synced)
          VALUES (?, ?, ?, datetime('now'), datetime('now'), 0)
          ON CONFLICT(user_id) DO UPDATE SET company_id = excluded.company_id, updated_at = datetime('now'), synced = 0
        `).run(associationId, data.user_id, id);

        const association = db.prepare('SELECT * FROM user_companies WHERE user_id = ?').get(data.user_id);
        queueSyncOperation('user_company', 'upsert', association.id, {
          user_id: association.user_id,
          company_id: association.company_id,
          cloud_id: association.cloud_id || null,
        });
      }

      if (Array.isArray(data.documents) && data.documents.length > 0) {
        const insertDoc = db.prepare(`
          INSERT INTO company_documents (id, company_id, document_type, filename, file_url, created_at, updated_at, synced)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
        `);

        for (const doc of data.documents) {
          const documentId = uuidv4();
          insertDoc.run(
            documentId,
            id,
            doc.document_type || 'Institucional',
            doc.filename,
            doc.file_url || null,
          );
          queueSyncOperation('company_document', 'upsert', documentId, {
            company_id: id,
            document_type: doc.document_type || 'Institucional',
            filename: doc.filename,
            file_url: doc.file_url || null,
            cloud_id: null,
          });
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
      const updated = this.getCompanyById(id);
      if (updated) {
        queueSyncOperation('company', 'upsert', id, {
          name: updated.name,
          cnpj: updated.cnpj || null,
          contact_email: updated.contact_email || null,
          logo_url_light: updated.logo_url_light || null,
          logo_url_dark: updated.logo_url_dark || null,
          status: updated.status || 'active',
          vessels: updated.vessels || [],
          project_managers: updated.project_managers || [],
          cloud_id: updated.cloud_id || null,
        });
      }
      return updated;
    },

    deleteCompany(id) {
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
      const documents = db.prepare('SELECT * FROM company_documents WHERE company_id = ?').all(id);
      const associations = db.prepare('SELECT * FROM user_companies WHERE company_id = ?').all(id);

      for (const doc of documents) {
        if (doc.cloud_id || doc.synced) {
          queueSyncOperation('company_document', 'delete', doc.id, {
            cloud_id: doc.cloud_id || null,
          });
        } else {
          clearQueuedSyncOperation('company_document', doc.id);
        }
      }

      for (const association of associations) {
        if (association.cloud_id || association.synced) {
          queueSyncOperation('user_company', 'delete', association.id, {
            cloud_id: association.cloud_id || null,
            user_id: association.user_id,
          });
        } else {
          clearQueuedSyncOperation('user_company', association.id);
        }
      }

      if (company?.cloud_id || company?.synced) {
        queueSyncOperation('company', 'delete', id, {
          cloud_id: company?.cloud_id || null,
        });
      } else {
        clearQueuedSyncOperation('company', id);
      }

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
        INSERT INTO company_documents (id, company_id, document_type, filename, file_url, created_at, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
      `).run(id, data.company_id, data.document_type, data.filename, data.file_url || null);

      queueSyncOperation('company_document', 'upsert', id, {
        company_id: data.company_id,
        document_type: data.document_type,
        filename: data.filename,
        file_url: data.file_url || null,
        cloud_id: null,
      });

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

      sets.push("updated_at = datetime('now')");
      sets.push('synced = 0');
      params.push(id);
      db.prepare(`UPDATE company_documents SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      const updated = db.prepare('SELECT * FROM company_documents WHERE id = ?').get(id);
      queueSyncOperation('company_document', 'upsert', id, {
        company_id: updated.company_id,
        document_type: updated.document_type,
        filename: updated.filename,
        file_url: updated.file_url || null,
        cloud_id: updated.cloud_id || null,
      });

      return updated;
    },

    deleteCompanyDocument(id) {
      const existing = db.prepare('SELECT * FROM company_documents WHERE id = ?').get(id);
      if (!existing) return;

      if (existing.cloud_id || existing.synced) {
        queueSyncOperation('company_document', 'delete', id, {
          cloud_id: existing.cloud_id || null,
        });
      } else {
        clearQueuedSyncOperation('company_document', id);
      }

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
        INSERT INTO worker_documents (id, worker_id, document_type, document_url, expiry_date, issue_date, filename, extracted_data, status, created_at, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 0)
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

      queueSyncOperation('worker_document', 'upsert', id, {
        worker_id: data.worker_id,
        document_type: data.document_type,
        document_url: data.document_url || null,
        expiry_date: data.expiry_date || null,
        issue_date: data.issue_date || null,
        filename: data.filename || null,
        extracted_data: data.extracted_data || null,
        status: data.status || 'valid',
        cloud_id: null,
      });

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

      const updated = normalizeWorkerDocumentRow(db.prepare('SELECT * FROM worker_documents WHERE id = ?').get(id));
      queueSyncOperation('worker_document', 'upsert', id, {
        worker_id: updated.worker_id,
        document_type: updated.document_type,
        document_url: updated.document_url || null,
        expiry_date: updated.expiry_date || null,
        issue_date: updated.issue_date || null,
        filename: updated.filename || null,
        extracted_data: updated.extracted_data || null,
        status: updated.status || 'valid',
        cloud_id: updated.cloud_id || null,
      });

      return updated;
    },

    deleteWorkerDocument(id) {
      const existing = db.prepare('SELECT * FROM worker_documents WHERE id = ?').get(id);
      if (!existing) return;

      if (existing.cloud_id || existing.synced) {
        queueSyncOperation('worker_document', 'delete', id, {
          cloud_id: existing.cloud_id || null,
        });
      } else {
        clearQueuedSyncOperation('worker_document', id);
      }

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
      // Compute local midnight in UTC (matches web: new Date(y,m,d).toISOString())
      const now = new Date();
      const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startTimestamp = localMidnight.toISOString();
      // Temporal ceiling: ignore timestamps more than 2 min in the future (matches web)
      const maxTimestamp = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      
      // Filter by project devices when projectId is provided
      const deviceFilter = projectId
        ? 'AND al.device_id IN (SELECT id FROM devices WHERE project_id = ?)'
        : '';
      const exitDeviceFilter = projectId
        ? 'AND ex.device_id IN (SELECT id FROM devices WHERE project_id = ?)'
        : '';
      const params = projectId
        ? [startTimestamp, maxTimestamp, projectId, startTimestamp, maxTimestamp, projectId]
        : [startTimestamp, maxTimestamp, startTimestamp, maxTimestamp];

      const rows = db.prepare(`
        WITH first_entries AS (
          SELECT al.worker_id, al.worker_name, al.device_name, al.timestamp,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(al.worker_name, al.worker_id)
              ORDER BY al.timestamp ASC
            ) as rn
          FROM access_logs al
          WHERE al.timestamp >= ?
            AND al.timestamp <= ?
            AND al.access_status = 'granted'
            AND al.direction = 'entry'
            AND al.worker_id IS NOT NULL
            ${deviceFilter}
        )
        SELECT fe.worker_id, fe.worker_name, fe.device_name, fe.timestamp as entry_time,
          w.name, w.role, w.company_id, c.name as company_name
        FROM first_entries fe
        LEFT JOIN workers w ON fe.worker_id = w.id
        LEFT JOIN companies c ON w.company_id = c.id
        WHERE fe.rn = 1
          AND NOT EXISTS (
            SELECT 1 FROM access_logs ex
            WHERE (ex.worker_name = fe.worker_name OR ex.worker_id = fe.worker_id)
              AND ex.direction = 'exit'
              AND ex.timestamp > fe.timestamp
              AND ex.timestamp >= ?
              AND ex.timestamp <= ?
              ${exitDeviceFilter}
          )
      `).all(...params);

      return rows.map((r) => {
        // Timestamps from cloud sync are already in UTC (ISO with Z).
        // Timestamps from local agent capture are also stored in UTC after +3h normalization.
        // Just ensure proper ISO format for the frontend.
        let entryTime = r.entry_time;
        if (entryTime && !entryTime.includes('Z') && !entryTime.includes('+')) {
          // Timestamps without timezone marker are legacy BRT data — tag as -03:00
          // so the frontend interprets them correctly as local time
          entryTime = entryTime + '-03:00';
        }
        return {
          id: r.worker_id,
          name: r.name || r.worker_name,
          location: r.device_name,
          role: r.role,
          company: r.company_name || 'N/A',
          company_id: r.company_id,
          entryTime,
        };
      });
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
        INSERT INTO devices (id, name, controlid_serial_number, controlid_ip_address, type, status, location, project_id, agent_id, api_credentials, configuration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.controlid_serial_number || null,
        data.controlid_ip_address || null,
        data.type || 'facial_reader',
        data.status || 'offline',
        data.location || null,
        data.project_id || null,
        data.agent_id || null,
        JSON.stringify(data.api_credentials || {}),
        JSON.stringify(data.configuration || {}),
      );
      return this.getDeviceById(id);
    },

    updateDevice(id, data) {
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        if (['id', 'created_at'].includes(key)) continue;
        if (key === 'configuration' || key === 'api_credentials') {
          sets.push(`${key} = ?`);
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

    deleteDevice(id) {
      db.prepare('DELETE FROM devices WHERE id = ?').run(id);
    },

    upsertDeviceFromCloud(data) {
      if (!data.id) return;
      // Validate project_id FK: if project doesn't exist locally, use null to avoid FK constraint failure
      let safeProjectId = data.project_id || null;
      if (safeProjectId) {
        const projectExists = db.prepare('SELECT id FROM projects WHERE id = ?').get(safeProjectId);
        if (!projectExists) {
          console.warn(`[db] upsertDeviceFromCloud: project ${safeProjectId} not found locally, setting project_id=null for device ${data.id}`);
          safeProjectId = null;
        }
      }
      const existing = db.prepare('SELECT id FROM devices WHERE id = ?').get(data.id);
      if (existing) {
        // NOTE: Do NOT overwrite `status` from cloud — local agent polling is the source of truth
        db.prepare(`
          UPDATE devices SET name = ?, controlid_serial_number = ?, controlid_ip_address = ?,
          type = ?, location = ?, project_id = ?, agent_id = ?,
          api_credentials = ?, configuration = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          data.name, data.controlid_serial_number || null, data.controlid_ip_address || null,
          data.type || 'facial_reader', data.location || null,
          safeProjectId, data.agent_id || null,
          JSON.stringify(data.api_credentials || {}), JSON.stringify(data.configuration || {}),
          data.id
        );
      } else {
        db.prepare(`
          INSERT INTO devices (id, name, controlid_serial_number, controlid_ip_address, type, status, location, project_id, agent_id, api_credentials, configuration)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.id, data.name, data.controlid_serial_number || null, data.controlid_ip_address || null,
          data.type || 'facial_reader', data.status || 'offline', data.location || null,
          safeProjectId, data.agent_id || null,
          JSON.stringify(data.api_credentials || {}), JSON.stringify(data.configuration || {})
        );
      }
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
      return db.prepare('SELECT * FROM workers WHERE synced = 0').all()
        .map(normalizeWorkerRow)
        .map((worker) => {
          const cloudCompanyId = worker.company_id ? resolveCloudEntityId('companies', worker.company_id) : null;
          if (worker.company_id && !cloudCompanyId) return null;
          return {
            ...worker,
            company_id: cloudCompanyId || worker.company_id || null,
          };
        })
        .filter(Boolean);
    },

    getUnsyncedLogs() {
      return db.prepare('SELECT * FROM access_logs WHERE synced = 0').all();
    },

    getPendingSyncOperations() {
      const rows = db.prepare('SELECT * FROM sync_queue ORDER BY created_at ASC').all();
      const operations = [];

      for (const row of rows) {
        if (shouldDropQueuedSyncOperation(row)) {
          db.prepare('DELETE FROM sync_queue WHERE id = ?').run(row.id);
          continue;
        }

        const prepared = prepareSyncOperationForUpload(row);
        if (prepared) {
          operations.push(prepared);
        }
      }

      return operations;
    },

    getPendingSyncCount() {
      const row = db.prepare('SELECT COUNT(*) as count FROM sync_queue').get();
      return row?.count || 0;
    },

    markWorkerSynced(id, cloudId) {
      db.prepare('UPDATE workers SET synced = 1, cloud_id = ? WHERE id = ?').run(cloudId, id);
    },

    markLogsSynced(ids) {
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE access_logs SET synced = 1 WHERE id IN (${placeholders})`).run(...ids);
    },

    markSyncEntitySynced(entityType, entityId, cloudId = null) {
      const table = syncEntityTableMap[entityType];
      if (!table || !entityId) return;

      if (cloudId) {
        db.prepare(`UPDATE ${table} SET synced = 1, cloud_id = ?, updated_at = datetime('now') WHERE id = ?`).run(cloudId, entityId);
      } else {
        db.prepare(`UPDATE ${table} SET synced = 1, updated_at = datetime('now') WHERE id = ?`).run(entityId);
      }
    },

    removeSyncQueueEntry(queueId) {
      db.prepare('DELETE FROM sync_queue WHERE id = ?').run(queueId);
    },

    upsertWorkerFromCloud(data) {
      const existing = db.prepare('SELECT id FROM workers WHERE cloud_id = ? OR id = ?').get(data.id, data.id);
      const localCompanyId = data.company_id ? (resolveLocalEntityId('companies', data.company_id) || null) : null;
      if (data.company_id && !localCompanyId) {
        console.warn(`[db] upsertWorkerFromCloud: company not found locally for cloud company_id=${data.company_id}, setting null`);
      }
      if (existing) {
        db.prepare(`
          UPDATE workers SET code = ?, name = ?, company_id = ?, role = ?, status = ?, document_number = ?, 
          photo_url = ?, allowed_project_ids = ?, job_function_id = ?, birth_date = ?, gender = ?,
          blood_type = ?, observations = ?, devices_enrolled = ?,
          updated_at = datetime('now'), synced = 1, cloud_id = ?
          WHERE id = ?
        `).run(
          data.code || 0,
          data.name,
          localCompanyId,
          data.role,
          data.status,
          data.document_number,
          data.photo_url,
          JSON.stringify(data.allowed_project_ids || []),
          data.job_function_id || null,
          data.birth_date || null,
          data.gender || null,
          data.blood_type || null,
          data.observations || null,
          JSON.stringify(data.devices_enrolled || []),
          data.id,
          existing.id,
        );
      } else {
        db.prepare(`
          INSERT INTO workers (id, code, name, company_id, role, status, document_number, photo_url,
          allowed_project_ids, job_function_id, birth_date, gender, blood_type, observations, devices_enrolled,
          cloud_id, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          uuidv4(),
          data.code || 0,
          data.name,
          localCompanyId,
          data.role,
          data.status,
          data.document_number,
          data.photo_url,
          JSON.stringify(data.allowed_project_ids || []),
          data.job_function_id || null,
          data.birth_date || null,
          data.gender || null,
          data.blood_type || null,
          data.observations || null,
          JSON.stringify(data.devices_enrolled || []),
          data.id,
        );
      }
    },

    upsertCompanyFromCloud(data) {
      const existing = db.prepare('SELECT id FROM companies WHERE cloud_id = ? OR id = ?').get(data.id, data.id);
      if (existing) {
        db.prepare(`
          UPDATE companies
          SET name = ?, cnpj = ?, contact_email = ?, logo_url_light = ?, logo_url_dark = ?, status = ?, vessels = ?, project_managers = ?, updated_at = datetime('now'), synced = 1, cloud_id = ?
          WHERE id = ?
        `).run(
          data.name,
          data.cnpj || null,
          data.contact_email || null,
          data.logo_url_light || null,
          data.logo_url_dark || null,
          data.status || 'active',
          JSON.stringify(data.vessels || []),
          JSON.stringify(data.project_managers || []),
          data.id,
          existing.id,
        );
      } else {
        db.prepare(`
          INSERT INTO companies (id, name, cnpj, contact_email, logo_url_light, logo_url_dark, status, vessels, project_managers, synced, cloud_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).run(
          uuidv4(),
          data.name,
          data.cnpj || null,
          data.contact_email || null,
          data.logo_url_light || null,
          data.logo_url_dark || null,
          data.status || 'active',
          JSON.stringify(data.vessels || []),
          JSON.stringify(data.project_managers || []),
          data.id,
        );
      }
    },

    upsertProjectFromCloud(data) {
      // CRITICAL: resolve cloud client_id to local company id; use null if not found (never pass cloud UUID as FK)
      let localClientId = null;
      if (data.client_id) {
        localClientId = resolveLocalEntityId('companies', data.client_id);
        if (!localClientId) {
          console.warn(`[db] upsertProjectFromCloud: company not found locally for cloud client_id=${data.client_id}, setting client_id=null for project ${data.id}`);
        }
      }
      const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(data.id);
      if (existing) {
        db.prepare(`UPDATE projects SET name = ?, client_id = ?, status = ?, location = ?, crew_size = ?, commander = ?, chief_engineer = ?, project_type = ?, armador = ?, start_date = ?, updated_at = datetime('now'), synced = 1 WHERE id = ?`)
          .run(data.name, localClientId, data.status, data.location, data.crew_size, data.commander || null, data.chief_engineer || null, data.project_type || null, data.armador || null, data.start_date || null, data.id);
      } else {
        db.prepare(`INSERT INTO projects (id, name, client_id, status, location, crew_size, commander, chief_engineer, project_type, armador, start_date, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
          .run(data.id, data.name, localClientId, data.status, data.location, data.crew_size, data.commander || null, data.chief_engineer || null, data.project_type || null, data.armador || null, data.start_date || null);
      }
    },

    upsertUserCompanyFromCloud(data) {
      const existing = db.prepare('SELECT id FROM user_companies WHERE cloud_id = ? OR user_id = ?').get(data.id, data.user_id);
      const localCompanyId = resolveLocalEntityId('companies', data.company_id) || null;
      // Skip if parent company doesn't exist locally (FK would fail)
      if (!localCompanyId) {
        console.warn(`[db] upsertUserCompanyFromCloud: skipping — company ${data.company_id} not found locally`);
        return;
      }
      if (existing) {
        db.prepare(`
          UPDATE user_companies
          SET user_id = ?, company_id = ?, updated_at = datetime('now'), synced = 1, cloud_id = ?
          WHERE id = ?
        `).run(data.user_id, localCompanyId, data.id, existing.id);
      } else {
        db.prepare(`
          INSERT INTO user_companies (id, user_id, company_id, created_at, updated_at, synced, cloud_id)
          VALUES (?, ?, ?, ?, datetime('now'), 1, ?)
        `).run(uuidv4(), data.user_id, localCompanyId, data.created_at || new Date().toISOString(), data.id);
      }
    },

    upsertCompanyDocumentFromCloud(data) {
      const existing = db.prepare('SELECT id FROM company_documents WHERE cloud_id = ? OR id = ?').get(data.id, data.id);
      const localCompanyId = resolveLocalEntityId('companies', data.company_id) || null;
      // Skip if parent company doesn't exist locally (FK would fail)
      if (!localCompanyId) {
        console.warn(`[db] upsertCompanyDocumentFromCloud: skipping — company ${data.company_id} not found locally`);
        return;
      }
      if (existing) {
        db.prepare(`
          UPDATE company_documents
          SET company_id = ?, document_type = ?, filename = ?, file_url = ?, updated_at = datetime('now'), synced = 1, cloud_id = ?
          WHERE id = ?
        `).run(localCompanyId, data.document_type, data.filename, data.file_url || null, data.id, existing.id);
      } else {
        db.prepare(`
          INSERT INTO company_documents (id, company_id, document_type, filename, file_url, created_at, updated_at, synced, cloud_id)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1, ?)
        `).run(uuidv4(), localCompanyId, data.document_type, data.filename, data.file_url || null, data.created_at || new Date().toISOString(), data.id);
      }
    },

    upsertWorkerDocumentFromCloud(data) {
      const existing = db.prepare('SELECT id FROM worker_documents WHERE cloud_id = ? OR id = ?').get(data.id, data.id);
      const localWorkerId = resolveLocalEntityId('workers', data.worker_id) || null;
      // Skip if parent worker doesn't exist locally (FK would fail)
      if (!localWorkerId) {
        console.warn(`[db] upsertWorkerDocumentFromCloud: skipping — worker ${data.worker_id} not found locally`);
        return;
      }
      if (existing) {
        db.prepare(`
          UPDATE worker_documents
          SET worker_id = ?, document_type = ?, document_url = ?, expiry_date = ?, issue_date = ?, filename = ?, extracted_data = ?, status = ?, updated_at = datetime('now'), synced = 1, cloud_id = ?
          WHERE id = ?
        `).run(
          localWorkerId,
          data.document_type,
          data.document_url || null,
          data.expiry_date || null,
          data.issue_date || null,
          data.filename || null,
          data.extracted_data ? JSON.stringify(data.extracted_data) : null,
          data.status || 'valid',
          data.id,
          existing.id,
        );
      } else {
        db.prepare(`
          INSERT INTO worker_documents (id, worker_id, document_type, document_url, expiry_date, issue_date, filename, extracted_data, status, created_at, updated_at, synced, cloud_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1, ?)
        `).run(
          uuidv4(),
          localWorkerId,
          data.document_type,
          data.document_url || null,
          data.expiry_date || null,
          data.issue_date || null,
          data.filename || null,
          data.extracted_data ? JSON.stringify(data.extracted_data) : null,
          data.status || 'valid',
          data.created_at || new Date().toISOString(),
          data.id,
        );
      }
    },

    upsertAccessLogFromCloud(data) {
      if (!data.id) return;

      // Resolve worker_id FK — use null if worker not found locally
      let localWorkerId = data.worker_id || null;
      if (localWorkerId) {
        const workerExists = db.prepare('SELECT id FROM workers WHERE id = ? OR cloud_id = ?').get(localWorkerId, localWorkerId);
        if (!workerExists) localWorkerId = null;
      }

      const existing = db.prepare('SELECT id FROM access_logs WHERE id = ?').get(data.id);
      if (existing) {
        // UPDATE canonical fields from cloud (fixes timestamp drift)
        db.prepare(`
          UPDATE access_logs SET
            worker_id = ?, device_id = ?, timestamp = ?, access_status = ?, direction = ?,
            reason = ?, score = ?, worker_name = ?, worker_document = ?, device_name = ?, synced = 1
          WHERE id = ?
        `).run(
          localWorkerId,
          data.device_id || null,
          data.timestamp || new Date().toISOString(),
          data.access_status || 'granted',
          data.direction || 'unknown',
          data.reason || null,
          data.score || null,
          data.worker_name || null,
          data.worker_document || null,
          data.device_name || null,
          data.id,
        );
        return;
      }

      db.prepare(`
        INSERT INTO access_logs (id, worker_id, device_id, timestamp, access_status, direction, reason, score, worker_name, worker_document, device_name, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        data.id,
        localWorkerId,
        data.device_id || null,
        data.timestamp || new Date().toISOString(),
        data.access_status || 'granted',
        data.direction || 'unknown',
        data.reason || null,
        data.score || null,
        data.worker_name || null,
        data.worker_document || null,
        data.device_name || null,
      );
    },

    getUnsyncedWorkers() {
      return db.prepare('SELECT * FROM workers WHERE synced = 0').all().map(normalizeWorkerRow);
    },

    getUnsyncedLogs() {
      return db.prepare('SELECT * FROM access_logs WHERE synced = 0 LIMIT 100').all();
    },

    getPendingSyncOperations() {
      return db.prepare('SELECT * FROM sync_queue ORDER BY created_at ASC').all();
    },

    removeSyncQueueEntry(queueId) {
      db.prepare('DELETE FROM sync_queue WHERE id = ?').run(queueId);
    },

    markSyncEntitySynced(entityType, entityId, cloudId) {
      const validTables = ['companies', 'projects', 'workers', 'worker_documents', 'company_documents', 'user_companies'];
      const targetTable = entityType.endsWith('s') ? entityType : entityType + 's';
      if (validTables.includes(targetTable)) {
        db.prepare(`UPDATE ${targetTable} SET synced = 1, cloud_id = ?, updated_at = datetime('now') WHERE id = ?`).run(cloudId, entityId);
      }
    },

    markLogsSynced(logIds) {
      if (!logIds || logIds.length === 0) return;
      const placeholders = logIds.map(() => '?').join(',');
      db.prepare(`UPDATE access_logs SET synced = 1 WHERE id IN (${placeholders})`).run(...logIds);
    },

    markWorkerSynced(localId, cloudId) {
      db.prepare("UPDATE workers SET synced = 1, cloud_id = ?, updated_at = datetime('now') WHERE id = ?").run(cloudId, localId);
    },

    getPendingSyncCount() {
      const workers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE synced = 0').get()?.count || 0;
      const logs = db.prepare('SELECT COUNT(*) as count FROM access_logs WHERE synced = 0').get()?.count || 0;
      const queue = db.prepare('SELECT COUNT(*) as count FROM sync_queue').get()?.count || 0;
      return workers + logs + queue;
    },

    getDeviceById(deviceId) {
      const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
      return normalizeDeviceRow(row);
    },

    getSyncMeta(key) {
      const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key);
      return row ? row.value : null;
    },

    setSyncMeta(key, value) {
      db.prepare("INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
    },

    getAgentInfo() {
      const row = db.prepare('SELECT * FROM agent_info LIMIT 1').get();
      if (!row) return null;
      return {
        ...row,
        project_ids: safeParseJson(row.project_ids, [])
      };
    },

    updateAgentInfo(data) {
      const existing = this.getAgentInfo();
      const id = data.id || (existing ? existing.id : uuidv4());
      const name = data.name || (existing ? existing.name : 'Local Dashboard');
      const project_ids = data.project_ids ? JSON.stringify(data.project_ids) : (existing ? JSON.stringify(existing.project_ids) : '[]');
      const status = data.status || (existing ? existing.status : 'active');
      const last_sync = data.last_sync || new Date().toISOString();

      db.prepare(`
        INSERT OR REPLACE INTO agent_info (id, name, project_ids, status, last_sync)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, project_ids, status, last_sync);
      return this.getAgentInfo();
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
