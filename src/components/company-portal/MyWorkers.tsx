import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResolvedAvatar } from '@/components/ResolvedAvatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Eye
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentCompany } from '@/hooks/useCurrentCompany';
import { EmployeeForm } from './EmployeeForm';
import { WorkerDocumentsDialog } from './WorkerDocumentsDialog';
import { getValidityStatus } from '@/utils/documentParser';

export const MyWorkers = () => {
  const { user } = useAuth();
  const { data: companyAccess } = useCurrentCompany(user?.id);
  const userCompany = companyAccess?.companyId;
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingDocumentsWorker, setViewingDocumentsWorker] = useState<any>(null);

  const { data: workers = [], isLoading, refetch } = useQuery({
    queryKey: ['company-workers', userCompany],
    queryFn: async () => {
      if (!userCompany) return [];

      const { data, error } = await supabase
        .from('workers')
        .select(`
          *,
          job_function:job_functions(name)
        `)
        .eq('company_id', userCompany)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!userCompany
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['workers-documents', workers.map((worker) => worker.id)],
    queryFn: async () => {
      if (workers.length === 0) return [];

      const { data, error } = await supabase
        .from('worker_documents')
        .select('*')
        .in('worker_id', workers.map((worker) => worker.id));

      if (error) throw error;
      return data || [];
    },
    enabled: workers.length > 0
  });

  const getDocumentStatus = (workerId: string) => {
    const workerDocs = documents.filter((document) => document.worker_id === workerId);
    if (workerDocs.length === 0) return 'pending';

    const hasExpired = workerDocs.some((document) => {
      if (!document.expiry_date) return false;
      return getValidityStatus(document.expiry_date) === 'expired';
    });

    const hasExpiringSoon = workerDocs.some((document) => {
      if (!document.expiry_date) return false;
      return getValidityStatus(document.expiry_date) === 'expiring_soon';
    });

    if (hasExpired) return 'expired';
    if (hasExpiringSoon) return 'expiring_soon';
    return 'valid';
  };

  const getDocumentCount = (workerId: string) => {
    return documents.filter((document) => document.worker_id === workerId).length;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
            <CheckCircle className="mr-1 h-3 w-3" />
            Regular
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="border-border bg-muted text-foreground">
            <Clock className="mr-1 h-3 w-3" />
            Vencendo
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Vencido
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            Pendente
          </Badge>
        );
    }
  };

  const filteredWorkers = workers.filter((worker) =>
    worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Meus Trabalhadores ({workers.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar trabalhador..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Funcionário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Funcionário</DialogTitle>
                </DialogHeader>
                {userCompany && (
                  <EmployeeForm
                    companyId={userCompany}
                    onSuccess={() => {
                      setIsAddDialogOpen(false);
                      refetch();
                    }}
                    onCancel={() => setIsAddDialogOpen(false)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Nenhum trabalhador encontrado</p>
            <p className="mt-2 text-sm">Clique em "Novo Funcionário" para adicionar</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabalhador</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documentação</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkers.map((worker) => (
                  <TableRow key={worker.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ResolvedAvatar
                          className="h-8 w-8"
                          photoUrl={worker.photo_url}
                          name={worker.name}
                          fallback="initials"
                        />
                        <span className="font-medium">{worker.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{worker.job_function?.name || worker.role || '-'}</TableCell>
                    <TableCell>{worker.document_number || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={worker.status === 'active' ? 'default' : 'secondary'}>
                        {worker.status === 'active' ? 'Ativo' : worker.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(getDocumentStatus(worker.id))}
                        <Badge variant="outline" className="text-xs">
                          {getDocumentCount(worker.id)} doc(s)
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingDocumentsWorker(worker)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Ver Docs
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      <Dialog open={!!viewingDocumentsWorker} onOpenChange={(open) => !open && setViewingDocumentsWorker(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Documentos de {viewingDocumentsWorker?.name}</DialogTitle>
          </DialogHeader>
          {viewingDocumentsWorker && (
            <WorkerDocumentsDialog
              workerId={viewingDocumentsWorker.id}
              workerName={viewingDocumentsWorker.name}
              onClose={() => setViewingDocumentsWorker(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
