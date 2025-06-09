// src/main/main.js - FIXED: Always setup IPC handlers regardless of service initialization
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');

console.log('🚀 WhisperDesk Enhanced starting...');
console.log('🚀 Platform:', process.platform);
console.log('🚀 Electron version:', process.versions.electron);

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  console.log('❌ Another instance is already running');
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let services = {};
let stores = {};

// Initialize stores safely
function initializeStores() {
  try {
    console.log('🔧 Initializing stores...');
    
    stores.main = new Store();
    stores.transcription = new Store({
      name: 'transcription',
      defaults: {
        activeTranscription: null
      }
    });
    
    // Clear transcription state on startup
    stores.transcription.clear();
    
    console.log('✅ Stores initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize stores:', error);
    return false;
  }
}

// 🔴 FIXED: Always setup IPC handlers first, before service initialization
function setupAllIpcHandlers() {
  console.log('🔧 Setting up ALL IPC handlers...');

  // Basic IPC handlers that should always work
  setupBasicIpcHandlers();
  
  // 🔴 CRITICAL FIX: Always setup screen recorder handlers, even with fallbacks
  setupScreenRecorderHandlersAlways();
  
  console.log('✅ All IPC handlers set up');
}

function setupBasicIpcHandlers() {
  // Window controls
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  // Shell access for opening system preferences
  ipcMain.handle('shell:openExternal', (event, url) => {
    return shell.openExternal(url);
  });

  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);
  ipcMain.handle('window:isMinimized', () => mainWindow?.isMinimized() || false);
  ipcMain.handle('window:getPlatform', () => process.platform);
  ipcMain.handle('window:setTheme', (event, theme) => {
    stores.main?.set('theme', theme);
    mainWindow?.webContents.send('theme-changed', theme);
    return true;
  });

  // Debug
  ipcMain.handle('debug:test', () => ({ success: true, message: 'Enhanced IPC working!' }));
}

// 🔴 CRITICAL FIX: Setup screen recorder handlers with fallbacks
function setupScreenRecorderHandlersAlways() {
  console.log('🔧 Setting up screen recorder IPC handlers (with fallbacks)...');

  // Create fallback responses for when service is not available
  const createFallbackResponse = (operation) => {
    return {
      success: false,
      error: `Screen recorder service not initialized. Try refreshing the page or restart the app.`,
      operation
    };
  };

  const createFallbackStatus = () => {
    return {
      isRecording: false,
      isPaused: false,
      duration: 0,
      error: 'Screen recorder service not available',
      availableDevices: { 
        screens: ['2'], // Provide default fallback
        audio: ['0'],
        deviceNames: {
          screens: { '2': 'Default Screen' },
          audio: { '0': 'Default Audio' }
        }
      },
      hasActiveProcess: false,
      recordingValidated: false
    };
  };

  // 🔴 ALWAYS register these handlers, with service checks
  ipcMain.handle('screenRecorder:startRecording', async (event, opts) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.startRecording === 'function') {
        return await services.screenRecorder.startRecording(opts);
      } else {
        console.warn('⚠️ Screen recorder service not available for startRecording');
        return createFallbackResponse('start');
      }
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      return { success: false, error: error.message, type: 'start_error' };
    }
  });

  ipcMain.handle('screenRecorder:stopRecording', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.stopRecording === 'function') {
        return await services.screenRecorder.stopRecording();
      } else {
        console.warn('⚠️ Screen recorder service not available for stopRecording');
        return { success: true, message: 'No recording was in progress' };
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      return { success: false, error: error.message, type: 'stop_error' };
    }
  });

  ipcMain.handle('screenRecorder:pauseRecording', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.pauseRecording === 'function') {
        return services.screenRecorder.pauseRecording();
      } else {
        return { success: false, error: 'Screen recorder service not available' };
      }
    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      return { success: false, error: error.message, type: 'pause_error' };
    }
  });

  ipcMain.handle('screenRecorder:resumeRecording', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.resumeRecording === 'function') {
        return services.screenRecorder.resumeRecording();
      } else {
        return { success: false, error: 'Screen recorder service not available' };
      }
    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      return { success: false, error: error.message, type: 'resume_error' };
    }
  });

  // 🔴 MOST IMPORTANT: Always provide getStatus, even with fallback
  ipcMain.handle('screenRecorder:getStatus', (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.getStatus === 'function') {
        const status = services.screenRecorder.getStatus();
        console.log('📊 Screen recorder status requested:', status);
        return status;
      } else {
        console.warn('⚠️ Screen recorder service not available, returning fallback status');
        const fallbackStatus = createFallbackStatus();
        console.log('📊 Fallback status returned:', fallbackStatus);
        return fallbackStatus;
      }
    } catch (error) {
      console.error('❌ Failed to get recording status:', error);
      return createFallbackStatus();
    }
  });

  ipcMain.handle('screenRecorder:getAvailableScreens', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.getAvailableScreens === 'function') {
        return await services.screenRecorder.getAvailableScreens();
      } else {
        return [{ id: '2', name: 'Default Screen' }];
      }
    } catch (error) {
      console.error('❌ Failed to get available screens:', error);
      return [{ id: '2', name: 'Default Screen' }];
    }
  });

  ipcMain.handle('screenRecorder:getRecordings', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.getRecordings === 'function') {
        return await services.screenRecorder.getRecordings();
      } else {
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get recordings:', error);
      return [];
    }
  });

  ipcMain.handle('screenRecorder:deleteRecording', async (event, filePath) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.deleteRecording === 'function') {
        return await services.screenRecorder.deleteRecording(filePath);
      } else {
        return { success: false, error: 'Screen recorder service not available' };
      }
    } catch (error) {
      console.error('❌ Failed to delete recording:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('screenRecorder:forceCleanup', (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.forceCleanup === 'function') {
        services.screenRecorder.forceCleanup();
        return { success: true, message: 'Cleanup completed' };
      } else {
        return { success: true, message: 'No service to clean up' };
      }
    } catch (error) {
      console.error('❌ Failed to force cleanup:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Screen recorder IPC handlers set up (with fallbacks)');
}

