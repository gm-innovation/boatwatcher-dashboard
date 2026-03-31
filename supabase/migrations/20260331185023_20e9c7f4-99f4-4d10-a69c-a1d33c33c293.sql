
ALTER TABLE public.manual_access_points
  ADD COLUMN location_description text,
  ADD COLUMN client_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN recognition_method text NOT NULL DEFAULT 'code',
  ADD COLUMN require_photo boolean NOT NULL DEFAULT false,
  ADD COLUMN auto_sync boolean NOT NULL DEFAULT true;
