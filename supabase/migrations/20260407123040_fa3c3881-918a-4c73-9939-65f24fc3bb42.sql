-- Fix contaminated access_logs: 96 records batch-uploaded on 2026-04-06 19:49:41
-- with wrong worker_id (Gustavo 5e96256b, code=1) that should be Alexandre (46dc598a, code=350).
-- These were misattributed by the local agent due to duplicate code mappings in SQLite.
-- 
-- We can identify them by: created_at = exact batch timestamp AND worker_id = Gustavo's UUID.
-- The real events belong to multiple different workers (not just Alexandre), but since we can't
-- determine the correct mapping retroactively for all 96, we null out the worker_id and worker_name
-- so the dashboard won't show ghost sessions. The events remain in the DB for audit purposes.

UPDATE access_logs 
SET worker_id = NULL, 
    worker_name = NULL,
    reason = COALESCE(reason, '') || ' [auto-corrected: misattributed batch upload from agent with corrupted code mapping]'
WHERE created_at = '2026-04-06 19:49:41.483988+00'
  AND worker_id = '5e96256b-89f9-4153-9534-c3386cbaa263';