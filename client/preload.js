const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Server URL va WebSocket URL ni qaytaradi */
  getConfig: () => ipcRenderer.invoke('get-config'),

  /** Favqulodda chiqish (faqat admin uchun) */
  forceQuit: () => ipcRenderer.send('force-quit'),
});
