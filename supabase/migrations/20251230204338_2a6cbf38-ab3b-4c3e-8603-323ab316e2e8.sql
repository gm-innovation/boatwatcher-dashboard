-- Create table for local agents
CREATE TABLE public.local_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'offline',
  last_seen_at timestamp with time zone,
  ip_address text,
  version text,
  configuration jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create table for agent command queue
CREATE TABLE public.agent_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.local_agents(id) ON DELETE CASCADE NOT NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  command text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  executed_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.local_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_commands ENABLE ROW LEVEL SECURITY;

-- RLS Policies for local_agents
CREATE POLICY "Admins can view local_agents"
ON public.local_agents FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert local_agents"
ON public.local_agents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update local_agents"
ON public.local_agents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete local_agents"
ON public.local_agents FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for agent_commands
CREATE POLICY "Admins can view agent_commands"
ON public.agent_commands FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert agent_commands"
ON public.agent_commands FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update agent_commands"
ON public.agent_commands FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete agent_commands"
ON public.agent_commands FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add agent_id to devices for association
ALTER TABLE public.devices ADD COLUMN agent_id uuid REFERENCES public.local_agents(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_agent_commands_agent_id ON public.agent_commands(agent_id);
CREATE INDEX idx_agent_commands_status ON public.agent_commands(status);
CREATE INDEX idx_local_agents_token ON public.local_agents(token);
CREATE INDEX idx_devices_agent_id ON public.devices(agent_id);

-- Trigger for updated_at
CREATE TRIGGER update_local_agents_updated_at
BEFORE UPDATE ON public.local_agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();