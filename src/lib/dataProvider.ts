/**
 * Data Provider Abstraction Layer
 * 
 * Detects if running inside Electron (desktop) or browser (web).
 * - Browser: uses Supabase client directly
 * - Electron: uses SQLite via IPC bridge (window.electronAPI)
 * 
 * All hooks in the app should use this layer instead of importing supabase directly.
 */

export interface UpdaterStatus {
  configured: boolean;
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  version: string | null;
  progress: number;
  error: string | null;
}

export const isElectron = (): boolean => {
  return !!(window as any).electronAPI;
};

export const isOnline = (): boolean => {
  if (isElectron()) {
    return (window as any).electronAPI?.isOnline?.() ?? navigator.onLine;
  }
  return navigator.onLine;
};

// Generic CRUD interface that both Supabase and SQLite implement
export interface DataProvider {
  // Workers
  getWorkers: (filters?: Record<string, any>) => Promise<any[]>;
  getWorkerById: (id: string) => Promise<any | null>;
  createWorker: (data: any) => Promise<any>;
  updateWorker: (id: string, data: any) => Promise<any>;
  deleteWorker: (id: string) => Promise<void>;

  // Companies
  getCompanies: () => Promise<any[]>;
  getCompanyById: (id: string) => Promise<any | null>;

  // Projects
  getProjects: () => Promise<any[]>;
  getProjectById: (id: string) => Promise<any | null>;

  // Access Logs
  getAccessLogs: (filters?: Record<string, any>) => Promise<any[]>;
  insertAccessLog: (data: any) => Promise<any>;

  // Workers on board
  getWorkersOnBoard: (projectId: string) => Promise<any[]>;

  // Devices
  getDevices: (projectId?: string) => Promise<any[]>;

  // Job Functions
  getJobFunctions: () => Promise<any[]>;
}

/**
 * Get the appropriate data provider based on environment.
 * In web mode, components continue using Supabase hooks directly.
 * In Electron mode, the electronAPI bridge provides SQLite access.
 */
export const getElectronAPI = () => {
  if (!isElectron()) return null;
  return (window as any).electronAPI as {
    db: DataProvider;
    sync: {
      getStatus: () => Promise<{
        online: boolean;
        lastSync: string | null;
        pendingCount: number;
        syncing?: boolean;
        configured?: boolean;
        mode?: 'cloud-sync' | 'local-only';
        message?: string;
      }>;
      triggerSync: () => Promise<void>;
    };
    agent: {
      getStatus: () => Promise<{ running: boolean; devicesCount: number }>;
      start: () => Promise<void>;
      stop: () => Promise<void>;
    };
    updater: {
      getStatus: () => Promise<UpdaterStatus>;
      checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>;
      installDownloadedUpdate: () => Promise<boolean>;
    };
    getServerUrl: () => Promise<string>;
    setServerUrl: (url: string) => Promise<boolean>;
    getUpdateUrl: () => Promise<string>;
    setUpdateUrl: (url: string) => Promise<boolean>;
    isOnline: () => boolean;
    onSyncStatusChange: (callback: (status: any) => void) => void;
    onUpdaterStatusChange: (callback: (status: UpdaterStatus) => void) => void;
    onConnectivityChange: (callback: (online: boolean) => void) => void;
  };
};
