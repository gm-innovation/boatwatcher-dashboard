import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useDocumentExtraction } from '@/hooks/useDocumentExtraction';
import { usesLocalServer } from '@/lib/runtimeProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Plus,
  Sparkles
} from 'lucide-react';
import { getValidityStatus, getDaysUntilExpiry } from '@/utils/documentParser';
import { fetchWorkerDocuments, createWorkerDocument } from '@/hooks/useDataProvider';

interface WorkerDocumentsDialogProps {
  workerId: string;
  workerName: string;
  onClose: () => void;
}

export const WorkerDocumentsDialog = ({ workerId, workerName, onClose }: WorkerDocumentsDialogProps) => {
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalServer();
  const { extractMultipleDocuments, isExtracting, progress } = useDocumentExtraction();
  const docsInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['worker-documents', workerId, isLocalRuntime],
    queryFn: async () => {
      return await fetchWorkerDocuments(workerId);
    }
  });

  const handleDocumentsSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (isLocalRuntime) {
      toast({
        title: 'Extração com IA indisponível no desktop',
        description: 'Você pode adicionar documentos manualmente.',
        variant: 'destructive'
      });
      event.target.value = '';
      return;
    }

    const fileArray = Array.from(files).filter((file) =>
      file.type === 'application/pdf' ||
      file.type.startsWith('image/')
    );

    if (fileArray.length === 0) {
      toast({ title: 'Selecione arquivos PDF ou imagens', variant: 'destructive' });
      return;
    }

    const processedDocs = await extractMultipleDocuments(fileArray, workerId);

    if (processedDocs.length > 0) {
      let successCount = 0;
      for (const doc of processedDocs) {
        try {
          await createWorkerDocument({
            worker_id: workerId,
            document_type: doc.document_type,
            document_url: doc.file_url,
            filename: doc.filename,
            issue_date: doc.completion_date || null,
            expiry_date: doc.expiry_date || null,
            extracted_data: doc.extracted_data,
            status: getValidityStatus(doc.expiry_date),
          });
          successCount++;
        } catch (err) {
          console.error('Erro ao salvar documento:', err);
        }
      }

      if (successCount > 0) {
        toast({ title: `${successCount} documento(s) adicionado(s)` });
        refetch();
        queryClient.invalidateQueries({ queryKey: ['workers-documents'] });
      } else {
        toast({ title: 'Erro ao salvar documentos', variant: 'destructive' });
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
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
            <CheckCircle className="mr-1 h-3 w-3" />
            Válido {daysUntil !== null && `(${daysUntil}d)`}
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="border-border bg-muted text-foreground">
            <Clock className="mr-1 h-3 w-3" />
            Vence em {daysUntil}d
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Vencido há {Math.abs(daysUntil || 0)}d
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
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
          className="cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors hover:bg-muted/50"
        >
          {isExtracting ? (
            <div className="space-y-2">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando com IA...</p>
              <Progress value={progress} className="mx-auto max-w-xs" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Plus className="h-5 w-5" />
              <span className="text-sm">Adicionar Documentos</span>
              {!isLocalRuntime && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  IA
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-10 w-10 opacity-50" />
          <p>Nenhum documento cadastrado</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {documents.map((doc: any) => (
              <Card key={doc.id} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-muted p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {doc.filename || doc.document_type}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
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

      <div className="border-t pt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </div>
  );
};
