const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'boatwatcher.db');
if (!fs.existsSync(dbPath)) {
    console.log('Database not found at ' + dbPath);
    process.exit(1);
}

const db = new sqlite3(dbPath);
const metas = db.prepare('SELECT * FROM sync_meta').all();
console.log('Sync Metas:', metas);

const pendingOps = db.prepare('SELECT COUNT(*) as count FROM sync_queue').get();
console.log('Pending Operations:', pendingOps.count);

const workers = db.prepare('SELECT COUNT(*) as count FROM workers WHERE synced = 0').get();
console.log('Unsynced Workers:', workers.count);

db.close();
