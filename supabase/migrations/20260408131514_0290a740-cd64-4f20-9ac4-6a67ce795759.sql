-- Allow operators to read workers (needed for manual access control terminals)
CREATE POLICY "Operators can view workers"
ON public.workers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));

-- Allow operators to read companies (needed to resolve company names in terminal)
CREATE POLICY "Operators can view companies"
ON public.companies
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operator'::app_role));