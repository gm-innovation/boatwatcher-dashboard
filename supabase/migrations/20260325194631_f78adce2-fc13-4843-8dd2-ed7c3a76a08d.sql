
-- 1. Create document_types catalog
CREATE TABLE public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_validity_days integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view document_types" ON public.document_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert document_types" ON public.document_types
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update document_types" ON public.document_types
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete document_types" ON public.document_types
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add columns to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text;

-- 3. Create pending_workers table
CREATE TABLE public.pending_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document_number text,
  role text,
  photo_url text,
  job_function_id uuid REFERENCES public.job_functions(id),
  submitted_by uuid,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pending_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all pending_workers" ON public.pending_workers
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Company admins can view own pending_workers" ON public.pending_workers
  FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Company admins can insert pending_workers" ON public.pending_workers
  FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update pending_workers" ON public.pending_workers
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete pending_workers" ON public.pending_workers
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create generated_reports table
CREATE TABLE public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  filters jsonb DEFAULT '{}',
  data jsonb,
  file_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view generated_reports" ON public.generated_reports
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert generated_reports" ON public.generated_reports
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete generated_reports" ON public.generated_reports
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
