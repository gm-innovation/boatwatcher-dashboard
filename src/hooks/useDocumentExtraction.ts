import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ensureValidSession } from '@/utils/ensureValidSession';
import { identifyDocumentType, parseDocumentDate, calculateExpiryDate, normalizeDocumentType, DocumentType } from '@/utils/documentParser';

export interface ExtractedDocumentData {
  document_type?: DocumentType;
  full_name?: string;
  document_number?: string;
  birth_date?: string;
  gender?: 'Masculino' | 'Feminino';
  blood_type?: string;
  job_function?: string;
  company_name?: string;
  completion_date?: string;
  expiry_date?: string;
}

export interface ProcessedDocument {
  filename: string;
  file_url: string;
  file_type: string;
  document_type: DocumentType;
  completion_date: string | null;
  expiry_date: string | null;
  extracted_data: ExtractedDocumentData;
  upload_date: string;
}

interface UseDocumentExtractionReturn {
  extractDocument: (file: File, workerId?: string) => Promise<ProcessedDocument | null>;
  extractMultipleDocuments: (files: File[], workerId?: string) => Promise<ProcessedDocument[]>;
  isExtracting: boolean;
  progress: number;
}

export const useDocumentExtraction = (): UseDocumentExtractionReturn => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadToStorage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('worker-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('[uploadToStorage] Erro no upload:', uploadError);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from('worker-documents')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('[uploadToStorage] Erro ao fazer upload:', error);
      return null;
    }
  };

  const extractDocument = async (file: File, workerId?: string): Promise<ProcessedDocument | null> => {
    try {
      // 1. Validate session with the server FIRST
      const validSession = await ensureValidSession();
      
      if (!validSession) {
        // ensureValidSession already handles toast and redirect for expired sessions
        // If it returns null without redirect, user is simply not logged in
        console.warn('[extractDocument] No valid session');
        return null;
      }

      // 2. Upload do arquivo
      const fileUrl = await uploadToStorage(file);
      if (!fileUrl) {
        toast({
          title: 'Erro no upload',
          description: `Não foi possível fazer upload de ${file.name}`,
          variant: 'destructive'
        });
        return null;
      }

      // 3. Identificar tipo preliminar pelo nome
      const preliminaryType = identifyDocumentType(file.name);

      // 4. Chamar edge function usando supabase.functions.invoke (mais seguro)
      console.log('[extractDocument] Calling edge function with valid token');
      
      let { data, error } = await supabase.functions.invoke('extract-document-data', {
        headers: {
          Authorization: `Bearer ${validSession.accessToken}`,
        },
        body: {
          file_url: fileUrl,
          filename: file.name,
          document_type: preliminaryType,
          worker_id: workerId,
        },
      });

      // Se retornar erro de autenticação, tenta refresh e repete
      if (error && (error.message?.includes('401') || error.message?.includes('Invalid JWT'))) {
        console.log('[extractDocument] Got 401, attempting token refresh...');
        
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        const newToken = refreshed.session?.access_token;
        
        if (!refreshError && newToken) {
          console.log('[extractDocument] Token refreshed, retrying...');
          ({ data, error } = await supabase.functions.invoke('extract-document-data', {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
            body: {
              file_url: fileUrl,
              filename: file.name,
              document_type: preliminaryType,
              worker_id: workerId,
            },
          }));
        } else {
          console.error('[extractDocument] Token refresh failed:', refreshError);
        }
      }

      if (error) {
        console.error('[extractDocument] Edge function error:', error);
        
        // Verificar se é erro de autenticação (401)
        if (error.message?.includes('401') || error.message?.includes('Invalid JWT')) {
          toast({
            title: 'Sessão expirada',
            description: 'Sua sessão expirou. Por favor, faça login novamente.',
            variant: 'destructive'
          });
          return null;
        }
        
        // Para outros erros, retornar documento com dados mínimos
        toast({
          title: 'Erro na extração',
          description: 'Não foi possível extrair dados do documento. Tente novamente.',
          variant: 'destructive'
        });
        
        return {
          filename: file.name,
          file_url: fileUrl,
          file_type: file.type,
          document_type: preliminaryType,
          completion_date: null,
          expiry_date: null,
          extracted_data: {},
          upload_date: new Date().toISOString()
        };
      }

      const extractedData: ExtractedDocumentData = data?.extracted_data || {};
      
      // 5. Processar datas
      const completionDate = parseDocumentDate(extractedData.completion_date);
      const documentType = normalizeDocumentType(extractedData.document_type || preliminaryType);
      const expiryDate = parseDocumentDate(extractedData.expiry_date) || 
                         calculateExpiryDate(completionDate, documentType);

      console.log('[extractDocument] Success, extracted data:', Object.keys(extractedData));

      return {
        filename: file.name,
        file_url: fileUrl,
        file_type: file.type,
        document_type: documentType,
        completion_date: completionDate,
        expiry_date: expiryDate,
        extracted_data: extractedData,
        upload_date: new Date().toISOString()
      };

    } catch (error) {
      console.error('[extractDocument] Erro ao processar documento:', error);
      toast({
        title: 'Erro ao processar documento',
        description: `Erro ao processar ${file.name}. Verifique sua conexão e tente novamente.`,
        variant: 'destructive'
      });
      return null;
    }
  };

  const extractMultipleDocuments = async (files: File[], workerId?: string): Promise<ProcessedDocument[]> => {
    setIsExtracting(true);
    setProgress(0);
    
    // Validate session once before processing all files
    const validSession = await ensureValidSession();
    if (!validSession) {
      setIsExtracting(false);
      return [];
    }
    
    const results: ProcessedDocument[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await extractDocument(file, workerId);
      
      if (result) {
        results.push(result);
      }
      
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsExtracting(false);
    setProgress(0);
    
    return results;
  };

  return {
    extractDocument,
    extractMultipleDocuments,
    isExtracting,
    progress
  };
};
