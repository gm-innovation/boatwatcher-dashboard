-- Criar tabela de agendamento de relatórios
CREATE TABLE public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('presence', 'access', 'compliance', 'device')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipients text[] NOT NULL DEFAULT '{}',
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  filters jsonb DEFAULT '{}',
  last_run_at timestamptz,
  next_run_at timestamptz,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can view report_schedules" 
ON public.report_schedules FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert report_schedules" 
ON public.report_schedules FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update report_schedules" 
ON public.report_schedules FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete report_schedules" 
ON public.report_schedules FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_report_schedules_updated_at
BEFORE UPDATE ON public.report_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();