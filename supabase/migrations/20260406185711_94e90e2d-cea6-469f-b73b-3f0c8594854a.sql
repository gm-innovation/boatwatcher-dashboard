UPDATE access_logs
SET worker_id = '46dc598a-467a-4317-be54-43e6c27a48e6',
    worker_name = 'Alexandre Silva'
WHERE worker_id = '5e96256b-89f9-4153-9534-c3386cbaa263'
  AND direction = 'exit'
  AND timestamp >= '2026-04-06T00:00:00Z'
  AND timestamp < '2026-04-07T00:00:00Z';