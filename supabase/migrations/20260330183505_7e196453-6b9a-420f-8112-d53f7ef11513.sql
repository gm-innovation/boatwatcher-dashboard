
-- Add 60s debounce to device status change trigger
CREATE OR REPLACE FUNCTION public.log_device_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Debounce: skip if same entity had a status change less than 60s ago
    IF NOT EXISTS (
      SELECT 1 FROM connectivity_events
      WHERE entity_type = 'device' AND entity_id = NEW.id
        AND created_at > now() - interval '60 seconds'
    ) THEN
      INSERT INTO connectivity_events (entity_type, entity_id, project_id, previous_status, new_status)
      VALUES ('device', NEW.id, NEW.project_id, OLD.status::text, NEW.status::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Add 60s debounce to agent status change trigger
CREATE OR REPLACE FUNCTION public.log_agent_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Debounce: skip if same entity had a status change less than 60s ago
    IF NOT EXISTS (
      SELECT 1 FROM connectivity_events
      WHERE entity_type = 'agent' AND entity_id = NEW.id
        AND created_at > now() - interval '60 seconds'
    ) THEN
      INSERT INTO connectivity_events (entity_type, entity_id, project_id, previous_status, new_status)
      VALUES ('agent', NEW.id, NEW.project_id, OLD.status::text, NEW.status::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
