
-- Step 1: Delete duplicate access logs where the same event was received twice
-- (same device_id, timestamp, direction) — keep the one with worker_id, or the oldest
DELETE FROM access_logs
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY device_id, timestamp, direction
        ORDER BY
          (CASE WHEN worker_id IS NOT NULL THEN 0 ELSE 1 END),
          created_at ASC
      ) as rn
    FROM access_logs
    WHERE device_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Create unique index to prevent future duplicates from hardware devices
-- Only applies to events WITH a device_id (manual events have device_id = NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_access_logs_device_timestamp_direction
ON access_logs (device_id, timestamp, direction)
WHERE device_id IS NOT NULL;
