/**
 * Universal Data Provider Hook
 *
 * Rotas de dados por runtime:
 * - Web: backend cloud
 * - Desktop: Local Server REST API quando disponível
 * - Desktop sem servidor local: fallback automático para backend cloud
 */

import { supabase } from '@/integrations/supabase/client';
import {
  localWorkers,
  localCompanies,
  localProjects,
  localAccessLogs,
  localDevices,
  localJobFunctions,
  localCompanyDocuments,
  localWorkerDocuments,
  refreshLocalServerAvailability,
} from '@/lib/localServerProvider';
import { shouldUseLocalServer } from '@/lib/runtimeProfile';

async function executeWithDesktopFallback<T>(localOperation: () => Promise<T>, cloudOperation: () => Promise<T>): Promise<T> {
  if (!(await shouldUseLocalServer())) {
    return cloudOperation();
  }

  try {
    return await localOperation();
  } catch (error) {
    await refreshLocalServerAvailability({ force: true });
    return cloudOperation();
  }
}

// --- Companies ---

export async function fetchCompanies() {
  return executeWithDesktopFallback(
    () => localCompanies.list(),
    async () => {
      const { data, error } = await supabase.from('companies').select('*').order('name');
      if (error) throw error;
      return data;
    },
  );
}

export async function fetchCompanyById(id: string) {
  return executeWithDesktopFallback(
    () => localCompanies.getById(id),
    async () => {
      const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  );
}

export async function fetchCurrentCompanyByUserId(userId: string) {
  return executeWithDesktopFallback(
    () => localCompanies.getCurrent(userId),
    async () => {
      const { data, error } = await supabase
        .from('user_companies')
        .select('company_id, companies(*)')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  );
}

export async function createCompany(companyData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localCompanies.create(companyData),
    async () => {
      const { data, error } = await supabase.from('companies').insert(companyData as any).select().single();
      if (error) throw error;
      return data;
    },
  );
}

export async function updateCompany(id: string, companyData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localCompanies.update(id, companyData),
    async () => {
      const { data, error } = await supabase.from('companies').update(companyData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
  );
}

export async function deleteCompany(id: string) {
  return executeWithDesktopFallback(
    () => localCompanies.delete(id),
    async () => {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
  );
}

export async function fetchCompanyDocuments(companyId: string) {
  return executeWithDesktopFallback(
    () => localCompanyDocuments.list(companyId),
    async () => {
      const { data, error } = await supabase
        .from('company_documents')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  );
}

export async function createCompanyDocument(data: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localCompanyDocuments.create(data),
    async () => {
      const { data: result, error } = await supabase.from('company_documents').insert(data as any).select().single();
      if (error) throw error;
      return result;
    },
  );
}

export async function updateCompanyDocument(id: string, data: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localCompanyDocuments.update(id, data),
    async () => {
      const { data: result, error } = await supabase.from('company_documents').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
  );
}

export async function deleteCompanyDocument(id: string) {
  return executeWithDesktopFallback(
    () => localCompanyDocuments.delete(id),
    async () => {
      const { error } = await supabase.from('company_documents').delete().eq('id', id);
      if (error) throw error;
    },
  );
}

// --- Workers ---

export async function fetchWorkers() {
  return executeWithDesktopFallback(
    () => localWorkers.list(),
    async () => {
      const { data, error } = await supabase.from('workers').select('*, companies(name)').order('name');
      if (error) throw error;
      return data.map((w: any) => ({ ...w, company: w.companies?.name || 'N/A' }));
    },
  );
}

export async function fetchWorkerById(id: string) {
  return executeWithDesktopFallback(
    () => localWorkers.getById(id),
    async () => {
      const { data, error } = await supabase.from('workers').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  );
}

export async function createWorker(workerData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localWorkers.create(workerData),
    async () => {
      const { data, error } = await supabase.from('workers').insert(workerData as any).select().single();
      if (error) throw error;
      return data;
    },
  );
}

export async function updateWorker(id: string, workerData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localWorkers.update(id, workerData),
    async () => {
      const { data, error } = await supabase.from('workers').update(workerData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
  );
}

export async function deleteWorker(id: string) {
  return executeWithDesktopFallback(
    () => localWorkers.delete(id),
    async () => {
      const { error } = await supabase.from('workers').delete().eq('id', id);
      if (error) throw error;
    },
  );
}

export async function fetchWorkerDocuments(workerId: string) {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.list(workerId),
    async () => {
      const { data, error } = await supabase
        .from('worker_documents')
        .select('*')
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  );
}

export async function fetchWorkerDocumentsByWorkerIds(workerIds: string[]) {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.listByWorkers(workerIds),
    async () => {
      const { data, error } = await supabase.from('worker_documents').select('*').in('worker_id', workerIds);
      if (error) throw error;
      return data;
    },
  );
}

export async function fetchWorkersWithExpiringDocuments(daysAhead: number = 30) {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.listExpiring(daysAhead),
    async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('worker_documents')
        .select(`
          *,
          worker:workers(id, name, company_id, document_number)
        `)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .order('expiry_date');

      if (error) throw error;
      return data;
    },
  );
}

export async function fetchExpiredDocuments() {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.listExpired(),
    async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('worker_documents')
        .select(`
          *,
          worker:workers(id, name, company_id, document_number)
        `)
        .lt('expiry_date', today)
        .order('expiry_date');

      if (error) throw error;
      return data;
    },
  );
}

