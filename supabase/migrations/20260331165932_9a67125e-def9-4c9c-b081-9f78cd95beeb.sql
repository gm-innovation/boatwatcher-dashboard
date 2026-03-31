
CREATE TABLE public.manual_access_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_location text NOT NULL DEFAULT 'bordo',
  direction_mode text NOT NULL DEFAULT 'both',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_access_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/operator can select manual_access_points"
  ON public.manual_access_points FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admin/operator can insert manual_access_points"
  ON public.manual_access_points FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admin/operator can update manual_access_points"
  ON public.manual_access_points FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role));

CREATE POLICY "Admin/operator can delete manual_access_points"
  ON public.manual_access_points FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operators can insert access_logs"
  ON public.access_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'operator'::app_role));
