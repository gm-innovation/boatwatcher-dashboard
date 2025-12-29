-- Fase 1: Schema do Banco de Dados

-- 1.1 Adicionar campos na tabela worker_documents
ALTER TABLE public.worker_documents 
ADD COLUMN IF NOT EXISTS extracted_data jsonb,
ADD COLUMN IF NOT EXISTS filename text;

-- 1.2 Criar tabela company_documents para documentos institucionais
CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL,
  filename text NOT NULL,
  file_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_documents
CREATE POLICY "Users can view their company documents" 
ON public.company_documents 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Company admins can insert documents" 
ON public.company_documents 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  company_id = get_user_company_id(auth.uid())
);

CREATE POLICY "Company admins can delete documents" 
ON public.company_documents 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  company_id = get_user_company_id(auth.uid())
);

-- 1.3 Criar bucket de storage para documentos da empresa
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-documents', 'company-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 1.4 Criar bucket de storage para documentos de trabalhadores
INSERT INTO storage.buckets (id, name, public) 
VALUES ('worker-documents', 'worker-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para company-documents
CREATE POLICY "Anyone can view company documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-documents');

CREATE POLICY "Authenticated users can upload company documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete company documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Storage policies para worker-documents
CREATE POLICY "Anyone can view worker documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'worker-documents');

CREATE POLICY "Authenticated users can upload worker documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'worker-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete worker documents" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'worker-documents' AND auth.role() = 'authenticated');