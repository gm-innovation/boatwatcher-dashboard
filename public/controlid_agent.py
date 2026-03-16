#!/usr/bin/env python3
"""
Agente Local ControlID — Offline-first com SQLite e sync queue.
Conecta leitores ControlID em rede local ao sistema na nuvem.

Requisitos: Python 3.7+, requests (pip install requests)
Configuração: config.json no mesmo diretório
"""

import json
import os
import sqlite3
import sys
import threading
import time
from datetime import datetime, timezone

import requests

VERSION = "2.0.0"
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")


# ── Banco de dados local ────────────────────────────────────────────

class DatabaseManager:
    def __init__(self, db_path="agent_data.db"):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()

    def _conn(self):
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self.db_path)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_db(self):
        c = self._conn()
        c.executescript("""
            CREATE TABLE IF NOT EXISTS workers (
                id TEXT PRIMARY KEY,
                name TEXT,
                code INTEGER,
                document_number TEXT,
                photo_url TEXT,
                status TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_id TEXT,
                worker_name TEXT,
                worker_document TEXT,
                device_id TEXT,
                device_name TEXT,
                direction TEXT DEFAULT 'entry',
                access_status TEXT DEFAULT 'granted',
                score REAL,
                timestamp TEXT,
                synced INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS sync_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        """)
        c.commit()

    def get_meta(self, key, default=None):
        row = self._conn().execute(
            "SELECT value FROM sync_meta WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default

    def set_meta(self, key, value):
        self._conn().execute(
            "INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)",
            (key, str(value)),
        )
        self._conn().commit()

    def upsert_workers(self, workers):
        c = self._conn()
        for w in workers:
            c.execute(
                """INSERT OR REPLACE INTO workers (id, name, code, document_number, photo_url, status, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (w["id"], w["name"], w.get("code"), w.get("document_number"),
                 w.get("photo_url"), w.get("status"), datetime.now(timezone.utc).isoformat()),
            )
        c.commit()
        return len(workers)

    def insert_access_log(self, log):
        c = self._conn()
        c.execute(
            """INSERT INTO access_logs
               (worker_id, worker_name, worker_document, device_id, device_name,
                direction, access_status, score, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (log.get("worker_id"), log.get("worker_name"), log.get("worker_document"),
             log.get("device_id"), log.get("device_name"), log.get("direction", "entry"),
             log.get("access_status", "granted"), log.get("score"),
             log.get("timestamp", datetime.now(timezone.utc).isoformat())),
        )
        c.commit()

    def get_pending_logs(self, limit=50):
        rows = self._conn().execute(
            "SELECT * FROM access_logs WHERE synced = 0 ORDER BY id LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]

    def mark_synced(self, ids):
        if not ids:
            return
        placeholders = ",".join("?" for _ in ids)
        self._conn().execute(
            f"UPDATE access_logs SET synced = 1 WHERE id IN ({placeholders})", ids
        )
        self._conn().commit()

    def pending_count(self):
        row = self._conn().execute(
            "SELECT COUNT(*) as cnt FROM access_logs WHERE synced = 0"
        ).fetchone()
        return row["cnt"] if row else 0

    def find_worker_by_code(self, code):
        row = self._conn().execute(
            "SELECT * FROM workers WHERE code = ? AND status = 'active'", (code,)
        ).fetchone()
        return dict(row) if row else None


# ── Cliente ControlID ────────────────────────────────────────────────

class ControlIDClient:
    def __init__(self, ip, user="admin", password="admin"):
        self.base = f"http://{ip}"
        self.session = None
        self.user = user
        self.password = password

    def login(self):
        try:
            r = requests.post(
                f"{self.base}/login.fcgi",
                json={"login": self.user, "password": self.password},
                timeout=10,
            )
            if r.ok:
                self.session = r.json().get("session")
                return True
        except Exception as e:
            print(f"[ControlID] Erro login {self.base}: {e}")
        return False

    def get_events(self, since_id=0):
        if not self.session:
            if not self.login():
                return []
        try:
            r = requests.post(
                f"{self.base}/access_logs.fcgi",
                json={
                    "session": self.session,
                    "where": {"access_logs": {"id": {">": since_id}}},
                    "limit": 100,
                    "order": {"access_logs": {"id": "ASC"}},
                },
                timeout=15,
            )
            if r.ok:
                return r.json().get("access_logs", [])
            if r.status_code == 401:
                self.session = None
        except Exception as e:
            print(f"[ControlID] Erro eventos {self.base}: {e}")
        return []


# ── Motor de sincronização ───────────────────────────────────────────

class SyncEngine:
    def __init__(self, db: DatabaseManager, relay_url: str, token: str):
        self.db = db
        self.relay_url = relay_url.rstrip("/")
        self.headers = {
            "x-agent-token": token,
            "Content-Type": "application/json",
            "X-Agent-Version": VERSION,
        }

    def upload_logs(self):
        pending = self.db.get_pending_logs(limit=50)
        if not pending:
            return 0
        logs_payload = []
        local_ids = []
        for log in pending:
            local_ids.append(log["id"])
            logs_payload.append({
                "worker_id": log["worker_id"],
                "worker_name": log["worker_name"],
                "worker_document": log["worker_document"],
                "device_id": log["device_id"],
                "device_name": log["device_name"],
                "direction": log["direction"],
                "access_status": log["access_status"],
                "score": log["score"],
                "timestamp": log["timestamp"],
            })
        try:
            r = requests.post(
                f"{self.relay_url}/upload-logs",
                headers=self.headers,
                json={"logs": logs_payload},
                timeout=30,
            )
            if r.ok:
                self.db.mark_synced(local_ids)
                print(f"[Sync] {len(local_ids)} logs enviados")
                return len(local_ids)
            print(f"[Sync] Erro upload: {r.status_code}")
        except Exception as e:
            print(f"[Sync] Erro upload: {e}")
        return 0

    def download_workers(self):
        since = self.db.get_meta("last_worker_sync", "1970-01-01T00:00:00Z")
        try:
            r = requests.get(
                f"{self.relay_url}/download-workers",
                headers=self.headers,
                params={"since": since},
                timeout=30,
            )
            if r.ok:
                data = r.json()
                workers = data.get("workers", [])
                for worker in workers:
                    photo_url = worker.get("photo_url")
                    photo_signed_url = worker.get("photo_signed_url")
                    if photo_url and str(photo_url).startswith("storage://"):
                        if photo_signed_url:
                            print(f"[Sync] Worker {worker.get('id')} foto assinada pronta para download")
                        else:
                            print(
                                f"[Sync] Worker {worker.get('id')} sem photo_signed_url; "
                                f"photo_url persistente={photo_url}"
                            )
                if workers:
                    count = self.db.upsert_workers(workers)
                    print(f"[Sync] {count} workers atualizados")
                self.db.set_meta("last_worker_sync", data.get("timestamp", since))
                return len(workers)
            print(f"[Sync] Erro download workers: {r.status_code} {r.text[:200]}")
        except Exception as e:
            print(f"[Sync] Erro download workers: {e}")
        return 0

    def heartbeat(self, sync_status="idle"):
        try:
            requests.post(
                f"{self.relay_url}/status",
                headers=self.headers,
                json={
                    "version": VERSION,
                    "sync_status": sync_status,
                    "pending_count": self.db.pending_count(),
                },
                timeout=15,
            )
        except Exception:
            pass


# ── Agente principal ─────────────────────────────────────────────────

class Agent:
    def __init__(self, config_path=CONFIG_PATH):
        with open(config_path) as f:
            self.cfg = json.load(f)

        self.db = DatabaseManager(self.cfg.get("db_path", "agent_data.db"))
        self.sync = SyncEngine(
            self.db,
            self.cfg["relay_url"],
            self.cfg["agent_token"],
        )
        self.devices = []
        for dev in self.cfg.get("devices", []):
            self.devices.append({
                "client": ControlIDClient(
                    dev["ip"],
                    dev.get("user", "admin"),
                    dev.get("password", "admin"),
                ),
                "id": dev.get("device_id"),
                "name": dev.get("name", dev["ip"]),
                "last_event_id": int(self.db.get_meta(f"last_event_{dev['ip']}", "0")),
            })
        self._running = True

    def _poll_devices(self):
        interval = self.cfg.get("poll_interval", 5)
        while self._running:
            for dev in self.devices:
                events = dev["client"].get_events(dev["last_event_id"])
                for evt in events:
                    worker = self.db.find_worker_by_code(evt.get("user_id", 0))
                    self.db.insert_access_log({
                        "worker_id": worker["id"] if worker else None,
                        "worker_name": worker["name"] if worker else f"ID:{evt.get('user_id')}",
                        "worker_document": worker["document_number"] if worker else None,
                        "device_id": dev["id"],
                        "device_name": dev["name"],
                        "direction": "entry" if evt.get("event") == 7 else "exit",
                        "access_status": "granted" if evt.get("event") in (7, 8) else "denied",
                        "score": evt.get("score"),
                        "timestamp": evt.get("time", datetime.now(timezone.utc).isoformat()),
                    })
                    dev["last_event_id"] = max(dev["last_event_id"], evt.get("id", 0))
                if events:
                    ip = dev["client"].base.replace("http://", "")
                    self.db.set_meta(f"last_event_{ip}", str(dev["last_event_id"]))
            time.sleep(interval)

    def _sync_loop(self):
        interval = self.cfg.get("sync_interval", 30)
        while self._running:
            self.sync.upload_logs()
            self.sync.download_workers()
            time.sleep(interval)

    def _heartbeat_loop(self):
        interval = self.cfg.get("heartbeat_interval", 60)
        while self._running:
            pending = self.db.pending_count()
            status = "pending" if pending > 0 else "synced"
            self.sync.heartbeat(status)
            time.sleep(interval)

    def run(self):
        print(f"Agente ControlID v{VERSION} iniciado")
        print(f"Dispositivos: {len(self.devices)}")

        threads = [
            threading.Thread(target=self._poll_devices, daemon=True, name="poller"),
            threading.Thread(target=self._sync_loop, daemon=True, name="sync"),
            threading.Thread(target=self._heartbeat_loop, daemon=True, name="heartbeat"),
        ]
        for t in threads:
            t.start()

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nEncerrando agente...")
            self._running = False


if __name__ == "__main__":
    if not os.path.exists(CONFIG_PATH):
        print(f"Arquivo de configuração não encontrado: {CONFIG_PATH}")
        print("Crie um config.json com base no template disponível no sistema.")
        sys.exit(1)
    Agent().run()
