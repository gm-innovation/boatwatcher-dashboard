const fs = require('fs');
const path = require('path');

class BackupManager {
  constructor(dataDir, backupDir) {
    this.dataDir = dataDir;
    this.backupDir = backupDir;
    this.intervalMs = 6 * 60 * 60 * 1000; // 6 hours
    this.maxBackups = 10;
    this.timer = null;
  }

  start() {
    fs.mkdirSync(this.backupDir, { recursive: true });
    this.timer = setInterval(() => this.performBackup(), this.intervalMs);
    // First backup after 1 minute
    setTimeout(() => this.performBackup(), 60_000);
    console.log(`[Backup] Scheduled every ${this.intervalMs / 3600000}h → ${this.backupDir}`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  performBackup() {
    const dbPath = path.join(this.dataDir, 'dockcheck.db');
    if (!fs.existsSync(dbPath)) {
      console.log('[Backup] No database file found, skipping');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `dockcheck-${timestamp}.db`);

    try {
      fs.copyFileSync(dbPath, backupFile);
      console.log(`[Backup] Created: ${backupFile}`);
      this.pruneOldBackups();
    } catch (err) {
      console.error(`[Backup] Failed:`, err.message);
    }
  }

  pruneOldBackups() {
    const files = fs.readdirSync(this.backupDir)
      .filter(f => f.startsWith('boatwatcher-') && f.endsWith('.db'))
      .sort()
      .reverse();

    for (let i = this.maxBackups; i < files.length; i++) {
      const old = path.join(this.backupDir, files[i]);
      fs.unlinkSync(old);
      console.log(`[Backup] Pruned: ${files[i]}`);
    }
  }
}

module.exports = { BackupManager };
