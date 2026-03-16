import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { WorkerDocument } from '@/types/supabase';
import { usesLocalServer } from '@/lib/runtimeProfile';
import { localWorkerDocuments } from '@/lib/localServerProvider';

export const useWorkerDocuments = (workerId: string | null) => {
  const isLocalRuntime = usesLocalServer();

  return useQuery({
    queryKey: ['worker-documents', workerId, isLocalRuntime],
    queryFn: async () => {
      if (!workerId) return [];

      if (isLocalRuntime) {
        return (await localWorkerDocuments.list(workerId)) as WorkerDocument[];
      }

      const { data, error } = await supabase
        .from('worker_documents')
        .select('*')
        .eq('worker_id', workerId)
        .order('document_type');

      if (error) throw error;
      return data as WorkerDocument[];
    },
    enabled: !!workerId,
  });
};

export const useWorkersWithExpiringDocuments = (daysAhead: number = 30) => {
  return useQuery({
    queryKey: ['expiring-documents', daysAhead],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('worker_documents')
        .select(`
          *,
          worker:workers(id, name, company_id, document_number)
        `)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .order('expiry_date');

      if (error) throw error;
      return data;
    },
  });
};

export const useExpiredDocuments = () => {
  return useQuery({
    queryKey: ['expired-documents'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('worker_documents')
        .select(`
          *,
          worker:workers(id, name, company_id, document_number)
        `)
        .lt('expiry_date', today)
        .order('expiry_date');

      if (error) throw error;
      return data;
    },
  });
};

export const useCreateWorkerDocument = () => {
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalServer();

  return useMutation({
    mutationFn: async (data: {
      worker_id: string;
      document_type: string;
      document_url?: string;
      filename?: string;
      issue_date?: string | null;
      expiry_date?: string | null;
      extracted_data?: Record<string, any> | null;
      status?: string;
    }) => {
      if (isLocalRuntime) {
        return await localWorkerDocuments.create(data);
      }

      const { data: result, error } = await supabase
        .from('worker_documents')
        .insert({
          worker_id: data.worker_id,
          document_type: data.document_type,
          document_url: data.document_url,
          filename: data.filename,
          issue_date: data.issue_date,
          expiry_date: data.expiry_date,
          extracted_data: data.extracted_data,
          status: data.status || 'valid',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents', variables.worker_id] });
      toast({ title: 'Documento adicionado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao adicionar documento', description: error.message, variant: 'destructive' });
    },
  });
};

export const useUpdateWorkerDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workerId, data }: {
      id: string;
      workerId: string;
      data: Partial<WorkerDocument>;
    }) => {
      const { error } = await supabase
        .from('worker_documents')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      return workerId;
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents', workerId] });
      toast({ title: 'Documento atualizado com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar documento', description: error.message, variant: 'destructive' });
    },
  });
};

export const useDeleteWorkerDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workerId }: { id: string; workerId: string }) => {
      const { error } = await supabase
        .from('worker_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return workerId;
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents', workerId] });
      toast({ title: 'Documento removido com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover documento', description: error.message, variant: 'destructive' });
    },
  });
};
