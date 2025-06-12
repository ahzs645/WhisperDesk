// src/main/ipc-handlers/file-handlers.js
const { ipcMain, dialog } = require('electron');

class FileHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up file IPC handlers...');
    
    ipcMain.handle('file:showOpenDialog', async (event, options) => {
      try {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
          return await dialog.showOpenDialog(mainWindow, options);
        } else {
          return await dialog.showOpenDialog(options);
        }
      } catch (error) {
        console.error('❌ Failed to show open dialog:', error);
        return { canceled: true, filePaths: [] };
      }
    });

    ipcMain.handle('file:showSaveDialog', async (event, options) => {
      try {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
          return await dialog.showSaveDialog(mainWindow, options);
        } else {
          return await dialog.showSaveDialog(options);
        }
      } catch (error) {
        console.error('❌ Failed to show save dialog:', error);
        return { canceled: true, filePath: undefined };
      }
    });

    ipcMain.handle('file:showMessageBox', async (event, options) => {
      try {
        const mainWindow = this.getMainWindow();
        if (mainWindow) {
          return await dialog.showMessageBox(mainWindow, options);
        } else {
          return await dialog.showMessageBox(options);
        }
      } catch (error) {
        console.error('❌ Failed to show message box:', error);
        return { response: 0, checkboxChecked: false };
      }
    });

    ipcMain.handle('file:showErrorBox', (event, title, content) => {
      try {
        dialog.showErrorBox(title, content);
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to show error box:', error);
        return { success: false, error: error.message };
      }
    });

    // FIXED: Add new handler for saving recording files directly
    ipcMain.handle('file:saveRecordingFile', async (event, options) => {
      try {
        const { data, path: targetPath } = options;
        
        // Convert array back to Buffer
        const buffer = Buffer.from(data);
        
        // Ensure directory exists
        const fs = require('fs').promises;
        const path = require('path');
        const dir = path.dirname(targetPath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.writeFile(targetPath, buffer);
        
        // Verify file was written
        const stats = await fs.stat(targetPath);
        
        console.log(`✅ Recording file saved: ${targetPath} (${Math.round(stats.size / 1024)}KB)`);
        
        return { 
          success: true, 
          actualPath: targetPath,
          size: stats.size
        };
        
      } catch (error) {
        console.error('❌ Failed to save recording file:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    });

    console.log('✅ File IPC handlers set up');
  }

  getMainWindow() {
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    return windows.find(win => !win.isDestroyed()) || null;
  }

  cleanup() {
    console.log('🔧 Cleaning up file handlers');
  }
}

module.exports = FileHandlers;