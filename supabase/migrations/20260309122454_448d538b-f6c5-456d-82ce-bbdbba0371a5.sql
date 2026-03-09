CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document_number text,
  company text,
  reason text,
  valid_until timestamptz,
  photo_url text,
  status text NOT NULL DEFAULT 'active',
  project_id uuid REFERENCES public.projects(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_out_at timestamptz
);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access visitors" ON public.visitors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view visitors" ON public.visitors FOR SELECT TO authenticated
  USING (true);