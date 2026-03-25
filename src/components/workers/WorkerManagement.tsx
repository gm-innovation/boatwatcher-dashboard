import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createWorker, updateWorker, deleteWorker } from '@/hooks/useDataProvider';
import { uploadFile } from '@/lib/storageProvider';
import { isElectron } from '@/lib/dataProvider';
import { supabase } from '@/integrations/supabase/client';
import { useWorkers, useCompanies, useProjects } from '@/hooks/useSupabase';
import { useDevices, useWorkerEnrollment } from '@/hooks/useControlID';
import { useResolvedUrl } from '@/hooks/useResolvedUrl';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ResolvedAvatar } from '@/components/ResolvedAvatar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Upload,
  User,
  Edit,
  Trash2,
  Camera,
  CheckCircle,
  XCircle,
  Fingerprint,
  Eye,
  Hash,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { Worker, WorkerStatus } from '@/types/supabase';
import { WorkerDetailsDialog } from './WorkerDetailsDialog';
import { NewWorkerDialog } from './NewWorkerDialog';

const workerSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  document_number: z.string().min(11, 'CPF inválido').max(14),
  role: z.string().optional(),
  company_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'blocked', 'pending_review']),
  allowed_project_ids: z.array(z.string()).default([]),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface WorkerFormProps {
  worker?: Worker | null;
  onSuccess: (autoEnrollResult?: { workerId: string; workerName: string; commandIds: string[] }) => void;
  onCancel: () => void;
}

