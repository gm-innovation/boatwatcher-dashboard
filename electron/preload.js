const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Database CRUD (proxied to local server via main process)
  db: {
    getWorkers: (filters) => ipcRenderer.invoke('db:getWorkers', filters),
    getWorkerById: (id) => ipcRenderer.invoke('db:getWorkerById', id),
    createWorker: (data) => ipcRenderer.invoke('db:createWorker', data),
    updateWorker: (id, data) => ipcRenderer.invoke('db:updateWorker', id, data),
    deleteWorker: (id) => ipcRenderer.invoke('db:deleteWorker', id),

    getCompanies: () => ipcRenderer.invoke('db:getCompanies'),
    getCompanyById: (id) => ipcRenderer.invoke('db:getCompanyById', id),
    createCompany: (data) => ipcRenderer.invoke('db:createCompany', data),
    updateCompany: (id, data) => ipcRenderer.invoke('db:updateCompany', id, data),
    deleteCompany: (id) => ipcRenderer.invoke('db:deleteCompany', id),

    getProjects: () => ipcRenderer.invoke('db:getProjects'),
    getProjectById: (id) => ipcRenderer.invoke('db:getProjectById', id),
    createProject: (data) => ipcRenderer.invoke('db:createProject', data),
    updateProject: (id, data) => ipcRenderer.invoke('db:updateProject', id, data),

    getAccessLogs: (filters) => ipcRenderer.invoke('db:getAccessLogs', filters),
    insertAccessLog: (data) => ipcRenderer.invoke('db:insertAccessLog', data),

    getWorkersOnBoard: (projectId) => ipcRenderer.invoke('db:getWorkersOnBoard', projectId),
    getDevices: (projectId) => ipcRenderer.invoke('db:getDevices', projectId),
    getJobFunctions: () => ipcRenderer.invoke('db:getJobFunctions'),
  },

  // Sync engine (on local server)
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    bootstrap: (accessToken) => ipcRenderer.invoke('sync:bootstrap', accessToken),
    triggerSync: () => ipcRenderer.invoke('sync:trigger'),
  },

  // ControlID agent (on local server)
  agent: {
    getStatus: () => ipcRenderer.invoke('agent:getStatus'),
    start: () => ipcRenderer.invoke('agent:start'),
    stop: () => ipcRenderer.invoke('agent:stop'),
  },

  // App configuration
  getServerUrl: () => ipcRenderer.sendSync('config:getServerUrlSync'),
  setServerUrl: (url) => ipcRenderer.invoke('config:setServerUrl', url),

  // Update flow
  updater: {
    getStatus: () => ipcRenderer.invoke('updater:getStatus'),
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    installDownloadedUpdate: () => ipcRenderer.invoke('updater:installDownloadedUpdate'),
  },

  // Connectivity (checks local server reachability)
  isOnline: () => navigator.onLine,
  checkServer: () => ipcRenderer.invoke('app:isOnline'),

  // Renderer ready handshake
  appReady: () => ipcRenderer.send('app:renderer-ready'),

  // Event listeners
  onSyncStatusChange: (callback) => {
    ipcRenderer.on('sync-status-changed', (_, status) => callback(status));
  },
  onUpdaterStatusChange: (callback) => {
    ipcRenderer.on('updater:status', (_, status) => callback(status));
  },
  onConnectivityChange: (callback) => {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  },
});
