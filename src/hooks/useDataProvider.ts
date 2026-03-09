/**
 * Universal Data Provider Hook
 * 
 * Detects environment and routes data operations:
 * - Web: uses Supabase client directly
 * - Electron: uses SQLite via IPC bridge (window.electronAPI.db)
 */

import { isElectron, getElectronAPI } from '@/lib/dataProvider';
import { supabase } from '@/integrations/supabase/client';

// --- Generic CRUD helpers for Electron ---

const electronDB = () => getElectronAPI()?.db;

// --- Companies ---

export async function fetchCompanies() {
  if (isElectron()) {
    return electronDB()!.getCompanies();
  }
  const { data, error } = await supabase.from('companies').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function fetchCompanyById(id: string) {
  if (isElectron()) {
    return electronDB()!.getCompanyById(id);
  }
  const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createCompany(companyData: Record<string, any>) {
  if (isElectron()) {
    return null; // expanded in IPC bridge
  }
  const { data, error } = await supabase.from('companies').insert(companyData as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompany(id: string, companyData: Record<string, any>) {
  if (isElectron()) {
    // Will be handled by expanded IPC bridge
    return null;
  }
  const { data, error } = await supabase.from('companies').update(companyData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCompany(id: string) {
  if (isElectron()) {
    return null;
  }
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

// --- Workers ---

export async function fetchWorkers() {
  if (isElectron()) {
    return electronDB()!.getWorkers();
  }
  const { data, error } = await supabase
    .from('workers')
    .select('*, companies(name)')
    .order('name');
  if (error) throw error;
  return data.map((w: any) => ({ ...w, company: w.companies?.name || 'N/A' }));
}

export async function fetchWorkerById(id: string) {
  if (isElectron()) {
    return electronDB()!.getWorkerById(id);
  }
  const { data, error } = await supabase.from('workers').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createWorker(workerData: Record<string, any>) {
  if (isElectron()) {
    return electronDB()!.createWorker(workerData);
  }
  const { data, error } = await supabase.from('workers').insert(workerData as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id: string, workerData: Record<string, any>) {
  if (isElectron()) {
    return electronDB()!.updateWorker(id, workerData);
  }
  const { data, error } = await supabase.from('workers').update(workerData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteWorker(id: string) {
  if (isElectron()) {
    return electronDB()!.deleteWorker(id);
  }
  const { error } = await supabase.from('workers').delete().eq('id', id);
  if (error) throw error;
}

// --- Projects ---

export async function fetchProjects() {
  if (isElectron()) {
    return electronDB()!.getProjects();
  }
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:companies(name, vessels, project_managers, logo_url_light, logo_url_dark)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchProjectById(id: string) {
  if (isElectron()) {
    return electronDB()!.getProjectById(id);
  }
  const { data, error } = await supabase
    .from('projects')
    .select('*, client:companies(name, vessels, project_managers, logo_url_light, logo_url_dark)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject(projectData: Record<string, any>) {
  if (isElectron()) {
    return null; // expanded in IPC bridge
  }
  const { data, error } = await supabase.from('projects').insert(projectData as any).select().single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, projectData: Record<string, any>) {
  if (isElectron()) {
    return null;
  }
  const { data, error } = await supabase.from('projects').update(projectData).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// --- Access Logs ---

export async function fetchAccessLogs(filters?: { projectId?: string; startDate?: string; endDate?: string; limit?: number }) {
  if (isElectron()) {
    return electronDB()!.getAccessLogs(filters);
  }
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
  if (isElectron()) {
    return electronDB()!.insertAccessLog(logData);
  }
  const { data, error } = await supabase.from('access_logs').insert(logData).select().single();
  if (error) throw error;
  return data;
}

// --- Devices ---

export async function fetchDevices(projectId?: string) {
  if (isElectron()) {
    return electronDB()!.getDevices(projectId);
  }
  let query = supabase.from('devices').select('*, project:projects(id, name)').order('name');
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// --- Workers on Board ---

export async function fetchWorkersOnBoard(projectId: string) {
  if (isElectron()) {
    return electronDB()!.getWorkersOnBoard(projectId);
  }
  // Web version delegates to the existing hook logic — this is a convenience wrapper
  return null; // useWorkersOnBoard hook handles this for web
}

// --- Job Functions ---

export async function fetchJobFunctions() {
  if (isElectron()) {
    return electronDB()!.getJobFunctions();
  }
  const { data, error } = await supabase.from('job_functions').select('*').order('name');
  if (error) throw error;
  return data;
}
