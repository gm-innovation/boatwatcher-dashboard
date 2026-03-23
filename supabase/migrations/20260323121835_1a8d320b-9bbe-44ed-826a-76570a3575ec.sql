
-- Rebind device to the correct agent (Engenharia b7a3fd5d)
UPDATE devices SET agent_id = 'b7a3fd5d-2658-4890-b66d-ed08e301b437' WHERE project_id = '8685513e-90d3-467c-80ce-74fc5eae984f';

-- Delete orphan agent without project_id
DELETE FROM local_agents WHERE id = 'e49cea39-d5ea-4190-9d86-95538fe34975';

-- Delete duplicate Engenharia01 agent
DELETE FROM local_agents WHERE id = '1ff56fcb-93cd-4e11-88c0-15e87baea56d';
