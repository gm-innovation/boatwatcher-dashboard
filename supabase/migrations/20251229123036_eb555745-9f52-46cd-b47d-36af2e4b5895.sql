-- Function to create initial admin (only works if no admin exists)
-- Uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.create_initial_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if any admin already exists
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;
  
  -- Create admin role for the user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin');
  
  RETURN true;
END;
$$;

-- Function to check if initial setup is needed (no admins exist)
CREATE OR REPLACE FUNCTION public.needs_initial_setup()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;