export async function createWorkerDocument(documentData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.create(documentData),
    async () => {
      const { data, error } = await supabase.from('worker_documents').insert(documentData as any).select().single();
      if (error) throw error;
      return data;
    },
  );
}

export async function updateWorkerDocument(id: string, data: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.update(id, data),
    async () => {
      const { data: result, error } = await supabase.from('worker_documents').update(data).eq('id', id).select().single();
      if (error) throw error;
      return result;
    },
  );
}

export async function deleteWorkerDocument(id: string) {
  return executeWithDesktopFallback(
    () => localWorkerDocuments.delete(id),
    async () => {
      const { error } = await supabase.from('worker_documents').delete().eq('id', id);
      if (error) throw error;
    },
  );
}

// --- Projects ---

export async function fetchProjects() {
  return executeWithDesktopFallback(
    () => localProjects.list(),
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:companies(name, vessels, project_managers, logo_url_light, logo_url_dark)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  );
}

export async function fetchProjectById(id: string) {
  return executeWithDesktopFallback(
    () => localProjects.getById(id),
    async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:companies(name, vessels, project_managers, logo_url_light, logo_url_dark)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  );
}

export async function createProject(projectData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localProjects.create(projectData),
    async () => {
      const { data, error } = await supabase.from('projects').insert(projectData as any).select().single();
      if (error) throw error;
      return data;
    },
  );
}

export async function updateProject(id: string, projectData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localProjects.update(id, projectData),
    async () => {
      const { data, error } = await supabase.from('projects').update(projectData).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
  );
}

// --- Access Logs ---

export async function fetchAccessLogs(filters?: { projectId?: string; startDate?: string; endDate?: string; limit?: number }) {
  return executeWithDesktopFallback(
    () => localAccessLogs.list(filters as any),
    async () => {
      let query = supabase
        .from('access_logs')
        .select('*, worker:workers(id, name, document_number, company_id), device:devices(id, name, project_id)')
        .order('timestamp', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.startDate) query = query.gte('timestamp', `${filters.startDate}T00:00:00`);
      if (filters?.endDate) query = query.lte('timestamp', `${filters.endDate}T23:59:59`);

      if (filters?.projectId) {
        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('id')
          .eq('project_id', filters.projectId);

        if (devicesError) throw devicesError;

        const deviceIds = (devices || []).map((device) => device.id);
        if (deviceIds.length === 0) return [];

        query = query.in('device_id', deviceIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  );
}

export async function insertAccessLog(logData: Record<string, any>) {
  return executeWithDesktopFallback(
    () => localAccessLogs.insert(logData),
    async () => {
      const { data, error } = await supabase.from('access_logs').insert(logData as any).select().single();
      if (error) throw error;
      return data;
    },
  );
}

// --- Devices ---

export async function fetchDevices(projectId?: string) {
  return executeWithDesktopFallback(
    () => localDevices.list(projectId),
    async () => {
      let query = supabase.from('devices').select('*, project:projects(id, name)').order('name');
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  );
}

// --- Workers on Board ---

export async function fetchWorkersOnBoard(projectId: string) {
  return executeWithDesktopFallback(
    () => localProjects.getWorkersOnBoard(projectId),
    async () => null,
  );
}

// --- Job Functions ---

export async function fetchJobFunctions() {
  return executeWithDesktopFallback(
    () => localJobFunctions.list(),
    async () => {
      const { data, error } = await supabase.from('job_functions').select('*').order('name');
      if (error) throw error;
      return data;
    },
  );
}
