-- FASE 1: Estrutura completa do banco de dados

-- 1.1 Adicionar 'company_admin' ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'company_admin';

-- 1.2 Criar tabela job_functions (Cargos)
CREATE TABLE IF NOT EXISTS public.job_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3 Criar tabela required_documents (Documentos Obrigatórios por Cargo)
CREATE TABLE IF NOT EXISTS public.required_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_function_id uuid REFERENCES public.job_functions(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  validity_days integer,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4 Criar tabela worker_documents (Documentos dos Trabalhadores)
CREATE TABLE IF NOT EXISTS public.worker_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_url text,
  issue_date date,
  expiry_date date,
  status text DEFAULT 'valid',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.5 Criar tabela audit_logs (Auditoria)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.6 Criar tabela system_settings (Configurações Globais)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- 1.7 Criar tabela notifications (Alertas e Notificações)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  priority text DEFAULT 'normal',
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.8 Criar tabela user_companies (Vincular usuários a empresas)
CREATE TABLE IF NOT EXISTS public.user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- 1.9 Adicionar campo job_function_id na tabela workers
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS job_function_id uuid REFERENCES public.job_functions(id);

-- 1.10 Habilitar RLS em todas as novas tabelas
ALTER TABLE public.job_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.required_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- 1.11 Função auxiliar para obter company_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.user_companies
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 1.12 RLS Policies para job_functions
CREATE POLICY "Authenticated users can view job_functions"
ON public.job_functions FOR SELECT
USING (true);

CREATE POLICY "Admins can insert job_functions"
ON public.job_functions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update job_functions"
ON public.job_functions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete job_functions"
ON public.job_functions FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.13 RLS Policies para required_documents
CREATE POLICY "Authenticated users can view required_documents"
ON public.required_documents FOR SELECT
USING (true);

CREATE POLICY "Admins can insert required_documents"
ON public.required_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update required_documents"
ON public.required_documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete required_documents"
ON public.required_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.14 RLS Policies para worker_documents
CREATE POLICY "Authenticated users can view worker_documents"
ON public.worker_documents FOR SELECT
USING (true);

CREATE POLICY "Admins can insert worker_documents"
ON public.worker_documents FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update worker_documents"
ON public.worker_documents FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete worker_documents"
ON public.worker_documents FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.15 RLS Policies para audit_logs (somente leitura para admins)
CREATE POLICY "Admins can view audit_logs"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit_logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- 1.16 RLS Policies para system_settings
CREATE POLICY "Authenticated users can view system_settings"
ON public.system_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can insert system_settings"
ON public.system_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system_settings"
ON public.system_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete system_settings"
ON public.system_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.17 RLS Policies para notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can delete notifications"
ON public.notifications FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.18 RLS Policies para user_companies
CREATE POLICY "Users can view their own company associations"
ON public.user_companies FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert user_companies"
ON public.user_companies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user_companies"
ON public.user_companies FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user_companies"
ON public.user_companies FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 1.19 Triggers para updated_at
CREATE TRIGGER update_job_functions_updated_at
BEFORE UPDATE ON public.job_functions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_documents_updated_at
BEFORE UPDATE ON public.worker_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 1.20 Habilitar Realtime para notifications e devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;

-- 1.21 Inserir configurações padrão do sistema
INSERT INTO public.system_settings (key, value, description) VALUES
('facial_recognition_threshold', '{"min_score": 0.7}'::jsonb, 'Limiar mínimo de confiança para reconhecimento facial'),
('log_retention_days', '{"days": 365}'::jsonb, 'Dias de retenção de logs de acesso'),
('notification_settings', '{"device_offline_minutes": 5, "document_expiry_warning_days": [30, 15, 7]}'::jsonb, 'Configurações de notificações automáticas')
ON CONFLICT (key) DO NOTHING;