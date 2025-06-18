// src/main/ipc-handlers/basic-handlers.js
const { ipcMain, shell } = require('electron');

class BasicHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up basic IPC handlers...');
    
    // Window controls
    this.setupWindowControls();
    
    // Shell access
    this.setupShellHandlers();
    
    // Debug handlers
    this.setupDebugHandlers();
    
    // Desktop capturer handlers
    this.setupDesktopCapturerHandlers();
    
    console.log('✅ Basic IPC handlers set up');
  }

  setupWindowControls() {
    ipcMain.on('window:minimize', () => {
      const mainWindow = this.getMainWindow();
      mainWindow?.minimize();
    });

    ipcMain.on('window:maximize', () => {
      const mainWindow = this.getMainWindow();
      if (mainWindow?.isMaximized()) {
        mainWindow?.unmaximize();
      } else {
        mainWindow?.maximize();
      }
    });

    ipcMain.on('window:close', () => {
      const mainWindow = this.getMainWindow();
      mainWindow?.close();
    });

    ipcMain.handle('window:isMaximized', () => {
      const mainWindow = this.getMainWindow();
      return mainWindow?.isMaximized() || false;
    });

    ipcMain.handle('window:isMinimized', () => {
      const mainWindow = this.getMainWindow();
      return mainWindow?.isMinimized() || false;
    });

    ipcMain.handle('window:getPlatform', () => process.platform);

    ipcMain.handle('window:setTheme', (event, theme) => {
      try {
        // Get store from service manager if available
        const stores = this.serviceManager?.storeManager?.stores;
        stores?.main?.set('theme', theme);
        
        const mainWindow = this.getMainWindow();
        mainWindow?.webContents.send('theme-changed', theme);
        return true;
      } catch (error) {
        console.error('❌ Failed to set theme:', error);
        return false;
      }
    });
  }

  setupShellHandlers() {
    ipcMain.handle('shell:openExternal', async (event, url) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to open external URL:', error);
        return { success: false, error: error.message };
      }
    });
  }

  setupDebugHandlers() {
    ipcMain.handle('debug:test', () => {
      return { 
        success: true, 
        message: 'Enhanced IPC working!',
        timestamp: new Date().toISOString(),
        platform: process.platform
      };
    });

    ipcMain.handle('debug:getServiceStatus', () => {
      const services = this.serviceManager?.getServices() || {};
      const status = {};
      
      Object.keys(services).forEach(serviceName => {
        const service = services[serviceName];
        status[serviceName] = {
          available: !!service,
          initialized: service && typeof service.initialize === 'function'
        };
      });
      
      return status;
    });
  }

  setupDesktopCapturerHandlers() {
    const { desktopCapturer } = require('electron');
    
    ipcMain.handle('desktopCapturer:getSources', async (event, options) => {
      try {
        console.log('🖥️ Getting desktop sources:', options);
        const sources = await desktopCapturer.getSources(options);
        console.log(`✅ Found ${sources.length} desktop sources`);
        return sources;
      } catch (error) {
        console.error('❌ Failed to get desktop sources:', error);
        return [];
      }
    });
  }

  getMainWindow() {
    // This would typically come from the window manager
    // For now, we'll get it from BrowserWindow
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    return windows.find(win => !win.isDestroyed()) || null;
  }

  cleanup() {
    // Remove any specific listeners if needed
    console.log('🔧 Cleaning up basic handlers');
  }
}

module.exports = BasicHandlers;