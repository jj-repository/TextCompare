const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
});
