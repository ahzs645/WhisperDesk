const { contextBridge, ipcRenderer } = require('electron');

// Enhanced IPC wrapper with error handling and logging
const createSafeIPC = (channel) => {
  return (...args) => {
    console.log(`IPC Call: ${channel}`, args);
    return ipcRenderer.invoke(channel, ...args)
      .catch(error => {
        console.error(`IPC Error on ${channel}:`, error);
        throw error;
      });
  };
};

// Expose enhanced electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Model management with enhanced error handling
  model: {
    getAvailable: createSafeIPC('model:getAvailable'),
    getInstalled: createSafeIPC('model:getInstalled'),
    download: createSafeIPC('model:download'),
    delete: createSafeIPC('model:delete'),
    getInfo: createSafeIPC('model:getInfo'),
    
    // Event listeners with cleanup
    onDownloadProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:downloadProgress', handler);
      return () => ipcRenderer.removeListener('model:downloadProgress', handler);
    },
    
    onDownloadComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:downloadComplete', handler);
      return () => ipcRenderer.removeListener('model:downloadComplete', handler);
    },
    
    onDownloadQueued: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:downloadQueued', handler);
      return () => ipcRenderer.removeListener('model:downloadQueued', handler);
    },
    
    onDownloadError: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:downloadError', handler);
      return () => ipcRenderer.removeListener('model:downloadError', handler);
    },
    
    onDownloadCancelled: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:downloadCancelled', handler);
      return () => ipcRenderer.removeListener('model:downloadCancelled', handler);
    },
    
    onModelDeleted: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('model:modelDeleted', handler);
      return () => ipcRenderer.removeListener('model:modelDeleted', handler);
    }
  },

  // Transcription with progress tracking
  transcription: {
    processFile: createSafeIPC('transcription:processFile'),
    start: createSafeIPC('transcription:start'),
    stop: createSafeIPC('transcription:stop'),
    getProviders: createSafeIPC('transcription:getProviders'),
    getActiveTranscription: createSafeIPC('transcription:getActiveTranscription'),
    setActiveTranscription: createSafeIPC('transcription:setActiveTranscription'),
    updateActiveTranscription: createSafeIPC('transcription:updateActiveTranscription'),
    clearActiveTranscription: createSafeIPC('transcription:clearActiveTranscription'),
    
    // Progress events
    onProgress: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('transcription:progress', handler);
      return () => ipcRenderer.removeListener('transcription:progress', handler);
    },
    
    onComplete: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('transcription:complete', handler);
      return () => ipcRenderer.removeListener('transcription:complete', handler);
    },
    
    onError: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('transcription:error', handler);
      return () => ipcRenderer.removeListener('transcription:error', handler);
    },
    
    onResult: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('transcription:result', handler);
      return () => ipcRenderer.removeListener('transcription:result', handler);
    }
  },

  // Audio service
  audio: {
    getDevices: createSafeIPC('audio:getDevices'),
    startRecording: createSafeIPC('audio:startRecording'),
    stopRecording: createSafeIPC('audio:stopRecording'),
    getWaveform: createSafeIPC('audio:getWaveform'),
    
    // Audio events
    onData: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('audio:data', handler);
      return () => ipcRenderer.removeListener('audio:data', handler);
    },
    
    onLevel: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('audio:level', handler);
      return () => ipcRenderer.removeListener('audio:level', handler);
    }
  },

  // Settings
  settings: {
    get: createSafeIPC('settings:get'),
    set: createSafeIPC('settings:set'),
    getAll: createSafeIPC('settings:getAll'),
    
    // Settings events
    onChange: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('settings:changed', handler);
      return () => ipcRenderer.removeListener('settings:changed', handler);
    }
  },

  // Export
  export: {
    text: createSafeIPC('export:text'),
    subtitle: createSafeIPC('export:subtitle'),
    copy: createSafeIPC('export:copy')
  },

  // File operations
  file: {
    showOpenDialog: createSafeIPC('file:showOpenDialog'),
    showSaveDialog: createSafeIPC('file:showSaveDialog'),
    
    // File events
    onOpened: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('file-opened', handler);
      return () => ipcRenderer.removeListener('file-opened', handler);
    }
  },

  // App operations
  app: {
    getVersion: createSafeIPC('app:getVersion'),
    restart: createSafeIPC('app:restart'),
    
    // App events
    onUpdateAvailable: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update-available', handler);
      return () => ipcRenderer.removeListener('update-available', handler);
    },
    
    onUpdateDownloaded: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('update-downloaded', handler);
      return () => ipcRenderer.removeListener('update-downloaded', handler);
    }
  },

  // Menu events
  menu: {
    onNewTranscription: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('menu-new-transcription', handler);
      return () => ipcRenderer.removeListener('menu-new-transcription', handler);
    },
    
    onExport: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('menu-export', handler);
      return () => ipcRenderer.removeListener('menu-export', handler);
    },
    
    onModelMarketplace: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('menu-model-marketplace', handler);
      return () => ipcRenderer.removeListener('menu-model-marketplace', handler);
    },
    
    onManageModels: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('menu-manage-models', handler);
      return () => ipcRenderer.removeListener('menu-manage-models', handler);
    },
    
    onDownloadModels: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('menu-download-models', handler);
      return () => ipcRenderer.removeListener('menu-download-models', handler);
    }
  },

  // Debug utilities
  debug: {
    log: (message, data) => console.log('[Renderer]', message, data),
    testIPC: createSafeIPC('debug:test')
  }
});

// Platform information
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  versions: process.versions
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('Renderer Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

console.log('Enhanced preload script loaded');

