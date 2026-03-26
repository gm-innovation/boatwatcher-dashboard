import { useQuery } from '@tanstack/react-query';
import { fetchCompanies, fetchWorkers, fetchProjects, fetchProjectById, fetchWorkersOnBoard as fetchProjectWorkersOnBoard } from '@/hooks/useDataProvider';
import { supabase } from '@/integrations/supabase/client';
import type { Company, Worker, Project } from '@/types/supabase';
import { format, startOfDay, subDays } from 'date-fns';
import { usesLocalServer } from '@/lib/runtimeProfile';

export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      return await fetchCompanies() as Company[];
    }
  });
};

export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      if (usesLocalServer()) {
        const all = await fetchCompanies() as Company[];
        return all.filter(c => c.type === 'client');
      }
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('type', 'client');
      if (error) throw error;
      return (data || []) as Company[];
    }
  });
};

export const useContractorCompanies = () => {
  return useQuery({
    queryKey: ['contractor-companies'],
    queryFn: async () => {
      if (usesLocalServer()) {
        const all = await fetchCompanies() as Company[];
        return all.filter(c => c.type === 'company' || !c.type);
      }
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('type', 'company');
      if (error) throw error;
      return (data || []) as Company[];
    }
  });
};

export const useWorkers = () => {
  return useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      return await fetchWorkers() as Worker[];
    }
  });
};

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      return await fetchProjects() as Project[];
    }
  });
};

export const useProjectById = (projectId: string | null) => {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return await fetchProjectById(projectId) as Project;
    },
    enabled: !!projectId
  });
};

export const useCompanyLogo = (companyId: string | null) => {
  return useQuery({
    queryKey: ['company-logo', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      if (usesLocalServer()) {
        const companies = await fetchCompanies();
        const company = companies?.find((c: any) => c.id === companyId);
        return company ? { logo_url_light: company.logo_url_light, logo_url_dark: company.logo_url_dark } : null;
      }

      const { data, error } = await supabase
        .from('companies')
        .select('logo_url_light, logo_url_dark')
        .eq('id', companyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId
  });
};

export type DateFilter = 'today' | '7days' | '30days';

export const useWorkersOnBoard = (projectId: string | null, dateFilter: DateFilter = 'today') => {
  // UTC-aware: compute local midnight then convert to ISO for correct timezone offset
  const now = new Date();
  const daysBack = dateFilter === 'today' ? 0 : dateFilter === '7days' ? 7 : 30;
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack);
  const startTimestamp = localMidnight.toISOString();

  return useQuery({
    queryKey: ['workers-on-board', projectId, startTimestamp],
    queryFn: async () => {
      if (!projectId) return [];

      // Local server mode only works for today
      if (dateFilter === 'today') {
        const localWorkersOnBoard = await fetchProjectWorkersOnBoard(projectId);
        if (localWorkersOnBoard !== null) {
          return localWorkersOnBoard;
        }
      }

      // First, get device IDs for this project
      const { data: projectDevices, error: devicesError } = await supabase
        .from('devices')
        .select('id')
        .eq('project_id', projectId);

      if (devicesError) throw devicesError;

      const deviceIds = (projectDevices || []).map(d => d.id);
      if (deviceIds.length === 0) return [];

      // Temporal ceiling: ignore timestamps more than 2 min in the future
      const maxTimestamp = new Date(Date.now() + 2 * 60 * 1000).toISOString();

      const { data: entryLogs, error: entryError } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, device_name, timestamp')
        .eq('direction', 'entry')
        .eq('access_status', 'granted')
        .in('device_id', deviceIds)
        .gte('timestamp', startTimestamp)
        .lte('timestamp', maxTimestamp)
        .order('timestamp', { ascending: true });

      if (entryError) throw entryError;

      const { data: exitLogs, error: exitError } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, timestamp')
        .eq('direction', 'exit')
        .in('device_id', deviceIds)
        .gte('timestamp', startTimestamp)
        .lte('timestamp', maxTimestamp);

      if (exitError) throw exitError;

      // Use worker_name as the primary key for matching entries/exits (handles UUID mismatch)
      const workersOnBoard = new Map<string, any>();

      for (const entry of entryLogs || []) {
        const key = entry.worker_name || entry.worker_id || '';
        if (!key) continue;

        // Match exit by worker_name first, fallback to worker_id
        const hasExit = exitLogs?.some(exit => {
          const nameMatch = entry.worker_name && exit.worker_name && exit.worker_name === entry.worker_name;
          const idMatch = exit.worker_id === entry.worker_id;
          return (nameMatch || idMatch) && new Date(exit.timestamp) > new Date(entry.timestamp);
        });

        if (!hasExit && !workersOnBoard.has(key)) {
          workersOnBoard.set(key, {
            worker_id: entry.worker_id,
            worker_name: entry.worker_name,
            device_name: entry.device_name,
            entry_time: entry.timestamp,
          });
        }
      }

      if (workersOnBoard.size === 0) return [];

      // Enrich by worker_name (handles UUID mismatch)
      const workerNames = Array.from(workersOnBoard.values())
        .map(w => w.worker_name)
        .filter(Boolean);

      const { data: workers } = workerNames.length > 0
        ? await supabase
            .from('workers')
            .select('id, name, role, company_id, companies(name)')
            .in('name', workerNames)
        : { data: [] };

      const workersByName = new Map<string, any>();
      for (const w of workers || []) {
        workersByName.set(w.name, w);
      }

      return Array.from(workersOnBoard.entries()).map(([key, onBoard]) => {
        const enriched = workersByName.get(onBoard.worker_name);
        return {
          id: enriched?.id || onBoard.worker_id || key,
          name: enriched?.name || onBoard.worker_name || 'Desconhecido',
          location: onBoard.device_name || null,
          role: enriched?.role || null,
          company: enriched?.companies?.name || 'N/A',
          company_id: enriched?.company_id || null,
          entryTime: onBoard.entry_time,
        };
      });
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });
};

export const useLastAccessLog = (projectId: string | null) => {
  return useQuery({
    queryKey: ['last-access-log', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_logs')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0]?.timestamp || null;
    },
    enabled: !!projectId,
  });
};

export const useCompaniesOnBoard = (workersOnBoard: any[]) => {
  const companiesMap = new Map<string, { id: string; name: string; count: number }>();

  for (const worker of workersOnBoard) {
    if (!worker.company_id) continue;

    if (companiesMap.has(worker.company_id)) {
      companiesMap.get(worker.company_id)!.count++;
    } else {
      companiesMap.set(worker.company_id, {
        id: worker.company_id,
        name: worker.company,
        count: 1
      });
    }
  }

  return Array.from(companiesMap.values()).map(c => ({
    id: c.id,
    name: c.name,
    workersCount: c.count
  }));
};
