import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface WorkerStrike {
  id: string;
  worker_id: string;
  reason: string;
  description: string | null;
  severity: 'warning' | 'serious' | 'critical';
  created_by: string | null;
  created_at: string;
}

export const useWorkerStrikes = (workerId: string | null) => {
  return useQuery({
    queryKey: ['worker-strikes', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data, error } = await supabase
        .from('worker_strikes')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as WorkerStrike[];
    },
    enabled: !!workerId,
  });
};

export const useCreateWorkerStrike = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (strike: Omit<WorkerStrike, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('worker_strikes')
        .insert(strike)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-strikes', variables.worker_id] });
      toast({ title: 'Strike adicionado com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar strike', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteWorkerStrike = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ strikeId, workerId }: { strikeId: string; workerId: string }) => {
      const { error } = await supabase
        .from('worker_strikes')
        .delete()
        .eq('id', strikeId);
      
      if (error) throw error;
      return workerId;
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['worker-strikes', workerId] });
      toast({ title: 'Strike removido com sucesso' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover strike', description: error.message, variant: 'destructive' });
    },
  });
};
