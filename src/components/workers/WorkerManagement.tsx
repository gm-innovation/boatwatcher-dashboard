import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useWorkers, useCompanies, useProjects } from '@/hooks/useSupabase';
import { useDevices, useWorkerEnrollment } from '@/hooks/useControlID';
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
import { 
  Plus, 
  Upload, 
  User, 
  Edit, 
  Trash2,
  Camera,
  CheckCircle,
  XCircle,
  Fingerprint
} from 'lucide-react';
import type { Worker, WorkerStatus } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';

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
  onSuccess: () => void;
  onCancel: () => void;
}

const WorkerForm = ({ worker, onSuccess, onCancel }: WorkerFormProps) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(worker?.photo_url || null);
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

    const { error: uploadError } = await supabase.storage
      .from('worker-photos')
      .upload(filePath, photoFile, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage.from('worker-photos').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const onSubmit = async (data: WorkerFormData) => {
    setIsUploading(true);
    try {
      if (worker) {
        // Update
        const photoUrl = await uploadPhoto(worker.id);
        const { error } = await supabase
          .from('workers')
          .update({
            name: data.name,
            document_number: data.document_number,
            role: data.role || null,
            company_id: data.company_id || null,
            status: data.status,
            allowed_project_ids: data.allowed_project_ids,
            photo_url: photoUrl,
          })
          .eq('id', worker.id);

        if (error) throw error;
        toast({ title: 'Trabalhador atualizado com sucesso' });
      } else {
        // Insert
        const { data: newWorker, error } = await supabase
          .from('workers')
          .insert({
            name: data.name,
            document_number: data.document_number,
            role: data.role || null,
            company_id: data.company_id || null,
            status: data.status,
            allowed_project_ids: data.allowed_project_ids,
          })
          .select()
          .single();

        if (error) throw error;

        if (photoFile && newWorker) {
          const photoUrl = await uploadPhoto(newWorker.id);
          if (photoUrl) {
            await supabase.from('workers').update({ photo_url: photoUrl }).eq('id', newWorker.id);
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

// Componente de Enrollment
interface EnrollmentDialogProps {
  worker: Worker;
  onClose: () => void;
}

const EnrollmentDialog = ({ worker, onClose }: EnrollmentDialogProps) => {
  const { data: devices = [] } = useDevices();
  const { enroll, remove, isLoading } = useWorkerEnrollment();
  const [selectedDevices, setSelectedDevices] = useState<string[]>(worker.devices_enrolled || []);

  const handleEnroll = async () => {
    const toEnroll = selectedDevices.filter(id => !worker.devices_enrolled?.includes(id));
    const toRemove = (worker.devices_enrolled || []).filter(id => !selectedDevices.includes(id));

    try {
      if (toEnroll.length > 0) {
        await enroll(worker.id, toEnroll);
      }
      if (toRemove.length > 0) {
        await remove(worker.id, toRemove);
      }
      onClose();
    } catch (error) {
      console.error('Enrollment error:', error);
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId) 
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b">
        <Avatar className="h-12 w-12">
          {worker.photo_url ? (
            <AvatarImage src={worker.photo_url} alt={worker.name} />
          ) : (
            <AvatarFallback><User className="h-6 w-6" /></AvatarFallback>
          )}
        </Avatar>
        <div>
          <p className="font-medium">{worker.name}</p>
          <p className="text-sm text-muted-foreground">{worker.document_number}</p>
        </div>
      </div>

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
    </div>
  );
};

export const WorkerManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [enrollingWorker, setEnrollingWorker] = useState<Worker | null>(null);
  const { data: workers = [], isLoading, refetch } = useWorkers();
  const { data: companies = [] } = useCompanies();
  const queryClient = useQueryClient();

  const handleDelete = async (worker: Worker) => {
    if (!confirm(`Tem certeza que deseja remover ${worker.name}?`)) return;
    
    const { error } = await supabase.from('workers').delete().eq('id', worker.id);
    if (error) {
      toast({ title: 'Erro ao remover trabalhador', variant: 'destructive' });
    } else {
      toast({ title: 'Trabalhador removido' });
      queryClient.invalidateQueries({ queryKey: ['workers'] });
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWorker(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Trabalhador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingWorker ? 'Editar Trabalhador' : 'Novo Trabalhador'}</DialogTitle>
            </DialogHeader>
            <WorkerForm 
              worker={editingWorker} 
              onSuccess={() => {
                setIsDialogOpen(false);
                setEditingWorker(null);
              }}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingWorker(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

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
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Trabalhador</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">CPF</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Empresa</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Função</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Dispositivos</th>
              <th className="text-center p-4 text-sm font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {workers.map(worker => (
              <tr key={worker.id} className="border-b hover:bg-muted/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      {worker.photo_url ? (
                        <AvatarImage src={worker.photo_url} alt={worker.name} />
                      ) : (
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                      )}
                    </Avatar>
                    <span className="font-medium">{worker.name}</span>
                  </div>
                </td>
                <td className="p-4 text-sm text-muted-foreground">{worker.document_number || '-'}</td>
                <td className="p-4 text-sm text-muted-foreground">{getCompanyName(worker.company_id)}</td>
                <td className="p-4 text-sm text-muted-foreground">{worker.role || '-'}</td>
                <td className="p-4 text-center">{getStatusBadge(worker.status)}</td>
                <td className="p-4 text-center">
                  <Badge variant="outline">
                    {worker.devices_enrolled?.length || 0} dispositivo(s)
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setEnrollingWorker(worker)}
                    >
                      <Fingerprint className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => {
                        setEditingWorker(worker);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-destructive"
                      onClick={() => handleDelete(worker)}
                    >
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
