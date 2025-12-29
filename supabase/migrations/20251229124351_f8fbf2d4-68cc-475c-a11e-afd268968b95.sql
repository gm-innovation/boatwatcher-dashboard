-- Adicionar novos campos na tabela projects para o dashboard reestruturado
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS commander text,
ADD COLUMN IF NOT EXISTS chief_engineer text,
ADD COLUMN IF NOT EXISTS project_type text,
ADD COLUMN IF NOT EXISTS crew_size integer DEFAULT 0;