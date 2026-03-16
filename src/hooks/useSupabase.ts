import { useQuery } from '@tanstack/react-query';
import { fetchCompanies, fetchWorkers, fetchProjects, fetchProjectById, fetchWorkersOnBoard as fetchProjectWorkersOnBoard } from '@/hooks/useDataProvider';
import { supabase } from '@/integrations/supabase/client';
import type { Company, Worker, Project } from '@/types/supabase';
import { format, startOfDay } from 'date-fns';

export const useCompanies = () => {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      return await fetchCompanies() as Company[];
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

export const useWorkersOnBoard = (projectId: string | null) => {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['workers-on-board', projectId, today],
    queryFn: async () => {
      if (!projectId) return [];

      const localWorkersOnBoard = await fetchProjectWorkersOnBoard(projectId);
      if (localWorkersOnBoard !== null) {
        return localWorkersOnBoard;
      }

      const { data: entryLogs, error: entryError } = await supabase
        .from('access_logs')
        .select('worker_id, worker_name, device_name, timestamp')
        .eq('direction', 'entry')
        .eq('access_status', 'granted')
        .gte('timestamp', `${today}T00:00:00`)
        .order('timestamp', { ascending: false });

      if (entryError) throw entryError;

      const { data: exitLogs, error: exitError } = await supabase
        .from('access_logs')
        .select('worker_id, timestamp')
        .eq('direction', 'exit')
        .gte('timestamp', `${today}T00:00:00`);

      if (exitError) throw exitError;

      const workersOnBoard = new Map<string, any>();

      for (const entry of entryLogs || []) {
        if (!entry.worker_id) continue;

        const hasExit = exitLogs?.some(exit =>
          exit.worker_id === entry.worker_id &&
          new Date(exit.timestamp) > new Date(entry.timestamp)
        );

        if (!hasExit && !workersOnBoard.has(entry.worker_id)) {
          workersOnBoard.set(entry.worker_id, {
            worker_id: entry.worker_id,
            worker_name: entry.worker_name,
            device_name: entry.device_name,
            entry_time: entry.timestamp,
          });
        }
      }

      const workerIds = Array.from(workersOnBoard.keys());
      if (workerIds.length === 0) return [];

      const { data: workers, error: workersError } = await supabase
        .from('workers')
        .select('id, name, role, company_id, companies(name)')
        .in('id', workerIds);

      if (workersError) throw workersError;

      return (workers || []).map((worker: any) => ({
        id: worker.id,
        name: worker.name,
        location: workersOnBoard.get(worker.id)?.device_name || null,
        role: worker.role,
        company: worker.companies?.name || 'N/A',
        company_id: worker.company_id,
        entryTime: workersOnBoard.get(worker.id)?.entry_time,
      }));
    },
    enabled: !!projectId,
    refetchInterval: 30000,
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
