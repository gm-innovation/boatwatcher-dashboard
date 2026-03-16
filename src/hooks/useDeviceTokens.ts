import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { usesLocalAuth, usesLocalServer } from '@/lib/runtimeProfile';

interface DeviceToken {
  id: string;
  device_id: string;
  token: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const LOCAL_RUNTIME_MESSAGE = 'A gestão local de tokens será conectada na fase de integração completa do servidor local.';

export function useDeviceTokens(deviceId: string | null) {
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  const { data: tokens = [], isLoading, error } = useQuery({
    queryKey: ['device-tokens', deviceId],
    queryFn: async () => {
      if (!deviceId || isLocalRuntime) return [];

      const { data, error } = await supabase
        .from('device_api_tokens')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as DeviceToken[];
    },
    enabled: !!deviceId
  });

  const createToken = useMutation({
    mutationFn: async ({ name, expiresInDays }: { name?: string; expiresInDays?: number }) => {
      if (!deviceId) throw new Error('Device ID is required');
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const token = generateSecureToken();
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('device_api_tokens')
        .insert({
          device_id: deviceId,
          token,
          name: name || 'Token ' + new Date().toLocaleDateString('pt-BR'),
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, plainToken: token } as DeviceToken & { plainToken: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-tokens', deviceId] });
      toast({ title: 'Token criado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar token', description: error.message, variant: 'destructive' });
    }
  });

  const revokeToken = useMutation({
    mutationFn: async (tokenId: string) => {
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const { error } = await supabase
        .from('device_api_tokens')
        .update({ is_active: false })
        .eq('id', tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-tokens', deviceId] });
      toast({ title: 'Token revogado' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao revogar token', description: error.message, variant: 'destructive' });
    }
  });

  const deleteToken = useMutation({
    mutationFn: async (tokenId: string) => {
      if (isLocalRuntime) throw new Error(LOCAL_RUNTIME_MESSAGE);

      const { error } = await supabase
        .from('device_api_tokens')
        .delete()
        .eq('id', tokenId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-tokens', deviceId] });
      toast({ title: 'Token removido' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover token', description: error.message, variant: 'destructive' });
    }
  });

  return {
    tokens,
    isLoading,
    error,
    createToken,
    revokeToken,
    deleteToken
  };
}
