const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Model management
  model: {
    getAvailable: () => ipcRenderer.invoke('model:getAvailable'),
    getInstalled: () => ipcRenderer.invoke('model:getInstalled'),
    download: (modelId) => ipcRenderer.invoke('model:download', modelId),
    delete: (modelId) => ipcRenderer.invoke('model:delete', modelId),
    getInfo: (modelId) => ipcRenderer.invoke('model:getInfo', modelId),
    
    // Listen for download progress
    onDownloadProgress: (callback) => {
      ipcRenderer.on('model:downloadProgress', callback);
      return () => ipcRenderer.removeListener('model:downloadProgress', callback);
    },
    
    onDownloadComplete: (callback) => {
      ipcRenderer.on('model:downloadComplete', callback);
      return () => ipcRenderer.removeListener('model:downloadComplete', callback);
    },
    
    onDownloadError: (callback) => {
      ipcRenderer.on('model:downloadError', callback);
      return () => ipcRenderer.removeListener('model:downloadError', callback);
    }
  },

  // Transcription
  transcription: {
    start: (options) => ipcRenderer.invoke('transcription:start', options),
    stop: () => ipcRenderer.invoke('transcription:stop'),
    processFile: (filePath, options) => ipcRenderer.invoke('transcription:processFile', filePath, options),
    getProviders: () => ipcRenderer.invoke('transcription:getProviders'),
    
    // Listen for transcription events
    onProgress: (callback) => {
      ipcRenderer.on('transcription:progress', callback);
      return () => ipcRenderer.removeListener('transcription:progress', callback);
    },
    
    onResult: (callback) => {
      ipcRenderer.on('transcription:result', callback);
      return () => ipcRenderer.removeListener('transcription:result', callback);
    },
    
    onError: (callback) => {
      ipcRenderer.on('transcription:error', callback);
      return () => ipcRenderer.removeListener('transcription:error', callback);
    },
    
    onComplete: (callback) => {
      ipcRenderer.on('transcription:complete', callback);
      return () => ipcRenderer.removeListener('transcription:complete', callback);
    }
  },

  // Audio
  audio: {
    getDevices: () => ipcRenderer.invoke('audio:getDevices'),
    startRecording: (deviceId) => ipcRenderer.invoke('audio:startRecording', deviceId),
    stopRecording: () => ipcRenderer.invoke('audio:stopRecording'),
    getWaveform: (filePath) => ipcRenderer.invoke('audio:getWaveform', filePath),
    
    // Listen for audio events
    onData: (callback) => {
      ipcRenderer.on('audio:data', callback);
      return () => ipcRenderer.removeListener('audio:data', callback);
    },
    
    onLevel: (callback) => {
      ipcRenderer.on('audio:level', callback);
      return () => ipcRenderer.removeListener('audio:level', callback);
    }
  },

  // Settings
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    
    // Listen for settings changes
    onChange: (callback) => {
      ipcRenderer.on('settings:changed', callback);
      return () => ipcRenderer.removeListener('settings:changed', callback);
    }
  },

  // Export
  export: {
    text: (data, format) => ipcRenderer.invoke('export:text', data, format),
    subtitle: (data, format) => ipcRenderer.invoke('export:subtitle', data, format),
    copy: (text) => ipcRenderer.invoke('export:copy', text)
  },

  // File operations
  file: {
    showOpenDialog: (options) => ipcRenderer.invoke('file:showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('file:showSaveDialog', options),
    
    // Listen for file events
    onOpened: (callback) => {
      ipcRenderer.on('file-opened', callback);
      return () => ipcRenderer.removeListener('file-opened', callback);
    }
  },

  // App operations
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    restart: () => ipcRenderer.invoke('app:restart'),
    
    // Listen for app events
    onUpdateAvailable: (callback) => {
      ipcRenderer.on('update-available', callback);
      return () => ipcRenderer.removeListener('update-available', callback);
    },
    
    onUpdateDownloaded: (callback) => {
      ipcRenderer.on('update-downloaded', callback);
      return () => ipcRenderer.removeListener('update-downloaded', callback);
    }
  },

  // Menu events
  menu: {
    onNewTranscription: (callback) => {
      ipcRenderer.on('menu-new-transcription', callback);
      return () => ipcRenderer.removeListener('menu-new-transcription', callback);
    },
    
    onExport: (callback) => {
      ipcRenderer.on('menu-export', callback);
      return () => ipcRenderer.removeListener('menu-export', callback);
    },
    
    onModelMarketplace: (callback) => {
      ipcRenderer.on('menu-model-marketplace', callback);
      return () => ipcRenderer.removeListener('menu-model-marketplace', callback);
    },
    
    onManageModels: (callback) => {
      ipcRenderer.on('menu-manage-models', callback);
      return () => ipcRenderer.removeListener('menu-manage-models', callback);
    },
    
    onDownloadModels: (callback) => {
      ipcRenderer.on('menu-download-models', callback);
      return () => ipcRenderer.removeListener('menu-download-models', callback);
    }
  }
});

// Platform information
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  versions: process.versions
});

