const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database CRUD
  db: {
    // Workers
    getWorkers: (filters) => ipcRenderer.invoke('db:getWorkers', filters),
    getWorkerById: (id) => ipcRenderer.invoke('db:getWorkerById', id),
    createWorker: (data) => ipcRenderer.invoke('db:createWorker', data),
    updateWorker: (id, data) => ipcRenderer.invoke('db:updateWorker', id, data),
    deleteWorker: (id) => ipcRenderer.invoke('db:deleteWorker', id),

    // Companies
    getCompanies: () => ipcRenderer.invoke('db:getCompanies'),
    getCompanyById: (id) => ipcRenderer.invoke('db:getCompanyById', id),
    createCompany: (data) => ipcRenderer.invoke('db:createCompany', data),
    updateCompany: (id, data) => ipcRenderer.invoke('db:updateCompany', id, data),
    deleteCompany: (id) => ipcRenderer.invoke('db:deleteCompany', id),

    // Projects
    getProjects: () => ipcRenderer.invoke('db:getProjects'),
    getProjectById: (id) => ipcRenderer.invoke('db:getProjectById', id),
    createProject: (data) => ipcRenderer.invoke('db:createProject', data),
    updateProject: (id, data) => ipcRenderer.invoke('db:updateProject', id, data),

    // Access Logs
    getAccessLogs: (filters) => ipcRenderer.invoke('db:getAccessLogs', filters),
    insertAccessLog: (data) => ipcRenderer.invoke('db:insertAccessLog', data),

    // Workers on board
    getWorkersOnBoard: (projectId) => ipcRenderer.invoke('db:getWorkersOnBoard', projectId),

    // Devices
    getDevices: (projectId) => ipcRenderer.invoke('db:getDevices', projectId),

    // Job Functions
    getJobFunctions: () => ipcRenderer.invoke('db:getJobFunctions'),
  },

  // Storage (local filesystem)
  storage: {
    uploadFile: (bucket, path, arrayBuffer) => ipcRenderer.invoke('storage:uploadFile', bucket, path, arrayBuffer),
    getFileUrl: (bucket, path) => ipcRenderer.invoke('storage:getFileUrl', bucket, path),
    resolveUrl: (storedUrl) => ipcRenderer.invoke('storage:resolveUrl', storedUrl),
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
