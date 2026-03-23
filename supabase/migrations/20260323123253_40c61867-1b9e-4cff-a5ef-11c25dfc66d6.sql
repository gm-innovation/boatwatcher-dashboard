-- Clean up orphan agents (no project_id) and consolidate duplicates
-- Delete agents that have no project_id AND no devices referencing them
DELETE FROM local_agents
WHERE project_id IS NULL
  AND id NOT IN (SELECT DISTINCT agent_id FROM devices WHERE agent_id IS NOT NULL);

-- For agents sharing the same project_id, keep only the most recently seen one
-- and rebind all devices from the older agents to the active one
WITH ranked_agents AS (
  SELECT id, project_id, 
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY last_seen_at DESC NULLS LAST, created_at DESC) as rn
  FROM local_agents
  WHERE project_id IS NOT NULL
)
UPDATE devices 
SET agent_id = (
  SELECT ra.id FROM ranked_agents ra 
  WHERE ra.project_id = devices.project_id AND ra.rn = 1
)
WHERE project_id IN (
  SELECT project_id FROM ranked_agents WHERE rn > 1
)
AND agent_id IN (
  SELECT id FROM ranked_agents WHERE rn > 1
);

-- Now delete the duplicate agents (keeping only the most recently seen per project)
WITH ranked_agents AS (
  SELECT id, project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY last_seen_at DESC NULLS LAST, created_at DESC) as rn
  FROM local_agents
  WHERE project_id IS NOT NULL
)
DELETE FROM local_agents WHERE id IN (
  SELECT id FROM ranked_agents WHERE rn > 1
);