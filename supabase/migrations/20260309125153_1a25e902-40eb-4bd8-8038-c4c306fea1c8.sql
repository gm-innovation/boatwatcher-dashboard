-- Fix worker_documents INSERT policies: drop RESTRICTIVE and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admins can insert worker_documents" ON public.worker_documents;
DROP POLICY IF EXISTS "Company admins can insert worker_documents" ON public.worker_documents;

CREATE POLICY "Admins can insert worker_documents" ON public.worker_documents
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Company admins can insert worker_documents" ON public.worker_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers w
      WHERE w.id = worker_id
      AND w.company_id = get_user_company_id(auth.uid())
    )
  );