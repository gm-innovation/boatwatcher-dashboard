import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AccessLog } from '@/types/supabase';

interface UseRealtimeAccessLogsOptions {
  projectId?: string | null;
  onNewLog?: (log: AccessLog) => void;
}

export const useRealtimeAccessLogs = ({ projectId, onNewLog }: UseRealtimeAccessLogsOptions = {}) => {
  const queryClient = useQueryClient();

  const handleNewLog = useCallback((payload: any) => {
    // Invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ['workers-on-board'] });
    queryClient.invalidateQueries({ queryKey: ['access-logs'] });
    
    if (onNewLog && payload.new) {
      onNewLog(payload.new as AccessLog);
    }
  }, [queryClient, onNewLog]);

  useEffect(() => {
    const channel = supabase
      .channel('access-logs-realtime')
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
  }, [handleNewLog]);
};
