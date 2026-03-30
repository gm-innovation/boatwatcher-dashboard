
ALTER TABLE public.companies ADD COLUMN logo_url_rotated TEXT;

UPDATE public.companies SET logo_url_rotated = logo_url_dark WHERE logo_url_dark IS NOT NULL;

UPDATE public.companies SET logo_url_dark = NULL WHERE logo_url_rotated IS NOT NULL;
