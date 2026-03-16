/**
 * Universal Data Provider Hook
 *
 * Rotas de dados por runtime:
 * - Web: backend cloud
 * - Desktop: Local Server REST API
 */

import { supabase } from '@/integrations/supabase/client';
import { localWorkers, localCompanies, localProjects, localAccessLogs, localDevices, localJobFunctions, localCompanyDocuments, localWorkerDocuments } from '@/lib/localServerProvider';
import { usesLocalServer } from '@/lib/runtimeProfile';

// --- Companies ---

export async function fetchCompanies() {
  if (usesLocalServer()) return localCompanies.list();
  const { data, error } = await supabase.from('companies').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function fetchCompanyById(id: string) {
  if (usesLocalServer()) return localCompanies.getById(id);
  const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchCurrentCompanyByUserId(userId: string) {
  if (usesLocalServer()) return localCompanies.getCurrent(userId);
  const { data, error } = await supabase
    .from('user_companies')
    .select('company_id, companies(*)')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCompany(companyData: Record<string, any>) {
  if (usesLocalServer()) return localCompanies.create(companyData);
  const { data, error } = await supabase.from('companies').insert(companyData as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompany(id: string, companyData: Record<string, any>) {
  if (usesLocalServer()) return localCompanies.update(id, companyData);
  const { data, error } = await supabase.from('companies').update(companyData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCompany(id: string) {
  if (usesLocalServer()) return localCompanies.delete(id);
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCompanyDocuments(companyId: string) {
  if (usesLocalServer()) return localCompanyDocuments.list(companyId);
  const { data, error } = await supabase.from('company_documents').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCompanyDocument(data: Record<string, any>) {
  if (usesLocalServer()) return localCompanyDocuments.create(data);
  const { data: result, error } = await supabase.from('company_documents').insert(data as any).select().single();
  if (error) throw error;
  return result;
}

// --- Workers ---

export async function fetchWorkers() {
  if (usesLocalServer()) return localWorkers.list();
  const { data, error } = await supabase
    .from('workers')
    .select('*, companies(name)')
    .order('name');
  if (error) throw error;
  return data.map((w: any) => ({ ...w, company: w.companies?.name || 'N/A' }));
}

export async function fetchWorkerById(id: string) {
  if (usesLocalServer()) return localWorkers.getById(id);
  const { data, error } = await supabase.from('workers').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createWorker(workerData: Record<string, any>) {
  if (usesLocalServer()) return localWorkers.create(workerData);
  const { data, error } = await supabase.from('workers').insert(workerData as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id: string, workerData: Record<string, any>) {
  if (usesLocalServer()) return localWorkers.update(id, workerData);
  const { data, error } = await supabase.from('workers').update(workerData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteWorker(id: string) {
  if (usesLocalServer()) return localWorkers.delete(id);
  const { error } = await supabase.from('workers').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchWorkerDocuments(workerId: string) {
  if (usesLocalServer()) return localWorkerDocuments.list(workerId);
  const { data, error } = await supabase.from('worker_documents').select('*').eq('worker_id', workerId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchWorkerDocumentsByWorkerIds(workerIds: string[]) {
  if (usesLocalServer()) return localWorkerDocuments.listByWorkers(workerIds);
  const { data, error } = await supabase.from('worker_documents').select('*').in('worker_id', workerIds);
  if (error) throw error;
  return data;
}

export async function createWorkerDocument(documentData: Record<string, any>) {
  if (usesLocalServer()) return localWorkerDocuments.create(documentData);
  const { data, error } = await supabase.from('worker_documents').insert(documentData as any).select().single();
  if (error) throw error;
  return data;
}

// --- Projects ---

export async function fetchProjects() {
  if (usesLocalServer()) return localProjects.list();
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:companies(name, vessels, project_managers, logo_url_light, logo_url_dark)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchProjectById(id: string) {
  if (usesLocalServer()) return localProjects.getById(id);
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:companies(name, vessels, project_managers, logo_url_light, logo_url_dark)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject(projectData: Record<string, any>) {
  if (usesLocalServer()) return localProjects.create(projectData);
  const { data, error } = await supabase.from('projects').insert(projectData as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, projectData: Record<string, any>) {
  if (usesLocalServer()) return localProjects.update(id, projectData);
  const { data, error } = await supabase.from('projects').update(projectData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// --- Access Logs ---

export async function fetchAccessLogs(filters?: { projectId?: string; startDate?: string; endDate?: string; limit?: number }) {
  if (usesLocalServer()) return localAccessLogs.list(filters as any);
  let query = supabase
    .from('access_logs')
    .select('*, worker:workers(id, name, document_number, company_id), device:devices(id, name, project_id)')
    .order('timestamp', { ascending: false })
    .limit(filters?.limit || 100);

  if (filters?.startDate) query = query.gte('timestamp', `${filters.startDate}T00:00:00`);
  if (filters?.endDate) query = query.lte('timestamp', `${filters.endDate}T23:59:59`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function insertAccessLog(logData: Record<string, any>) {
  if (usesLocalServer()) return localAccessLogs.insert(logData);
  const { data, error } = await supabase.from('access_logs').insert(logData as any).select().single();
  if (error) throw error;
  return data;
}

// --- Devices ---

export async function fetchDevices(projectId?: string) {
  if (usesLocalServer()) return localDevices.list(projectId);
  let query = supabase.from('devices').select('*, project:projects(id, name)').order('name');
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// --- Workers on Board ---

export async function fetchWorkersOnBoard(projectId: string) {
  if (usesLocalServer()) return localProjects.getWorkersOnBoard(projectId);
  return null;
}

// --- Job Functions ---

export async function fetchJobFunctions() {
  if (usesLocalServer()) return localJobFunctions.list();
  const { data, error } = await supabase.from('job_functions').select('*').order('name');
  if (error) throw error;
  return data;
}
