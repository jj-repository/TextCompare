const { contextBridge, ipcRenderer } = require('electron');

// Track listener to prevent accumulation on repeated calls
let downloadProgressHandler = null;

contextBridge.exposeInMainWorld('electron', {
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onDownloadProgress: (callback) => {
    // Remove previous listener to prevent memory leak
    if (downloadProgressHandler) {
      ipcRenderer.removeListener('download-progress', downloadProgressHandler);
    }
    downloadProgressHandler = (_, data) => callback(data);
    ipcRenderer.on('download-progress', downloadProgressHandler);
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setAutoUpdate: (enabled) => ipcRenderer.invoke('set-auto-update', enabled),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
