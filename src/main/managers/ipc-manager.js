// src/main/managers/ipc-manager.js
const { ipcMain } = require('electron');

const BasicHandlers = require('../ipc-handlers/basic-handlers');
const ModelHandlers = require('../ipc-handlers/model-handlers');
const TranscriptionHandlers = require('../ipc-handlers/transcription-handlers');
// Note: Screen recorder handlers are now managed by the centralized system
const SettingsHandlers = require('../ipc-handlers/settings-handlers');
const FileHandlers = require('../ipc-handlers/file-handlers');
const ExportHandlers = require('../ipc-handlers/export-handlers');
const AppHandlers = require('../ipc-handlers/app-handlers');

class IpcManager {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
    this.handlers = {};
    this.registeredHandlers = new Set();
  }

  setupAllHandlers() {
    console.log('🔧 Setting up ALL IPC handlers...');
    
    try {
      // Initialize all handler modules
      this.handlers.basic = new BasicHandlers(this.serviceManager);
      this.handlers.model = new ModelHandlers(this.serviceManager);
      this.handlers.transcription = new TranscriptionHandlers(this.serviceManager);
      // Screen recorder handlers are managed by the centralized system
      this.handlers.settings = new SettingsHandlers(this.serviceManager);
      this.handlers.file = new FileHandlers(this.serviceManager);
      this.handlers.export = new ExportHandlers(this.serviceManager);
      this.handlers.app = new AppHandlers(this.serviceManager);

      // Setup all handlers
      Object.values(this.handlers).forEach(handler => {
        if (handler.setup) {
          handler.setup();
        }
      });

      // Setup screen recorder handlers
      this.setupScreenRecorderHandlers();

      console.log('✅ All IPC handlers set up successfully');
    } catch (error) {
      console.error('❌ Failed to setup IPC handlers:', error);
    }
  }

  setupScreenRecorderHandlers() {
    try {
      console.log('🔧 Setting up Screen Recorder IPC handlers...');
      
      // Get the screen recorder handlers from service manager
      const screenRecorderHandlers = this.serviceManager.getScreenRecorderHandlers();
      
      if (screenRecorderHandlers) {
        // The handlers are already set up in the ScreenRecorderHandlers class
        // We just need to ensure they're initialized
        console.log('✅ Screen Recorder IPC handlers available');
        console.log('🔍 Registered handlers count:', screenRecorderHandlers.registeredHandlers?.size || 0);
      } else {
        console.warn('⚠️ Screen Recorder handlers not available - setting up fallback handlers');
        console.log('🔍 Service manager exists:', !!this.serviceManager);
        console.log('🔍 Service manager screen recorder system:', !!this.serviceManager.screenRecorderSystem);
        
        // Set up emergency fallback handlers to prevent app crashes
        this.setupFallbackScreenRecorderHandlers();
      }
    } catch (error) {
      console.error('❌ Failed to set up Screen Recorder IPC handlers:', error);
      // Set up emergency fallback handlers to prevent app crashes
      this.setupFallbackScreenRecorderHandlers();
    }
  }

  setupFallbackScreenRecorderHandlers() {
    console.log('🚨 Setting up fallback Screen Recorder IPC handlers...');
    
    const { ipcMain } = require('electron');
    
    // Fallback getStatus handler
    ipcMain.handle('screenRecorder:getStatus', () => {
      console.log('📊 Fallback: Getting screen recorder status');
      return {
        isRecording: false,
        isPaused: false,
        currentRecordingId: null,
        platform: process.platform,
        method: 'fallback',
        capabilities: null,
        isInitialized: false,
        error: 'Screen recorder service not properly initialized'
      };
    });

    // Fallback for other essential handlers
    const fallbackHandlers = [
      'screenRecorder:startRecording',
      'screenRecorder:stopRecording',
      'screenRecorder:pauseRecording',
      'screenRecorder:resumeRecording',
      'screenRecorder:getAvailableScreens',
      'screenRecorder:checkPermissions',
      'screenRecorder:requestPermissions'
    ];

    fallbackHandlers.forEach(channel => {
      ipcMain.handle(channel, () => {
        console.log(`📊 Fallback: ${channel} called`);
        return {
          success: false,
          error: 'Screen recorder service not properly initialized',
          fallback: true
        };
      });
    });

    console.log('✅ Fallback Screen Recorder IPC handlers registered');
  }

  registerHandler(channel, handler) {
    if (this.registeredHandlers.has(channel)) {
      console.warn(`⚠️ Handler for ${channel} already registered, removing old one`);
      ipcMain.removeHandler(channel);
    }
    
    ipcMain.handle(channel, handler);
    this.registeredHandlers.add(channel);
  }

  registerListener(channel, handler) {
    if (this.registeredHandlers.has(channel)) {
      console.warn(`⚠️ Listener for ${channel} already registered, removing old one`);
      ipcMain.removeAllListeners(channel);
    }
    
    ipcMain.on(channel, handler);
    this.registeredHandlers.add(channel);
  }

  cleanup() {
    console.log('🔧 Cleaning up IPC handlers...');
    
    // Clean up screen recorder handlers
    const screenRecorderHandlers = this.serviceManager.getScreenRecorderHandlers();
    if (screenRecorderHandlers) {
      screenRecorderHandlers.cleanup();
    }
    
    // Remove all registered handlers
    this.registeredHandlers.forEach(channel => {
      try {
        ipcMain.removeHandler(channel);
        ipcMain.removeAllListeners(channel);
      } catch (error) {
        console.warn(`⚠️ Failed to remove handler for ${channel}:`, error.message);
      }
    });
    
    this.registeredHandlers.clear();
    
    // Cleanup handler modules
    Object.values(this.handlers).forEach(handler => {
      if (handler.cleanup) {
        handler.cleanup();
      }
    });
    
    this.handlers = {};
    console.log('✅ IPC cleanup complete');
  }
}

module.exports = IpcManager;