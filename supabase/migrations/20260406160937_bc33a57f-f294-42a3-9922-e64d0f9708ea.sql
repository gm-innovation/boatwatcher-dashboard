CREATE OR REPLACE FUNCTION public.authorize_companies_to_project(
  _company_ids uuid[],
  _project_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE workers
  SET 
    allowed_project_ids = CASE
      WHEN allowed_project_ids IS NULL THEN ARRAY[_project_id]
      WHEN NOT (allowed_project_ids @> ARRAY[_project_id]) THEN allowed_project_ids || _project_id
      ELSE allowed_project_ids
    END,
    updated_at = now()
  WHERE company_id = ANY(_company_ids)
    AND (allowed_project_ids IS NULL OR NOT (allowed_project_ids @> ARRAY[_project_id]));
  
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;