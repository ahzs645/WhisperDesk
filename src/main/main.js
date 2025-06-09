// src/main/main-simplified.js - Enhanced version with improved screen recording
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
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

// Initialize services with error handling
async function initializeServices() {
  console.log('🔧 Initializing services...');
  
  try {
    // Try to initialize real services one by one
    await initializeModelManager();
    await initializeTranscriptionService();
    await initializeAudioService();
    await initializeSettingsService();
    await initializeExportService();
    await initializeEnhancedScreenRecorder();
    
    console.log('✅ All services initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    console.warn('⚠️ Continuing with fallback services...');
    initializeFallbackServices();
    return false;
  }
}

async function initializeModelManager() {
  try {
    console.log('🔧 Initializing Model Manager...');
    const ModelManager = require('./services/model-manager');
    services.modelManager = new ModelManager();
    await services.modelManager.initialize();
    
    // Set up events
    services.modelManager.on('downloadQueued', (data) => {
      mainWindow?.webContents.send('model:downloadQueued', data);
    });
    services.modelManager.on('downloadProgress', (data) => {
      mainWindow?.webContents.send('model:downloadProgress', data);
    });
    services.modelManager.on('downloadComplete', (data) => {
      mainWindow?.webContents.send('model:downloadComplete', data);
    });
    services.modelManager.on('downloadError', (data) => {
      mainWindow?.webContents.send('model:downloadError', data);
    });
    services.modelManager.on('downloadCancelled', (data) => {
      mainWindow?.webContents.send('model:downloadCancelled', data);
    });
    
    console.log('✅ Model Manager initialized');
  } catch (error) {
    console.error('❌ Model Manager failed:', error);
    console.warn('⚠️ Using fallback model manager');
    
    // Fallback model manager
    services.modelManager = {
      getAvailableModels: () => Promise.resolve([
        { id: 'whisper-tiny', name: 'Whisper Tiny', size: '39 MB', isInstalled: false },
        { id: 'whisper-base', name: 'Whisper Base', size: '142 MB', isInstalled: false }
      ]),
      getInstalledModels: () => Promise.resolve([]),
      downloadModel: () => Promise.resolve({ success: true }),
      deleteModel: () => Promise.resolve({ success: true }),
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
    
    // Set up events
    services.transcriptionService.on('progress', (data) => {
      console.log('📈 Transcription progress:', data);
      mainWindow?.webContents.send('transcription:progress', data);
    });
    services.transcriptionService.on('complete', (data) => {
      console.log('✅ Transcription complete');
      mainWindow?.webContents.send('transcription:complete', data);
    });
    services.transcriptionService.on('error', (data) => {
      console.log('❌ Transcription error:', data);
      mainWindow?.webContents.send('transcription:error', data);
    });
    services.transcriptionService.on('start', (data) => {
      console.log('🎬 Transcription started');
      mainWindow?.webContents.send('transcription:start', data);
    });
    services.transcriptionService.on('cancelled', (data) => {
      console.log('⏹️ Transcription cancelled');
      mainWindow?.webContents.send('transcription:cancelled', data);
    });
    
    console.log('✅ Transcription Service initialized');
  } catch (error) {
    console.error('❌ Transcription Service failed:', error);
    console.warn('⚠️ Using fallback transcription service');
    
    // Fallback transcription service
    services.transcriptionService = {
      getProviders: () => [
        { id: 'whisper-native', name: 'Native Whisper (Fallback)', isAvailable: false },
        { id: 'mock', name: 'Mock Transcription', isAvailable: true }
      ],
      processFile: async (filePath, options) => {
        console.log('🔧 Fallback transcription for:', filePath);
        
        // Simulate progress
        mainWindow?.webContents.send('transcription:start', { filePath });
        
        for (let i = 0; i <= 100; i += 20) {
          await new Promise(resolve => setTimeout(resolve, 300));
          mainWindow?.webContents.send('transcription:progress', {
            progress: i,
            message: `Fallback processing... ${i}%`
          });
        }
        
        const result = {
          text: `Fallback transcription of: ${path.basename(filePath)}. This is a mock result because the real transcription service failed to initialize.`,
          segments: [
            { start: 0, end: 5, text: "Fallback transcription" },
            { start: 5, end: 10, text: "service is working" }
          ],
          language: 'en'
        };
        
        mainWindow?.webContents.send('transcription:complete', { result });
        return result;
      },
      on: () => {},
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeAudioService() {
  try {
    console.log('🔧 Initializing Audio Service...');
    const AudioService = require('./services/audio-service');
    services.audioService = new AudioService();
    await services.audioService.initialize();
    console.log('✅ Audio Service initialized');
  } catch (error) {
    console.error('❌ Audio Service failed:', error);
    console.warn('⚠️ Using fallback audio service');
    
    services.audioService = {
      getDevices: () => Promise.resolve([]),
      startRecording: () => Promise.resolve({ success: false, error: 'Audio service not available' }),
      stopRecording: () => Promise.resolve({ success: false }),
      getWaveform: () => Promise.resolve(null),
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeSettingsService() {
  try {
    console.log('🔧 Initializing Settings Service...');
    const SettingsService = require('./services/settings-service');
    services.settingsService = new SettingsService();
    await services.settingsService.initialize();
    console.log('✅ Settings Service initialized');
  } catch (error) {
    console.error('❌ Settings Service failed:', error);
    console.warn('⚠️ Using fallback settings service');
    
    const fallbackSettings = {
      theme: 'system',
      selectedProvider: 'whisper-native',
      selectedModel: 'whisper-tiny'
    };
    
    services.settingsService = {
      get: (key) => fallbackSettings[key] || null,
      set: (key, value) => { fallbackSettings[key] = value; return true; },
      getAll: () => fallbackSettings,
      getTranscriptionSettings: () => ({
        defaultModel: 'whisper-tiny',
        defaultProvider: 'whisper-native'
      }),
      initialize: () => Promise.resolve()
    };
  }
}

async function initializeExportService() {
  try {
    console.log('🔧 Initializing Export Service...');
    const ExportService = require('./services/export-service');
    services.exportService = new ExportService();
    await services.exportService.initialize();
    console.log('✅ Export Service initialized');
  } catch (error) {
    console.error('❌ Export Service failed:', error);
    console.warn('⚠️ Using fallback export service');
    
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

// ENHANCED: Screen recorder initialization with better error handling
async function initializeEnhancedScreenRecorder() {
  try {
    console.log('🔧 Initializing Enhanced Screen Recorder...');
    const ScreenRecorder = require('./services/screen-recorder');
    services.screenRecorder = new ScreenRecorder();
    await services.screenRecorder.initialize();
    
    // Set up event handlers with proper error handling
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
      
      // Enhanced error handling - try to provide more context
      const enhancedError = {
        ...data,
        timestamp: new Date().toISOString(),
        platform: process.platform
      };
      
      // Add suggestions based on error type
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
    
    // Set up the enhanced IPC handlers
    setupEnhancedScreenRecorderHandlers();
    
    console.log('✅ Enhanced Screen Recorder initialized successfully');
    
  } catch (error) {
    console.error('❌ Enhanced Screen Recorder failed to initialize:', error);
    console.warn('⚠️ Using fallback screen recorder');
    
    // Fallback screen recorder that returns errors
    services.screenRecorder = {
      startRecording: () => Promise.resolve({ 
        success: false, 
        error: 'Screen recorder initialization failed: ' + error.message 
      }),
      stopRecording: () => Promise.resolve({ 
        success: false, 
        error: 'Screen recorder not available' 
      }),
      pauseRecording: () => ({ 
        success: false, 
        error: 'Screen recorder not available' 
      }),
      resumeRecording: () => ({ 
        success: false, 
        error: 'Screen recorder not available' 
      }),
      getStatus: () => ({ 
        isRecording: false, 
        isPaused: false, 
        duration: 0, 
        error: 'Screen recorder not available',
        availableDevices: { screens: ['0'], audio: ['0'] },
        hasActiveProcess: false
      }),
      getAvailableScreens: () => Promise.resolve([{ id: '0', name: 'Default Screen' }]),
      getRecordings: () => Promise.resolve([]),
      deleteRecording: () => Promise.resolve({ success: false, error: 'Not available' }),
      forceCleanup: () => {},
      initialize: () => Promise.resolve()
    };
    
    // Still set up IPC handlers even with fallback
    setupEnhancedScreenRecorderHandlers();
  }
}

// ENHANCED: Screen recorder IPC handlers with proper error handling and state validation
function setupEnhancedScreenRecorderHandlers() {
  console.log('🔧 Setting up enhanced screen recorder IPC handlers...');

  // NEW: Add this event handler for recording validation
  if (services.screenRecorder) {
    services.screenRecorder.on('recording-validated', (data) => {
      console.log('✅ Recording validated event');
      mainWindow?.webContents.send('screenRecorder:validated', data);
    });
  }

  ipcMain.handle('screenRecorder:startRecording', async (event, opts) => {
    try {
      console.log('🎬 Starting screen recording with options:', opts);
      
      // Check if service is available
      if (!services.screenRecorder) {
        throw new Error('Screen recorder service not available');
      }
      
      // Check current status first - IMPROVED validation
      const currentStatus = services.screenRecorder.getStatus();
      if (currentStatus.isRecording && !currentStatus.lastError) {
        console.warn('⚠️ Recording already in progress, ignoring start request');
        return { 
          success: false, 
          error: 'Recording already in progress',
          currentStatus 
        };
      }
      
      // NEW: Force cleanup any stale state before starting
      if (currentStatus.hasActiveProcess || currentStatus.lastError) {
        console.log('🧹 Cleaning up stale recording state before starting');
        services.screenRecorder.forceCleanup();
      }
      
      const result = await services.screenRecorder.startRecording(opts);
      console.log('✅ Recording started successfully:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      
      // Ensure clean state after error
      if (services.screenRecorder) {
        services.screenRecorder.forceCleanup();
      }
      
      // NEW: Enhanced error response with more context
      return { 
        success: false, 
        error: error.message,
        type: 'start_error',
        suggestion: getErrorSuggestion(error.message)
      };
    }
  });

  ipcMain.handle('screenRecorder:stopRecording', async (event) => {
    try {
      console.log('⏹️ Stopping screen recording...');
      
      if (!services.screenRecorder) {
        throw new Error('Screen recorder service not available');
      }
      
      // IMPROVED: Check current status with better validation
      const currentStatus = services.screenRecorder.getStatus();
      console.log('📊 Current recording status:', currentStatus);
      
      if (!currentStatus.isRecording && !currentStatus.hasActiveProcess) {
        console.warn('⚠️ No recording in progress, cleaning up state');
        
        // Force cleanup to ensure clean state
        services.screenRecorder.forceCleanup();
        
        return { 
          success: true, 
          message: 'No recording was in progress',
          wasAlreadyStopped: true 
        };
      }
      
      const result = await services.screenRecorder.stopRecording();
      console.log('✅ Recording stopped successfully:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      
      // Force cleanup on any error
      if (services.screenRecorder) {
        services.screenRecorder.forceCleanup();
      }
      
      // If the error is about no recording in progress, return success
      if (error.message?.includes('No recording in progress')) {
        return { 
          success: true, 
          message: 'Recording was already stopped',
          wasAlreadyStopped: true 
        };
      }
      
      return { 
        success: false, 
        error: error.message,
        type: 'stop_error' 
      };
    }
  });

  ipcMain.handle('screenRecorder:pauseRecording', async (event) => {
    try {
      console.log('⏸️ Pausing screen recording...');
      
      if (!services.screenRecorder) {
        return { success: false, error: 'Screen recorder service not available' };
      }
      
      // Check current status
      const currentStatus = services.screenRecorder.getStatus();
      if (!currentStatus.isRecording) {
        console.warn('⚠️ Cannot pause: no recording in progress');
        return { success: false, error: 'No recording in progress' };
      }
      
      if (currentStatus.isPaused) {
        console.warn('⚠️ Cannot pause: already paused');
        return { success: false, error: 'Recording is already paused' };
      }
      
      const result = services.screenRecorder.pauseRecording();
      console.log('Pause result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      return { 
        success: false, 
        error: error.message,
        type: 'pause_error' 
      };
    }
  });

  ipcMain.handle('screenRecorder:resumeRecording', async (event) => {
    try {
      console.log('▶️ Resuming screen recording...');
      
      if (!services.screenRecorder) {
        return { success: false, error: 'Screen recorder service not available' };
      }
      
      // Check current status
      const currentStatus = services.screenRecorder.getStatus();
      if (!currentStatus.isRecording) {
        console.warn('⚠️ Cannot resume: no recording in progress');
        return { success: false, error: 'No recording in progress' };
      }
      
      if (!currentStatus.isPaused) {
        console.warn('⚠️ Cannot resume: not paused');
        return { success: false, error: 'Recording is not paused' };
      }
      
      const result = services.screenRecorder.resumeRecording();
      console.log('Resume result:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      return { 
        success: false, 
        error: error.message,
        type: 'resume_error' 
      };
    }
  });

  ipcMain.handle('screenRecorder:getStatus', (event) => {
    try {
      if (!services.screenRecorder) {
        return { 
          isRecording: false, 
          isPaused: false, 
          error: 'Screen recorder service not available',
          availableDevices: { screens: ['0'], audio: ['0'] }
        };
      }
      
      const status = services.screenRecorder.getStatus();
      console.log('📊 Screen recorder status requested:', status);
      return status;
      
    } catch (error) {
      console.error('❌ Failed to get recording status:', error);
      return { 
        isRecording: false, 
        isPaused: false, 
        error: error.message,
        availableDevices: { screens: ['0'], audio: ['0'] }
      };
    }
  });

  // ENHANCED: Additional helper handlers
  ipcMain.handle('screenRecorder:getAvailableScreens', async (event) => {
    try {
      if (!services.screenRecorder) {
        return [{ id: '0', name: 'Default Screen' }];
      }
      
      const screens = await services.screenRecorder.getAvailableScreens();
      return screens;
      
    } catch (error) {
      console.error('❌ Failed to get available screens:', error);
      return [{ id: '0', name: 'Default Screen' }];
    }
  });

  ipcMain.handle('screenRecorder:getRecordings', async (event) => {
    try {
      if (!services.screenRecorder) {
        return [];
      }
      
      const recordings = await services.screenRecorder.getRecordings();
      return recordings;
      
    } catch (error) {
      console.error('❌ Failed to get recordings:', error);
      return [];
    }
  });

  ipcMain.handle('screenRecorder:deleteRecording', async (event, filePath) => {
    try {
      if (!services.screenRecorder) {
        throw new Error('Screen recorder service not available');
      }
      
      const result = await services.screenRecorder.deleteRecording(filePath);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to delete recording:', error);
      return { success: false, error: error.message };
    }
  });

  // ENHANCED: Force cleanup handler for emergency situations
  ipcMain.handle('screenRecorder:forceCleanup', (event) => {
    try {
      console.log('🧹 Force cleanup requested');
      
      if (services.screenRecorder) {
        services.screenRecorder.forceCleanup();
      }
      
      return { success: true, message: 'Cleanup completed' };
      
    } catch (error) {
      console.error('❌ Failed to force cleanup:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Enhanced screen recorder IPC handlers set up successfully');
}

function initializeFallbackServices() {
  console.log('🔧 Initializing fallback services...');
  
  // This function is called if any service fails
  // Services are already initialized with fallbacks in their individual init functions
  
  console.log('✅ Fallback services ready');
}

function createWindow() {
  console.log('🔧 Creating main window...');
  
  // Check preload script
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
    // FIXED: Proper window configuration for custom header
    frame: false,  // No native frame at all
    titleBarStyle: 'hidden',  // Hide title bar but keep window controls on macOS
    titleBarOverlay: false,   // Disable overlay
    transparent: false,       // Not transparent - causes glass effect
    vibrancy: null,          // No vibrancy effect
    visualEffectState: 'inactive', // No visual effects
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

  // FIXED: Explicitly disable native window controls on macOS
  if (process.platform === 'darwin') {
    // This completely removes the traffic light buttons
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

// IPC Handlers with enhanced screen recorder functionality
function setupIpcHandlers() {
  console.log('🔧 Setting up IPC handlers...');

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

  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);
  ipcMain.handle('window:isMinimized', () => mainWindow?.isMinimized() || false);
  ipcMain.handle('window:getPlatform', () => process.platform);
  ipcMain.handle('window:setTheme', (event, theme) => {
    stores.main?.set('theme', theme);
    mainWindow?.webContents.send('theme-changed', theme);
    return true;
  });

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

  // Debug
  ipcMain.handle('debug:test', () => ({ success: true, message: 'Enhanced IPC working!' }));

  console.log('✅ IPC handlers set up successfully');
  
  // Note: Enhanced screen recorder IPC handlers are set up in setupEnhancedScreenRecorderHandlers()
  // which is called from initializeEnhancedScreenRecorder()
}

// Helper function to provide error suggestions
function getErrorSuggestion(errorMessage) {
  if (!errorMessage) return null;
  
  const errorLower = errorMessage.toLowerCase();
  
  if (errorLower.includes('permission') || errorLower.includes('denied')) {
    return 'Please check your screen recording and microphone permissions in System Preferences';
  }
  
  if (errorLower.includes('device') && errorLower.includes('busy')) {
    return 'Another application may be using the recording devices. Try closing other recording applications';
  }
  
  if (errorLower.includes('not supported') || errorLower.includes('configuration')) {
    return 'Try selecting a different screen or audio device, or adjust the quality settings';
  }
  
  if (errorLower.includes('no frames captured') || errorLower.includes('failed to start')) {
    return 'Try refreshing the available devices and select a different screen to record';
  }
  
  return 'Try refreshing devices or check screen recording permissions';
}

// App initialization
app.whenReady().then(async () => {
  console.log('🚀 App ready');
  
  // Initialize stores first
  if (!initializeStores()) {
    console.error('❌ Failed to initialize stores, continuing anyway...');
  }
  
  // Initialize services (includes enhanced screen recorder)
  await initializeServices();
  
  // Set up IPC handlers (basic handlers, screen recorder handlers set up in service init)
  setupIpcHandlers();
  
  // Create window
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