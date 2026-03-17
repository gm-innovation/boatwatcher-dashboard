import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import type { JobFunction, RequiredDocument } from '@/types/supabase';
import { localJobFunctions } from '@/lib/localServerProvider';
import { useRuntimeProfile } from '@/hooks/useRuntimeProfile';

export const useJobFunctions = () => {
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;

  return useQuery({
    queryKey: ['job-functions', runtimeProfile.dataMode],
    queryFn: async () => {
      if (isDesktopLocalRuntime) {
        return await localJobFunctions.list();
      }

      const { data, error } = await supabase
        .from('job_functions')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as JobFunction[];
    },
  });
};

export const useJobFunctionById = (id: string | null) => {
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;

  return useQuery({
    queryKey: ['job-function', id, runtimeProfile.dataMode],
    queryFn: async () => {
      if (!id) return null;

      if (isDesktopLocalRuntime) {
        const jobFunctions = await localJobFunctions.list();
        return (jobFunctions as JobFunction[]).find((item) => item.id === id) ?? null;
      }

      const { data, error } = await supabase
        .from('job_functions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as JobFunction;
    },
    enabled: !!id,
  });
};

export const useRequiredDocuments = (jobFunctionId: string | null) => {
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;

  return useQuery({
    queryKey: ['required-documents', jobFunctionId, runtimeProfile.dataMode],
    queryFn: async () => {
      if (!jobFunctionId || isDesktopLocalRuntime) return [];

      const { data, error } = await supabase
        .from('required_documents')
        .select('*')
        .eq('job_function_id', jobFunctionId)
        .order('document_name');

      if (error) throw error;
      return data as RequiredDocument[];
    },
    enabled: !!jobFunctionId,
  });
};

export const useCreateJobFunction = () => {
  const queryClient = useQueryClient();
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;

  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      if (isDesktopLocalRuntime) {
        return await localJobFunctions.create(data);
      }

      const { data: result, error } = await supabase
        .from('job_functions')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-functions'] });
      toast({ title: 'Cargo criado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar cargo', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateJobFunction = () => {
  const queryClient = useQueryClient();
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string } }) => {
      if (isDesktopLocalRuntime) {
        return await localJobFunctions.update(id, data);
      }

      const { error } = await supabase
        .from('job_functions')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-functions'] });
      toast({ title: 'Cargo atualizado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar cargo', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteJobFunction = () => {
  const queryClient = useQueryClient();
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;

  return useMutation({
    mutationFn: async (id: string) => {
      if (isDesktopLocalRuntime) {
        return await localJobFunctions.delete(id);
      }

      const { error } = await supabase
        .from('job_functions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-functions'] });
      toast({ title: 'Cargo removido com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover cargo', description: error.message, variant: 'destructive' });
    },
  });
};

export const useCreateRequiredDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      job_function_id: string;
      document_name: string;
      validity_days?: number;
      is_mandatory?: boolean
    }) => {
      const { data: result, error } = await supabase
        .from('required_documents')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['required-documents', variables.job_function_id] });
      toast({ title: 'Documento adicionado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao adicionar documento', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteRequiredDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, jobFunctionId }: { id: string; jobFunctionId: string }) => {
      const { error } = await supabase
        .from('required_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return jobFunctionId;
    },
    onSuccess: (jobFunctionId) => {
      queryClient.invalidateQueries({ queryKey: ['required-documents', jobFunctionId] });
      toast({ title: 'Documento removido com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover documento', description: error.message, variant: 'destructive' });
    },
  });
};
