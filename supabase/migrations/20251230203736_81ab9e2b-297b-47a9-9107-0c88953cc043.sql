-- Create table for device API tokens (for webhook authentication)
CREATE TABLE public.device_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'default',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.device_api_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view device_api_tokens"
ON public.device_api_tokens
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert device_api_tokens"
ON public.device_api_tokens
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update device_api_tokens"
ON public.device_api_tokens
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete device_api_tokens"
ON public.device_api_tokens
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for faster token lookups
CREATE INDEX idx_device_api_tokens_token ON public.device_api_tokens(token);
CREATE INDEX idx_device_api_tokens_device_id ON public.device_api_tokens(device_id);