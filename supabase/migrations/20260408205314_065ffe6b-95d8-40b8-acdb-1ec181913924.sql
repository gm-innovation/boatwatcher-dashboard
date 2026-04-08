
-- Add updated_at column to access_logs
ALTER TABLE public.access_logs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Backfill: set updated_at = created_at for existing rows
UPDATE public.access_logs SET updated_at = created_at WHERE updated_at = now();

-- Create trigger to auto-update updated_at on any UPDATE
CREATE OR REPLACE FUNCTION public.update_access_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_access_logs_updated_at
BEFORE UPDATE ON public.access_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_access_logs_updated_at();

-- Index for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_access_logs_updated_at ON public.access_logs (updated_at);
