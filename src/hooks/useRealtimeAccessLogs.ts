import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AccessLog } from '@/types/supabase';
import { usesLocalServer } from '@/lib/runtimeProfile';

interface UseRealtimeAccessLogsOptions {
  projectId?: string | null;
  onNewLog?: (log: AccessLog) => void;
}

export const useRealtimeAccessLogs = ({ projectId, onNewLog }: UseRealtimeAccessLogsOptions = {}) => {
  const queryClient = useQueryClient();
  const isLocalRuntime = usesLocalServer();

  const handleNewLog = useCallback((payload: any) => {
    queryClient.invalidateQueries({ queryKey: ['workers-on-board'] });
    queryClient.invalidateQueries({ queryKey: ['access-logs'] });

    if (onNewLog && payload.new) {
      onNewLog(payload.new as AccessLog);
    }
  }, [queryClient, onNewLog]);

  useEffect(() => {
    if (isLocalRuntime || !projectId) return;

    const channel = supabase
      .channel(`access-logs-realtime-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'access_logs',
        },
        handleNewLog
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleNewLog, isLocalRuntime, projectId]);
};
