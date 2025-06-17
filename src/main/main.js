// src/main/main.js - Main entry point
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const WindowManager = require('./managers/window-manager');
const ServiceManager = require('./managers/service-manager');
const IpcManager = require('./managers/ipc-manager');
const StoreManager = require('./managers/store-manager');

console.log('🚀 WhisperDesk Enhanced starting...');
console.log('🚀 Platform:', process.platform);
console.log('🚀 Electron version:', process.versions.electron);

// Handle macOS-specific Electron issues
if (process.platform === 'darwin') {
  // Note: AVCaptureDeviceTypeExternal deprecation warnings may appear during device enumeration
  // This is a known Electron/macOS issue with Continuity Cameras that will be resolved in future versions
  // The warnings are harmless and don't affect functionality
  console.log('ℹ️  Running on macOS - some AVCapture warnings are expected and harmless');
}

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  console.log('❌ Another instance is already running');
  app.quit();
  process.exit(0);
}

async function waitForDevServer(maxRetries = 30, retryInterval = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch('http://localhost:3000/');
      if (response.ok) {
        console.log('✅ Vite dev server is ready');
        return true;
      }
    } catch (error) {
      console.log(`⏳ Waiting for Vite dev server... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  return false;
}

class WhisperDeskApp {
  constructor() {
    this.windowManager = null;
    this.serviceManager = null;
    this.ipcManager = null;
    this.storeManager = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing WhisperDesk...');

      // Step 1: Initialize stores
      this.storeManager = new StoreManager();
      await this.storeManager.initialize();

      // Step 2: Initialize services
      this.serviceManager = new ServiceManager();
      await this.serviceManager.initialize();

      // Step 3: Setup IPC handlers
      this.ipcManager = new IpcManager(this.serviceManager);
      this.ipcManager.setupAllHandlers();

      // Wait for Vite dev server before creating window
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Waiting for Vite dev server...');
        const serverReady = await waitForDevServer();
        if (!serverReady) {
          console.error('❌ Vite dev server failed to start');
          app.quit();
          return;
        }
      }

      // Step 4: Create window manager
      this.windowManager = new WindowManager(this.serviceManager);
      await this.windowManager.createMainWindow();

      // Step 5: Setup event forwarding
      this.serviceManager.setupEventForwarding(this.windowManager.getMainWindow());

      // Add enhanced export IPC handler
      ipcMain.handle('export:enhancedTranscription', async (event, data, format, options) => {
        try {
          return await this.serviceManager.exportService.exportEnhancedTranscription(data, format, options);
        } catch (error) {
          console.error('Export failed:', error);
          return {
            success: false,
            error: error.message
          };
        }
      });

      console.log('✅ WhisperDesk initialization completed');
      return true;
    } catch (error) {
      console.error('❌ WhisperDesk initialization failed:', error);
      return false;
    }
  }

  getMainWindow() {
    return this.windowManager?.getMainWindow();
  }

  getServices() {
    return this.serviceManager?.getServices();
  }

  async shutdown() {
    console.log('🔧 Shutting down WhisperDesk...');
    
    if (this.serviceManager) {
      await this.serviceManager.cleanup();
    }
    
    if (this.ipcManager) {
      this.ipcManager.cleanup();
    }
    
    console.log('✅ WhisperDesk shutdown complete');
  }
}

// Global app instance
let whisperDeskApp = null;

// App lifecycle handlers
app.whenReady().then(async () => {
  console.log('🚀 App ready');
  
  whisperDeskApp = new WhisperDeskApp();
  const success = await whisperDeskApp.initialize();
  
  if (!success) {
    console.error('❌ Failed to initialize app');
    // Could show error dialog here
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (whisperDeskApp) {
      await whisperDeskApp.windowManager.createMainWindow();
    }
  }
});

app.on('before-quit', async () => {
  if (whisperDeskApp) {
    await whisperDeskApp.shutdown();
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