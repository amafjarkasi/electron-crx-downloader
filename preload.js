const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    
    // Directory selection
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    getDefaultDirectory: () => ipcRenderer.invoke('get-default-directory'),
    
    // Extension download
    downloadExtension: (extensionId, outputDir) => 
      ipcRenderer.invoke('download-extension', extensionId, outputDir),
    
    // Directory opening
    openDirectory: (dirPath) => ipcRenderer.invoke('open-directory', dirPath)
  }
);
