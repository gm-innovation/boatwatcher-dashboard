import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuditLog } from '@/types/supabase';

interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
}

export const useAuditLogs = (filters: AuditLogFilters = {}) => {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as AuditLog[];
    },
  });
};

export const useAuditLogActions = () => {
  return useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action')
        .limit(1000);

      if (error) throw error;
      
      const uniqueActions = [...new Set(data.map(d => d.action))].sort();
      return uniqueActions;
    },
  });
};

export const useAuditLogEntityTypes = () => {
  return useQuery({
    queryKey: ['audit-log-entity-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('entity_type')
        .limit(1000);

      if (error) throw error;
      
      const uniqueTypes = [...new Set(data.map(d => d.entity_type))].sort();
      return uniqueTypes;
    },
  });
};
