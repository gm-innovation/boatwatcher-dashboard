

# Fix: Dashboard Exit Detection, Enrichment & UTC

## Root Cause (confirmed by DB query)

The entry log has `worker_id = 5a96074e` (local UUID, uploaded before the resolution fix), while the exit log has `worker_id = 46dc598a` (cloud UUID, resolved after the fix). Both have `worker_name = "Alexandre Silva"`.

**Bug 1 — Exit not detected**: `hasExit` compares `exit.worker_id === entry.worker_id` → `46dc598a !== 5a96074e` → worker stays "on board" forever.

**Bug 2 — Missing role/company**: Enrichment does `.in('id', ['5a96074e...'])` on workers table → no match → role=null, company="N/A".

**Bug 3 — UTC offset**: Filter uses `${startDate}T00:00:00` which Postgres interprets as midnight UTC (= 21:00 BRT previous day).

## Fix — `src/hooks/useSupabase.ts`

### 1. Exit detection by `worker_name` instead of `worker_id`
Change entry/exit queries to include `worker_name`. Match exits to entries by `worker_name` (fallback to `worker_id` when both are present). This handles the UUID mismatch between old and new logs.

### 2. Enrichment by `worker_name`
Instead of `.in('id', workerIds)`, query workers by name: `.in('name', workerNames)`. Map results by name for enrichment. This guarantees role and company are found even when UUIDs don't match.

### 3. UTC-aware date filter
Use `new Date().toISOString()` for start-of-day calculation that respects the user's local timezone:
```typescript
const now = new Date();
const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const startTimestamp = todayLocal.toISOString(); // midnight local → correct UTC offset
```

### Files changed
- **`src/hooks/useSupabase.ts`** — all three fixes in `useWorkersOnBoard`

