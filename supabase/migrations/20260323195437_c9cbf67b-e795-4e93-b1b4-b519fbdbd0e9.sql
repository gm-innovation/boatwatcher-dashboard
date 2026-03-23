
-- Clean orphaned FK references in local_agents table
-- Set project_id to null where the referenced project doesn't exist
UPDATE public.local_agents
SET project_id = NULL
WHERE project_id IS NOT NULL
  AND project_id NOT IN (SELECT id FROM public.projects);

-- Set created_by to null where the referenced user doesn't exist
UPDATE public.local_agents
SET created_by = NULL
WHERE created_by IS NOT NULL
  AND created_by NOT IN (SELECT id FROM auth.users);
