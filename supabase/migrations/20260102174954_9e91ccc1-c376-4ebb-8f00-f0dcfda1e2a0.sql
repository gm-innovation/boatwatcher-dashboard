-- Add new columns to projects table for armador and API project ID
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS armador text,
ADD COLUMN IF NOT EXISTS api_project_id text;