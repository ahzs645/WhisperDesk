// src/main/preload.js - Unified preload script
const { contextBridge, ipcRenderer } = require('electron');

// Enhanced IPC wrapper with error handling and logging
const createSafeIPC = (channel) => {
  return (...args) => {
    console.log(`[IPC] ${channel}`, args.length > 0 ? args : '');
    return ipcRenderer.invoke(channel, ...args)
      .catch(error => {
        console.error(`[IPC Error] ${channel}:`, error);
        throw error;
      });
  };
};

// Create event listener with cleanup
const createEventListener = (channel) => {
  return (callback) => {
    const handler = (event, data) => {
      console.log(`[Event] ${channel}`, data);
      callback(data);
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  };
};

// Expose unified electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Model management
  model: {
    getAvailable: createSafeIPC('model:getAvailable'),
    getInstalled: createSafeIPC('model:getInstalled'),
    download: createSafeIPC('model:download'),
    delete: createSafeIPC('model:delete'),
    getInfo: createSafeIPC('model:getInfo'),
    
    // Model events
    onDownloadQueued: createEventListener('model:downloadQueued'),
    onDownloadProgress: createEventListener('model:downloadProgress'),
    onDownloadComplete: createEventListener('model:downloadComplete'),
    onDownloadError: createEventListener('model:downloadError'),
    onDownloadCancelled: createEventListener('model:downloadCancelled'),
    onModelDeleted: createEventListener('model:modelDeleted')
  },

  // Transcription with enhanced progress tracking
  transcription: {
    processFile: createSafeIPC('transcription:processFile'),
    start: createSafeIPC('transcription:start'),
    stop: createSafeIPC('transcription:stop'),
    getProviders: createSafeIPC('transcription:getProviders'),
    getActiveTranscription: createSafeIPC('transcription:getActiveTranscription'),
    setActiveTranscription: createSafeIPC('transcription:setActiveTranscription'),
    updateActiveTranscription: createSafeIPC('transcription:updateActiveTranscription'),
    clearActiveTranscription: createSafeIPC('transcription:clearActiveTranscription'),
    
    // Transcription events
    onProgress: createEventListener('transcription:progress'),
    onComplete: createEventListener('transcription:complete'),
    onError: createEventListener('transcription:error'),
    onResult: createEventListener('transcription:result'),
    onStart: createEventListener('transcription:start')
  },

  // Audio service
  audio: {
    getDevices: createSafeIPC('audio:getDevices'),
    startRecording: createSafeIPC('audio:startRecording'),
    stopRecording: createSafeIPC('audio:stopRecording'),
    getWaveform: createSafeIPC('audio:getWaveform'),
    
    // Audio events
    onData: createEventListener('audio:data'),
    onLevel: createEventListener('audio:level')
  },

  // Settings
  settings: {
    get: createSafeIPC('settings:get'),
    set: createSafeIPC('settings:set'),
    getAll: createSafeIPC('settings:getAll'),
    
    // Settings events
    onChange: createEventListener('settings:changed')
  },

  // Export functionality
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
    onOpened: createEventListener('file-opened')
  },

  // App operations
  app: {
    getVersion: createSafeIPC('app:getVersion'),
    restart: createSafeIPC('app:restart'),
    
    // App events
    onUpdateAvailable: createEventListener('update-available'),
    onUpdateDownloaded: createEventListener('update-downloaded')
  },

  // Menu events
  menu: {
    onNewTranscription: createEventListener('menu-new-transcription'),
    onExport: createEventListener('menu-export'),
    onModelMarketplace: createEventListener('menu-model-marketplace'),
    onManageModels: createEventListener('menu-manage-models'),
    onDownloadModels: createEventListener('menu-download-models')
  },

  // Debug utilities (useful for development)
  debug: {
    log: (message, data) => console.log('[Renderer]', message, data),
    testIPC: createSafeIPC('debug:test'),
    listChannels: () => {
      console.log('Available IPC channels:');
      console.log('Models:', Object.keys(contextBridge.exposeInMainWorld.model || {}));
      console.log('Transcription:', Object.keys(contextBridge.exposeInMainWorld.transcription || {}));
    }
  }
});

// Platform information
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  versions: process.versions,
  isWindows: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
});

// Enhanced error handling
window.addEventListener('error', (event) => {
  console.error('[Renderer Error]', {
    message: event.error?.message,
    stack: event.error?.stack,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', {
    reason: event.reason,
    promise: event.promise
  });
});

// Startup logging
console.log('[Preload] WhisperDesk Enhanced preload script loaded');
console.log('[Preload] Platform:', process.platform, process.arch);
console.log('[Preload] Electron version:', process.versions.electron);
console.log('[Preload] Node version:', process.versions.node);