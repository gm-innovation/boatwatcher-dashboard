ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_worker_id_fkey;
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_device_id_fkey;