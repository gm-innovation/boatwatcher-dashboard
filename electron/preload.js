const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database CRUD
  db: {
    getWorkers: (filters) => ipcRenderer.invoke('db:getWorkers', filters),
    getWorkerById: (id) => ipcRenderer.invoke('db:getWorkerById', id),
    createWorker: (data) => ipcRenderer.invoke('db:createWorker', data),
    updateWorker: (id, data) => ipcRenderer.invoke('db:updateWorker', id, data),
    deleteWorker: (id) => ipcRenderer.invoke('db:deleteWorker', id),
    getCompanies: () => ipcRenderer.invoke('db:getCompanies'),
    getCompanyById: (id) => ipcRenderer.invoke('db:getCompanyById', id),
    getProjects: () => ipcRenderer.invoke('db:getProjects'),
    getProjectById: (id) => ipcRenderer.invoke('db:getProjectById', id),
    getAccessLogs: (filters) => ipcRenderer.invoke('db:getAccessLogs', filters),
    insertAccessLog: (data) => ipcRenderer.invoke('db:insertAccessLog', data),
    getWorkersOnBoard: (projectId) => ipcRenderer.invoke('db:getWorkersOnBoard', projectId),
    getDevices: (projectId) => ipcRenderer.invoke('db:getDevices', projectId),
    getJobFunctions: () => ipcRenderer.invoke('db:getJobFunctions'),
  },

  // Sync engine
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    triggerSync: () => ipcRenderer.invoke('sync:trigger'),
  },

  // ControlID agent
  agent: {
    getStatus: () => ipcRenderer.invoke('agent:getStatus'),
    start: () => ipcRenderer.invoke('agent:start'),
    stop: () => ipcRenderer.invoke('agent:stop'),
  },

  // Connectivity
  isOnline: () => navigator.onLine,

  // Event listeners
  onSyncStatusChange: (callback) => {
    ipcRenderer.on('sync-status-changed', (_, status) => callback(status));
  },
  onConnectivityChange: (callback) => {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  },
});
