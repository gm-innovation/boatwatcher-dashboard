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

      // Desktop with local server: LOCAL-FIRST for immediate responsiveness
      // The local SQLite has both manual and facial events instantly,
      // while cloud data depends on sync cycle (5s+).
      if (usesLocalServer()) {
        if (dateFilter === 'today') {
          const localWorkersOnBoard = await fetchProjectWorkersOnBoard(projectId);
          if (localWorkersOnBoard !== null) {
            return localWorkersOnBoard;
          }
        }

        // Fallback to cloud for non-today filters or if local fails
        const cloudResult = await fetchWorkersOnBoardFromCloud(projectId, startTimestamp, dateFilter);
        if (cloudResult !== null) return cloudResult;

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

/** Canonical identity key for cloud logs — ensures manual entry + facial exit match */
function resolveCloudCanonicalKey(log: { worker_id?: string | null; worker_name?: string | null; worker_document?: string | null }): string {
  if (log.worker_document) return `doc:${log.worker_document}`;
  if (log.worker_id) return `id:${log.worker_id}`;
  if (log.worker_name) return `name:${log.worker_name.toLowerCase().trim()}`;
  return '';
}

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

    // ── Carry-over: fetch last event per worker from previous 7 days ──
    // This handles workers who entered on a previous day and haven't exited yet.
    const carryOverStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: priorLogs } = await supabase
      .from('access_logs')
      .select('worker_id, worker_name, device_name, device_id, timestamp, direction, created_at')
      .eq('access_status', 'granted')
      .gte('timestamp', carryOverStart)
      .lt('timestamp', startTimestamp)
      .order('timestamp', { ascending: true });

    // Filter prior logs to this project's devices/manual points
    const relevantPriorLogs = (priorLogs || []).filter(log =>
      (log.device_id && deviceIds.includes(log.device_id)) ||
      (!log.device_id && log.device_name && manualDeviceNames.includes(log.device_name))
    );

    // Build last-known state from prior days using STABLE keys and TIMESTAMP order
    const priorState = new Map<string, { direction: string; worker_id: string | null; worker_name: string | null; worker_document: string | null; device_name: string | null; device_id: string | null; entry_time: string }>();
    for (const log of relevantPriorLogs) {
      const key = resolveCloudCanonicalKey(log);
      if (!key) continue;
      if (log.direction === 'entry') {
        priorState.set(key, { direction: 'entry', worker_id: log.worker_id, worker_name: log.worker_name, worker_document: (log as any).worker_document, device_name: log.device_name, device_id: log.device_id, entry_time: log.timestamp });
      } else if (log.direction === 'exit') {
        priorState.set(key, { direction: 'exit', worker_id: log.worker_id, worker_name: log.worker_name, worker_document: (log as any).worker_document, device_name: log.device_name, device_id: log.device_id, entry_time: log.timestamp });
      }
    }

    // Fetch ALL events (entry + exit) for the day, ordered by TIMESTAMP (event time, not upload time)
    const { data: allLogs, error: logsError } = await supabase
      .from('access_logs')
      .select('worker_id, worker_name, worker_document, device_name, device_id, timestamp, direction, created_at')
      .eq('access_status', 'granted')
      .gte('timestamp', startTimestamp)
      .lte('timestamp', maxTimestamp)
      .order('timestamp', { ascending: true });

    if (logsError) throw logsError;

    // Filter to only logs belonging to this project's devices or manual points
    const relevantLogs = (allLogs || []).filter(log =>
      (log.device_id && deviceIds.includes(log.device_id)) ||
      (!log.device_id && log.device_name && manualDeviceNames.includes(log.device_name))
    );

    // Initialize workerState from carry-over (workers still on board from prior days)
    const workerState = new Map<string, any>();
    for (const [key, state] of priorState) {
      if (state.direction === 'entry') {
        workerState.set(key, {
          worker_id: state.worker_id,
          worker_name: state.worker_name,
          device_name: state.device_name,
          device_id: state.device_id,
          entry_time: state.entry_time,
          isOnBoard: true,
        });
      }
    }

    // Process today's events chronologically by TIMESTAMP (actual event time)
    for (const log of relevantLogs) {
      const key = resolveCloudCanonicalKey(log);
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
        } else {
          // Exit without prior entry today — mark as exited (carry-over case)
          workerState.set(key, {
            worker_id: log.worker_id,
            worker_name: log.worker_name,
            device_name: log.device_name,
            device_id: log.device_id,
            entry_time: log.timestamp,
            isOnBoard: false,
          });
        }
      }
    }

    // Keep only workers whose final state is on-board
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString();

    const workersOnBoard = new Map<string, any>();
    for (const [key, state] of workerState) {
      if (state.isOnBoard && state.entry_time > cutoffTime) {
        workersOnBoard.set(key, state);
      }
    }

    if (workersOnBoard.size === 0) return [];

    // Build first entry map from relevantLogs (already ordered by timestamp ASC)
    const firstEntryMap = new Map<string, string>();
    for (const log of relevantLogs) {
      if (log.direction !== 'entry') continue;
      const key = resolveCloudCanonicalKey(log);
      if (key && !firstEntryMap.has(key)) {
        firstEntryMap.set(key, log.timestamp);
      }
    }

    // Enrich: collect worker_ids AND worker_names for lookup
    const workerIds = Array.from(workersOnBoard.values())
      .map(w => w.worker_id)
      .filter(Boolean);
    const workerNames = Array.from(workersOnBoard.values())
      .map(w => w.worker_name)
      .filter(Boolean);

    // Enrich by worker_id first (most reliable), then by name as fallback
    let workersByIdOrName = new Map<string, any>();

    if (workerIds.length > 0) {
      const { data: byId } = await supabase
        .from('workers')
        .select('id, name, role, company_id, companies(name)')
        .in('id', workerIds);
      for (const w of byId || []) {
        workersByIdOrName.set(w.id, w);
      }
    }

    // Fallback: fetch by name for workers without a valid UUID
    const missingNames = workerNames.filter(n => {
      // Check if we already have this worker by ID
      for (const [, state] of workersOnBoard) {
        if (state.worker_name === n && state.worker_id && workersByIdOrName.has(state.worker_id)) return false;
      }
      return true;
    });

    if (missingNames.length > 0) {
      const { data: byName } = await supabase
        .from('workers')
        .select('id, name, role, company_id, companies(name)')
        .in('name', missingNames);
      for (const w of byName || []) {
        if (!workersByIdOrName.has(w.id)) {
          workersByIdOrName.set(w.name, w); // Index by name for fallback
        }
      }
    }

    return Array.from(workersOnBoard.entries()).map(([key, onBoard]) => {
      // Look up by worker_id first (stable), then by name
      const enriched = (onBoard.worker_id && workersByIdOrName.get(onBoard.worker_id))
        || workersByIdOrName.get(onBoard.worker_name);
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
