import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useDevices } from '@/hooks/useControlID';
import { useProjects, useClients } from '@/hooks/useSupabase';
import { useLocalAgents } from '@/hooks/useLocalAgents';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeviceSetupInstructions } from './DeviceSetupInstructions';
import { AgentManagement } from './AgentManagement';
import { AdminProjectFilter } from '../admin/AdminProjectFilter';
import {
  Plus, Wifi, WifiOff, Trash2, RefreshCw, DoorOpen, Camera, Server, Loader2, Users, Pencil, Ship, Anchor, MoreHorizontal, Bot
} from 'lucide-react';
import type { Device, DeviceType } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usesLocalAuth, usesLocalServer } from '@/lib/runtimeProfile';
import { localControlId, localDevices } from '@/lib/localServerProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const deviceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  controlid_serial_number: z.string().min(1, 'Número de série é obrigatório'),
  controlid_ip_address: z.string().min(1, 'Endereço IP é obrigatório'),
  type: z.enum(['facial_reader', 'turnstile', 'terminal']),
  location: z.string().optional(),
  project_id: z.string().optional(),
  agent_id: z.string().optional(),
  api_username: z.string().optional(),
  api_password: z.string().optional(),
  passage_direction: z.enum(['entry', 'exit']).optional(),
  access_location: z.enum(['bordo', 'dique']).optional(),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

// Helper to get access_location from device configuration
const getAccessLocation = (device: Device): 'bordo' | 'dique' => {
  return (device.configuration as any)?.access_location || 'bordo';
};

