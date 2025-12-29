-- Add new columns to workers table
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS blood_type text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS observations text;
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS code serial;

-- Create worker_strikes table
CREATE TABLE public.worker_strikes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  severity text DEFAULT 'warning' CHECK (severity IN ('warning', 'serious', 'critical')),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_strikes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for worker_strikes
CREATE POLICY "Authenticated users can view worker_strikes" 
ON public.worker_strikes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert worker_strikes" 
ON public.worker_strikes 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update worker_strikes" 
ON public.worker_strikes 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete worker_strikes" 
ON public.worker_strikes 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));