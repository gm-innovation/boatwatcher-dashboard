import { useState, useEffect, useCallback, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';

export interface CachedWorker {
  id: string;
  name: string;
  code: number;
  document_number: string | null;
  photo_url: string | null;
  company_id: string | null;
  company_name?: string;
  job_function_name?: string;
  status: string | null;
}

export interface PendingAccessLog {
  id: string;
  worker_id: string | null;
  worker_name: string | null;
  worker_document: string | null;
  device_name: string | null;
  access_status: 'granted' | 'denied';
  direction: 'entry' | 'exit' | 'unknown';
  timestamp: string;
  created_at: string;
}

const WORKERS_CACHE_KEY = 'ac_workers_cache';
const PENDING_LOGS_KEY = 'ac_pending_logs';

export function useOfflineAccessControl(clientIdFilter?: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [workers, setWorkers] = useState<CachedWorker[]>([]);
  const [pendingLogs, setPendingLogs] = useState<PendingAccessLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Online/offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load workers from cache or fetch
  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      if (navigator.onLine) {
        let query = supabase
          .from('workers')
          .select('id, name, code, document_number, photo_url, company_id, status, job_function_id')
          .eq('status', 'active')
          .limit(5000);

        if (clientIdFilter) {
          query = query.eq('company_id', clientIdFilter);
        }

        const { data: workersData } = await query;

        if (workersData && workersData.length > 0) {
          const { data: companies } = await supabase.from('companies').select('id, name');
          const { data: jobFunctions } = await supabase.from('job_functions').select('id, name');

          const companiesMap = new Map((companies || []).map(c => [c.id, c.name]));
          const jobFunctionsMap = new Map((jobFunctions || []).map(j => [j.id, j.name]));

          const cached: CachedWorker[] = workersData.map(w => ({
            id: w.id,
            name: w.name,
            code: w.code,
            document_number: w.document_number,
            photo_url: w.photo_url,
            company_id: w.company_id,
            company_name: w.company_id ? companiesMap.get(w.company_id) || undefined : undefined,
            job_function_name: w.job_function_id ? jobFunctionsMap.get(w.job_function_id) || undefined : undefined,
            status: w.status,
          }));

          await set(WORKERS_CACHE_KEY, cached);
          setWorkers(cached);
        }
      } else {
        const cached = await get<CachedWorker[]>(WORKERS_CACHE_KEY);
        if (cached) setWorkers(cached);
      }
    } catch (err) {
      console.error('Error loading workers:', err);
      const cached = await get<CachedWorker[]>(WORKERS_CACHE_KEY);
      if (cached) setWorkers(cached);
    } finally {
      setLoadingWorkers(false);
    }
  }, [clientIdFilter]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // Load pending logs from IndexedDB
  useEffect(() => {
    get<PendingAccessLog[]>(PENDING_LOGS_KEY).then(logs => {
      if (logs) setPendingLogs(logs);
    });
  }, []);

  // Save an access log
  const saveAccessLog = useCallback(async (log: PendingAccessLog) => {
    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('access_logs').insert({
          worker_id: log.worker_id,
          worker_name: log.worker_name,
          worker_document: log.worker_document,
          device_name: log.device_name,
          access_status: log.access_status,
          direction: log.direction,
          timestamp: log.timestamp,
        });
        if (error) throw error;
        return true;
      } catch {
        // Fallback to offline queue
      }
    }

    const current = (await get<PendingAccessLog[]>(PENDING_LOGS_KEY)) || [];
    const updated = [...current, log];
    await set(PENDING_LOGS_KEY, updated);
    setPendingLogs(updated);
    return false;
  }, []);

  // Sync pending logs
  const syncPendingLogs = useCallback(async () => {
    const current = (await get<PendingAccessLog[]>(PENDING_LOGS_KEY)) || [];
    if (current.length === 0) return;

    setIsSyncing(true);
    const failed: PendingAccessLog[] = [];

    for (const log of current) {
      try {
        const { error } = await supabase.from('access_logs').insert({
          worker_id: log.worker_id,
          worker_name: log.worker_name,
          worker_document: log.worker_document,
          device_name: log.device_name,
          access_status: log.access_status,
          direction: log.direction,
          timestamp: log.timestamp,
        });
        if (error) failed.push(log);
      } catch {
        failed.push(log);
      }
    }

    await set(PENDING_LOGS_KEY, failed);
    setPendingLogs(failed);
    setIsSyncing(false);
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingLogs.length > 0) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => syncPendingLogs(), 3000);
    }
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isOnline, pendingLogs.length, syncPendingLogs]);

  return {
    isOnline,
    workers,
    pendingLogs,
    isSyncing,
    loadingWorkers,
    saveAccessLog,
    syncPendingLogs,
    refreshWorkers: loadWorkers,
  };
}
