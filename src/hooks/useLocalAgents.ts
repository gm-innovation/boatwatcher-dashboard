import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

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

export function useLocalAgents(projectId?: string | null) {
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading, error } = useQuery({
    queryKey: ['local-agents', projectId],
    queryFn: async () => {
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

  return {
    agents,
    isLoading,
    error,
    createAgent,
    deleteAgent,
    regenerateToken
  };
}

export function useAgentCommands(agentId: string | null) {
  const queryClient = useQueryClient();

  const { data: commands = [], isLoading, error } = useQuery({
    queryKey: ['agent-commands', agentId],
    queryFn: async () => {
      if (!agentId) return [];
      
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
    refetchInterval: 5000 // Atualizar a cada 5 segundos
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