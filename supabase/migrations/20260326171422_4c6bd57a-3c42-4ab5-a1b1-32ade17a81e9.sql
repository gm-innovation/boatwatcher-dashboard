
ALTER TABLE public.generated_reports 
ADD COLUMN IF NOT EXISTS date_range_start timestamptz,
ADD COLUMN IF NOT EXISTS date_range_end timestamptz;

CREATE POLICY "Admins can update generated_reports"
ON public.generated_reports
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
