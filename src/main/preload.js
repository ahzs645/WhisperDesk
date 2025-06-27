// src/main/preload.js - Enhanced preload script with complete model events
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
  // Platform info (for backward compatibility)
  platform: process.platform,
  
  // Window controls with proper event handling
  window: {
    minimize: () => {
      console.log('[Preload] Window minimize called');
      ipcRenderer.send('window:minimize');
    },
    maximize: () => {
      console.log('[Preload] Window maximize called');
      ipcRenderer.send('window:maximize');
    },
    close: () => {
      console.log('[Preload] Window close called');
      ipcRenderer.send('window:close');
    },
    
    // State queries
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    isMinimized: () => ipcRenderer.invoke('window:isMinimized'),
    getPlatform: () => ipcRenderer.invoke('window:getPlatform'),
    
    // Theme handling
    setTheme: (theme) => ipcRenderer.invoke('window:setTheme', theme),
    onThemeChanged: (callback) => {
      const handler = (_, theme) => {
        console.log('[Preload] Theme changed:', theme);
        callback(theme);
      };
      ipcRenderer.on('theme-changed', handler);
      return () => ipcRenderer.removeListener('theme-changed', handler);
    },
    removeThemeListener: (callback) => {
      ipcRenderer.removeListener('theme-changed', callback);
    },
    
    // Window state events
    onMaximize: (callback) => {
      const handler = () => {
        console.log('[Preload] Window maximized');
        callback();
      };
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    },
    onUnmaximize: (callback) => {
      const handler = () => {
        console.log('[Preload] Window unmaximized');
        callback();
      };
      ipcRenderer.on('window:unmaximized', handler);
      return () => ipcRenderer.removeListener('window:unmaximized', handler);
    },
    removeMaximizeListener: (callback) => {
      ipcRenderer.removeListener('window:maximized', callback);
    },
    removeUnmaximizeListener: (callback) => {
      ipcRenderer.removeListener('window:unmaximized', callback);
    }
  },

  // Shell operations (needed for system preferences)
  shell: {
    openExternal: createSafeIPC('shell:openExternal')
  },

  // 🔴 ENHANCED: Complete model management with all event handlers
  model: {
    // Basic model operations
    getAvailable: createSafeIPC('model:getAvailable'),
    getInstalled: createSafeIPC('model:getInstalled'),
    download: createSafeIPC('model:download'),
    delete: createSafeIPC('model:delete'),
    getInfo: createSafeIPC('model:getInfo'),
    cancelDownload: createSafeIPC('model:cancelDownload'),
    getAllDownloadStates: createSafeIPC('model:getAllDownloadStates'),
    
    // 🔴 CRITICAL: All model event listeners that return cleanup functions
    onDownloadQueued: (callback) => {
      console.log('[Preload] Setting up downloadQueued listener');
      const handler = (event, data) => {
        console.log('[Preload] Model download queued:', data);
        callback(data);
      };
      ipcRenderer.on('model:downloadQueued', handler);
      
      // Return cleanup function
      return () => {
        console.log('[Preload] Removing downloadQueued listener');
        ipcRenderer.removeListener('model:downloadQueued', handler);
      };
    },

    onDownloadProgress: (callback) => {
      console.log('[Preload] Setting up downloadProgress listener');
      const handler = (event, data) => {
        console.log(`[Preload] Model download progress: ${data.modelId} - ${Math.round(data.progress)}%`);
        callback(data);
      };
      ipcRenderer.on('model:downloadProgress', handler);
      
      return () => {
        console.log('[Preload] Removing downloadProgress listener');
        ipcRenderer.removeListener('model:downloadProgress', handler);
      };
    },

    onDownloadComplete: (callback) => {
      console.log('[Preload] Setting up downloadComplete listener');
      const handler = (event, data) => {
        console.log('[Preload] Model download complete:', data);
        callback(data);
      };
      ipcRenderer.on('model:downloadComplete', handler);
      
      return () => {
        console.log('[Preload] Removing downloadComplete listener');
        ipcRenderer.removeListener('model:downloadComplete', handler);
      };
    },

    onDownloadError: (callback) => {
      console.log('[Preload] Setting up downloadError listener');
      const handler = (event, data) => {
        console.error('[Preload] Model download error:', data);
        callback(data);
      };
      ipcRenderer.on('model:downloadError', handler);
      
      return () => {
        console.log('[Preload] Removing downloadError listener');
        ipcRenderer.removeListener('model:downloadError', handler);
      };
    },

    onDownloadCancelled: (callback) => {
      console.log('[Preload] Setting up downloadCancelled listener');
      const handler = (event, data) => {
        console.log('[Preload] Model download cancelled:', data);
        callback(data);
      };
      ipcRenderer.on('model:downloadCancelled', handler);
      
      return () => {
        console.log('[Preload] Removing downloadCancelled listener');
        ipcRenderer.removeListener('model:downloadCancelled', handler);
      };
    },

    onModelDeleted: (callback) => {
      console.log('[Preload] Setting up modelDeleted listener');
      const handler = (event, data) => {
        console.log('[Preload] Model deleted:', data);
        callback(data);
      };
      ipcRenderer.on('model:modelDeleted', handler);
      
      return () => {
        console.log('[Preload] Removing modelDeleted listener');
        ipcRenderer.removeListener('model:modelDeleted', handler);
      };
    }
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
    onStart: createEventListener('transcription:start'),
    onCancelled: createEventListener('transcription:cancelled')
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

  // Complete screen recorder API with all missing methods
  screenRecorder: {
    // Recording operations
    startRecording: createSafeIPC('screenRecorder:startRecording'),
    stopRecording: createSafeIPC('screenRecorder:stopRecording'),
    pauseRecording: createSafeIPC('screenRecorder:pauseRecording'),
    resumeRecording: createSafeIPC('screenRecorder:resumeRecording'),
    getStatus: createSafeIPC('screenRecorder:getStatus'),
    
    // Device and recording management APIs
    getAvailableScreens: createSafeIPC('screenRecorder:getAvailableScreens'),
    getRecordings: createSafeIPC('screenRecorder:getRecordings'),
    deleteRecording: createSafeIPC('screenRecorder:deleteRecording'),
    forceCleanup: createSafeIPC('screenRecorder:forceCleanup'),
    updateAudioDevices: createSafeIPC('screenRecorder:updateAudioDevices'),
    validateDevices: createSafeIPC('screenRecorder:validateDevices'),
    checkPermissions: createSafeIPC('screenRecorder:checkPermissions'),
    requestPermissions: createSafeIPC('screenRecorder:requestPermissions'),
    validateRecording: createSafeIPC('screenRecorder:validateRecording'),
    handleError: createSafeIPC('screenRecorder:handleError'),
    
    // Additional methods from the requested API
    confirmComplete: createSafeIPC('screenRecorder:confirmComplete'),
    
    // Recording events
    onRecordingStarted: createEventListener('screenRecorder:started'),
    onRecordingValidated: createEventListener('screenRecorder:validated'),
    onRecordingCompleted: createEventListener('screenRecorder:completed'),
    onRecordingError: createEventListener('screenRecorder:error'),
    onRecordingPaused: createEventListener('screenRecorder:paused'),
    onRecordingResumed: createEventListener('screenRecorder:resumed'),
    onRecordingProgress: createEventListener('screenRecorder:progress')
  },

  // Desktop capturer for fallback screen enumeration
  desktopCapturer: {
    getSources: createSafeIPC('desktopCapturer:getSources')
  },

  // Settings
  settings: {
    get: createSafeIPC('settings:get'),
    set: createSafeIPC('settings:set'),
    getAll: createSafeIPC('settings:getAll'),
    
    // Specific setting groups
    getTranscriptionSettings: createSafeIPC('settings:getTranscriptionSettings'),
    setTranscriptionSettings: createSafeIPC('settings:setTranscriptionSettings'),
    getRecordingSettings: createSafeIPC('settings:getRecordingSettings'),
    setRecordingSettings: createSafeIPC('settings:setRecordingSettings'),
    getExportSettings: createSafeIPC('settings:getExportSettings'),
    
    // Settings events
    onChange: createEventListener('settings:changed')
  },

  // Export functionality
  export: {
    text: createSafeIPC('export:text'),
    subtitle: createSafeIPC('export:subtitle'),
    copy: createSafeIPC('export:copy')
  },

  // Enhanced File operations with complete API
  file: {
    showOpenDialog: createSafeIPC('file:showOpenDialog'),
    showSaveDialog: createSafeIPC('file:showSaveDialog'),
    
    // FIXED: Add new method for saving recording files
    saveRecordingFile: createSafeIPC('file:saveRecordingFile'),
    
    /**
     * Write a file to the file system
     * @param {string} filePath - Path where to save the file
     * @param {Buffer|string} data - File content as buffer or string
     */
    async writeFile(filePath, data) {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      try {
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // If no full path provided, save to default recordings directory
        if (!path.isAbsolute(filePath)) {
          const recordingsDir = path.join(os.homedir(), 'Documents', 'WhisperDesk Recordings');
          await fs.mkdir(recordingsDir, { recursive: true });
          filePath = path.join(recordingsDir, filePath);
        }
        
        // Write the file
        await fs.writeFile(filePath, data);
        
        console.log(`✅ File written to: ${filePath}`);
        return { success: true, path: filePath };
      } catch (error) {
        console.error('❌ Failed to write file:', error);
        throw error;
      }
    },

    /**
     * Read file from the file system
     * @param {string} filePath - Path to the file to read
     * @param {object} options - Read options (encoding, etc.)
     */
    async readFile(filePath, options = {}) {
      const fs = require('fs').promises;
      try {
        return await fs.readFile(filePath, options);
      } catch (error) {
        console.error('❌ Failed to read file:', error);
        throw error;
      }
    },

    /**
     * Check if file exists
     * @param {string} filePath - Path to check
     */
    async exists(filePath) {
      const fs = require('fs').promises;
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },

    /**
     * Get default recordings directory
     */
    getDefaultRecordingsDirectory: createSafeIPC('file:getDefaultRecordingsDirectory'),

    /**
     * Show item in folder (reveal in file manager)
     */
    showItemInFolder: createSafeIPC('file:showItemInFolder'),

    /**
     * Legacy method for backward compatibility
     */
    async fileExists(filePath) {
      return this.exists(filePath);
    },
    
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

  // Speaker recognition service
  speaker: {
    setSpeakerLabel: createSafeIPC('speaker-service:setSpeakerLabel'),
    getSpeakerLabel: createSafeIPC('speaker-service:getSpeakerLabel'),
    getAllSpeakers: createSafeIPC('speaker-service:getAllSpeakers'),
    deleteSpeaker: createSafeIPC('speaker-service:deleteSpeaker'),
    processDiarization: createSafeIPC('speaker-service:processDiarization'),
    
    // Speaker events
    onSpeakerLabelUpdated: createEventListener('speaker-label-updated'),
    onSpeakerCreated: createEventListener('speaker-created')
  },

  // Raw IPC access for custom event handling
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
  },

  // 🔴 ENHANCED: Debug utilities with model event testing
  debug: {
    log: (message, data) => console.log('[Renderer]', message, data),
    test: createSafeIPC('debug:test'),
    testIPC: createSafeIPC('debug:test'), // Alias for compatibility
    
    // Enhanced debug helpers
    listChannels: () => {
      console.log('🔍 Available IPC channels:');
      console.log('Screen Recorder:', [
        'startRecording', 'stopRecording', 'pauseRecording', 'resumeRecording',
        'getStatus', 'getAvailableScreens', 'getRecordings', 'deleteRecording'
      ]);
      console.log('Models:', [
        'getAvailable', 'getInstalled', 'download', 'delete', 'getInfo', 'cancelDownload'
      ]);
      console.log('Transcription:', [
        'processFile', 'start', 'stop', 'getProviders'
      ]);
    },
    
    listModelEvents: () => {
      console.log('🔍 Model event listeners:');
      console.log('- downloadQueued:', ipcRenderer.listenerCount('model:downloadQueued'));
      console.log('- downloadProgress:', ipcRenderer.listenerCount('model:downloadProgress'));
      console.log('- downloadComplete:', ipcRenderer.listenerCount('model:downloadComplete'));
      console.log('- downloadError:', ipcRenderer.listenerCount('model:downloadError'));
      console.log('- downloadCancelled:', ipcRenderer.listenerCount('model:downloadCancelled'));
      console.log('- modelDeleted:', ipcRenderer.listenerCount('model:modelDeleted'));
    },
    
    testModelEvents: () => {
      console.log('🧪 Testing model events...');
      
      // Set up temporary listeners to test if events are working
      const testListeners = [];
      
      const events = [
        'model:downloadQueued',
        'model:downloadProgress', 
        'model:downloadComplete',
        'model:downloadError',
        'model:downloadCancelled'
      ];
      
      events.forEach(event => {
        const handler = (_, data) => {
          console.log(`✅ Test received event ${event}:`, data);
        };
        ipcRenderer.on(event, handler);
        testListeners.push({ event, handler });
      });
      
      // Clean up test listeners after 30 seconds
      setTimeout(() => {
        testListeners.forEach(({ event, handler }) => {
          ipcRenderer.removeListener(event, handler);
        });
        console.log('🧹 Test listeners cleaned up');
      }, 30000);
      
      console.log('✅ Test listeners set up, will auto-cleanup in 30s');
    }
  }
});

