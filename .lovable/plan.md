

# Fix: Facial Events Disappearing — Stuck `align_cursors_requested` Flag

## Root Cause

The `align_cursors_requested: true` flag is permanently stuck in the agent's cloud configuration (`local_agents.configuration`). Every 60-second sync cycle, `downloadUpdates()` detects this flag and runs `executeAlignCursors()`, which calls `markAllLogsSynced()` — this marks ALL unsynced access logs as already synced, so `uploadLogs()` never finds anything to send.

The flag should be cleared after the first alignment via `clear-align-flag`, but the edge function call never succeeds (zero logs for it in the backend). Result: every new facial event is captured locally, then silently erased from the upload queue within seconds.

## Evidence

- Cloud telemetry: `unsyncedLogsCount: 0`, `uploadLogsCount: 16`, `lastUploadLogsError: null` — agent thinks everything is fine
- Edge function logs: zero calls to `upload-logs` in the last 40+ minutes, zero calls to `clear-align-flag` ever
- Cloud configuration: `align_cursors_requested: true` still set
- `lastCapturedAt: 15:55:33` — no new captures since the last successful upload batch

## Fix (3 changes, no impact on working features)

### 1. Clear the stuck flag NOW (database migration)
Update the `local_agents` configuration to remove `align_cursors_requested`:
```sql
UPDATE local_agents 
SET configuration = configuration - 'align_cursors_requested'
WHERE id = '0afe0864-6632-4af5-94f0-ce48bce8edd3';
```

### 2. Fix `executeAlignCursors` in `electron/sync.js`
**Problem:** `markAllLogsSynced()` at line 410 destroys pending uploads.
**Fix:** Upload unsynced logs BEFORE marking them as synced:
```js
// BEFORE aligning, upload any pending logs so they aren't lost
await this.uploadLogs();
// Then mark remaining as synced (safety net for stale backlog only)
const cleared = this.db.markAllLogsSynced?.() || 0;
```

### 3. Make flag clearing more robust in `electron/sync.js`
**Problem:** If `clear-align-flag` fails, the flag loops forever.
**Fix:** After executing alignment, set a local `sync_meta` flag to skip re-execution even if the cloud flag persists:
```js
// After alignment, mark locally that we've already aligned this session
const alignKey = 'last_align_cursors_executed';
const lastAligned = this.db.getSyncMeta?.(alignKey);
const now = Date.now();
// Skip if aligned less than 10 minutes ago
if (lastAligned && (now - parseInt(lastAligned, 10)) < 600000) {
  return; // Already aligned recently
}
// ... execute alignment ...
this.db.setSyncMeta?.(alignKey, String(now));
```

## Files changed
- `electron/sync.js` — `executeAlignCursors()` and the flag check in `downloadUpdates()`
- Database migration — clear the stuck flag

## What stays untouched
- Dashboard logic, manual access points, reports, device polling, all UI components

## Expected result
After clearing the flag and deploying v1.3.65:
- Next facial event is captured → stays unsynced → uploaded within 3 seconds (fast-lane) → appears on dashboard

