import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { usesLocalAuth, usesLocalServer } from '@/lib/runtimeProfile';
import { localAgent, localSync } from '@/lib/localServerProvider';

interface LocalAgent {
  id: string;
  name: string;
  token: string;
  project_id: string | null;
  status: string;
  last_seen_at: string | null;
  ip_address: string | null;
  version: string | null;
  configuration: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
  pending_sync_count: number | null;
  sync_status: string | null;
}

interface AgentCommand {
  id: string;
  agent_id: string;
  device_id: string;
  command: string;
  payload: Record<string, unknown>;
  status: string;
  result: unknown;
  error_message: string | null;
  created_at: string;
  executed_at: string | null;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const LOCAL_RUNTIME_MESSAGE = 'Esta ação ficará disponível quando concluirmos a integração completa do servidor local com agentes e comandos.';

export function useLocalAgents(projectId?: string | null) {
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['local-agents', projectId, isLocalRuntime],
    queryFn: async () => {
      if (isLocalRuntime) {
        const [agentStatus, syncStatus] = await Promise.all([
          localAgent.getStatus(),
          localSync.getStatus(),
        ]);

        const pseudoAgent: LocalAgent = {
          id: 'local-runtime-agent',
          name: 'Agente local do servidor',
          token: '',
          project_id: projectId || null,
          status: agentStatus?.running ? 'online' : 'offline',
          last_seen_at: null,
          ip_address: null,
          version: null,
          configuration: {
            devicesCount: agentStatus?.devicesCount ?? 0,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_sync_at: syncStatus?.lastSync ?? null,
          pending_sync_count: syncStatus?.pendingCount ?? 0,
          sync_status: syncStatus?.online ? 'online' : 'offline',
        };

        return [pseudoAgent];
      }

      let query = supabase
        .from('local_agents')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LocalAgent[];
    }
  });

  const createAgent = useMutation({
    mutationFn: async ({ name, projectId }: { name: string; projectId?: string }) => {
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const token = generateSecureToken();
      const { data, error } = await supabase
        .from('local_agents')
        .insert({
          name,
          token,
          project_id: projectId || null,
          status: 'offline'
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, plainToken: token } as LocalAgent & { plainToken: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-agents'] });
      toast({ title: 'Agente criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar agente', description: error.message, variant: 'destructive' });
    }
  });

  const deleteAgent = useMutation({
    mutationFn: async (agentId: string) => {
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const { error } = await supabase
        .from('local_agents')
        .delete()
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-agents'] });
      toast({ title: 'Agente removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover agente', description: error.message, variant: 'destructive' });
    }
  });

  const regenerateToken = useMutation({
    mutationFn: async (agentId: string) => {
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const newToken = generateSecureToken();
      const { data, error } = await supabase
        .from('local_agents')
        .update({ token: newToken })
        .eq('id', agentId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, plainToken: newToken } as LocalAgent & { plainToken: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-agents'] });
      toast({ title: 'Token regenerado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao regenerar token', description: error.message, variant: 'destructive' });
    }
  });

  const startAgent = useMutation({
    mutationFn: async () => {
      if (!isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);
      return localAgent.start();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-agents'] });
      toast({ title: 'Agente local iniciado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao iniciar agente', description: error.message, variant: 'destructive' });
    }
  });

  const stopAgent = useMutation({
    mutationFn: async () => {
      if (!isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);
      return localAgent.stop();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['local-agents'] });
      toast({ title: 'Agente local parado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao parar agente', description: error.message, variant: 'destructive' });
    }
  });

  return {
    agents,
    isLoading,
    error,
    createAgent,
    deleteAgent,
    regenerateToken,
    startAgent,
    stopAgent,
    isLocalRuntime,
  };
}

export function useAgentCommands(agentId: string | null) {
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  const { data: commands = [], isLoading, error } = useQuery({
    queryKey: ['agent-commands', agentId],
    queryFn: async () => {
      if (!agentId || isLocalRuntime) return [];

      const { data, error } = await supabase
        .from('agent_commands')
        .select(`
          *,
          devices (
            id,
            name,
            controlid_serial_number
          )
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as (AgentCommand & { devices: { id: string; name: string; controlid_serial_number: string } })[];
    },
    enabled: !!agentId,
    refetchInterval: isLocalRuntime ? false : 5000
  });

  const sendCommand = useMutation({
    mutationFn: async ({
      agentId,
      deviceId,
      command,
      payload
    }: {
      agentId: string;
      deviceId: string;
      command: string;
      payload?: Record<string, unknown>
    }) => {
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const { data, error } = await supabase
        .from('agent_commands')
        .insert([{
          agent_id: agentId,
          device_id: deviceId,
          command,
          payload: payload || {},
          status: 'pending'
        }] as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-commands', agentId] });
      toast({ title: 'Comando enviado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao enviar comando', description: error.message, variant: 'destructive' });
    }
  });

  return {
    commands,
    isLoading,
    error,
    sendCommand
  };
}
