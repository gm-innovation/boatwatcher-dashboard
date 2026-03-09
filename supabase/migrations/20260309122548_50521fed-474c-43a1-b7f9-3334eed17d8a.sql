CREATE POLICY "Company admins can insert worker_documents" ON public.worker_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers w
      WHERE w.id = worker_id
      AND w.company_id = get_user_company_id(auth.uid())
    )
  );