// Platform information (separate namespace for better organization)
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
  versions: process.versions,
  isWindows: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
});

// 🔴 ENHANCED: Development debugging tools
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('debugModelEvents', {
    testProgressEvent: () => {
      console.log('[DEBUG] Testing progress event...');
      ipcRenderer.on('model:downloadProgress', (event, data) => {
        console.log('[DEBUG] Received progress event:', data);
      });
    },
    
    listAllListeners: () => {
      console.log('[DEBUG] Current event listeners:');
      console.log('- downloadProgress:', ipcRenderer.listenerCount('model:downloadProgress'));
      console.log('- downloadComplete:', ipcRenderer.listenerCount('model:downloadComplete'));
      console.log('- downloadError:', ipcRenderer.listenerCount('model:downloadError'));
      console.log('- downloadQueued:', ipcRenderer.listenerCount('model:downloadQueued'));
      console.log('- downloadCancelled:', ipcRenderer.listenerCount('model:downloadCancelled'));
    },
    
    injectTestProgress: () => {
      console.log('[DEBUG] Injecting test progress event...');
      // Simulate a progress event for testing
      setTimeout(() => {
        ipcRenderer.emit('model:downloadProgress', null, {
          modelId: 'test-model',
          progress: 50,
          downloadedBytes: 5000000,
          totalBytes: 10000000
        });
      }, 1000);
    }
  });
}

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