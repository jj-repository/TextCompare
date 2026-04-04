const { contextBridge, ipcRenderer } = require('electron');

// Track listener to prevent accumulation on repeated calls
let downloadProgressHandler = null;

contextBridge.exposeInMainWorld('electron', {
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  onDownloadProgress: (callback) => {
    // Remove previous listener to prevent memory leak
    if (downloadProgressHandler) {
      ipcRenderer.removeListener('download-progress', downloadProgressHandler);
    }
    downloadProgressHandler = (_, data) => callback(data);
    ipcRenderer.on('download-progress', downloadProgressHandler);
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('download-progress', downloadProgressHandler);
      downloadProgressHandler = null;
    };
  },
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setAutoUpdate: (enabled) => ipcRenderer.invoke('set-auto-update', enabled),
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