const WorkerForm = ({ worker, onSuccess, onCancel }: WorkerFormProps) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const resolvedWorkerPhotoUrl = useResolvedUrl(worker?.photo_url);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: companies = [] } = useCompanies();
  const { data: projects = [] } = useProjects();
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      name: worker?.name || '',
      document_number: worker?.document_number || '',
      role: worker?.role || '',
      company_id: worker?.company_id || '',
      status: (worker?.status as WorkerStatus) || 'active',
      allowed_project_ids: worker?.allowed_project_ids || [],
    }
  });

  const selectedProjects = watch('allowed_project_ids');

  useEffect(() => {
    setPhotoFile(null);
    setPhotoPreview(resolvedWorkerPhotoUrl ?? null);
  }, [worker?.id, resolvedWorkerPhotoUrl]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (workerId: string): Promise<string | null> => {
    if (!photoFile) return worker?.photo_url || null;

    const fileExt = photoFile.name.split('.').pop();
    const fileName = `${workerId}.${fileExt}`;
    const filePath = `workers/${fileName}`;

    const result = await uploadFile('worker-photos', filePath, photoFile, { upsert: true });
    return result;
  };

  const onSubmit = async (data: WorkerFormData) => {
    setIsUploading(true);
    try {
      if (worker) {
        const photoUrl = await uploadPhoto(worker.id);
        await updateWorker(worker.id, {
          name: data.name,
          document_number: data.document_number,
          role: data.role || null,
          company_id: data.company_id || null,
          status: data.status,
          allowed_project_ids: data.allowed_project_ids,
          photo_url: photoUrl,
        });

        // Auto-enrollment: if worker has devices_enrolled, re-sync automatically
        const enrolledDevices = worker.devices_enrolled || [];
        if (enrolledDevices.length > 0) {
          try {
            const { data: enrollResult, error: enrollError } = await supabase.functions.invoke("worker-enrollment", {
              body: { action: 'enroll', workerId: worker.id, deviceIds: enrolledDevices }
            });
            if (!enrollError && enrollResult?.commandIds?.length > 0) {
              toast({ 
                title: 'Dados atualizados',
                description: `Re-sincronizando biometria em ${enrolledDevices.length} dispositivo(s)...`,
              });
              queryClient.invalidateQueries({ queryKey: ['workers'] });
              onSuccess({ workerId: worker.id, workerName: worker.name, commandIds: enrollResult.commandIds });
              return;
            }
          } catch (enrollErr) {
            console.error('Auto-enrollment failed:', enrollErr);
            toast({ 
              title: 'Trabalhador atualizado', 
              description: 'Não foi possível re-sincronizar a biometria automaticamente. Use o botão de Enrollment manualmente.',
              variant: 'destructive',
            });
          }
        }

        toast({ title: 'Trabalhador atualizado com sucesso' });
      } else {
        const newWorker = await createWorker({
          name: data.name,
          document_number: data.document_number,
          role: data.role || null,
          company_id: data.company_id || null,
          status: data.status,
          allowed_project_ids: data.allowed_project_ids,
        });

        if (photoFile && newWorker) {
          const photoUrl = await uploadPhoto(newWorker.id);
          if (photoUrl) {
            await updateWorker(newWorker.id, { photo_url: photoUrl });
          }
        }

        toast({ title: 'Trabalhador cadastrado com sucesso' });
      }

      queryClient.invalidateQueries({ queryKey: ['workers'] });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const toggleProject = (projectId: string) => {
    const current = selectedProjects || [];
    if (current.includes(projectId)) {
      setValue('allowed_project_ids', current.filter(id => id !== projectId));
    } else {
      setValue('allowed_project_ids', [...current, projectId]);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex items-center gap-4">
        <div 
          className="relative cursor-pointer group"
          onClick={() => fileInputRef.current?.click()}
        >
          <Avatar className="h-20 w-20">
            {photoPreview ? (
              <AvatarImage src={photoPreview} alt="Foto" />
            ) : (
              <AvatarFallback>
                <User className="h-8 w-8" />
              </AvatarFallback>
            )}
          </Avatar>
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Foto para Reconhecimento Facial</p>
          <p className="text-xs text-muted-foreground">Clique para enviar uma foto de alta qualidade</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome Completo *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="document_number">CPF *</Label>
          <Input id="document_number" placeholder="000.000.000-00" {...register('document_number')} />
          {errors.document_number && <p className="text-sm text-destructive">{errors.document_number.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Função</Label>
          <Input id="role" placeholder="Ex: Eletricista" {...register('role')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company_id">Empresa</Label>
          <Select onValueChange={(value) => setValue('company_id', value)} defaultValue={worker?.company_id || ''}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status de Acesso</Label>
        <Select onValueChange={(value) => setValue('status', value as WorkerStatus)} defaultValue={worker?.status || 'active'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
            <SelectItem value="blocked">Bloqueado</SelectItem>
            <SelectItem value="pending_review">Pendente de Revisão</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Projetos Permitidos</Label>
        <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
          {projects.map(project => (
            <div key={project.id} className="flex items-center gap-2">
              <Checkbox 
                id={`project-${project.id}`}
                checked={selectedProjects?.includes(project.id)}
                onCheckedChange={() => toggleProject(project.id)}
              />
              <label htmlFor={`project-${project.id}`} className="text-sm cursor-pointer">
                {project.name}
              </label>
            </div>
          ))}
          {projects.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum projeto cadastrado</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isUploading}>
          {isUploading ? 'Salvando...' : worker ? 'Atualizar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
};

// Componente de Enrollment com tracking de status
interface EnrollmentDialogProps {
  worker: Worker;
  onClose: () => void;
}

const EnrollmentDialog = ({ worker, onClose }: EnrollmentDialogProps) => {
  const { data: devices = [] } = useDevices();
  const { enroll, remove, isLoading } = useWorkerEnrollment();
  const queryClient = useQueryClient();
  const [selectedDevices, setSelectedDevices] = useState<string[]>(worker.devices_enrolled || []);
  const [trackedCommandIds, setTrackedCommandIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<'select' | 'tracking'>('select');

  // Poll command statuses when tracking
  const { data: commandStatuses = [] } = useQuery({
    queryKey: ['enrollment-commands', trackedCommandIds],
    queryFn: async () => {
      if (trackedCommandIds.length === 0) return [];
      const { data, error } = await supabase
        .from('agent_commands')
        .select('id, device_id, status, error_message, command, executed_at')
        .in('id', trackedCommandIds);
      if (error) throw error;
      return data || [];
    },
    enabled: trackedCommandIds.length > 0 && phase === 'tracking',
    refetchInterval: trackedCommandIds.length > 0 ? 3000 : false,
  });

  // Stop polling when all commands are done
  const allDone = commandStatuses.length > 0 && 
    commandStatuses.every(c => c.status === 'completed' || c.status === 'failed');

  useEffect(() => {
    if (allDone) {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }
  }, [allDone, queryClient]);

  const handleEnroll = async () => {
    const toEnroll = selectedDevices.filter(id => !worker.devices_enrolled?.includes(id));
    const toRemove = (worker.devices_enrolled || []).filter(id => !selectedDevices.includes(id));

    try {
      const allCommandIds: string[] = [];

      if (toEnroll.length > 0) {
        const result = await enroll(worker.id, toEnroll);
        if (result?.commandIds) allCommandIds.push(...result.commandIds);
      }
      if (toRemove.length > 0) {
        const result = await remove(worker.id, toRemove);
        if (result?.commandIds) allCommandIds.push(...result.commandIds);
      }

      if (allCommandIds.length > 0) {
        setTrackedCommandIds(allCommandIds);
        setPhase('tracking');
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Enrollment error:', error);
    }
  };

  const handleRetry = async (commandId: string) => {
    const cmd = commandStatuses.find(c => c.id === commandId);
    if (!cmd) return;

    try {
      const action = cmd.command === 'remove_worker' ? 'remove' : 'enroll';
      const fn = action === 'remove' ? remove : enroll;
      const result = await fn(worker.id, [cmd.device_id]);
      if (result?.commandIds) {
        setTrackedCommandIds(prev => [
          ...prev.filter(id => id !== commandId),
          ...result.commandIds,
        ]);
      }
    } catch (error) {
      console.error('Retry error:', error);
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const getDeviceName = (deviceId: string) => {
    return devices.find(d => d.id === deviceId)?.name || deviceId.slice(0, 8);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'in_progress': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      default: return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'failed': return 'Falhou';
      case 'in_progress': return 'Executando...';
      default: return 'Aguardando agente...';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b">
        <ResolvedAvatar
          className="h-12 w-12"
          photoUrl={worker.photo_url}
          name={worker.name}
          iconClassName="h-6 w-6"
        />
        <div>
          <p className="font-medium">{worker.name}</p>
          <p className="text-sm text-muted-foreground">{worker.document_number}</p>
        </div>
      </div>

      {phase === 'select' ? (
        <>
          <div className="space-y-2">
            <Label>Dispositivos para Enrollment</Label>
            <ScrollArea className="h-60 border rounded-md p-3">
              {devices.map(device => {
                const isEnrolled = worker.devices_enrolled?.includes(device.id);
                const isSelected = selectedDevices.includes(device.id);
                
                return (
                  <div 
                    key={device.id} 
                    className={`flex items-center justify-between p-3 rounded-md mb-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border border-primary' : 'bg-muted/50 hover:bg-muted'
                    }`}
                    onClick={() => toggleDevice(device.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={isSelected} />
                      <div>
                        <p className="font-medium text-sm">{device.name}</p>
                        <p className="text-xs text-muted-foreground">{device.controlid_ip_address}</p>
                      </div>
                    </div>
                    {isEnrolled && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Cadastrado
                      </Badge>
                    )}
                  </div>
                );
              })}
              {devices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum dispositivo cadastrado
                </p>
              )}
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleEnroll} disabled={isLoading}>
              <Fingerprint className="h-4 w-4 mr-2" />
              {isLoading ? 'Processando...' : 'Sincronizar Biometria'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {allDone ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {allDone ? 'Enrollment finalizado' : 'Aguardando execução pelo agente local...'}
            </Label>
            <div className="border rounded-md divide-y">
              {commandStatuses.map(cmd => (
                <div key={cmd.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(cmd.status)}
                    <div>
                      <p className="text-sm font-medium">{getDeviceName(cmd.device_id)}</p>
                      <p className="text-xs text-muted-foreground">{getStatusLabel(cmd.status)}</p>
                      {cmd.error_message && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {cmd.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  {cmd.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={() => handleRetry(cmd.id)}>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reenviar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose}>
              {allDone ? 'Fechar' : 'Fechar (continua em background)'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export const WorkerManagement = () => {
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [enrollingWorker, setEnrollingWorker] = useState<Worker | null>(null);
  const { data: workers = [], isLoading, refetch } = useWorkers();
  const { data: companies = [] } = useCompanies();
  const queryClient = useQueryClient();

  const handleDelete = async (worker: Worker) => {
    if (!confirm(`Tem certeza que deseja remover ${worker.name}?`)) return;
    
    try {
      await deleteWorker(worker.id);
      toast({ title: 'Trabalhador removido' });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    } catch {
      toast({ title: 'Erro ao remover trabalhador', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-500/10 text-green-500">Ativo</Badge>;
      case 'inactive': return <Badge className="bg-gray-500/10 text-gray-500">Inativo</Badge>;
      case 'blocked': return <Badge className="bg-red-500/10 text-red-500">Bloqueado</Badge>;
      case 'pending_review': return <Badge className="bg-yellow-500/10 text-yellow-500">Pendente</Badge>;
      default: return <Badge className="bg-gray-500/10 text-gray-500">-</Badge>;
    }
  };

  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return '-';
    return companies.find(c => c.id === companyId)?.name || '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trabalhadores</h2>
          <p className="text-sm text-muted-foreground">{workers.length} trabalhadores cadastrados</p>
        </div>
        <Button onClick={() => setIsNewDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Trabalhador
        </Button>
      </div>

      {/* New Worker Dialog */}
      <NewWorkerDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onSuccess={() => refetch()}
      />

      {/* Worker Details Dialog */}
      <WorkerDetailsDialog
        worker={selectedWorker}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onUpdate={() => refetch()}
      />

      {/* Edit Worker Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Trabalhador</DialogTitle>
          </DialogHeader>
          <WorkerForm 
            worker={editingWorker} 
            onSuccess={() => {
              setIsEditDialogOpen(false);
              setEditingWorker(null);
            }}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingWorker(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Enrollment Dialog */}
      <Dialog open={!!enrollingWorker} onOpenChange={(open) => !open && setEnrollingWorker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enrollment Biométrico</DialogTitle>
          </DialogHeader>
          {enrollingWorker && (
            <EnrollmentDialog worker={enrollingWorker} onClose={() => setEnrollingWorker(null)} />
          )}
        </DialogContent>
      </Dialog>

      <ScrollArea className="h-[500px] border rounded-lg">
        <table className="w-full">
          <thead className="sticky top-0 bg-card border-b">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Código</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Trabalhador</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">CPF</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Função</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {workers.map(worker => (
              <tr key={worker.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedWorker(worker); setIsDetailsOpen(true); }}>
                <td className="p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {(worker as any).code || '-'}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <ResolvedAvatar
                      className="h-8 w-8"
                      photoUrl={worker.photo_url}
                      name={worker.name}
                      iconClassName="h-4 w-4"
                    />
                    <span className="font-medium">{worker.name}</span>
                  </div>
                </td>
                <td className="p-4 text-sm text-muted-foreground">{worker.document_number || '-'}</td>
                <td className="p-4 text-sm text-muted-foreground">{getCompanyName(worker.company_id)}</td>
                <td className="p-4 text-sm text-muted-foreground">{worker.role || '-'}</td>
                <td className="p-4 text-center">{getStatusBadge(worker.status)}</td>
                <td className="p-4">
                  <div className="flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedWorker(worker); setIsDetailsOpen(true); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEnrollingWorker(worker)}>
                      <Fingerprint className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingWorker(worker); setIsEditDialogOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(worker)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {workers.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum trabalhador cadastrado</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
};