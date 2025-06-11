// src/main/main.js - Main entry point
const { app, BrowserWindow } = require('electron');
const path = require('path');

const WindowManager = require('./managers/window-manager');
const ServiceManager = require('./managers/service-manager');
const IpcManager = require('./managers/ipc-manager');
const StoreManager = require('./managers/store-manager');

console.log('🚀 WhisperDesk Enhanced starting...');
console.log('🚀 Platform:', process.platform);
console.log('🚀 Electron version:', process.versions.electron);

// Prevent multiple instances
if (!app.requestSingleInstanceLock()) {
  console.log('❌ Another instance is already running');
  app.quit();
  process.exit(0);
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

      // Step 4: Create window manager
      this.windowManager = new WindowManager(this.serviceManager);
      await this.windowManager.createMainWindow();

      // Step 5: Setup event forwarding
      this.serviceManager.setupEventForwarding(this.windowManager.getMainWindow());

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