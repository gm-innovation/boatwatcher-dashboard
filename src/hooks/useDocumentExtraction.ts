import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
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
        console.error('Erro no upload:', uploadError);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from('worker-documents')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      return null;
    }
  };

  const extractDocument = async (file: File, workerId?: string): Promise<ProcessedDocument | null> => {
    try {
      // 1. Upload do arquivo
      const fileUrl = await uploadToStorage(file);
      if (!fileUrl) {
        toast({
          title: 'Erro no upload',
          description: `Não foi possível fazer upload de ${file.name}`,
          variant: 'destructive'
        });
        return null;
      }

      // 2. Identificar tipo preliminar pelo nome
      const preliminaryType = identifyDocumentType(file.name);

      // 3. Chamar edge function para extração via IA
      const { data, error } = await supabase.functions.invoke('extract-document-data', {
        body: {
          file_url: fileUrl,
          filename: file.name,
          document_type: preliminaryType,
          worker_id: workerId
        }
      });

      if (error) {
        console.error('Erro na extração:', error);
        // Retornar documento com dados mínimos
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
      
      // 4. Processar datas
      const completionDate = parseDocumentDate(extractedData.completion_date);
      const documentType = normalizeDocumentType(extractedData.document_type || preliminaryType);
      const expiryDate = parseDocumentDate(extractedData.expiry_date) || 
                         calculateExpiryDate(completionDate, documentType);

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
      console.error('Erro ao processar documento:', error);
      toast({
        title: 'Erro ao processar documento',
        description: `Erro ao processar ${file.name}`,
        variant: 'destructive'
      });
      return null;
    }
  };

  const extractMultipleDocuments = async (files: File[], workerId?: string): Promise<ProcessedDocument[]> => {
    setIsExtracting(true);
    setProgress(0);
    
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
