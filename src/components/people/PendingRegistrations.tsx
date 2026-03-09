import { useState } from 'react';
import { useWorkers } from '@/hooks/useSupabase';
import { updateWorker } from '@/hooks/useDataProvider';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, User, Clock, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export const PendingRegistrations = () => {
  const { data: workers = [], isLoading } = useWorkers();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingWorkers = workers.filter(w => w.status === 'pending_review');

  const handleApprove = async (workerId: string) => {
    setProcessingId(workerId);
    try {
      await updateWorker(workerId, { status: 'active' });
      toast({ title: 'Cadastro aprovado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (workerId: string) => {
    setProcessingId(workerId);
    try {
      await updateWorker(workerId, { status: 'blocked' });
      toast({ title: 'Cadastro rejeitado' });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    } catch (error: any) {
      toast({ title: 'Erro ao rejeitar', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-3xl font-bold">{pendingWorkers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovados Hoje</p>
                <p className="text-3xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Docs Faltando</p>
                <p className="text-3xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending List */}
      <Card>
        <CardHeader>
          <CardTitle>Cadastros Aguardando Análise</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : pendingWorkers.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {pendingWorkers.map((worker) => (
                  <div 
                    key={worker.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        {worker.photo_url ? (
                          <AvatarImage src={worker.photo_url} alt={worker.name} />
                        ) : (
                          <AvatarFallback>
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="font-medium">{worker.name}</p>
                        <p className="text-sm text-muted-foreground">{worker.document_number}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{worker.role || 'Sem função'}</Badge>
                          <Badge variant="secondary">{worker.company || 'Sem empresa'}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleReject(worker.id)}
                        disabled={processingId === worker.id}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(worker.id)}
                        disabled={processingId === worker.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum cadastro pendente</p>
              <p className="text-sm">Todos os cadastros foram analisados</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
