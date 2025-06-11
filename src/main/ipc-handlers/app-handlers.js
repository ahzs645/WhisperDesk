// src/main/ipc-handlers/app-handlers.js
const { ipcMain, app } = require('electron');

class AppHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up app IPC handlers...');
    
    ipcMain.handle('app:getVersion', () => {
      try {
        return app.getVersion();
      } catch (error) {
        console.error('❌ Failed to get app version:', error);
        return '1.0.0'; // fallback version
      }
    });

    ipcMain.handle('app:getName', () => {
      try {
        return app.getName();
      } catch (error) {
        console.error('❌ Failed to get app name:', error);
        return 'WhisperDesk';
      }
    });

    ipcMain.handle('app:getPath', (event, name) => {
      try {
        return app.getPath(name);
      } catch (error) {
        console.error(`❌ Failed to get app path '${name}':`, error);
        return null;
      }
    });

    ipcMain.handle('app:restart', () => {
      try {
        console.log('🔄 Restarting application...');
        
        // Try to use autoUpdater if available
        try {
          const { autoUpdater } = require('electron-updater');
          if (autoUpdater?.quitAndInstall) {
            autoUpdater.quitAndInstall();
            return { success: true, method: 'autoUpdater' };
          }
        } catch (updaterError) {
          console.warn('⚠️ AutoUpdater not available, using app.relaunch');
        }
        
        // Fallback to app.relaunch
        app.relaunch();
        app.exit();
        return { success: true, method: 'relaunch' };
      } catch (error) {
        console.error('❌ Failed to restart app:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('app:quit', () => {
      try {
        console.log('🛑 Quitting application...');
        app.quit();
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to quit app:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('app:getSystemInfo', () => {
      try {
        return {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          electronVersion: process.versions.electron,
          chromeVersion: process.versions.chrome,
          v8Version: process.versions.v8
        };
      } catch (error) {
        console.error('❌ Failed to get system info:', error);
        return {
          platform: 'unknown',
          arch: 'unknown',
          nodeVersion: 'unknown',
          electronVersion: 'unknown',
          chromeVersion: 'unknown',
          v8Version: 'unknown'
        };
      }
    });

    ipcMain.handle('app:isPackaged', () => {
      try {
        return app.isPackaged;
      } catch (error) {
        console.error('❌ Failed to check if app is packaged:', error);
        return false;
      }
    });

    ipcMain.handle('app:focus', () => {
      try {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
          mainWindow.focus();
          return { success: true };
        }
        return { success: false, error: 'No main window available' };
      } catch (error) {
        console.error('❌ Failed to focus app:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('✅ App IPC handlers set up');
  }

  getMainWindow() {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    return windows.find(win => !win.isDestroyed()) || null;
  }

  cleanup() {
    console.log('🔧 Cleaning up app handlers');
  }
}

module.exports = AppHandlers;