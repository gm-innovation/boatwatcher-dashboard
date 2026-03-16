import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import type { WorkerDocument } from '@/types/supabase';
import {
  fetchWorkerDocuments,
  fetchWorkersWithExpiringDocuments,
  fetchExpiredDocuments,
  createWorkerDocument,
  updateWorkerDocument,
  deleteWorkerDocument,
} from '@/hooks/useDataProvider';

export const useWorkerDocuments = (workerId: string | null) => {
  return useQuery({
    queryKey: ['worker-documents', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      return (await fetchWorkerDocuments(workerId)) as WorkerDocument[];
    },
    enabled: !!workerId,
  });
};

export const useWorkersWithExpiringDocuments = (daysAhead: number = 30) => {
  return useQuery({
    queryKey: ['expiring-documents', daysAhead],
    queryFn: async () => fetchWorkersWithExpiringDocuments(daysAhead),
  });
};

export const useExpiredDocuments = () => {
  return useQuery({
    queryKey: ['expired-documents'],
    queryFn: async () => fetchExpiredDocuments(),
  });
};

export const useCreateWorkerDocument = () => {
  const queryClient = useQueryClient();

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
    }) => createWorkerDocument(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents', variables.worker_id] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
      queryClient.invalidateQueries({ queryKey: ['expired-documents'] });
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
      await updateWorkerDocument(id, data);
      return workerId;
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents', workerId] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
      queryClient.invalidateQueries({ queryKey: ['expired-documents'] });
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
      await deleteWorkerDocument(id);
      return workerId;
    },
    onSuccess: (workerId) => {
      queryClient.invalidateQueries({ queryKey: ['worker-documents', workerId] });
      queryClient.invalidateQueries({ queryKey: ['expiring-documents'] });
      queryClient.invalidateQueries({ queryKey: ['expired-documents'] });
      toast({ title: 'Documento removido com sucesso' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover documento', description: error.message, variant: 'destructive' });
    },
  });
};
