// src/main/main.js - FIXED VERSION with proper event forwarding
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const fs = require('fs');

// Services
const ModelManager = require('./services/model-manager');
const TranscriptionService = require('./services/transcription-service-native');
const AudioService = require('./services/audio-service');
const SettingsService = require('./services/settings-service');
const ExportService = require('./services/export-service');
const ScreenRecorder = require('./services/screen-recorder');
const SettingsStore = require('./services/settings-store');

// Initialize stores
const store = new Store();
const transcriptionStore = new Store({
  name: 'transcription',
  defaults: {
    activeTranscription: null
  }
});
const settingsStore = new SettingsStore();

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

// Global reference to the app instance
let whisperDeskApp = null;

class WhisperDeskApp {
  constructor() {
    if (whisperDeskApp) {
      console.log('App instance already exists, returning existing instance');
      return whisperDeskApp;
    }
    
    this.app = app;
    this.mainWindow = null;
    this.isQuitting = false;
    this.modelManager = null;
    this.transcriptionService = null;
    this.audioService = null;
    this.settingsService = null;
    this.screenRecorder = null;
    this.isInitialized = false;
    
    // Always clear transcription state when app starts
    if (transcriptionStore) {
      transcriptionStore.clear();
    }
    
    // Store the instance
    whisperDeskApp = this;
  }

  static getInstance() {
    if (!whisperDeskApp) {
      console.log('Creating new WhisperDesk app instance');
      whisperDeskApp = new WhisperDeskApp();
    } else {
      console.log('Using existing WhisperDesk app instance');
    }
    return whisperDeskApp;
  }

