import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useDocumentExtraction, ProcessedDocument } from '@/hooks/useDocumentExtraction';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  ExternalLink,
  X,
  Plus,
  Sparkles
} from 'lucide-react';
import { getValidityStatus, getDaysUntilExpiry } from '@/utils/documentParser';

interface WorkerDocumentsDialogProps {
  workerId: string;
  workerName: string;
  onClose: () => void;
}

export const WorkerDocumentsDialog = ({ workerId, workerName, onClose }: WorkerDocumentsDialogProps) => {
  const queryClient = useQueryClient();
  const { extractMultipleDocuments, isExtracting, progress } = useDocumentExtraction();
  const docsInputRef = useRef<HTMLInputElement>(null);

  // Get existing documents
  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['worker-documents', workerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_documents')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const handleDocumentsSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter(f => 
      f.type === 'application/pdf' || 
      f.type.startsWith('image/')
    );

    if (fileArray.length === 0) {
      toast({ title: 'Selecione arquivos PDF ou imagens', variant: 'destructive' });
      return;
    }

    const processedDocs = await extractMultipleDocuments(fileArray, workerId);
    
    if (processedDocs.length > 0) {
      // Save to database
      const docsToInsert = processedDocs.map(doc => ({
        worker_id: workerId,
        document_type: doc.document_type,
        document_url: doc.file_url,
        filename: doc.filename,
        issue_date: doc.completion_date || null,
        expiry_date: doc.expiry_date || null,
        extracted_data: doc.extracted_data as any,
        status: getValidityStatus(doc.expiry_date),
      }));

      const { error } = await supabase
        .from('worker_documents')
        .insert(docsToInsert);

      if (error) {
        toast({ title: 'Erro ao salvar documentos', variant: 'destructive' });
      } else {
        toast({ title: `${processedDocs.length} documento(s) adicionado(s)` });
        refetch();
        queryClient.invalidateQueries({ queryKey: ['workers-documents'] });
      }
    }

    if (docsInputRef.current) {
      docsInputRef.current.value = '';
    }
  };

  const getStatusBadge = (expiryDate: string | null) => {
    const status = getValidityStatus(expiryDate);
    const daysUntil = getDaysUntilExpiry(expiryDate);
    
    switch (status) {
      case 'valid':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Válido {daysUntil !== null && `(${daysUntil}d)`}
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Vence em {daysUntil}d
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vencido há {Math.abs(daysUntil || 0)}d
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Documents */}
      <div className="space-y-2">
        <input
          ref={docsInputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          onChange={handleDocumentsSelect}
          className="hidden"
        />
        
        <div 
          onClick={() => !isExtracting && docsInputRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {isExtracting ? (
            <div className="space-y-2">
              <Loader2 className="h-6 w-6 mx-auto text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Processando com IA...</p>
              <Progress value={progress} className="max-w-xs mx-auto" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Plus className="h-5 w-5" />
              <span className="text-sm">Adicionar Documentos</span>
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                IA
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Nenhum documento cadastrado</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {documents.map((doc: any) => (
              <Card key={doc.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {doc.filename || doc.document_type}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {doc.document_type}
                      </Badge>
                      {doc.expiry_date && getStatusBadge(doc.expiry_date)}
                      {doc.issue_date && (
                        <span className="text-xs text-muted-foreground">
                          Emissão: {new Date(doc.issue_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                  {doc.document_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(doc.document_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
};
