// src/main/managers/ipc-manager.js
const { ipcMain } = require('electron');

const BasicHandlers = require('../ipc-handlers/basic-handlers');
const ModelHandlers = require('../ipc-handlers/model-handlers');
const TranscriptionHandlers = require('../ipc-handlers/transcription-handlers');
const ScreenRecorderHandlers = require('../ipc-handlers/screen-recorder-handlers');
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
      this.handlers.screenRecorder = new ScreenRecorderHandlers(this.serviceManager);
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

      console.log('✅ All IPC handlers set up successfully');
    } catch (error) {
      console.error('❌ Failed to setup IPC handlers:', error);
    }
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