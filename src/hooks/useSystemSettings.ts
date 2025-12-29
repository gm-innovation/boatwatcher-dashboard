import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import type { SystemSetting } from '@/types/supabase';

export const useSystemSettings = () => {
  return useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key');

      if (error) throw error;
      return data as SystemSetting[];
    },
  });
};

export const useSystemSetting = (key: string) => {
  return useQuery({
    queryKey: ['system-setting', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      if (error) throw error;
      return data as SystemSetting | null;
    },
  });
};

export const useUpdateSystemSetting = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value, description }: { 
      key: string; 
      value: Record<string, any>;
      description?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key,
          value,
          description,
          updated_by: session?.user?.id,
        }, {
          onConflict: 'key',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      queryClient.invalidateQueries({ queryKey: ['system-setting'] });
      toast({ title: 'Configuração atualizada com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar configuração', description: error.message, variant: 'destructive' });
    },
  });
};
