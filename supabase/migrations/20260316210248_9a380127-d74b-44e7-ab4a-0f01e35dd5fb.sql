DROP POLICY IF EXISTS "Users can view their assigned projects" ON public.projects;

CREATE POLICY "Users can view accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR client_id = public.get_user_company_id(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.user_projects
    WHERE user_projects.project_id = projects.id
      AND user_projects.user_id = auth.uid()
  )
);