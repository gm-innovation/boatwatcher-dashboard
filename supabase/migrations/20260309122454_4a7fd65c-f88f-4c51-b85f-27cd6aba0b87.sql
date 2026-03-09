DROP POLICY IF EXISTS "System can insert access_logs" ON public.access_logs;
CREATE POLICY "Only admins can insert access_logs" ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));