import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchDevices, fetchAccessLogs } from "@/hooks/useDataProvider";
import { toast } from "@/components/ui/use-toast";
import type { Device, AccessLog } from "@/types/supabase";
import { localControlId } from "@/lib/localServerProvider";
import { useRuntimeProfile } from "@/hooks/useRuntimeProfile";

const DESKTOP_LOCAL_ONLY_MESSAGE = 'O servidor local está indisponível no desktop. Os dados seguem em fallback para a nuvem, mas ações diretas em hardware ficam desabilitadas.';

// Hook para buscar dispositivos
export const useDevices = (projectId?: string | null) => {
  return useQuery({
    queryKey: ["devices", projectId],
    queryFn: async (): Promise<Device[]> => {
      const data = await fetchDevices(projectId || undefined);
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
      const data = await fetchAccessLogs({
        projectId: projectId || undefined,
        startDate,
        endDate,
        limit,
      });
      return data as unknown as AccessLog[];
    },
    enabled: true,
  });
};

// Hook para ações no dispositivo ControlID
export const useControlIDActions = () => {
  const queryClient = useQueryClient();
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;
  const isDesktopFallback = runtimeProfile.isDesktop && runtimeProfile.fallbackActive;

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
      if (isDesktopFallback) {
        throw new Error(DESKTOP_LOCAL_ONLY_MESSAGE);
      }

      if (isDesktopLocalRuntime) {
        switch (action) {
          case 'getDeviceStatus':
            return localControlId.getDeviceStatus(deviceId);
          case 'getDeviceInfo':
            return localControlId.getDeviceInfo(deviceId);
          case 'listUsers':
            return localControlId.listUsers(deviceId);
          case 'releaseAccess':
            return localControlId.releaseAccess(deviceId, params.doorId);
          case 'configureDevice':
            return localControlId.configureDevice(deviceId, params.config || {});
          default:
            throw new Error(`Ação local não suportada: ${action}`);
        }
      }

      const { data, error } = await supabase.functions.invoke("controlid-api", {
        body: { action, deviceId, ...params }
      });

      if (error) throw error;
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
    isDesktopFallback,
  };
};

// Hook para enrollment de trabalhadores
export const useWorkerEnrollment = () => {
  const queryClient = useQueryClient();
  const runtimeProfile = useRuntimeProfile();
  const isDesktopLocalRuntime = runtimeProfile.isDesktop && runtimeProfile.localServerAvailable;
  const isDesktopFallback = runtimeProfile.isDesktop && runtimeProfile.fallbackActive;

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
      if (isDesktopFallback) {
        throw new Error(DESKTOP_LOCAL_ONLY_MESSAGE);
      }

      if (isDesktopLocalRuntime) {
        return localControlId.enrollWorker(workerId, deviceIds, action);
      }

      const { data, error } = await supabase.functions.invoke("worker-enrollment", {
        body: { action, workerId, deviceIds }
      });

      if (error) throw error;
      // Return data including commandIds for UI tracking
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      
      if (data?.queued) {
        toast({
          title: "Comando enfileirado",
          description: data.message || "Aguardando execução pelo agente local.",
        });
      } else {
        toast({
          title: "Operação concluída",
          description: data.message,
        });
      }
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
    isDesktopFallback,
  };
};

// Hook legado para realtime de logs de acesso
export const useRealtimeAccessLogs = (_onNewLog: (log: AccessLog) => void) => {
  return () => {};
};
