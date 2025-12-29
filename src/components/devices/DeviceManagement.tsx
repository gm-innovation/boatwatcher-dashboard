import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useDevices, useControlIDActions } from '@/hooks/useControlID';
import { useProjects } from '@/hooks/useSupabase';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Wifi, 
  WifiOff, 
  Settings, 
  Trash2, 
  RefreshCw,
  DoorOpen,
  Camera,
  Server
} from 'lucide-react';
import type { Device, DeviceType } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';

const deviceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  controlid_serial_number: z.string().min(1, 'Número de série é obrigatório'),
  controlid_ip_address: z.string().min(1, 'Endereço IP é obrigatório'),
  type: z.enum(['facial_reader', 'turnstile', 'terminal']),
  location: z.string().optional(),
  project_id: z.string().optional(),
  api_username: z.string().optional(),
  api_password: z.string().optional(),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

const DeviceCard = ({ device, onRefresh }: { device: Device; onRefresh: () => void }) => {
  const { getDeviceStatus, releaseAccess, isLoading } = useControlIDActions();
  const queryClient = useQueryClient();

  const handleCheckStatus = async () => {
    try {
      await getDeviceStatus(device.id);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({ title: 'Status verificado' });
    } catch (error) {
      toast({ title: 'Erro ao verificar status', variant: 'destructive' });
    }
  };

  const handleRelease = async () => {
    try {
      await releaseAccess(device.id);
      toast({ title: 'Acesso liberado' });
    } catch (error) {
      toast({ title: 'Erro ao liberar acesso', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja remover este dispositivo?')) return;
    
    const { error } = await supabase.from('devices').delete().eq('id', device.id);
    if (error) {
      toast({ title: 'Erro ao remover dispositivo', variant: 'destructive' });
    } else {
      toast({ title: 'Dispositivo removido' });
      onRefresh();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'offline': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'error': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getTypeIcon = (type: DeviceType) => {
    switch (type) {
      case 'facial_reader': return Camera;
      case 'turnstile': return DoorOpen;
      default: return Server;
    }
  };

  const TypeIcon = getTypeIcon(device.type);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TypeIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{device.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{device.controlid_ip_address}</p>
            </div>
          </div>
          <Badge variant="outline" className={getStatusColor(device.status)}>
            {device.status === 'online' ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
            {device.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Serial:</span> {device.controlid_serial_number}
          </div>
          {device.location && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Local:</span> {device.location}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={handleCheckStatus} disabled={isLoading}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Status
            </Button>
            <Button size="sm" variant="outline" onClick={handleRelease} disabled={isLoading}>
              <DoorOpen className="h-4 w-4 mr-1" />
              Liberar
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const DeviceManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { selectedProjectId } = useProject();
  const { data: devices = [], isLoading, refetch } = useDevices(selectedProjectId);
  const { data: projects = [] } = useProjects();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      type: 'facial_reader',
    }
  });

  const onSubmit = async (data: DeviceFormData) => {
    const deviceData = {
      name: data.name,
      controlid_serial_number: data.controlid_serial_number,
      controlid_ip_address: data.controlid_ip_address,
      type: data.type,
      location: data.location || null,
      project_id: data.project_id || null,
      api_credentials: {
        username: data.api_username || '',
        password: data.api_password || '',
        port: 80
      },
      status: 'offline' as const
    };

    const { error } = await supabase.from('devices').insert(deviceData);

    if (error) {
      toast({ title: 'Erro ao cadastrar dispositivo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dispositivo cadastrado com sucesso' });
      reset();
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    }
  };

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status !== 'online').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dispositivos ControlID</h2>
          <p className="text-sm text-muted-foreground">
            {devices.length} dispositivos • {onlineCount} online • {offlineCount} offline
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Dispositivo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Dispositivo ControlID</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Dispositivo</Label>
                <Input id="name" placeholder="Ex: Catraca Entrada Principal" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select onValueChange={(value) => setValue('type', value as DeviceType)} defaultValue="facial_reader">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facial_reader">Leitor Facial</SelectItem>
                    <SelectItem value="turnstile">Catraca</SelectItem>
                    <SelectItem value="terminal">Terminal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="controlid_serial_number">Número de Série</Label>
                  <Input id="controlid_serial_number" placeholder="Serial" {...register('controlid_serial_number')} />
                  {errors.controlid_serial_number && <p className="text-sm text-destructive">{errors.controlid_serial_number.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="controlid_ip_address">Endereço IP</Label>
                  <Input id="controlid_ip_address" placeholder="192.168.1.100" {...register('controlid_ip_address')} />
                  {errors.controlid_ip_address && <p className="text-sm text-destructive">{errors.controlid_ip_address.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Localização</Label>
                <Input id="location" placeholder="Ex: Portaria Principal" {...register('location')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project_id">Projeto</Label>
                <Select onValueChange={(value) => setValue('project_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Credenciais de API (opcional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="api_username">Usuário</Label>
                    <Input id="api_username" {...register('api_username')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api_password">Senha</Label>
                    <Input id="api_password" type="password" {...register('api_password')} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map(device => (
            <DeviceCard key={device.id} device={device} onRefresh={() => refetch()} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dispositivo cadastrado</p>
          <p className="text-sm">Adicione seu primeiro dispositivo ControlID</p>
        </div>
      )}
    </div>
  );
};
