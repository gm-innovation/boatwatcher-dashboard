/**
 * Centralized normalization utilities for report components.
 *
 * Provides:
 * - Consistent worker key resolution (document → id → name)
 *   to ensure manual and facial events are properly grouped
 * - Timestamp normalization for Desktop with old local server builds
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usesLocalServer } from '@/lib/runtimeProfile';
import { getServerCapabilities } from '@/lib/localServerProvider';

// ── Worker Lookup ──────────────────────────────────────────────────────

export interface WorkerLookup {
  byId: Map<string, any>;
  byName: Map<string, any>;
  byDocument: Map<string, any>;
}

/**
 * Build lookup maps for workers by id, name (lowercased), and document_number.
 */
export function buildWorkerLookup(workers: any[]): WorkerLookup {
  const byId = new Map<string, any>();
  const byName = new Map<string, any>();
  const byDocument = new Map<string, any>();

  for (const w of workers) {
    if (w.id) byId.set(w.id, w);
    if (w.name) byName.set(w.name.toLowerCase().trim(), w);
    if (w.document_number) byDocument.set(w.document_number.trim(), w);
  }

  return { byId, byName, byDocument };
}

/**
 * Find a worker from an access log using canonical resolution order:
 * 1. worker_document → match by document_number
 * 2. worker_id → match by id
 * 3. worker_name → match by name (case-insensitive)
 */
export function findWorkerFromLog(log: any, lookup: WorkerLookup): any | null {
  if (log.worker_document) {
    const byDoc = lookup.byDocument.get(log.worker_document.trim());
    if (byDoc) return byDoc;
  }
  if (log.worker_id && lookup.byId.has(log.worker_id)) {
    return lookup.byId.get(log.worker_id)!;
  }
  if (log.worker_name) {
    const byName = lookup.byName.get(log.worker_name.toLowerCase().trim());
    if (byName) return byName;
  }
  return null;
}

/**
 * Resolve the canonical key for a log entry.
 * Ensures manual and facial events for the same worker are grouped together.
 */
export function resolveCanonicalKey(log: any, lookup: WorkerLookup): string {
  const worker = findWorkerFromLog(log, lookup);
  if (worker) return worker.id;
  return log.worker_document?.trim() || log.worker_id || log.worker_name || '';
}

/**
 * Group access logs by canonical worker key.
 */
export function groupLogsByWorker(logs: any[], lookup: WorkerLookup): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  for (const log of logs) {
    const key = resolveCanonicalKey(log, lookup);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(log);
  }
  return grouped;
}

// ── Timestamp Normalization ────────────────────────────────────────────

function isManualEvent(log: any): boolean {
  if (log.source === 'manual') return true;
  if (log.source && log.source !== 'manual') return false;
  // No source field: manual events typically lack device_id
  return !log.device_id;
}

/**
 * Hook that normalizes access log timestamps for reports.
 *
 * On Desktop with an old local server (lacking `timestamp_normalized`
 * capability), facial events are stored as BRT-as-UTC. The UI's BRT
 * formatting subtracts 3 h, causing a −3 h display offset. This hook
 * adds +3 h to facial event timestamps from old servers to compensate.
 *
 * On cloud or updated local servers, logs pass through unchanged.
 */
export function useNormalizedAccessLogs(accessLogs: any[]): any[] {
  const { data: needsFix = false } = useQuery({
    queryKey: ['server-timestamp-capability'],
    queryFn: async () => {
      if (!usesLocalServer()) return false;
      const caps = await getServerCapabilities();
      return !caps.timestamp_normalized;
    },
    staleTime: 300_000, // 5 min cache
  });

  return useMemo(() => {
    if (!needsFix || !accessLogs.length) return accessLogs;
    return accessLogs.map(log => {
      if (isManualEvent(log)) return log;
      const d = new Date(log.timestamp);
      d.setUTCHours(d.getUTCHours() + 3);
      return { ...log, timestamp: d.toISOString() };
    });
  }, [accessLogs, needsFix]);
}

// ── Company name helper ────────────────────────────────────────────────

/**
 * Get the company name for a worker, supporting both joined data
 * (from cloud queries with select joins) and flat data (from local server).
 */
export function getWorkerCompanyName(worker: any, companiesList?: any[]): string {
  if (!worker) return 'Sem empresa';
  // Joined data: worker.companies = { id, name } or worker.company = { id, name }
  const joined = worker.companies || worker.company;
  if (joined && typeof joined === 'object' && 'name' in joined) {
    return (joined as { name: string }).name;
  }
  // Data provider enrichment: worker.company = "CompanyName"
  if (typeof worker.company === 'string' && worker.company !== 'N/A') {
    return worker.company;
  }
  // Flat data: lookup by company_id
  if (worker.company_id && companiesList) {
    const c = companiesList.find((co: any) => co.id === worker.company_id);
    if (c) return c.name;
  }
  return 'Sem empresa';
}