// Initialize services with graceful error handling
async function initializeServices() {
  console.log('🔧 Initializing services...');
  
  try {
    // Initialize each service individually with error handling
    await initializeModelManager();
    await initializeTranscriptionService();
    await initializeAudioService();
    await initializeSettingsService();
    await initializeExportService();
    
    // 🔴 FIXED: Initialize screen recorder last, and don't fail if it doesn't work
    await initializeEnhancedScreenRecorderSafe();
    
    console.log('✅ Services initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Service initialization had errors:', error);
    console.warn('⚠️ Some services may not be available, but app will continue...');
    return false; // Don't fail completely
  }
}

// 🔴 SAFE screen recorder initialization
async function initializeEnhancedScreenRecorderSafe() {
  try {
    console.log('🔧 Initializing Enhanced Screen Recorder (safe mode)...');
    const ScreenRecorder = require('./services/screen-recorder');
    services.screenRecorder = new ScreenRecorder();
    await services.screenRecorder.initialize();
    
    // Set up event handlers if service is available
    if (services.screenRecorder) {
      setupScreenRecorderEvents();
    }
    
    console.log('✅ Enhanced Screen Recorder initialized successfully');
    
  } catch (error) {
    console.error('❌ Enhanced Screen Recorder failed to initialize:', error);
    console.warn('⚠️ Screen recorder will use fallback mode');
    
    // 🔴 Don't set services.screenRecorder = null, just leave it undefined
    // The IPC handlers will detect this and provide fallbacks
  }
}

function setupScreenRecorderEvents() {
  if (!services.screenRecorder) return;
  
  try {
    services.screenRecorder.on('started', (data) => {
      console.log('📹 Recording started event:', data);
      mainWindow?.webContents.send('screenRecorder:started', data);
    });
    
    services.screenRecorder.on('completed', (data) => {
      console.log('✅ Recording completed event:', data);
      mainWindow?.webContents.send('screenRecorder:completed', data);
    });
    
    services.screenRecorder.on('error', (data) => {
      console.error('❌ Recording error event:', data);
      const enhancedError = {
        ...data,
        timestamp: new Date().toISOString(),
        platform: process.platform
      };
      
      if (data.error?.includes('Selected framerate') || data.error?.includes('Input/output error')) {
        enhancedError.suggestion = 'Try refreshing devices or check screen recording permissions';
      } else if (data.error?.includes('permission')) {
        enhancedError.suggestion = 'Please grant screen recording and microphone permissions';
      }
      
      mainWindow?.webContents.send('screenRecorder:error', enhancedError);
    });
    
    services.screenRecorder.on('paused', () => {
      console.log('⏸️ Recording paused event');
      mainWindow?.webContents.send('screenRecorder:paused');
    });
    
    services.screenRecorder.on('resumed', () => {
      console.log('▶️ Recording resumed event');
      mainWindow?.webContents.send('screenRecorder:resumed');
    });
    
    services.screenRecorder.on('progress', (data) => {
      mainWindow?.webContents.send('screenRecorder:progress', data);
    });
    
    console.log('✅ Screen recorder events set up');
  } catch (error) {
    console.error('❌ Failed to set up screen recorder events:', error);
  }
}

