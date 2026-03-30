
-- Table to log connectivity status changes
CREATE TABLE public.connectivity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  previous_status text,
  new_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_connectivity_events_entity ON connectivity_events(entity_type, entity_id);
CREATE INDEX idx_connectivity_events_created ON connectivity_events(created_at DESC);

ALTER TABLE connectivity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read connectivity_events" ON connectivity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert connectivity_events" ON connectivity_events FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger for devices
CREATE OR REPLACE FUNCTION public.log_device_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO connectivity_events (entity_type, entity_id, project_id, previous_status, new_status)
    VALUES ('device', NEW.id, NEW.project_id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_device_status_change
  AFTER UPDATE OF status ON devices
  FOR EACH ROW EXECUTE FUNCTION log_device_status_change();

-- Trigger for local_agents
CREATE OR REPLACE FUNCTION public.log_agent_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO connectivity_events (entity_type, entity_id, project_id, previous_status, new_status)
    VALUES ('agent', NEW.id, NEW.project_id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_agent_status_change
  AFTER UPDATE OF status ON local_agents
  FOR EACH ROW EXECUTE FUNCTION log_agent_status_change();
