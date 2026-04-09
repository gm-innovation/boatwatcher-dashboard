import { useState, useEffect, useCallback, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllWorkers } from '@/lib/fetchAllWorkers';
import { localAccessLogs } from '@/lib/localServerProvider';
import { usesLocalServer } from '@/lib/runtimeProfile';

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
  role?: string | null;
  rejection_reason?: string | null;
  allowed_project_ids?: string[] | null;
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

const PENDING_LOGS_KEY = 'ac_pending_logs';

export function workersCacheKey(projectId?: string | null): string {
  return projectId ? `ac_workers_cache_${projectId}` : 'ac_workers_cache';
}

export function useOfflineAccessControl(projectId?: string | null) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [workers, setWorkers] = useState<CachedWorker[]>([]);
  const [pendingLogs, setPendingLogs] = useState<PendingAccessLog[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    const cacheKey = workersCacheKey(projectId);
    try {
      if (navigator.onLine) {
        const allWorkers = await fetchAllWorkers();

        if (allWorkers.length > 0) {
          await set(cacheKey, allWorkers);
          setWorkers(allWorkers);
        } else {
          // Remote returned empty — fallback to cache
          const cached = await get<CachedWorker[]>(cacheKey);
          if (cached && cached.length > 0) {
            setWorkers(cached);
            console.warn('[AC] Remote returned 0 workers, using cache with', cached.length, 'records');
          }
        }
      } else {
        const cached = await get<CachedWorker[]>(cacheKey);
        if (cached) setWorkers(cached);
      }
    } catch (err) {
      console.error('Error loading workers:', err);
      const cached = await get<CachedWorker[]>(cacheKey);
      if (cached) setWorkers(cached);
    } finally {
      setLoadingWorkers(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    get<PendingAccessLog[]>(PENDING_LOGS_KEY).then(logs => {
      if (logs) setPendingLogs(logs);
    });
  }, []);

  const saveAccessLog = useCallback(async (log: PendingAccessLog) => {
    const logPayload = {
      worker_id: log.worker_id,
      worker_name: log.worker_name,
      worker_document: log.worker_document,
      device_name: log.device_name,
      access_status: log.access_status,
      direction: log.direction,
      timestamp: log.timestamp,
      source: 'manual',
    };

    // Desktop with local server: route through local SQLite → sync engine → cloud
    // This unifies manual and facial events into the same pipeline
    if (usesLocalServer()) {
      try {
        await localAccessLogs.insert(logPayload);
        return true;
      } catch (err) {
        console.warn('[AC] Local server insert failed, falling back to cloud:', err);
        // Fall through to cloud insert
      }
    }

    if (navigator.onLine) {
      try {
        const { error } = await supabase.from('access_logs').insert(logPayload);
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
    workerCount: workers.length,
    saveAccessLog,
    syncPendingLogs,
    refreshWorkers: loadWorkers,
  };
}
