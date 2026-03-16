import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuditLog } from '@/types/supabase';
import { usesLocalAuth, usesLocalServer } from '@/lib/runtimeProfile';

interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}

export const useAuditLogs = (filters: AuditLogFilters = {}) => {
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      if (isLocalRuntime) return [] as AuditLog[];

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.action) query = query.eq('action', filters.action);
      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.startDate) query = query.gte('created_at', filters.startDate);
      if (filters.endDate) query = query.lte('created_at', filters.endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });
};

export const useAuditLogActions = () => {
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  return useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: async () => {
      if (isLocalRuntime) return [] as string[];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(1000);

      if (error) throw error;
      return [...new Set(data.map(d => d.action))].sort();
    },
  });
};

export const useAuditLogEntityTypes = () => {
  const isLocalRuntime = usesLocalAuth() || usesLocalServer();

  return useQuery({
    queryKey: ['audit-log-entity-types'],
    queryFn: async () => {
      if (isLocalRuntime) return [] as string[];

      const { data, error } = await supabase
        .from('audit_logs')
        .select('entity_type')
        .limit(1000);

      if (error) throw error;
      return [...new Set(data.map(d => d.entity_type))].sort();
    },
  });
};
