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

      // Desktop with local server: local-first for instant offline response
      if (usesLocalServer()) {
        if (dateFilter === 'today') {
          const localWorkersOnBoard = await fetchProjectWorkersOnBoard(projectId);
          if (localWorkersOnBoard !== null) {
            return localWorkersOnBoard;
          }
        }
        // Local failed or non-today filter: try cloud as fallback
        const cloudResult = await fetchWorkersOnBoardFromCloud(projectId, startTimestamp, dateFilter);
        if (cloudResult !== null) {
          return cloudResult;
        }
        return [];
      }

      // Web: cloud-first (primary source of truth)
      const cloudResult = await fetchWorkersOnBoardFromCloud(projectId, startTimestamp, dateFilter);
      if (cloudResult !== null) {
        return cloudResult;
      }

      return [];
    },
    enabled: !!projectId,
    refetchInterval: 10000,
  });
};

/** Cloud query for workers on board — extracted for reuse and clarity */
async function fetchWorkersOnBoardFromCloud(
  projectId: string,
  startTimestamp: string,
  _dateFilter: DateFilter,
): Promise<any[] | null> {
  try {
    // First, get device IDs for this project
    const { data: projectDevices, error: devicesError } = await supabase
      .from('devices')
      .select('id, configuration')
      .eq('project_id', projectId);

    if (devicesError) throw devicesError;

    const deviceIds = (projectDevices || []).map(d => d.id);

    // Build device location map from configuration.access_location
    const deviceLocationMap = new Map<string, string>();
    for (const d of projectDevices || []) {
      const config = d.configuration as Record<string, any> | null;
      const loc = config?.access_location || 'bordo';
      deviceLocationMap.set(d.id, loc);
    }

    // Temporal ceiling: ignore timestamps more than 2 min in the future
    const maxTimestamp = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    // --- Physical device logs ---
    let entryLogs: any[] = [];
    let exitLogs: any[] = [];

    if (deviceIds.length > 0) {
      const { data: devEntries, error: entryError } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, device_name, device_id, timestamp')
        .eq('direction', 'entry')
        .eq('access_status', 'granted')
        .in('device_id', deviceIds)
        .gte('timestamp', startTimestamp)
        .lte('timestamp', maxTimestamp)
        .order('timestamp', { ascending: true });

      if (entryError) throw entryError;
      entryLogs = devEntries || [];

      const { data: devExits, error: exitError } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, timestamp')
        .eq('direction', 'exit')
        .in('device_id', deviceIds)
        .gte('timestamp', startTimestamp)
        .lte('timestamp', maxTimestamp);

      if (exitError) throw exitError;
      exitLogs = devExits || [];
    }

    // --- Manual access point logs ---
    const { data: manualPoints } = await supabase
      .from('manual_access_points')
      .select('name')
      .eq('project_id', projectId);

    const manualDeviceNames = (manualPoints || []).map(p => `Manual - ${p.name}`);

    if (manualDeviceNames.length > 0) {
      const { data: manualEntries } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, device_name, device_id, timestamp')
        .eq('direction', 'entry')
        .eq('access_status', 'granted')
        .is('device_id', null)
        .in('device_name', manualDeviceNames)
        .gte('timestamp', startTimestamp)
        .lte('timestamp', maxTimestamp)
        .order('timestamp', { ascending: true });

      if (manualEntries) entryLogs = [...entryLogs, ...manualEntries];

      const { data: manualExits } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, timestamp')
        .eq('direction', 'exit')
        .is('device_id', null)
        .in('device_name', manualDeviceNames)
        .gte('timestamp', startTimestamp)
        .lte('timestamp', maxTimestamp);

      if (manualExits) exitLogs = [...exitLogs, ...manualExits];
    }

    if (deviceIds.length === 0 && manualDeviceNames.length === 0) return [];

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
          device_id: entry.device_id,
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
      // Map device access_location to display label; manual entries show "Manual"
      const isManual = !onBoard.device_id && onBoard.device_name?.startsWith('Manual -');
      const accessLocation = onBoard.device_id ? deviceLocationMap.get(onBoard.device_id) || 'bordo' : 'bordo';
      const locationLabel = isManual ? 'Manual' : accessLocation === 'dique' ? 'Dique' : 'Bordo';
      return {
        id: enriched?.id || onBoard.worker_id || key,
        name: enriched?.name || onBoard.worker_name || 'Desconhecido',
        location: locationLabel,
        role: enriched?.role || null,
        company: enriched?.companies?.name || 'N/A',
        company_id: enriched?.company_id || null,
        entryTime: onBoard.entry_time,
      };
    });
  } catch (err) {
    console.warn('[useWorkersOnBoard] Cloud query failed, will try local fallback:', err);
    return null;
  }
}

export const useLastAccessLog = (projectId: string | null) => {
  return useQuery({
    queryKey: ['last-access-log', projectId],
    queryFn: async () => {
      // Desktop with local server: try local first
      if (usesLocalServer()) {
        try {
          const { fetchAccessLogs } = await import('@/hooks/useDataProvider');
          const logs = await fetchAccessLogs({ limit: 1 });
          if (logs && logs.length > 0) {
            // Sort locally to get latest
            const sorted = [...logs].sort((a: any, b: any) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            return sorted[0].timestamp || null;
          }
        } catch {
          // fall through to cloud
        }
      }

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
  const companiesMap = new Map<string, { id: string; name: string; count: number; entryTime: string | null }>();

  for (const worker of workersOnBoard) {
    if (!worker.company_id) continue;

    const existing = companiesMap.get(worker.company_id);
    if (existing) {
      existing.count++;
      if (worker.entryTime && (!existing.entryTime || worker.entryTime < existing.entryTime)) {
        existing.entryTime = worker.entryTime;
      }
    } else {
      companiesMap.set(worker.company_id, {
        id: worker.company_id,
        name: worker.company,
        count: 1,
        entryTime: worker.entryTime || null,
      });
    }
  }

  return Array.from(companiesMap.values()).map(c => ({
    id: c.id,
    name: c.name,
    workersCount: c.count,
    entryTime: c.entryTime || undefined,
  }));
};
