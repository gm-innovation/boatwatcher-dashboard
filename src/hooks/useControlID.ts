import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import type { Device, AccessLog } from "@/types/supabase";

// Hook para buscar dispositivos
export const useDevices = (projectId?: string | null) => {
  return useQuery({
    queryKey: ["devices", projectId],
    queryFn: async (): Promise<Device[]> => {
      let query = supabase
        .from('devices')
        .select('*, project:projects(id, name)')
        .order('name');

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching devices:", error);
        toast({
          title: "Erro ao buscar dispositivos",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      return data as unknown as Device[];
    },
    enabled: true,
  });
};

// Hook para buscar logs de acesso
export const useAccessLogs = (
  projectId?: string | null,
  startDate?: string,
  endDate?: string,
  limit: number = 100
) => {
  return useQuery({
    queryKey: ["access-logs", projectId, startDate, endDate, limit],
    queryFn: async (): Promise<AccessLog[]> => {
      let query = supabase
        .from('access_logs')
        .select(`
          *,
          worker:workers(id, name, document_number, company_id),
          device:devices(id, name, project_id)
        `)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (projectId) {
        query = query.eq('device.project_id', projectId);
      }

      if (startDate) {
        query = query.gte('timestamp', `${startDate}T00:00:00`);
      }

      if (endDate) {
        query = query.lte('timestamp', `${endDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching access logs:", error);
        toast({
          title: "Erro ao buscar logs de acesso",
          description: error.message,
          variant: "destructive",
        });
        throw error;
      }

      return data as unknown as AccessLog[];
    },
    enabled: true,
  });
};

// Hook para ações no dispositivo ControlID
export const useControlIDActions = () => {
  const queryClient = useQueryClient();

  const executeAction = useMutation({
    mutationFn: async ({ 
      action, 
      deviceId, 
      ...params 
    }: { 
      action: string; 
      deviceId: string; 
      [key: string]: any 
    }) => {
      const { data, error } = await supabase.functions.invoke("controlid-api", {
        body: { action, deviceId, ...params }
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na ação do dispositivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    getDeviceStatus: (deviceId: string) => 
      executeAction.mutateAsync({ action: 'getDeviceStatus', deviceId }),
    
    getDeviceInfo: (deviceId: string) => 
      executeAction.mutateAsync({ action: 'getDeviceInfo', deviceId }),
    
    listUsers: (deviceId: string) => 
      executeAction.mutateAsync({ action: 'listUsers', deviceId }),
    
    releaseAccess: (deviceId: string, doorId?: number) => 
      executeAction.mutateAsync({ action: 'releaseAccess', deviceId, doorId }),
    
    configureDevice: (deviceId: string, config: Record<string, any>) => 
      executeAction.mutateAsync({ action: 'configureDevice', deviceId, config }),
    
    isLoading: executeAction.isPending,
  };
};

// Hook para enrollment de trabalhadores
export const useWorkerEnrollment = () => {
  const queryClient = useQueryClient();

  const enrollWorker = useMutation({
    mutationFn: async ({ 
      workerId, 
      deviceIds, 
      action = 'enroll' 
    }: { 
      workerId: string; 
      deviceIds: string[]; 
      action?: 'enroll' | 'remove' 
    }) => {
      const { data, error } = await supabase.functions.invoke("worker-enrollment", {
        body: { action, workerId, deviceIds }
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({
        title: "Operação concluída",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no enrollment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    enroll: (workerId: string, deviceIds: string[]) => 
      enrollWorker.mutateAsync({ workerId, deviceIds, action: 'enroll' }),
    
    remove: (workerId: string, deviceIds: string[]) => 
      enrollWorker.mutateAsync({ workerId, deviceIds, action: 'remove' }),
    
    isLoading: enrollWorker.isPending,
  };
};

// Hook para realtime de logs de acesso
export const useRealtimeAccessLogs = (onNewLog: (log: AccessLog) => void) => {
  const channel = supabase
    .channel('access_logs_realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'access_logs',
      },
      (payload) => {
        console.log('New access log:', payload.new);
        onNewLog(payload.new as AccessLog);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
