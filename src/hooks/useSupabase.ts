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
        .eq('type', 'company')
        .order('name')
        .range(0, 9999);
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
  // Fixed BRT midnight (UTC-3) — ensures consistent filtering regardless of browser timezone
  const now = new Date();
  const daysBack = dateFilter === 'today' ? 0 : dateFilter === '7days' ? 7 : 30;
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysBack));
  todayUTC.setUTCHours(3, 0, 0, 0); // meia-noite BRT = 03:00 UTC
  const startTimestamp = todayUTC.toISOString();

  return useQuery({
    queryKey: ['workers-on-board', projectId, startTimestamp],
    queryFn: async () => {
      if (!projectId) return [];

      // Desktop with local server: cloud-first (has all events with correct timestamps)
      if (usesLocalServer()) {
        const cloudResult = await fetchWorkersOnBoardFromCloud(projectId, startTimestamp, dateFilter);
        if (cloudResult !== null) return cloudResult;

        // Offline fallback: use local SQLite data
        if (dateFilter === 'today') {
          const localWorkersOnBoard = await fetchProjectWorkersOnBoard(projectId);
          if (localWorkersOnBoard !== null) {
            return localWorkersOnBoard;
          }
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
    refetchInterval: 5000,
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

    // --- Manual access point metadata ---
    const { data: manualPoints } = await supabase
      .from('manual_access_points')
      .select('name, access_location')
      .eq('project_id', projectId);

    const manualDeviceNames = (manualPoints || []).map(p => `Manual - ${p.name}`);

    // Map device_name → Bordo/Dique based on terminal's access_location config
    const manualLocationMap = new Map<string, string>(
      (manualPoints || []).map(p => [
        `Manual - ${p.name}`,
        p.access_location === 'dique' ? 'Dique' : 'Bordo'
      ])
    );

    if (deviceIds.length === 0 && manualDeviceNames.length === 0) return [];

    // Fetch ALL events (entry + exit) for the day, ordered by created_at (cloud arrival order)
    const { data: allLogs, error: logsError } = await supabase
      .from('access_logs')
      .select('worker_id, worker_name, device_name, device_id, timestamp, direction, created_at')
      .eq('access_status', 'granted')
      .gte('timestamp', startTimestamp)
      .lte('timestamp', maxTimestamp)
      .order('created_at', { ascending: true });

    if (logsError) throw logsError;

    // Filter to only logs belonging to this project's devices or manual points
    const relevantLogs = (allLogs || []).filter(log =>
      (log.device_id && deviceIds.includes(log.device_id)) ||
      (!log.device_id && log.device_name && manualDeviceNames.includes(log.device_name))
    );

    // Process worker state chronologically by created_at (cloud arrival order)
    const workerState = new Map<string, any>();
    for (const log of relevantLogs) {
      const key = log.worker_name || log.worker_id || '';
      if (!key) continue;

      if (log.direction === 'entry') {
        workerState.set(key, {
          worker_id: log.worker_id,
          worker_name: log.worker_name,
          device_name: log.device_name,
          device_id: log.device_id,
          entry_time: log.timestamp,
          isOnBoard: true,
        });
      } else if (log.direction === 'exit') {
        const existing = workerState.get(key);
        if (existing) {
          existing.isOnBoard = false;
        }
      }
    }

    // Keep only workers whose final state is on-board
    const workersOnBoard = new Map<string, any>();
    for (const [key, state] of workerState) {
      if (state.isOnBoard) {
        workersOnBoard.set(key, state);
      }
    }

    if (workersOnBoard.size === 0) return [];

    // Build first entry map from relevantLogs (already ordered by created_at ASC)
    const firstEntryMap = new Map<string, string>();
    for (const log of relevantLogs) {
      if (log.direction !== 'entry') continue;
      const key = log.worker_name || log.worker_id || '';
      if (key && !firstEntryMap.has(key)) {
        firstEntryMap.set(key, log.timestamp);
      }
    }

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
      const locationLabel = isManual
        ? (manualLocationMap.get(onBoard.device_name || '') || 'Bordo')
        : accessLocation === 'dique' ? 'Dique' : 'Bordo';
      return {
        id: enriched?.id || onBoard.worker_id || key,
        name: enriched?.name || onBoard.worker_name || 'Desconhecido',
        location: locationLabel,
        role: enriched?.role || null,
        company: enriched?.companies?.name || 'N/A',
        company_id: enriched?.company_id || null,
        entryTime: onBoard.entry_time,
        firstEntryTime: firstEntryMap.get(key) || onBoard.entry_time,
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

    const workerFirstEntry = worker.firstEntryTime || worker.entryTime;
    const existing = companiesMap.get(worker.company_id);
    if (existing) {
      existing.count++;
      if (workerFirstEntry && (!existing.entryTime || workerFirstEntry < existing.entryTime)) {
        existing.entryTime = workerFirstEntry;
      }
    } else {
      companiesMap.set(worker.company_id, {
        id: worker.company_id,
        name: worker.company,
        count: 1,
        entryTime: workerFirstEntry || null,
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
