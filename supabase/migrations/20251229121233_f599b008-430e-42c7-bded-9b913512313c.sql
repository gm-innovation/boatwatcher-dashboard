-- =============================================
-- FASE 1: Reestruturação do Banco de Dados Dock Check
-- =============================================

-- 1. Criar enum para status de trabalhador
CREATE TYPE public.worker_status AS ENUM ('active', 'inactive', 'blocked', 'pending_review');

-- 2. Criar enum para tipo de dispositivo
CREATE TYPE public.device_type AS ENUM ('facial_reader', 'turnstile', 'terminal');

-- 3. Criar enum para status de dispositivo
CREATE TYPE public.device_status AS ENUM ('online', 'offline', 'error', 'configuring');

-- 4. Criar enum para status de acesso
CREATE TYPE public.access_status AS ENUM ('granted', 'denied');

-- 5. Criar enum para direção de acesso
CREATE TYPE public.access_direction AS ENUM ('entry', 'exit', 'unknown');

-- 6. Expandir tabela companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 7. Expandir tabela projects
ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS allowed_worker_ids UUID[] DEFAULT '{}';

-- 8. Expandir tabela workers
ALTER TABLE public.workers 
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS facial_template_data JSONB,
  ADD COLUMN IF NOT EXISTS allowed_project_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS devices_enrolled UUID[] DEFAULT '{}';

-- 9. Criar tabela devices (dispositivos ControlID)
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  controlid_serial_number TEXT NOT NULL UNIQUE,
  controlid_ip_address TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  type device_type NOT NULL DEFAULT 'facial_reader',
  status device_status NOT NULL DEFAULT 'offline',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  configuration JSONB DEFAULT '{}',
  api_credentials JSONB DEFAULT '{}',
  last_event_timestamp TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Criar tabela access_logs (logs de acesso)
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  access_status access_status NOT NULL,
  reason TEXT,
  photo_capture_url TEXT,
  direction access_direction DEFAULT 'unknown',
  score NUMERIC(5,2),
  worker_name TEXT,
  worker_document TEXT,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON public.access_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_worker ON public.access_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_device ON public.access_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_project ON public.devices(project_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX IF NOT EXISTS idx_workers_document ON public.workers(document_number);

-- 12. Habilitar RLS nas novas tabelas
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- 13. Políticas RLS para devices
CREATE POLICY "Authenticated users can view devices"
ON public.devices
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert devices"
ON public.devices
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 14. Políticas RLS para access_logs
CREATE POLICY "Authenticated users can view access_logs"
ON public.access_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can insert access_logs"
ON public.access_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 15. Trigger para atualizar updated_at em devices
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 16. Habilitar Realtime para access_logs (monitoramento em tempo real)
ALTER PUBLICATION supabase_realtime ADD TABLE public.access_logs;

-- 17. Criar storage bucket para fotos de trabalhadores
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 18. Políticas de storage para worker-photos
CREATE POLICY "Anyone can view worker photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'worker-photos');

CREATE POLICY "Authenticated users can upload worker photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Admins can update worker photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'worker-photos');

CREATE POLICY "Admins can delete worker photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'worker-photos');