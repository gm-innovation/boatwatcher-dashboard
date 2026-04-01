

## Root Cause Analysis: 3 Distinct Bugs

### Bug 1: -3h on Desktop — DOUBLE SUBTRACTION

The `utcToBRT` function (database.js line 1192) is fundamentally broken. Here's what happens:

```text
Real event: 08:07 BRT
1. ControlID → normalizeTimestamp → adds 3h → "11:07:00.000Z" (correct UTC)
2. Stored in SQLite as "2025-04-01T11:07:00.000Z"
3. getWorkersOnBoard → utcToBRT("11:07Z"):
   - Subtracts 3h → 08:07
   - Appends "-03:00" → "08:07:00-03:00"
4. WorkersOnBoardTable → format(new Date("08:07-03:00"), 'HH:mm'):
   - JS interprets "-03:00" → absolute UTC = 08:07 + 3h = 11:07 UTC
   - format() converts to OS local BRT → 11:07 - 3h = 08:07 ✅ (seems ok?)

BUT the web shows 11:07 for the same event, not 08:07!
```

The web passes the raw UTC timestamp (`"11:07:00.000Z"`) to `format()`. If the browser is in BRT, `format(new Date("11:07Z"))` shows `08:07`. But the web screenshot shows `11:07`.

This means the web browser is NOT in BRT — it's in UTC or the timestamps in Postgres are stored differently than expected. **The ControlID normalizeTimestamp is adding +3h when it shouldn't be** — the device is likely already sending UTC or the +3h assumption is wrong for this particular installation.

**The real fix**: Stop mutating timestamps. The `normalizeTimestamp` function should NOT add +3h. ControlID devices' timestamps should be stored AS-IS (treating them as wall-clock time). Both web and desktop should display timestamps the same way — raw, without conversion.

### Bug 2: Company entry time shows worker's last entry

In `useCompaniesOnBoard` (line 339): `worker.firstEntryTime || worker.entryTime`. The desktop's `getWorkersOnBoard` returns both `entryTime` (last entry) and `firstEntryTime` (first entry). This should work. However, with the utcToBRT double-subtraction affecting both values equally, both are wrong by 3h. With a single worker, they'll show the same value.

### Bug 3: Manual events not appearing on Desktop

The code structure (table, sync, edge function) looks correct. The likely issue: the `last_download_access_logs` checkpoint was set AFTER the manual logs were created, so they're never re-downloaded. A full re-sync would fix this.

---

## Simplified Fix Plan

The core philosophy: **stop converting timestamps at every layer**. Store what the device gives, display what's stored.

### File: `electron/agent.js` — Stop adding +3h

The `normalizeTimestamp` function adds 3h assuming ControlID sends BRT. But timestamps are already being handled correctly by the cloud. The agent should store timestamps AS-IS in ISO format without timezone conversion. If the string has no timezone, treat it as local wall-clock time and store with the local offset.

```javascript
function normalizeTimestamp(event) {
  const raw = event.timestamp || event.time || event.date || event.datetime;
  if (!raw) return null;

  if (typeof raw === 'number') {
    // Unix timestamp — use directly (device clock, no offset adjustment)
    return new Date(raw * 1000).toISOString();
  }

  // String with timezone — parse directly
  if (/[Zz]$|[+-]\d{2}:?\d{2}$/.test(raw.trim())) {
    const ms = Date.parse(raw);
    return isNaN(ms) ? null : new Date(ms).toISOString();
  }

  // No timezone — store as-is in ISO format (local wall-clock time)
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, yr, mo, dy, hr, mn, sc] = match.map(Number);
    return `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}T${String(hr).padStart(2,'0')}:${String(mn).padStart(2,'0')}:${String(sc).padStart(2,'0')}.000Z`;
  }

  const ms = Date.parse(raw);
  return isNaN(ms) ? null : new Date(ms).toISOString();
}
```

**Important**: This means timestamps without timezone are stored with `Z` suffix but represent the device's local wall-clock time. This matches how the web already stores manual entries.

### File: `electron/database.js` — Remove utcToBRT entirely

Remove the `utcToBRT` function and pass raw timestamps:

```javascript
// Line 1192-1202: DELETE utcToBRT function and replace with:
let entryTime = state.entry_time;
let firstEntryTime = firstEntryMap.get(key) || state.entry_time;
```

Also remove the BRT midnight calculation (lines 1110-1113) and use simple date-based filtering:

```javascript
// Use same approach: just filter for today's date portion
const now = new Date();
const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const startTimestamp = todayStr + 'T00:00:00.000Z';
```

### File: `electron/sync.js` — Force re-download of access logs

Add logic to reset the access logs checkpoint when manual_access_points are first downloaded, ensuring manual events get pulled:

```javascript
// After downloading manual_access_points, if any were found and access logs 
// haven't been fully re-synced, reset the access logs checkpoint
if (manualRes.manual_access_points?.length > 0) {
  const hadManualBefore = this.db.getSyncMeta('has_manual_points');
  if (!hadManualBefore) {
    this.db.setSyncMeta('has_manual_points', 'true');
    this.db.setSyncMeta('last_download_access_logs', '1970-01-01T00:00:00Z');
    console.log('[sync] Manual access points detected — resetting access logs checkpoint for full re-download');
  }
}
```

### Summary

| File | Change |
|---|---|
| `electron/agent.js` | Remove +3h offset from `normalizeTimestamp` — store device wall-clock time as-is |
| `electron/database.js` | Remove `utcToBRT` function; pass raw timestamps; simplify date filter |
| `electron/sync.js` | Reset access logs checkpoint when manual points are first detected |

### Why previous fixes failed

1. **utcToBRT was a band-aid on top of a band-aid**: The agent adds +3h, then the display function subtracts 3h. Two wrongs don't make a right — they interact differently depending on OS timezone.
2. **The manual_access_points table and sync were added** but the access logs download checkpoint wasn't reset, so historical manual logs were never fetched.

