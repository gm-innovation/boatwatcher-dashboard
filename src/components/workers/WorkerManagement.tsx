import { useEffect, useState, useRef } from 'react';
import { formatWorkerCode, normalizeName, formatCpf } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import jsPDF from 'jspdf';
import { createWorker, updateWorker, deleteWorker } from '@/hooks/useDataProvider';
import { uploadFile } from '@/lib/storageProvider';
import { isElectron } from '@/lib/dataProvider';
import { supabase } from '@/integrations/supabase/client';
import { shouldUseLocalServer } from '@/lib/runtimeProfile';
import { localControlId } from '@/lib/localServerProvider';
import { useWorkers, useCompanies, useProjects } from '@/hooks/useSupabase';
import { useDevices, useWorkerEnrollment } from '@/hooks/useControlID';
import { useResolvedUrl } from '@/hooks/useResolvedUrl';
import { useJobFunctions } from '@/hooks/useJobFunctions';
import { resolveFileUrl } from '@/utils/storageUtils';
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
  
  Loader2,
  AlertCircle,
  RefreshCw,
  Printer,
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
      let savedWorkerId: string;
      let savedWorkerName: string;

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
        savedWorkerId = worker.id;
        savedWorkerName = data.name;
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
        savedWorkerId = newWorker?.id;
        savedWorkerName = data.name;
      }

      // Auto-enrollment: trigger based on allowed_project_ids
      if (savedWorkerId && data.allowed_project_ids.length > 0) {
        try {
          const useLocal = await shouldUseLocalServer();

          if (useLocal) {
            // Desktop: call local server directly for immediate hardware response
            const result = await localControlId.enrollWorker(savedWorkerId, [], 'enroll');
            if (result?.success || result?.results?.some((r: any) => r.success)) {
              toast({
                title: worker ? 'Dados atualizados' : 'Trabalhador cadastrado',
                description: result.message || `Enrollment concluído em ${result.results?.length || 0} dispositivo(s).`,
              });
              queryClient.invalidateQueries({ queryKey: ['workers'] });
              onSuccess();
              return;
            } else {
              toast({
                title: worker ? 'Dados atualizados' : 'Trabalhador cadastrado',
                description: result.message || 'Enrollment falhou em alguns dispositivos.',
                variant: 'destructive',
              });
              queryClient.invalidateQueries({ queryKey: ['workers'] });
              onSuccess();
              return;
            }
          } else {
            // Web / fallback: use cloud edge function (queues via agent_commands)
            const { data: enrollResult, error: enrollError } = await supabase.functions.invoke("worker-enrollment", {
              body: { action: 'enroll', workerId: savedWorkerId }
            });
            if (!enrollError && enrollResult?.commandIds?.length > 0) {
              toast({ 
                title: worker ? 'Dados atualizados' : 'Trabalhador cadastrado',
                description: `Sincronizando biometria em ${enrollResult.resolvedDeviceCount || enrollResult.commandIds.length} dispositivo(s)...`,
              });
              queryClient.invalidateQueries({ queryKey: ['workers'] });
              onSuccess({ workerId: savedWorkerId, workerName: savedWorkerName, commandIds: enrollResult.commandIds });
              return;
            }
          }
        } catch (enrollErr) {
          console.error('Auto-enrollment failed:', enrollErr);
        }
      }

      toast({ title: worker ? 'Trabalhador atualizado com sucesso' : 'Trabalhador cadastrado com sucesso' });
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
  const enrollSuccessCount = commandStatuses.filter(c => c.status === 'completed').length;
  const enrollFailedCount = commandStatuses.filter(c => c.status === 'failed').length;
  const enrollHasFailures = enrollFailedCount > 0;

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
                enrollHasFailures ? (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {allDone
                ? enrollHasFailures
                  ? `Finalizado com falhas (${enrollSuccessCount}/${commandStatuses.length} sucesso, ${enrollFailedCount} falha${enrollFailedCount > 1 ? 's' : ''})`
                  : `Enrollment finalizado (${enrollSuccessCount}/${commandStatuses.length} sucesso)`
                : 'Aguardando execução pelo agente local...'}
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

// Reusable enrollment tracker component
interface EnrollmentTrackerProps {
  commandIds: string[];
  onClose: () => void;
  workerName?: string;
}

const EnrollmentTracker = ({ commandIds, onClose, workerName }: EnrollmentTrackerProps) => {
  const { data: devices = [] } = useDevices();
  const { enroll } = useWorkerEnrollment();
  const queryClient = useQueryClient();

  const { data: commandStatuses = [] } = useQuery({
    queryKey: ['enrollment-commands', commandIds],
    queryFn: async () => {
      if (commandIds.length === 0) return [];
      const { data, error } = await supabase
        .from('agent_commands')
        .select('id, device_id, status, error_message, command, executed_at, payload')
        .in('id', commandIds);
      if (error) throw error;
      return data || [];
    },
    enabled: commandIds.length > 0,
    refetchInterval: commandIds.length > 0 ? 3000 : false,
  });

  const allDone = commandStatuses.length > 0 &&
    commandStatuses.every(c => c.status === 'completed' || c.status === 'failed');

  const successCount = commandStatuses.filter(c => c.status === 'completed').length;
  const failedCount = commandStatuses.filter(c => c.status === 'failed').length;
  const hasFailures = failedCount > 0;

  useEffect(() => {
    if (allDone) {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }
  }, [allDone, queryClient]);

  const getDeviceName = (deviceId: string) =>
    devices.find(d => d.id === deviceId)?.name || deviceId.slice(0, 8);

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
      {workerName && (
        <p className="text-sm text-muted-foreground">
          Re-sincronizando biometria de <strong>{workerName}</strong>
        </p>
      )}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          {allDone ? (
            hasFailures ? (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {allDone
            ? hasFailures
              ? `Finalizado com falhas (${successCount}/${commandStatuses.length} sucesso, ${failedCount} falha${failedCount > 1 ? 's' : ''})`
              : `Enrollment finalizado (${successCount}/${commandStatuses.length} sucesso)`
            : 'Aguardando execução pelo agente local...'}
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
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end pt-4 border-t">
        <Button onClick={onClose}>
          {allDone ? 'Fechar' : 'Fechar (continua em background)'}
        </Button>
      </div>
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
  const [autoEnrollData, setAutoEnrollData] = useState<{ workerName: string; commandIds: string[] } | null>(null);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [selectedProjectForLabels, setSelectedProjectForLabels] = useState<string>('');
  const [customLabelName, setCustomLabelName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const { data: workers = [], isLoading, refetch } = useWorkers();
  const { data: companies = [] } = useCompanies();
  const { data: projects = [] } = useProjects();
  const { data: jobFunctions = [] } = useJobFunctions();
  const queryClient = useQueryClient();

  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const formatNameForLabel = (fullName: string) => {
    if (!fullName) return 'Nome nao informado';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const generateLabels = async (workerList: typeof workers, projectId: string, overrideCustomName?: string) => {
    const selectedProject = projects.find((p: any) => p.id === projectId);
    if (!selectedProject) return;
    if (workerList.length === 0) return;

    toast({ title: `Gerando ${workerList.length} etiqueta(s)...` });

    // Fetch client logo
    let logoDataUrl: string | null = null;
    try {
      const clientId = (selectedProject as any).client_id;
      if (clientId) {
        const client = companies.find(c => c.id === clientId);
        const logoUrl = client?.logo_url_rotated || client?.logo_url_light;
        if (logoUrl) {
          const resolvedUrl = await resolveFileUrl(logoUrl);
          if (resolvedUrl) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
              const logoResponse = await fetch(resolvedUrl, { signal: controller.signal });
              clearTimeout(timeoutId);
              if (logoResponse.ok) {
                const logoBuffer = await logoResponse.arrayBuffer();
                const logoBytes = new Uint8Array(logoBuffer);
                let detectedFormat = 'JPEG';
                if (logoBytes[0] === 0x89 && logoBytes[1] === 0x50) detectedFormat = 'PNG';
                let binary = '';
                for (let j = 0; j < logoBytes.length; j++) {
                  binary += String.fromCharCode(logoBytes[j]);
                }
                logoDataUrl = `data:image/${detectedFormat.toLowerCase()};base64,${btoa(binary)}`;
              }
            } catch {
              clearTimeout(timeoutId);
            }
          }
        }
      }
    } catch (e) {
      console.error('[LABEL] Logo error:', e);
    }

    const combinedProjectName = selectedProject.name;
    let projectFontSize = 14;
    if (combinedProjectName.length > 40) projectFontSize = 9;
    else if (combinedProjectName.length > 30) projectFontSize = 10;
    else if (combinedProjectName.length > 20) projectFontSize = 12;

    const projectType = (selectedProject as any).project_type === 'docagem' ? 'Docagem' :
      (selectedProject as any).project_type === 'mobilizacao' ? 'Mobilizacao' : 'Projeto';

    const pageWidth = 62;
    const pageHeight = 100;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pageWidth, pageHeight] });

    workerList.forEach((worker, idx) => {
      if (idx > 0) doc.addPage([pageWidth, pageHeight]);

      let displayName: string;
      const effectiveCustomName = overrideCustomName !== undefined ? overrideCustomName : customLabelName;
      if (effectiveCustomName && effectiveCustomName.trim() !== '' && workerList.length === 1) {
        displayName = customLabelName.trim();
      } else {
        displayName = formatNameForLabel(worker.name);
      }

      // Border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(3, 3, pageWidth - 6, pageHeight - 6);

      // Logo (proportional, moved left)
      if (logoDataUrl) {
        try {
          const logoImg = new Image();
          logoImg.src = logoDataUrl;
          const logoW = 12;
          const logoH = 24;
          const logoX = pageWidth - 9 - logoW;
          doc.addImage(logoDataUrl, 'PNG', logoX, 5, logoW, logoH);
        } catch {}
      }

      // Name (rotated -90°)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      const cleanName = removeAccents(displayName);
      let nameFontSize = 16;
      doc.setFontSize(nameFontSize);
      while (doc.getTextWidth(cleanName) > 55 && nameFontSize > 8) {
        nameFontSize -= 1;
        doc.setFontSize(nameFontSize);
      }
      doc.text(cleanName, 32, 5, { angle: -90 });

      // Job function
      const jobFn = jobFunctions.find(jf => jf.id === (worker as any).job_function_id);
      const jobFunctionName = jobFn?.name || (worker as any).role || 'Funcao nao informada';
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(removeAccents(String(jobFunctionName)), 26, 5, { angle: -90 });

      // Company
      const companyName = getCompanyName(worker.company_id);
      doc.setFontSize(10);
      doc.text(removeAccents(companyName === '-' ? 'Empresa nao informada' : companyName), 22, 5, { angle: -90 });

      // Project name
      doc.setFontSize(projectFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text(removeAccents(combinedProjectName), 10, 5, { angle: -90 });

      // Project type
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(removeAccents(projectType), 6, 5, { angle: -90 });

      // Circle with code
      const circleX = 40;
      const circleY = 80;
      const radius = 16;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.circle(circleX, circleY, radius, 'FD');

      const code = String((worker as any).code || '1').padStart(4, '0');
      doc.setFontSize(25);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(code, circleX + 7, 71, { align: 'center', angle: -90 });

      // Powered by
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Powered by Googlemarine', 5, 40, { angle: -90 });

      // Blood type
      const bloodType = (worker as any).blood_type;
      const isValidBloodType = bloodType && typeof bloodType === 'string' &&
        bloodType.trim() !== '' && !['nao informado', 'não informado', 'n/a', 'null', 'undefined']
          .includes(bloodType.trim().toLowerCase());
      if (isValidBloodType) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text('Tipo Sanguineo', 16, 75, { angle: -90 });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(bloodType.trim(), 12, 80, { angle: -90 });
      }
    });

    // Abrir PDF em nova aba e disparar impressão (mesma lógica do relatório Visão Geral)
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      // Fallback: download se popup bloqueado
      const link = document.createElement('a');
      link.href = url;
      link.download = `etiquetas.pdf`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    toast({ title: `${workerList.length} etiqueta(s) gerada(s) com sucesso!` });
  };

  const handlePrintLabels = () => {
    const selected = workers.filter(w => selectedWorkerIds.includes(w.id));
    return generateLabels(selected, selectedProjectForLabels);
  };

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

  const getProjectNames = (projectIds: string[] | null) => {
    if (!projectIds || projectIds.length === 0) return [];
    return projectIds
      .map(id => projects.find(p => p.id === id)?.name)
      .filter(Boolean) as string[];
  };

  // Stats
  const activeCount = workers.filter(w => w.status === 'active').length;
  const inactiveCount = workers.filter(w => w.status !== 'active').length;
  const uniqueCompanyCount = new Set(workers.map(w => w.company_id).filter(Boolean)).size;

  // Filter
  const filteredWorkers = workers.filter(w => {
    const matchesCompany = companyFilter === 'all' || w.company_id === companyFilter;
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      w.name.toLowerCase().includes(term) ||
      (w.document_number && w.document_number.toLowerCase().includes(term)) ||
      (w.role && w.role.toLowerCase().includes(term)) ||
      ((w as any).code && String((w as any).code).includes(term)) ||
      getCompanyName(w.company_id).toLowerCase().includes(term);
    return matchesCompany && matchesSearch;
  });

  // Selection
  const allSelected = filteredWorkers.length > 0 && filteredWorkers.every(w => selectedWorkerIds.includes(w.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedWorkerIds([]);
    } else {
      setSelectedWorkerIds(filteredWorkers.map(w => w.id));
    }
  };
  const toggleWorker = (id: string) => {
    setSelectedWorkerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trabalhadores Cadastrados</h2>
          <p className="text-sm text-muted-foreground">Gerencie os trabalhadores do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Lista
          </Button>
          <Button onClick={() => setIsNewDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Trabalhador
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de Trabalhadores</p>
          <p className="text-2xl font-bold text-foreground">{workers.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Inativos / Outros</p>
          <p className="text-2xl font-bold text-muted-foreground">{inactiveCount}</p>
        </div>
        <div className="bg-card border rounded-lg p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Empresas</p>
          <p className="text-2xl font-bold text-foreground">{uniqueCompanyCount}</p>
        </div>
      </div>

      {/* Labels / Etiquetas */}
      <div className="flex items-center gap-4 bg-card border rounded-lg p-4 shadow-sm flex-wrap">
        <span className="text-sm font-medium text-foreground whitespace-nowrap">Projetos para etiquetas:</span>
        <Select value={selectedProjectForLabels} onValueChange={setSelectedProjectForLabels}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Selecione o projeto..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedWorkerIds.length === 1 && (
          <Input
            placeholder="Nome customizado (opcional)"
            value={customLabelName}
            onChange={(e) => setCustomLabelName(e.target.value)}
            className="w-[260px]"
          />
        )}

        <div className="ml-auto">
          <Button
            disabled={selectedWorkerIds.length === 0 || !selectedProjectForLabels}
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handlePrintLabels}
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Etiquetas ({selectedWorkerIds.length})
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nome, código, cargo, empresa ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas as Empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Empresas</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List title */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Lista de Trabalhadores ({filteredWorkers.length})
        </p>
        {selectedWorkerIds.length > 0 && (
          <p className="text-sm text-primary">{selectedWorkerIds.length} selecionado(s)</p>
        )}
      </div>

      {/* Dialogs */}
      <NewWorkerDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onSuccess={() => refetch()}
      />
      <WorkerDetailsDialog
        worker={selectedWorker}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onUpdate={() => refetch()}
        onPrintLabel={(w) => {
          const labelProjectId = selectedProjectForLabels || (w.allowed_project_ids?.[0]) || '';
          if (!labelProjectId) {
            toast({ title: 'Selecione um projeto para gerar a etiqueta', variant: 'destructive' });
            return;
          }
          generateLabels([w as any], labelProjectId, '');
        }}
      />
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Trabalhador</DialogTitle>
          </DialogHeader>
          <WorkerForm 
            worker={editingWorker} 
            onSuccess={(autoEnrollResult) => {
              setIsEditDialogOpen(false);
              setEditingWorker(null);
              if (autoEnrollResult) {
                setAutoEnrollData({
                  workerName: autoEnrollResult.workerName,
                  commandIds: autoEnrollResult.commandIds,
                });
              }
            }}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setEditingWorker(null);
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={!!autoEnrollData} onOpenChange={(open) => !open && setAutoEnrollData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-sincronização Biométrica</DialogTitle>
          </DialogHeader>
          {autoEnrollData && (
            <EnrollmentTracker
              commandIds={autoEnrollData.commandIds}
              workerName={autoEnrollData.workerName}
              onClose={() => setAutoEnrollData(null)}
            />
          )}
        </DialogContent>
      </Dialog>
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

      {/* Table */}
      <ScrollArea className="h-[500px] border rounded-lg">
        <table className="w-full">
          <thead className="sticky top-0 bg-card border-b">
            <tr>
              <th className="p-4 w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left p-4 text-xs font-medium text-muted-foreground">Código</th>
              <th className="text-left p-4 text-xs font-medium text-muted-foreground">Trabalhador</th>
              <th className="text-left p-4 text-xs font-medium text-muted-foreground">CPF</th>
              <th className="text-left p-4 text-xs font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-4 text-xs font-medium text-muted-foreground">Projetos Autorizados</th>
              <th className="text-left p-4 text-xs font-medium text-muted-foreground">Função</th>
              <th className="text-center p-4 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 text-xs font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkers.map(worker => {
              const projectNames = getProjectNames(worker.allowed_project_ids);
              return (
                <tr key={worker.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedWorker(worker); setIsDetailsOpen(true); }}>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedWorkerIds.includes(worker.id)}
                      onCheckedChange={() => toggleWorker(worker.id)}
                    />
                  </td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                    {formatWorkerCode((worker as any).code)}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <ResolvedAvatar
                        className="h-8 w-8"
                        photoUrl={worker.photo_url}
                        name={worker.name}
                        iconClassName="h-4 w-4"
                      />
                      <span className="font-medium text-sm">{normalizeName(worker.name)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{formatCpf(worker.document_number)}</td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{normalizeName(getCompanyName(worker.company_id))}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {projectNames.length > 0 ? projectNames.map((name, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                      )) : <span className="text-xs text-muted-foreground">-</span>}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">{normalizeName(worker.role)}</td>
                  <td className="p-4 text-center">{getStatusBadge(worker.status)}</td>
                  <td className="p-4">
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedWorker(worker); setIsDetailsOpen(true); }}>
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredWorkers.length === 0 && !isLoading && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum trabalhador encontrado</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
};