export const DeviceManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showSetupDevice, setShowSetupDevice] = useState<Device | null>(null);
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);
  const [resyncingDevice, setResyncingDevice] = useState<string | null>(null);
  const [listedUsers, setListedUsers] = useState<any[]>([]);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: devices = [], isLoading, refetch } = useDevices(selectedProjectId, { forceCloud: true });
  const { data: projects = [] } = useProjects();
  const { agents } = useLocalAgents(selectedProjectId);
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  // Filter devices by client when no specific project is selected
  const filteredDevices = selectedClientId && !selectedProjectId
    ? devices.filter((d) => {
        const project = projects.find((p) => p.id === d.project_id);
        return project?.client_id === selectedClientId;
      })
    : devices;

  const createForm = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { type: 'facial_reader', access_location: 'bordo' }
  });

  const editForm = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
  });

  const onSubmit = async (data: DeviceFormData) => {
    const deviceData = {
      name: data.name,
      controlid_serial_number: data.controlid_serial_number,
      controlid_ip_address: data.controlid_ip_address,
      type: data.type,
      location: data.location || null,
      project_id: data.project_id || null,
      agent_id: data.agent_id || null,
      api_credentials: {
        username: data.api_username || '',
        password: data.api_password || '',
        port: 80
      },
      configuration: {
        passage_direction: data.passage_direction || null,
        access_location: data.access_location || 'bordo',
      },
      status: 'offline' as const
    };

    const result = isLocalRuntime
      ? await localDevices.create(deviceData)
      : await supabase.from('devices').insert(deviceData).then(({ error }) => ({ error }));

    if (result?.error) {
      toast({ title: 'Erro ao cadastrar dispositivo', description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dispositivo cadastrado com sucesso' });
      createForm.reset();
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      refetch();

      if (data.project_id && data.agent_id && !isLocalRuntime) {
        try {
          const { data: workers, error: workersError } = await supabase
            .from('workers')
            .select('id')
            .contains('allowed_project_ids', [data.project_id])
            .eq('status', 'active');

          if (!workersError && workers && workers.length > 0) {
            const workerIds = workers.map(w => w.id);
            toast({ title: 'Sincronização em massa', description: `Enfileirando ${workerIds.length} trabalhador(es)...` });
            const { data: enrollResult } = await supabase.functions.invoke('worker-enrollment', {
              body: { action: 'enroll', workerIds },
            });
            toast({ title: 'Enrollment enfileirado', description: enrollResult?.message || `${workerIds.length} trabalhador(es) enfileirado(s).` });
          }
        } catch (bulkErr) {
          console.error('Bulk enrollment error:', bulkErr);
        }
      }
    }
  };

  const onEditSubmit = async (data: DeviceFormData) => {
    if (!editingDevice) return;

    const updatedData = {
      name: data.name,
      controlid_serial_number: data.controlid_serial_number,
      controlid_ip_address: data.controlid_ip_address,
      type: data.type,
      location: data.location || null,
      project_id: data.project_id || null,
      agent_id: data.agent_id || null,
      api_credentials: {
        username: data.api_username || '',
        password: data.api_password || '',
        port: 80
      },
      configuration: {
        ...(editingDevice.configuration as any),
        passage_direction: data.passage_direction || null,
        access_location: data.access_location || 'bordo',
      },
    };

    try {
      if (isLocalRuntime) {
        await localDevices.update(editingDevice.id, updatedData);
      } else {
        const { error } = await supabase.from('devices').update(updatedData).eq('id', editingDevice.id);
        if (error) throw error;
      }
      toast({ title: 'Dispositivo atualizado com sucesso' });
      setIsEditDialogOpen(false);
      setEditingDevice(null);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      refetch();
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar dispositivo', description: err.message, variant: 'destructive' });
    }
  };

  const openEditDialog = (device: Device) => {
    const config = device.configuration as any;
    const creds = device.api_credentials as any;
    editForm.reset({
      name: device.name,
      controlid_serial_number: device.controlid_serial_number,
      controlid_ip_address: device.controlid_ip_address,
      type: device.type,
      location: device.location || '',
      project_id: device.project_id || undefined,
      agent_id: device.agent_id || undefined,
      api_username: creds?.username || '',
      api_password: creds?.password || '',
      passage_direction: config?.passage_direction || undefined,
      access_location: config?.access_location || 'bordo',
    });
    setEditingDevice(device);
    setIsEditDialogOpen(true);
  };

  const toggleAccessLocation = async (device: Device) => {
    const current = getAccessLocation(device);
    const newLocation = current === 'bordo' ? 'dique' : 'bordo';
    const newConfig = { ...(device.configuration as any), access_location: newLocation };

    try {
      if (isLocalRuntime) {
        await localDevices.update(device.id, { configuration: newConfig });
      } else {
        const { error } = await supabase.from('devices').update({ configuration: newConfig }).eq('id', device.id);
        if (error) throw error;
      }
      toast({ title: 'Localização atualizada', description: newLocation === 'bordo' ? '🚢 Embarcação' : '⚓ Dique' });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      refetch();
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar localização', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (device: Device) => {
    if (!confirm('Tem certeza que deseja remover este dispositivo?')) return;
    try {
      if (isLocalRuntime) {
        await localDevices.delete(device.id);
      } else {
        const { error } = await supabase.from('devices').delete().eq('id', device.id);
        if (error) throw error;
      }
      toast({ title: 'Dispositivo removido' });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      refetch();
    } catch (error: any) {
      toast({ title: 'Erro ao remover dispositivo', description: error.message, variant: 'destructive' });
    }
  };

  const sendAgentCommand = async (device: Device, command: 'get_status' | 'release_access' | 'list_users', payload: Record<string, unknown> = {}) => {
    setSendingCommand(`${device.id}-${command}`);
    try {
      if (isLocalRuntime) {
        if (command === 'get_status') {
          const result = await localControlId.getDeviceStatus(device.id);
          toast({ title: result.success ? 'Status atualizado' : 'Falha', description: result.message || result.error, variant: result.success ? 'default' : 'destructive' });
        }
        if (command === 'release_access') {
          const result = await localControlId.releaseAccess(device.id, Number(payload.door_id || 1));
          toast({ title: result.success ? 'Comando enviado' : 'Falha', description: result.message || result.error, variant: result.success ? 'default' : 'destructive' });
        }
        if (command === 'list_users') {
          const result: any = await localControlId.listUsers(device.id);
          const users = Array.isArray(result?.data?.users) ? result.data.users : Array.isArray(result?.data) ? result.data : [];
          setListedUsers(users);
          setIsUsersDialogOpen(true);
          toast({ title: 'Usuários carregados', description: `${users.length} usuário(s).` });
        }
        queryClient.invalidateQueries({ queryKey: ['devices'] });
        refetch();
        return;
      }

      if (!device.agent_id) {
        toast({ title: 'Dispositivo sem agente', description: 'Associe um agente local.', variant: 'destructive' });
        return;
      }

      const mappedCommand = command === 'list_users' ? 'get_status' : command;
      const { error } = await supabase.from('agent_commands').insert({
        agent_id: device.agent_id,
        device_id: device.id,
        command: mappedCommand,
        payload,
        status: 'pending',
      } as any);
      if (error) throw error;
      toast({ title: 'Comando enviado', description: `Aguardando agente executar: ${mappedCommand}` });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar comando', description: error.message, variant: 'destructive' });
    } finally {
      setSendingCommand(null);
    }
  };

  const handleFullResync = async (device: Device) => {
    if (!confirm(`Re-sincronização total do dispositivo "${device.name}"?\n\nIsso vai:\n1. Baixar todos os trabalhadores da nuvem\n2. Limpar o dispositivo\n3. Recadastrar todos os trabalhadores\n\nEssa operação pode levar vários minutos.`)) return;
    setResyncingDevice(device.id);
    try {
      const result: any = await localDevices.fullResync(device.id);
      if (result.error) {
        toast({ title: 'Erro no resync', description: result.error, variant: 'destructive' });
      } else {
        toast({
          title: 'Re-sincronização concluída',
          description: `${result.enrolled || 0} cadastrados, ${result.failed || 0} falhas (${result.totalDownloaded || 0} baixados da nuvem, ${result.duplicatesRemoved || 0} duplicados removidos)`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      refetch();
    } catch (err: any) {
      toast({ title: 'Erro no resync', description: err.message, variant: 'destructive' });
    } finally {
      setResyncingDevice(null);
    }
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return '—';
    return projects.find(p => p.id === projectId)?.name || '—';
  };

  const getTypeLabel = (type: DeviceType) => {
    switch (type) {
      case 'facial_reader': return 'Leitor Facial';
      case 'turnstile': return 'Catraca';
      default: return 'Terminal';
    }
  };

  const onlineCount = filteredDevices.filter(d => d.status === 'online').length;
  const offlineCount = filteredDevices.filter(d => d.status !== 'online').length;

  const renderDeviceForm = (form: ReturnType<typeof useForm<DeviceFormData>>, onFormSubmit: (data: DeviceFormData) => void, submitLabel: string) => (
    <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do Dispositivo</Label>
        <Input placeholder="Ex: Catraca Entrada Principal" {...form.register('name')} />
        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select onValueChange={(v) => form.setValue('type', v as DeviceType)} value={form.watch('type')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facial_reader">Leitor Facial</SelectItem>
            <SelectItem value="turnstile">Catraca</SelectItem>
            <SelectItem value="terminal">Terminal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Número de Série</Label>
          <Input placeholder="Serial" {...form.register('controlid_serial_number')} />
          {form.formState.errors.controlid_serial_number && <p className="text-sm text-destructive">{form.formState.errors.controlid_serial_number.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Endereço IP</Label>
          <Input placeholder="192.168.1.100" {...form.register('controlid_ip_address')} />
          {form.formState.errors.controlid_ip_address && <p className="text-sm text-destructive">{form.formState.errors.controlid_ip_address.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Localização (descrição)</Label>
          <Input placeholder="Ex: Portaria Principal" {...form.register('location')} />
        </div>
        <div className="space-y-2">
          <Label>Acesso (Bordo/Dique)</Label>
          <Select onValueChange={(v) => form.setValue('access_location', v as 'bordo' | 'dique')} value={form.watch('access_location') || 'bordo'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bordo">🚢 Embarcação (Bordo)</SelectItem>
              <SelectItem value="dique">⚓ Dique</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Direção de Passagem</Label>
        <Select onValueChange={(v) => form.setValue('passage_direction', v as 'entry' | 'exit')} value={form.watch('passage_direction') || undefined}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="entry">↙ Entrada</SelectItem>
            <SelectItem value="exit">↗ Saída</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Projeto</Label>
          <Select onValueChange={(v) => form.setValue('project_id', v)} value={form.watch('project_id') || undefined}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Agente Local</Label>
          <Select onValueChange={(v) => form.setValue('agent_id', v)} value={form.watch('agent_id') || undefined}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-3">Credenciais de API (opcional)</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Input {...form.register('api_username')} />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input type="password" {...form.register('api_password')} />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setIsEditDialogOpen(false); }}>Cancelar</Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <Tabs defaultValue="devices" className="space-y-6">
      <TabsList>
        <TabsTrigger value="devices" className="gap-2">
          <Server className="h-4 w-4" />
          Dispositivos
        </TabsTrigger>
        <TabsTrigger value="agents" className="gap-2">
          <Bot className="h-4 w-4" />
          Agentes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agents">
        <AgentManagement />
      </TabsContent>

      <TabsContent value="devices">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Dispositivos</h2>
            <p className="text-sm text-muted-foreground">
              {filteredDevices.length} dispositivos • {onlineCount} online • {offlineCount} offline
            </p>
          </div>
          <AdminProjectFilter
            selectedClientId={selectedClientId}
            selectedProjectId={selectedProjectId}
            onClientChange={setSelectedClientId}
            onProjectChange={setSelectedProjectId}
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Adicionar Dispositivo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Dispositivo</DialogTitle>
            </DialogHeader>
            {renderDeviceForm(createForm, onSubmit, 'Cadastrar')}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredDevices.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Dispositivo</TableHead>
                <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Projeto</TableHead>
                <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Localização</TableHead>
                <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Último Evento</TableHead>
                <TableHead className="py-2 px-3 text-xs whitespace-nowrap">Status</TableHead>
                <TableHead className="py-2 px-3 text-xs whitespace-nowrap text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.map(device => {
                const accessLoc = getAccessLocation(device);
                const config = device.configuration as any;
                const dirLabel = config?.passage_direction === 'entry' ? '↙ Entrada' : config?.passage_direction === 'exit' ? '↗ Saída' : '';

                return (
                  <TableRow key={device.id}>
                    <TableCell className="py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {device.type === 'facial_reader' ? <Camera className="h-4 w-4 text-muted-foreground" /> :
                         device.type === 'turnstile' ? <DoorOpen className="h-4 w-4 text-muted-foreground" /> :
                         <Server className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <p className="text-sm font-medium">{device.name}</p>
                          <p className="text-xs text-muted-foreground">{device.controlid_ip_address} • {getTypeLabel(device.type)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm whitespace-nowrap">
                      {getProjectName(device.project_id)}
                    </TableCell>
                    <TableCell className="py-2 px-3 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={accessLoc === 'bordo'
                          ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                          : 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800'}
                      >
                        {accessLoc === 'bordo' ? <Ship className="h-3 w-3 mr-1" /> : <Anchor className="h-3 w-3 mr-1" />}
                        {accessLoc === 'bordo' ? 'Embarcação' : 'Dique'}
                      </Badge>
                      {dirLabel && <span className="ml-2 text-xs text-muted-foreground">{dirLabel}</span>}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-sm text-muted-foreground whitespace-nowrap">
                      {device.last_event_timestamp
                        ? formatDistanceToNow(new Date(device.last_event_timestamp), { addSuffix: true, locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell className="py-2 px-3 whitespace-nowrap">
                      <Badge variant="outline" className={
                        device.status === 'online'
                          ? 'bg-secondary text-secondary-foreground border-border'
                          : device.status === 'error'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-muted text-muted-foreground border-border'
                      }>
                        {device.status === 'online' ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(device)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleAccessLocation(device)}
                          title={accessLoc === 'bordo' ? 'Mover p/ Dique' : 'Mover p/ Embarcação'}
                        >
                          {accessLoc === 'bordo' ? <Anchor className="h-4 w-4" /> : <Ship className="h-4 w-4" />}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => sendAgentCommand(device, 'get_status')} disabled={!!sendingCommand}>
                              <RefreshCw className="h-4 w-4 mr-2" />Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sendAgentCommand(device, 'release_access', { door_id: 1 })} disabled={!!sendingCommand}>
                              <DoorOpen className="h-4 w-4 mr-2" />Liberar Acesso
                            </DropdownMenuItem>
                            {isLocalRuntime && (
                              <DropdownMenuItem onClick={() => sendAgentCommand(device, 'list_users')} disabled={!!sendingCommand}>
                                <Users className="h-4 w-4 mr-2" />Usuários
                              </DropdownMenuItem>
                            )}
                            {isLocalRuntime && (
                              <DropdownMenuItem onClick={() => handleFullResync(device)} disabled={!!resyncingDevice}>
                                {resyncingDevice === device.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Re-sincronização Total
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setShowSetupDevice(device)}>
                              <Server className="h-4 w-4 mr-2" />Configurar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(device)}>
                              <Trash2 className="h-4 w-4 mr-2" />Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dispositivo cadastrado</p>
          <p className="text-sm">Adicione seu primeiro dispositivo</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Dispositivo</DialogTitle>
          </DialogHeader>
          {renderDeviceForm(editForm, onEditSubmit, 'Salvar')}
        </DialogContent>
      </Dialog>

      {/* Setup Instructions */}
      {showSetupDevice && (
        <DeviceSetupInstructions device={showSetupDevice} open={!!showSetupDevice} onOpenChange={(open) => { if (!open) setShowSetupDevice(null); }} />
      )}

      {/* Users Dialog */}
      <Dialog open={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuários no dispositivo</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-80 pr-4">
            <div className="space-y-2">
              {listedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário retornado pelo dispositivo.</p>
              ) : (
                listedUsers.map((user: any, index) => (
                  <div key={user.id || user.user_id || index} className="rounded-md border border-border p-3 text-sm">
                    <p className="font-medium">{user.name || user.user_name || `Usuário ${index + 1}`}</p>
                    <p className="text-muted-foreground">ID: {user.id || user.user_id || 'N/A'}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
      </TabsContent>
    </Tabs>
  );
};
