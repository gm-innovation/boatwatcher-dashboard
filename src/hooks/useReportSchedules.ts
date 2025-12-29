import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReportSchedule {
  id: string;
  name: string;
  report_type: 'presence' | 'access' | 'compliance' | 'device';
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  project_id: string | null;
  filters: Record<string, any>;
  last_run_at: string | null;
  next_run_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReportScheduleInput {
  name: string;
  report_type: ReportSchedule['report_type'];
  frequency: ReportSchedule['frequency'];
  recipients: string[];
  project_id?: string | null;
  filters?: Record<string, any>;
  is_active?: boolean;
}

export const useReportSchedules = (projectId?: string | null) => {
  return useQuery({
    queryKey: ['report-schedules', projectId],
    queryFn: async () => {
      let query = supabase
        .from('report_schedules')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        toast.error('Erro ao carregar agendamentos');
        throw error;
      }

      return data as ReportSchedule[];
    }
  });
};

export const useCreateReportSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReportScheduleInput) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('report_schedules')
        .insert({
          ...input,
          created_by: user?.user?.id || null
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Agendamento criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar agendamento: ' + error.message);
    }
  });
};

export const useUpdateReportSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ReportSchedule> & { id: string }) => {
      const { data, error } = await supabase
        .from('report_schedules')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Agendamento atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  });
};

export const useDeleteReportSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('report_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Agendamento removido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    }
  });
};

export const useToggleReportSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('report_schedules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success(data.is_active ? 'Agendamento ativado' : 'Agendamento pausado');
    },
    onError: (error: Error) => {
      toast.error('Erro: ' + error.message);
    }
  });
};
