// src/main/ipc-handlers/transcription-handlers.js
const { ipcMain } = require('electron');

class TranscriptionHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up transcription IPC handlers...');
    
    ipcMain.handle('transcription:getProviders', () => {
      try {
        const service = this.getTranscriptionService();
        return service?.getProviders() || [];
      } catch (error) {
        console.error('❌ Failed to get transcription providers:', error);
        return [];
      }
    });

    ipcMain.handle('transcription:processFile', async (event, filePath, options) => {
      try {
        console.log('🎵 Processing file:', filePath);
        const service = this.getTranscriptionService();
        const settingsService = this.serviceManager?.getService('settingsService');
        
        const transcriptionSettings = settingsService?.getTranscriptionSettings() || {};
        const mergedOptions = { ...transcriptionSettings, ...options };
        
        if (service?.processFile) {
          return await service.processFile(filePath, mergedOptions);
        }
        throw new Error('Transcription service not available');
      } catch (error) {
        console.error('❌ Transcription failed:', error);
        throw error;
      }
    });

    ipcMain.handle('transcription:stop', (event, transcriptionId) => {
      try {
        const service = this.getTranscriptionService();
        return service?.cancelTranscription?.(transcriptionId) || { success: false };
      } catch (error) {
        console.error('❌ Failed to stop transcription:', error);
        return { success: false, error: error.message };
      }
    });

    console.log('✅ Transcription IPC handlers set up');
  }

  getTranscriptionService() {
    return this.serviceManager?.getService('transcriptionService');
  }

  cleanup() {
    console.log('🔧 Cleaning up transcription handlers');
  }
}

module.exports = TranscriptionHandlers;