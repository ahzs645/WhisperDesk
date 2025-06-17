// src/main/ipc-handlers/file-handlers.js
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

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

    // FIXED: Handler for saving recording files - matches renderer call signature
    ipcMain.handle('file:saveRecordingFile', async (event, filePath, data) => {
      try {
        console.log('💾 saveRecordingFile called with:', {
          filePath: filePath,
          dataType: data ? data.constructor.name : 'undefined',
          dataLength: data ? data.length : 0
        });

        // Validate parameters
        if (!filePath) {
          throw new Error('File path is required');
        }
        
        if (!data) {
          throw new Error('Data is required');
        }

        // Ensure the file path is absolute
        let targetPath = filePath;
        if (!path.isAbsolute(filePath)) {
          // If relative path, use default recordings directory
          const defaultDir = path.join(os.homedir(), 'Documents', 'WhisperDesk Recordings');
          await fs.mkdir(defaultDir, { recursive: true });
          targetPath = path.join(defaultDir, filePath);
        } else {
          // Ensure directory exists for absolute paths
          const dir = path.dirname(targetPath);
          await fs.mkdir(dir, { recursive: true });
        }

        // Convert data to Buffer
        let buffer;
        if (Buffer.isBuffer(data)) {
          buffer = data;
        } else if (data instanceof Uint8Array || Array.isArray(data)) {
          buffer = Buffer.from(data);
        } else {
          throw new Error(`Unsupported data type: ${typeof data}. Expected Buffer, Uint8Array, or Array.`);
        }

        console.log('💾 Writing recording file:', {
          path: targetPath,
          bufferSize: buffer.length
        });

        // Write the file
        await fs.writeFile(targetPath, buffer);

        // Verify the file was written
        const stats = await fs.stat(targetPath);
        
        console.log(`✅ Recording file saved: ${targetPath} (${Math.round(stats.size / 1024)}KB)`);

        return {
          success: true,
          path: targetPath,
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

    // Add handler for getting default recordings directory
    ipcMain.handle('file:getDefaultRecordingsDirectory', async () => {
      try {
        const defaultDir = path.join(os.homedir(), 'Documents', 'WhisperDesk Recordings');
        await fs.mkdir(defaultDir, { recursive: true });
        return defaultDir;
      } catch (error) {
        console.error('❌ Failed to get default recordings directory:', error);
        // Fallback to Desktop
        return path.join(os.homedir(), 'Desktop');
      }
    });

    // Add handler for checking if file exists
    ipcMain.handle('file:exists', async (event, filePath) => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    });

    // Add handler for writing files (generic)
    ipcMain.handle('file:writeFile', async (event, filePath, data) => {
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Convert data to Buffer if needed
        let buffer;
        if (Buffer.isBuffer(data)) {
          buffer = data;
        } else if (data instanceof Uint8Array || Array.isArray(data)) {
          buffer = Buffer.from(data);
        } else if (typeof data === 'string') {
          buffer = Buffer.from(data, 'utf8');
        } else {
          throw new Error(`Unsupported data type: ${typeof data}`);
        }
        
        await fs.writeFile(filePath, buffer);
        return { success: true, path: filePath };
      } catch (error) {
        console.error('❌ Failed to write file:', error);
        return { success: false, error: error.message };
      }
    });

    // Add handler for reading files
    ipcMain.handle('file:readFile', async (event, filePath, options = {}) => {
      try {
        const data = await fs.readFile(filePath, options);
        return { success: true, data };
      } catch (error) {
        console.error('❌ Failed to read file:', error);
        return { success: false, error: error.message };
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
    // Remove all file-related handlers
    const fileChannels = [
      'file:showOpenDialog',
      'file:showSaveDialog',
      'file:showMessageBox',
      'file:showErrorBox',
      'file:saveRecordingFile',
      'file:getDefaultRecordingsDirectory',
      'file:exists',
      'file:writeFile',
      'file:readFile'
    ];
    
    fileChannels.forEach(channel => {
      try {
        ipcMain.removeHandler(channel);
      } catch (error) {
        // Handler might not exist, ignore
      }
    });
  }
}

module.exports = FileHandlers;