import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Eye
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { EmployeeForm } from './EmployeeForm';
import { WorkerDocumentsDialog } from './WorkerDocumentsDialog';
import { getValidityStatus } from '@/utils/documentParser';

export const MyWorkers = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingDocumentsWorker, setViewingDocumentsWorker] = useState<any>(null);

  // Get company ID for current user
  const { data: userCompany } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data?.company_id;
    },
    enabled: !!user?.id
  });

  // Get workers for company
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

  // Get documents for workers
  const { data: documents = [] } = useQuery({
    queryKey: ['workers-documents', workers.map(w => w.id)],
    queryFn: async () => {
      if (workers.length === 0) return [];
      
      const { data, error } = await supabase
        .from('worker_documents')
        .select('*')
        .in('worker_id', workers.map(w => w.id));

      if (error) throw error;
      return data || [];
    },
    enabled: workers.length > 0
  });

  const getDocumentStatus = (workerId: string) => {
    const workerDocs = documents.filter(d => d.worker_id === workerId);
    if (workerDocs.length === 0) return 'pending';
    
    const hasExpired = workerDocs.some(d => {
      if (!d.expiry_date) return false;
      return getValidityStatus(d.expiry_date) === 'expired';
    });
    
    const hasExpiringSoon = workerDocs.some(d => {
      if (!d.expiry_date) return false;
      return getValidityStatus(d.expiry_date) === 'expiring_soon';
    });
    
    if (hasExpired) return 'expired';
    if (hasExpiringSoon) return 'expiring_soon';
    return 'valid';
  };

  const getDocumentCount = (workerId: string) => {
    return documents.filter(d => d.worker_id === workerId).length;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Regular
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Vencendo
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vencido
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const filteredWorkers = workers.filter(worker =>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar trabalhador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Funcionário
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum trabalhador encontrado</p>
            <p className="text-sm mt-2">Clique em "Novo Funcionário" para adicionar</p>
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
                        <Avatar className="h-8 w-8">
                          {worker.photo_url ? (
                            <AvatarImage src={worker.photo_url} alt={worker.name} />
                          ) : (
                            <AvatarFallback>
                              {worker.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          )}
                        </Avatar>
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
                        <Eye className="h-4 w-4 mr-1" />
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

      {/* Worker Documents Dialog */}
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
