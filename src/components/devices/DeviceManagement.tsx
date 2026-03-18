import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useDevices } from '@/hooks/useControlID';
import { useProjects } from '@/hooks/useSupabase';
import { useProject } from '@/contexts/ProjectContext';
import { useLocalAgents } from '@/hooks/useLocalAgents';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DeviceSetupInstructions } from './DeviceSetupInstructions';
import {
  Plus, Wifi, WifiOff, Trash2, RefreshCw, DoorOpen, Camera, Server, Link, Loader2, CheckCircle2, XCircle, Clock, Users, Copy
} from 'lucide-react';
import type { Device, DeviceType } from '@/types/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usesLocalAuth, usesLocalServer } from '@/lib/runtimeProfile';
import { localControlId, localDevices } from '@/lib/localServerProvider';

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
});

type DeviceFormData = z.infer<typeof deviceSchema>;

const DeviceCard = ({ device, onRefresh }: { device: Device; onRefresh: () => void }) => {
  const [showSetup, setShowSetup] = useState(false);
  const [sendingCommand, setSendingCommand] = useState<string | null>(null);
  const [listedUsers, setListedUsers] = useState<any[]>([]);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  const { data: recentCommands = [] } = useQuery({
    queryKey: ['device-commands', device.id],
    queryFn: async () => {
      if (isLocalRuntime) return [];

      const { data, error } = await supabase
        .from('agent_commands')
        .select('id, command, status, created_at, executed_at, error_message')
        .eq('device_id', device.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
    refetchInterval: isLocalRuntime ? false : 5000,
  });

  const sendAgentCommand = async (command: 'get_status' | 'release_access' | 'list_users', payload: Record<string, unknown> = {}) => {
    setSendingCommand(command);
    try {
      if (isLocalRuntime) {
        if (command === 'get_status') {
          const result = await localControlId.getDeviceStatus(device.id);
          toast({
            title: result.success ? 'Status atualizado' : 'Falha ao consultar status',
            description: result.message || result.error || 'Não foi possível consultar o dispositivo.',
            variant: result.success ? 'default' : 'destructive',
          });
        }

        if (command === 'release_access') {
          const result = await localControlId.releaseAccess(device.id, Number(payload.door_id || 1));
          toast({
            title: result.success ? 'Comando enviado' : 'Falha ao liberar acesso',
            description: result.message || result.error || 'Não foi possível acionar a porta.',
            variant: result.success ? 'default' : 'destructive',
          });
        }

        if (command === 'list_users') {
          const result: any = await localControlId.listUsers(device.id);
          const users = Array.isArray(result?.data?.users)
            ? result.data.users
            : Array.isArray(result?.data)
              ? result.data
              : [];
          setListedUsers(users);
          setIsUsersDialogOpen(true);
          toast({
            title: 'Usuários carregados',
            description: `${users.length} usuário(s) retornado(s) pelo dispositivo.`,
          });
        }

        queryClient.invalidateQueries({ queryKey: ['devices'] });
        onRefresh();
        return;
      }

      if (!device.agent_id) {
        toast({ title: 'Dispositivo sem agente', description: 'Associe um agente local a este dispositivo.', variant: 'destructive' });
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
      queryClient.invalidateQueries({ queryKey: ['device-commands', device.id] });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar comando', description: error.message, variant: 'destructive' });
    } finally {
      setSendingCommand(null);
    }
  };

  const handleDelete = async () => {
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
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Erro ao remover dispositivo', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-secondary text-secondary-foreground border-border';
      case 'offline': return 'bg-muted text-muted-foreground border-border';
      case 'error': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTypeIcon = (type: DeviceType) => {
    switch (type) {
      case 'facial_reader': return Camera;
      case 'turnstile': return DoorOpen;
      default: return Server;
    }
  };

  const getCmdStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="h-3 w-3 text-primary" />;
    if (status === 'failed') return <XCircle className="h-3 w-3 text-destructive" />;
    if (status === 'in_progress') return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  const TypeIcon = getTypeIcon(device.type);

  return (
    <>
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
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-medium">ID:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono select-all">{device.id}</code>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(device.id); toast({ title: 'ID copiado!' }); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {device.location && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Local:</span> {device.location}
              </div>
            )}
            {!device.agent_id && !isLocalRuntime && (
              <div className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">
                ⚠ Sem agente local associado
              </div>
            )}

            {recentCommands.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground">Últimos comandos:</p>
                {recentCommands.map(cmd => (
                  <div key={cmd.id} className="flex items-center gap-2 text-xs">
                    {getCmdStatusIcon(cmd.status)}
                    <span className="font-mono">{cmd.command}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setShowSetup(true)}>
                <Link className="h-4 w-4 mr-1" />
                Configurar
              </Button>
              <Button size="sm" variant="outline" onClick={() => sendAgentCommand('get_status')} disabled={!!sendingCommand}>
                {sendingCommand === 'get_status' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Status
              </Button>
              <Button size="sm" variant="outline" onClick={() => sendAgentCommand('release_access', { door_id: 1 })} disabled={!!sendingCommand}>
                {sendingCommand === 'release_access' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <DoorOpen className="h-4 w-4 mr-1" />}
                Liberar
              </Button>
              {isLocalRuntime && (
                <Button size="sm" variant="outline" onClick={() => sendAgentCommand('list_users')} disabled={!!sendingCommand}>
                  {sendingCommand === 'list_users' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Users className="h-4 w-4 mr-1" />}
                  Usuários
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeviceSetupInstructions device={device} open={showSetup} onOpenChange={setShowSetup} />

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
    </>
  );
};

export const DeviceManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { selectedProjectId } = useProject();
  const { data: devices = [], isLoading, refetch } = useDevices(selectedProjectId);
  const { data: projects = [] } = useProjects();
  const { agents } = useLocalAgents(selectedProjectId);
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: { type: 'facial_reader' }
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
      status: 'offline' as const
    };

    const result = isLocalRuntime
      ? await localDevices.create(deviceData)
      : await supabase.from('devices').insert(deviceData).then(({ error }) => ({ error }));

    if (result?.error) {
      toast({ title: 'Erro ao cadastrar dispositivo', description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dispositivo cadastrado com sucesso' });
      reset();
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      refetch();
    }
  };

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status !== 'online').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dispositivos</h2>
          <p className="text-sm text-muted-foreground">
            {devices.length} dispositivos • {onlineCount} online • {offlineCount} offline
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Adicionar Dispositivo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Dispositivo</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Dispositivo</Label>
                <Input id="name" placeholder="Ex: Catraca Entrada Principal" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select onValueChange={(value) => setValue('type', value as DeviceType)} defaultValue="facial_reader">
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
                  <Input placeholder="Serial" {...register('controlid_serial_number')} />
                  {errors.controlid_serial_number && <p className="text-sm text-destructive">{errors.controlid_serial_number.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Endereço IP</Label>
                  <Input placeholder="192.168.1.100" {...register('controlid_ip_address')} />
                  {errors.controlid_ip_address && <p className="text-sm text-destructive">{errors.controlid_ip_address.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Localização</Label>
                <Input placeholder="Ex: Portaria Principal" {...register('location')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <Select onValueChange={(value) => setValue('project_id', value)}>
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
                  <Select onValueChange={(value) => setValue('agent_id', value)}>
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
                    <Input {...register('api_username')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input type="password" {...register('api_password')} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Cadastrar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
          <p className="text-sm">Adicione seu primeiro dispositivo</p>
        </div>
      )}
    </div>
  );
};
