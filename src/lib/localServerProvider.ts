/**
 * Local Server Provider
 * 
 * Makes HTTP requests to the dedicated local server (Express API)
 * instead of accessing SQLite directly. Used when running in Electron.
 * 
 * The local server URL is configured via:
 * - window.electronAPI.getServerUrl() 
 * - or defaults to http://localhost:3001
 */

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getServerUrl) {
    return (window as any).electronAPI.getServerUrl();
  }
  return 'http://localhost:3001';
};

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const base = getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

// --- Workers ---
export const localWorkers = {
  list: (filters?: Record<string, any>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch(`/api/workers${params}`);
  },
  getById: (id: string) => apiFetch(`/api/workers/${id}`),
  create: (data: Record<string, any>) => apiFetch('/api/workers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => apiFetch(`/api/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/workers/${id}`, { method: 'DELETE' }),
};

// --- Companies ---
export const localCompanies = {
  list: () => apiFetch('/api/companies'),
  getById: (id: string) => apiFetch(`/api/companies/${id}`),
  create: (data: Record<string, any>) => apiFetch('/api/companies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => apiFetch(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/companies/${id}`, { method: 'DELETE' }),
};

// --- Projects ---
export const localProjects = {
  list: () => apiFetch('/api/projects'),
  getById: (id: string) => apiFetch(`/api/projects/${id}`),
  create: (data: Record<string, any>) => apiFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => apiFetch(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
  getWorkersOnBoard: (id: string) => apiFetch(`/api/projects/${id}/workers-on-board`),
};

// --- Access Logs ---
export const localAccessLogs = {
  list: (filters?: Record<string, any>) => {
    const params = filters ? '?' + new URLSearchParams(filters).toString() : '';
    return apiFetch(`/api/access-logs${params}`);
  },
  insert: (data: Record<string, any>) => apiFetch('/api/access-logs', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Devices ---
export const localDevices = {
  list: (projectId?: string) => {
    const params = projectId ? `?projectId=${projectId}` : '';
    return apiFetch(`/api/devices${params}`);
  },
  getById: (id: string) => apiFetch(`/api/devices/${id}`),
  create: (data: Record<string, any>) => apiFetch('/api/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => apiFetch(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// --- Job Functions ---
export const localJobFunctions = {
  list: () => apiFetch('/api/job-functions'),
  create: (data: Record<string, any>) => apiFetch('/api/job-functions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => apiFetch(`/api/job-functions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/api/job-functions/${id}`, { method: 'DELETE' }),
};

// --- Storage ---
export const localStorage = {
  upload: async (bucket: string, filePath: string, file: File): Promise<string | null> => {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/storage/upload?bucket=${bucket}&path=${filePath}`, {
      method: 'POST',
      body: await file.arrayBuffer(),
    });
    if (!res.ok) return null;
    const { url } = await res.json();
    return `${base}${url}`;
  },
  getUrl: (bucket: string, filePath: string): string => {
    return `${getBaseUrl()}/files/${bucket}/${filePath}`;
  },
};

// --- Sync & Agent ---
export const localSync = {
  getStatus: () => apiFetch('/api/sync/status'),
  trigger: () => apiFetch('/api/sync/trigger', { method: 'POST' }),
};

export const localAgent = {
  getStatus: () => apiFetch('/api/sync/agent/status'),
  start: () => apiFetch('/api/sync/agent/start', { method: 'POST' }),
  stop: () => apiFetch('/api/sync/agent/stop', { method: 'POST' }),
};

// --- Health ---
export const localHealth = {
  check: () => apiFetch('/api/health'),
};
