import { useCallback, useMemo } from 'react';
import type { AccessLog, Worker } from '@/types/supabase';

export interface ProcessedWorker {
  id: string;
  code?: string;
  name: string;
  role: string;
  company: string;
  isVisitante: boolean;
  currently_inside: boolean;
  entry_time: Date | null;
  exit_time: Date | null;
  location: string;
  isCrewMember: boolean;
}

export interface ProcessedCompany {
  name: string;
  team_count: number;
  first_entry: Date | null;
}

export interface ProcessedData {
  workers: ProcessedWorker[];
  companies: ProcessedCompany[];
  totalPeople: number;
  totalCompanies: number;
  diqueCount: number;
  bordoCount: number;
}

interface DeviceLocationMap {
  [deviceId: string]: string;
}

export const useProcessEvents = () => {
  const normalizeCompanyName = useCallback((companyName: string | null | undefined): string => {
    if (!companyName) return "Empresa não informada";
    const normalized = companyName.trim();
    if (!normalized) return "Empresa não informada";
    return normalized;
  }, []);

  const checkIfVisitante = useCallback((worker: Worker): boolean => {
    // Check role for visitor indication
    if (worker.role && worker.role.toLowerCase().includes("visitante")) {
      return true;
    }
    // If has a company and role, not a visitor
    if (worker.company_id && worker.role && worker.role !== "Não informado") {
      return false;
    }
    return false;
  }, []);

  const processAccessLogs = useCallback((
    accessLogs: AccessLog[],
    workers: Worker[],
    projectName: string = '',
    deviceLocations: DeviceLocationMap = {}
  ): ProcessedData => {
    const workerMap = new Map<string, ProcessedWorker>();
    const companyMap = new Map<string, Set<string>>();

    // Create a map of worker details
    const workerDetailsMap = new Map(workers.map(w => [w.id, w]));

    // Sort logs by timestamp (oldest first)
    const sortedLogs = [...accessLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sortedLogs.forEach(log => {
      const workerId = log.worker_id;
      if (!workerId) return;

      const workerDetails = workerDetailsMap.get(workerId);
      const isEntry = log.direction === 'entry';
      const isExit = log.direction === 'exit';
      const timestamp = new Date(log.timestamp);

      // Get location from device configuration.access_location
      const location = log.device_id ? (deviceLocations[log.device_id] || 'bordo') : 'bordo';

      // Get worker info
      const workerName = log.worker_name || workerDetails?.name || 'Desconhecido';
      const workerRole = workerDetails?.role || 'Não informado';
      const companyName = normalizeCompanyName(workerDetails?.company_id ? 'Empresa' : null);
      const isVisitante = workerDetails ? checkIfVisitante(workerDetails) : false;

      if (!workerMap.has(workerId)) {
        workerMap.set(workerId, {
          id: workerId,
          code: workerDetails?.document_number || undefined,
          name: workerName,
          role: workerRole,
          company: companyName,
          isVisitante,
          currently_inside: false,
          entry_time: null,
          exit_time: null,
          location,
          isCrewMember: projectName.toLowerCase().trim() === companyName.toLowerCase().trim()
        });
      }

      const worker = workerMap.get(workerId)!;

      if (isEntry) {
        worker.currently_inside = true;
        worker.entry_time = timestamp;
        worker.exit_time = null;
        worker.location = location;
      } else if (isExit) {
        worker.currently_inside = false;
        worker.exit_time = timestamp;
      }

      // Track companies
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, new Set());
      }
      companyMap.get(companyName)!.add(workerId);
    });

    // Filter workers currently inside
    const currentWorkers = Array.from(workerMap.values())
      .filter(w => w.currently_inside)
      .sort((a, b) => {
        if (!a.entry_time || !b.entry_time) return 0;
        return b.entry_time.getTime() - a.entry_time.getTime();
      });

    // Count by location
    const diqueWorkers = currentWorkers.filter(w => w.location === 'dique');
    const bordoWorkers = currentWorkers.filter(w => w.location !== 'dique');

    // Calculate companies with workers inside
    const currentCompanies: ProcessedCompany[] = Array.from(companyMap.entries())
      .map(([name, workerIds]) => {
        const workersInside = Array.from(workerIds).filter(
          id => workerMap.get(id)?.currently_inside
        );
        const firstEntry = workersInside
          .map(id => workerMap.get(id)?.entry_time)
          .filter((d): d is Date => d !== null)
          .sort((a, b) => a.getTime() - b.getTime())[0] || null;

        return {
          name,
          team_count: workersInside.length,
          first_entry: firstEntry
        };
      })
      .filter(c => c.team_count > 0 && c.name !== "Empresa não informada")
      .sort((a, b) => {
        if (!a.first_entry || !b.first_entry) return 0;
        return b.first_entry.getTime() - a.first_entry.getTime();
      });

    return {
      workers: currentWorkers,
      companies: currentCompanies,
      totalPeople: bordoWorkers.length,
      totalCompanies: currentCompanies.length,
      diqueCount: diqueWorkers.length,
      bordoCount: bordoWorkers.length
    };
  }, [normalizeCompanyName, checkIfVisitante]);

  return {
    processAccessLogs,
    normalizeCompanyName,
    checkIfVisitante
  };
};