  setupBasicEventHandlers() {
    // App event handlers
    let initializationPromise = null;
    
    app.whenReady().then(async () => {
      if (this.isInitialized) {
        console.log('App already initialized, skipping initialization');
        return;
      }
      
      if (initializationPromise) {
        console.log('Initialization already in progress, waiting...');
        await initializationPromise;
        return;
      }
      
      initializationPromise = (async () => {
        try {
          // Initialize services first
          await this.initializeServices();
          
          // Set up IPC handlers after services are initialized
          this.setupIpcHandlers();
          
          // Create window and setup menu
          await this.createWindow();
          this.setupMenu();
          this.setupAutoUpdater();
          
          this.isInitialized = true;
          console.log('App initialization complete');
        } catch (error) {
          console.error('Error during initialization:', error);
          app.quit();
        } finally {
          initializationPromise = null;
        }
      })();
      
      await initializationPromise;
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // Only create window if not initialized
        if (!this.isInitialized) {
          await this.initializeServices();
          this.setupIpcHandlers();
          this.setupMenu();
          this.setupAutoUpdater();
          this.isInitialized = true;
        }
        await this.createWindow();
      } else if (this.mainWindow) {
        this.mainWindow.show();
      }
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
    });
  }

  async initializeServices() {
    try {
      // Initialize Model Manager
      this.modelManager = new ModelManager();
      await this.modelManager.initialize();
      console.log('✅ Model Manager initialized');
      
      // Initialize Transcription Service (graceful failure)
      this.transcriptionService = new TranscriptionService(this.modelManager);
      await this.transcriptionService.initialize();
      console.log('✅ Transcription Service initialized');
      
      // Initialize Audio Service
      this.audioService = new AudioService();
      await this.audioService.initialize();
      console.log('✅ Audio Service initialized');
      
      // Initialize Settings Service
      this.settingsService = new SettingsService();
      await this.settingsService.initialize();
      console.log('✅ Settings Service initialized');
      
      // Initialize Export Service
      this.exportService = new ExportService();
      await this.exportService.initialize();
      console.log('✅ Export Service initialized');

      // Initialize Screen Recorder
      this.screenRecorder = new ScreenRecorder();
      await this.screenRecorder.initialize();
      console.log('✅ Screen Recorder initialized');
      
      // Set up model manager events
      this.setupModelManagerEvents();
      
      // Set up transcription service events
      this.setupTranscriptionServiceEvents();
      
      console.log('✅ All services initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing services:', error);
      
      // Don't crash the whole app - initialize what we can
      console.warn('⚠️ Some services failed to initialize, continuing with limited functionality');
      
      // Ensure critical services are available even if they failed
      if (!this.modelManager) {
        console.warn('⚠️ Model Manager failed, creating minimal fallback');
        this.modelManager = { 
          getAvailableModels: () => Promise.resolve([]),
          getInstalledModels: () => Promise.resolve([])
        };
      }
      
      if (!this.settingsService) {
        console.warn('⚠️ Settings Service failed, creating minimal fallback');
        this.settingsService = {
          get: () => null,
          set: () => {},
          getAll: () => ({}),
          getTranscriptionSettings: () => ({ defaultModel: 'base', defaultProvider: 'whisper-native' })
        };
      }
      
      if (!this.transcriptionService) {
        console.warn('⚠️ Transcription Service failed, creating minimal fallback');
        this.transcriptionService = {
          getProviders: () => [
            { id: 'whisper-native', name: 'Native Whisper (Unavailable)', isAvailable: false },
            { id: 'deepgram', name: 'Deepgram (Unavailable)', isAvailable: false }
          ],
          processFile: () => Promise.reject(new Error('Transcription service unavailable'))
        };
      }
      
      // Continue initialization - don't throw
    }
  }

  setupTranscriptionServiceEvents() {
    // Forward transcription events to renderer process
    this.transcriptionService.on('progress', (data) => {
      console.log('Main: Transcription progress:', data);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('transcription:progress', data);
      }
    });

    this.transcriptionService.on('complete', (data) => {
      console.log('Main: Transcription complete:', data);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('transcription:complete', data);
      }
    });

    this.transcriptionService.on('error', (data) => {
      console.log('Main: Transcription error:', data);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('transcription:error', data);
      }
    });

    this.transcriptionService.on('start', (data) => {
      console.log('Main: Transcription started:', data);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('transcription:start', data);
      }
    });
  }

  async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 700,
      show: true,
      focus: true,
      center: true,
      alwaysOnTop: false,
      skipTaskbar: false,
      frame: false,      // No native frame on any platform
      titleBarStyle: 'hidden',  // Hidden title bar on all platforms
      trafficLightPosition: process.platform === 'darwin' ? { x: 20, y: 20 } : undefined,  // Position traffic lights on macOS only
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true
      },
      icon: path.join(__dirname, '../../resources/icon.png')
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
      await this.mainWindow.loadURL('http://localhost:3000');
      this.mainWindow.webContents.openDevTools();
    } else {
      const indexPath = path.join(__dirname, '../renderer/whisperdesk-ui/dist/index.html');
      await this.mainWindow.loadFile(indexPath);
    }

    // Platform-specific focus handling
    if (process.platform === 'win32') {
      this.mainWindow.once('ready-to-show', () => {
        this.mainWindow.show();
        this.mainWindow.focus();
      });
    } else {
      // For other platforms (macOS, Linux)
      this.mainWindow.once('ready-to-show', () => {
        this.mainWindow.show();
        if (process.platform === 'darwin') {
          this.mainWindow.focus();
        }
      });
    }

    // Handle window maximize/unmaximize
    this.mainWindow.on('maximize', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('window:maximized');
      }
    });

    this.mainWindow.on('unmaximize', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('window:unmaximized');
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window close
    this.mainWindow.on('close', (event) => {
      if (process.platform === 'darwin' && !this.isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });
  }

  setupMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Transcription',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.mainWindow.webContents.send('menu-new-transcription')
          },
          {
            label: 'Open Audio File',
            accelerator: 'CmdOrCtrl+O',
            click: () => this.handleOpenFile()
          },
          { type: 'separator' },
          {
            label: 'Export Transcription',
            accelerator: 'CmdOrCtrl+E',
            click: () => this.mainWindow.webContents.send('menu-export')
          },
          { type: 'separator' },
          {
            label: process.platform === 'darwin' ? 'Quit WhisperDesk' : 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              this.isQuitting = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectall' }
        ]
      },
      {
        label: 'Models',
        submenu: [
          {
            label: 'Model Marketplace',
            click: () => this.mainWindow.webContents.send('menu-model-marketplace')
          },
          {
            label: 'Manage Models',
            click: () => this.mainWindow.webContents.send('menu-manage-models')
          },
          { type: 'separator' },
          {
            label: 'Download Models',
            click: () => this.mainWindow.webContents.send('menu-download-models')
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About WhisperDesk',
            click: () => this.showAbout()
          },
          {
            label: 'Learn More',
            click: () => shell.openExternal('https://github.com/whisperdesk/whisperdesk-enhanced')
          }
        ]
      }
    ];

    if (process.platform === 'darwin') {
      template.unshift({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });

      // Window menu
      template[5].submenu = [
        { role: 'close' },
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ];
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupAutoUpdater() {
    if (process.env.NODE_ENV === 'production') {
      autoUpdater.checkForUpdatesAndNotify();
      
      autoUpdater.on('update-available', () => {
        this.mainWindow.webContents.send('update-available');
      });

      autoUpdater.on('update-downloaded', () => {
        this.mainWindow.webContents.send('update-downloaded');
      });
    }
  }

  setupModelManagerEvents() {
    // Forward ModelManager events to renderer process
    this.modelManager.on('downloadQueued', (downloadInfo) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('model:downloadQueued', downloadInfo);
      }
    });

    this.modelManager.on('downloadProgress', (progressData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('model:downloadProgress', progressData);
      }
    });

    this.modelManager.on('downloadComplete', (completeData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('model:downloadComplete', completeData);
      }
    });

    this.modelManager.on('downloadError', (errorData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('model:downloadError', errorData);
      }
    });

    this.modelManager.on('downloadCancelled', (cancelData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('model:downloadCancelled', cancelData);
      }
    });

    this.modelManager.on('modelDeleted', (deleteData) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('model:modelDeleted', deleteData);
      }
    });
  }

  setupIpcHandlers() {
    // Window controls
    ipcMain.on('window:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.on('window:maximize', () => {
      if (this.mainWindow?.isMaximized()) {
        this.mainWindow?.unmaximize();
      } else {
        this.mainWindow?.maximize();
      }
    });

    ipcMain.on('window:close', () => {
      this.mainWindow?.close();
    });

    // Add theme handler
    ipcMain.handle('window:setTheme', (event, theme) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // Apply theme changes
        this.updateTitleBarTheme(theme);
        // Send theme change event to renderer
        this.mainWindow.webContents.send('theme-changed', theme);
        return true;
      }
      return false;
    });

    // Model management
    ipcMain.handle('model:getAvailable', () => this.modelManager.getAvailableModels());
    ipcMain.handle('model:getInstalled', () => this.modelManager.getInstalledModels());
    ipcMain.handle('model:download', (event, modelId) => this.modelManager.downloadModel(modelId));
    ipcMain.handle('model:delete', (event, modelId) => this.modelManager.deleteModel(modelId));
    ipcMain.handle('model:getInfo', (event, modelId) => this.modelManager.getModelInfo(modelId));

    // Transcription
    ipcMain.handle('transcription:getActiveTranscription', () => {
      return transcriptionStore.get('activeTranscription');
    });

    ipcMain.handle('transcription:setActiveTranscription', (event, transcription) => {
      transcriptionStore.set('activeTranscription', transcription);
      return true;
    });

    ipcMain.handle('transcription:updateActiveTranscription', (event, updates) => {
      const currentTranscription = transcriptionStore.get('activeTranscription');
      if (currentTranscription) {
        const updatedTranscription = { ...currentTranscription, ...updates };
        transcriptionStore.set('activeTranscription', updatedTranscription);
        return updatedTranscription;
      }
      return null;
    });

    ipcMain.handle('transcription:clearActiveTranscription', () => {
      transcriptionStore.delete('activeTranscription');
      return true;
    });

    ipcMain.handle('transcription:processFile', async (event, filePath, options) => {
      try {
        console.log('Main: Processing file request:', filePath, options);
        
        // Ensure filePath is a string
        if (typeof filePath !== 'string') {
          throw new Error('Invalid file path: must be a string');
        }

        // Validate file exists using fs.promises
        await fs.promises.access(filePath);

        // Get transcription settings
        const transcriptionSettings = this.settingsService.getTranscriptionSettings();
        
        // Ensure model name is properly formatted
        let modelName = options.model || transcriptionSettings.defaultModel;
        if (!modelName.startsWith('whisper-')) {
          modelName = `whisper-${modelName}`;
        }
        
        // Merge settings with provided options
        const mergedOptions = {
          ...transcriptionSettings,
          ...options,
          model: modelName
        };

        console.log('Main: Processing file with options:', mergedOptions);
        
        // Process the file - events will be automatically forwarded
        const result = await this.transcriptionService.processFile(filePath, mergedOptions);
        
        console.log('Main: Transcription result received:', {
          textLength: result.text?.length || 0,
          segments: result.segments?.length || 0
        });
        
        return result;
      } catch (error) {
        console.error('Main: Error processing file:', error);
        
        // Emit error event
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('transcription:error', {
            error: error.message
          });
        }
        
        throw error;
      }
    });

    ipcMain.handle('transcription:getProviders', () => {
      return this.transcriptionService.getProviders();
    });

    // Audio
    ipcMain.handle('audio:getDevices', async () => {
      try {
        return await this.audioService.getDevices();
      } catch (error) {
        console.error('Error getting audio devices:', error);
        throw error;
      }
    });

    ipcMain.handle('audio:startRecording', async (event, deviceId) => {
      try {
        return await this.audioService.startRecording(deviceId);
      } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
      }
    });

    ipcMain.handle('audio:stopRecording', async () => {
      try {
        return await this.audioService.stopRecording();
      } catch (error) {
        console.error('Error stopping recording:', error);
        throw error;
      }
    });

    ipcMain.handle('audio:getWaveform', (event, filePath) => this.audioService.getWaveform(filePath));

    // Settings
    ipcMain.handle('settings:get', (event, key) => this.settingsService.get(key));
    ipcMain.handle('settings:set', (event, key, value) => this.settingsService.set(key, value));
    ipcMain.handle('settings:getAll', () => this.settingsService.getAll());

    // Export
    ipcMain.handle('export:text', (event, data, format) => this.exportService.exportText(data, format));
    ipcMain.handle('export:subtitle', (event, data, format) => this.exportService.exportSubtitle(data, format));
    ipcMain.handle('export:copy', (event, text) => this.exportService.copyToClipboard(text));

    // File operations
    ipcMain.handle('file:showOpenDialog', (event, options) => this.showOpenDialog(options));
    ipcMain.handle('file:showSaveDialog', (event, options) => this.showSaveDialog(options));

    // App operations
    ipcMain.handle('app:getVersion', () => app.getVersion());
    ipcMain.handle('app:restart', () => {
      autoUpdater.quitAndInstall();
    });

    // Debug IPC handler
    ipcMain.handle('debug:test', async () => {
      console.log('Debug IPC test called');
      return { success: true, message: 'IPC communication working' };
    });

    // Screen recording handlers
    ipcMain.handle('screenRecorder:startRecording', async (event, options) => {
      try {
        return await this.screenRecorder.startRecording(options);
      } catch (error) {
        console.error('Error starting screen recording:', error);
        throw error;
      }
    });

    ipcMain.handle('screenRecorder:stopRecording', async () => {
      try {
        return await this.screenRecorder.stopRecording();
      } catch (error) {
        console.error('Error stopping screen recording:', error);
        throw error;
      }
    });

    ipcMain.handle('screenRecorder:getStatus', () => {
      return {
        isRecording: this.screenRecorder.isRecording,
        duration: this.screenRecorder.isRecording ? Date.now() - this.screenRecorder.recordingStartTime : 0
      };
    });
  }

  async handleOpenFile() {
    const result = await dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'] },
        { name: 'Video Files', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      this.mainWindow.webContents.send('file-opened', result.filePaths[0]);
    }
  }

  async showOpenDialog(options) {
    const result = await dialog.showOpenDialog(this.mainWindow, options);
    return result;
  }

  async showSaveDialog(options) {
    const result = await dialog.showSaveDialog(this.mainWindow, options);
    return result;
  }

  showAbout() {
    dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'About WhisperDesk Enhanced',
      message: 'WhisperDesk Enhanced',
      detail: `Version: ${app.getVersion()}\\n\\nAdvanced cross-platform transcription application with model marketplace and speaker recognition.\\n\\nBuilt with Electron and modern web technologies.`
    });
  }
}

// Create the app instance and set up event handlers
const whisperDeskInstance = WhisperDeskApp.getInstance();
whisperDeskInstance.setupBasicEventHandlers();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});