// src/main/ipc-handlers/export-handlers.js
const { ipcMain } = require('electron');

class ExportHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up export IPC handlers...');
    
    ipcMain.handle('export:text', async (event, data, format) => {
      try {
        const service = this.getExportService();
        if (service?.exportText) {
          return await service.exportText(data, format);
        } else {
          return { success: false, error: 'Export service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to export text:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('export:subtitle', async (event, data, format) => {
      try {
        const service = this.getExportService();
        if (service?.exportSubtitle) {
          return await service.exportSubtitle(data, format);
        } else {
          return { success: false, error: 'Export service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to export subtitle:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('export:copy', async (event, text) => {
      try {
        const service = this.getExportService();
        if (service?.copyToClipboard) {
          return await service.copyToClipboard(text);
        } else {
          // Fallback to direct clipboard access
          const { clipboard } = require('electron');
          clipboard.writeText(text);
          return true;
        }
      } catch (error) {
        console.error('❌ Failed to copy to clipboard:', error);
        return false;
      }
    });

    ipcMain.handle('export:saveToFile', async (event, data, filePath) => {
      try {
        const service = this.getExportService();
        if (service?.saveToFile) {
          return await service.saveToFile(data, filePath);
        } else {
          return { success: false, error: 'Export service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to save to file:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('export:getFormats', () => {
      try {
        const service = this.getExportService();
        if (service?.getAvailableFormats) {
          return service.getAvailableFormats();
        } else {
          // Return default formats
          return {
            text: ['txt', 'md', 'docx'],
            subtitle: ['srt', 'vtt', 'ass']
          };
        }
      } catch (error) {
        console.error('❌ Failed to get export formats:', error);
        return { text: [], subtitle: [] };
      }
    });

    console.log('✅ Export IPC handlers set up');
  }

  getExportService() {
    return this.serviceManager?.getService('exportService');
  }

  cleanup() {
    console.log('🔧 Cleaning up export handlers');
  }
}

module.exports = ExportHandlers;