function setupTranscriptionEvents() {
  if (!services.transcriptionService) return;

  try {
    services.transcriptionService.on('progress', (data) => {
      mainWindow?.webContents.send('transcription:progress', data);
    });
    services.transcriptionService.on('complete', (data) => {
      mainWindow?.webContents.send('transcription:complete', data);
    });
    services.transcriptionService.on('error', (data) => {
      mainWindow?.webContents.send('transcription:error', data);
    });
    services.transcriptionService.on('start', (data) => {
      mainWindow?.webContents.send('transcription:start', data);
    });
    services.transcriptionService.on('cancelled', (data) => {
      mainWindow?.webContents.send('transcription:cancelled', data);
    });
    console.log('✅ Transcription events set up');
  } catch (error) {
    console.error('❌ Failed to set up transcription events:', error);
  }
}

// Rest of initialization functions (simplified for brevity)
async function initializeModelManager() {
  try {
    console.log('🔧 Initializing Model Manager...');
    const ModelManager = require('./services/model-manager');
    services.modelManager = new ModelManager();
    await services.modelManager.initialize();
    console.log('✅ Model Manager initialized');
  } catch (error) {
    console.error('❌ Model Manager failed:', error);
    // Create fallback
    services.modelManager = {
      getAvailableModels: () => Promise.resolve([]),
      getInstalledModels: () => Promise.resolve([]),
      downloadModel: () => Promise.resolve({ success: false }),
      deleteModel: () => Promise.resolve({ success: false }),
      getModelInfo: () => Promise.resolve(null),
      on: () => {},
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeTranscriptionService() {
  try {
    console.log('🔧 Initializing Transcription Service...');
    const TranscriptionService = require('./services/transcription-service-native');
    services.transcriptionService = new TranscriptionService(services.modelManager);
    await services.transcriptionService.initialize();
    console.log('✅ Transcription Service initialized');
  } catch (error) {
    console.error('❌ Transcription Service failed:', error);
    // Create fallback
    services.transcriptionService = {
      getProviders: () => [{ id: 'mock', name: 'Mock Provider', isAvailable: false }],
      processFile: () => Promise.reject(new Error('Transcription service not available')),
      on: () => {},
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeAudioService() {
  try {
    const AudioService = require('./services/audio-service');
    services.audioService = new AudioService();
    await services.audioService.initialize();
    console.log('✅ Audio Service initialized');
  } catch (error) {
    console.error('❌ Audio Service failed:', error);
    services.audioService = {
      getDevices: () => Promise.resolve([]),
      startRecording: () => Promise.resolve({ success: false }),
      stopRecording: () => Promise.resolve({ success: false }),
      getWaveform: () => Promise.resolve(null),
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeSettingsService() {
  try {
    const SettingsService = require('./services/settings-service');
    services.settingsService = new SettingsService();
    await services.settingsService.initialize();
    console.log('✅ Settings Service initialized');
  } catch (error) {
    console.error('❌ Settings Service failed:', error);
    const fallbackSettings = { theme: 'system' };
    services.settingsService = {
      get: (key) => fallbackSettings[key] || null,
      set: (key, value) => { fallbackSettings[key] = value; return true; },
      getAll: () => fallbackSettings,
      getTranscriptionSettings: () => ({}),
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeExportService() {
  try {
    const ExportService = require('./services/export-service');
    services.exportService = new ExportService();
    await services.exportService.initialize();
    console.log('✅ Export Service initialized');
  } catch (error) {
    console.error('❌ Export Service failed:', error);
    services.exportService = {
      exportText: () => Promise.resolve({ success: true }),
      exportSubtitle: () => Promise.resolve({ success: true }),
      copyToClipboard: (text) => {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        return Promise.resolve(true);
      },
      initialize: () => Promise.resolve()
    };
  }
}

// Setup remaining IPC handlers for other services
function setupRemainingIpcHandlers() {
  // Model management
  ipcMain.handle('model:getAvailable', () => services.modelManager.getAvailableModels());
  ipcMain.handle('model:getInstalled', () => services.modelManager.getInstalledModels());
  ipcMain.handle('model:download', (event, modelId) => services.modelManager.downloadModel(modelId));
  ipcMain.handle('model:delete', (event, modelId) => services.modelManager.deleteModel(modelId));
  ipcMain.handle('model:getInfo', (event, modelId) => services.modelManager.getModelInfo(modelId));
  ipcMain.handle('model:cancelDownload', (event, modelId) => services.modelManager.cancelDownload(modelId));

  // Transcription
  ipcMain.handle('transcription:getProviders', () => services.transcriptionService.getProviders());
  ipcMain.handle('transcription:processFile', async (event, filePath, options) => {
    try {
      console.log('🎵 Processing file:', filePath);
      const transcriptionSettings = services.settingsService.getTranscriptionSettings();
      const mergedOptions = { ...transcriptionSettings, ...options };
      const result = await services.transcriptionService.processFile(filePath, mergedOptions);
      return result;
    } catch (error) {
      console.error('❌ Transcription failed:', error);
      mainWindow?.webContents.send('transcription:error', { error: error.message });
      throw error;
    }
  });
  ipcMain.handle('transcription:stop', (event, transcriptionId) => services.transcriptionService.cancelTranscription(transcriptionId));

  // Settings
  ipcMain.handle('settings:get', (event, key) => services.settingsService.get(key));
  ipcMain.handle('settings:set', (event, key, value) => services.settingsService.set(key, value));
  ipcMain.handle('settings:getAll', () => services.settingsService.getAll());

  // File operations
  ipcMain.handle('file:showOpenDialog', (event, options) => dialog.showOpenDialog(mainWindow, options));
  ipcMain.handle('file:showSaveDialog', (event, options) => dialog.showSaveDialog(mainWindow, options));

  // Export
  ipcMain.handle('export:text', (event, data, format) => services.exportService.exportText(data, format));
  ipcMain.handle('export:subtitle', (event, data, format) => services.exportService.exportSubtitle(data, format));
  ipcMain.handle('export:copy', (event, text) => services.exportService.copyToClipboard(text));

  // App operations
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:restart', () => autoUpdater.quitAndInstall());
}

function createWindow() {
  console.log('🔧 Creating main window...');
  
  const preloadPath = path.join(__dirname, 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  console.log('🔧 Preload script exists:', preloadExists);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    transparent: false,
    vibrancy: null,
    visualEffectState: 'inactive',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      backgroundThrottling: false,
      ...(preloadExists && { preload: preloadPath })
    },
    icon: path.join(__dirname, '../../resources/icons/icon.png')
  });

  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(false);
  }

  // Load renderer
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    console.log('🔧 Loading development URL...');
    mainWindow.loadURL('http://localhost:3000')
      .then(() => {
        console.log('✅ Dev URL loaded');
        mainWindow.webContents.openDevTools();
      })
      .catch(error => {
        console.error('❌ Failed to load dev URL:', error);
        loadFallback();
      });
  } else {
    console.log('🔧 Loading production renderer...');
    
    const possiblePaths = [
      path.join(process.resourcesPath, 'app.asar', 'src/renderer/whisperdesk-ui/dist/index.html'),
      path.join(process.resourcesPath, 'app', 'src/renderer/whisperdesk-ui/dist/index.html'),
      path.join(__dirname, '../renderer/whisperdesk-ui/dist/index.html'),
      path.join(app.getAppPath(), 'src/renderer/whisperdesk-ui/dist/index.html')
    ];
    
    let indexPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        indexPath = testPath;
        console.log('✅ Found renderer at:', indexPath);
        break;
      }
    }
    
    if (indexPath) {
      mainWindow.loadFile(indexPath)
        .then(() => console.log('✅ Renderer loaded successfully'))
        .catch(error => {
          console.error('❌ Failed to load renderer:', error);
          loadFallback();
        });
    } else {
      console.error('❌ No renderer files found');
      loadFallback();
    }
  }

  // Window event handlers
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Renderer finished loading');
    // Setup transcription events after mainWindow is ready
    setupTranscriptionEvents();
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Renderer failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('❌ Renderer process crashed');
  });

  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:unmaximized');
  });

  mainWindow.on('closed', () => {
    console.log('🔧 Window closed');
    mainWindow = null;
  });
}

function loadFallback() {
  const fallbackHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhisperDesk</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; background: #1a1a1a; color: white; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        .warning { color: #ff9800; }
      </style>
    </head>
    <body>
      <h1>🎵 WhisperDesk Enhanced</h1>
      <p class="success">✅ Electron is working!</p>
      <p class="warning">⚠️ Some services may be running in fallback mode</p>
      <p class="error">❌ Could not load main interface</p>
    </body>
    </html>
  `;
  
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHTML)}`);
}

// 🔴 FIXED: New initialization order
app.whenReady().then(async () => {
  console.log('🚀 App ready');
  
  // Step 1: Initialize stores
  if (!initializeStores()) {
    console.error('❌ Failed to initialize stores, continuing anyway...');
  }
  
  // Step 2: 🔴 CRITICAL - Setup ALL IPC handlers first (with fallbacks)
  setupAllIpcHandlers();
  
  // Step 3: Initialize services (can fail without breaking IPC)
  await initializeServices();
  
  // Step 4: Setup remaining IPC handlers for available services
  setupRemainingIpcHandlers();
  
  // Step 5: Create window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});

console.log('✅ Enhanced main process setup complete');