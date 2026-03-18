const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('serverAPI', {
  getServerHealth: () => ipcRenderer.invoke('server:get-health'),
  getAgentConfig: () => ipcRenderer.invoke('server:get-agent-config'),
  setAgentToken: (token) => ipcRenderer.invoke('server:set-agent-token', token),
  removeAgentToken: () => ipcRenderer.invoke('server:remove-agent-token'),
  getDevices: () => ipcRenderer.invoke('server:get-devices'),
  addDevice: (data) => ipcRenderer.invoke('server:add-device', data),
  removeDevice: (id) => ipcRenderer.invoke('server:remove-device', id),
  testDeviceConnection: (ip) => ipcRenderer.invoke('server:test-device-connection', ip),
  triggerSync: () => ipcRenderer.invoke('server:trigger-sync'),
  getLogContent: () => ipcRenderer.invoke('server:get-log-content'),
  openFolder: (type) => ipcRenderer.invoke('server:open-folder', type),
});
