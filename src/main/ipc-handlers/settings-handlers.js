// src/main/ipc-handlers/settings-handlers.js
const { ipcMain } = require('electron');

class SettingsHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up settings IPC handlers...');
    
    ipcMain.handle('settings:get', (event, key) => {
      try {
        const service = this.getSettingsService();
        return service?.get(key) || null;
      } catch (error) {
        console.error(`❌ Failed to get setting '${key}':`, error);
        return null;
      }
    });

    ipcMain.handle('settings:set', (event, key, value) => {
      try {
        const service = this.getSettingsService();
        return service?.set(key, value) || false;
      } catch (error) {
        console.error(`❌ Failed to set setting '${key}':`, error);
        return false;
      }
    });

    ipcMain.handle('settings:getAll', () => {
      try {
        const service = this.getSettingsService();
        return service?.getAll() || {};
      } catch (error) {
        console.error('❌ Failed to get all settings:', error);
        return {};
      }
    });

    ipcMain.handle('settings:getTranscriptionSettings', () => {
      try {
        const service = this.getSettingsService();
        return service?.getTranscriptionSettings() || {};
      } catch (error) {
        console.error('❌ Failed to get transcription settings:', error);
        return {};
      }
    });

    ipcMain.handle('settings:setTranscriptionSettings', (event, settings) => {
      try {
        const service = this.getSettingsService();
        if (service?.setTranscriptionSettings) {
          return service.setTranscriptionSettings(settings);
        }
        return false;
      } catch (error) {
        console.error('❌ Failed to set transcription settings:', error);
        return false;
      }
    });

    ipcMain.handle('settings:getRecordingSettings', () => {
      try {
        const service = this.getSettingsService();
        return service?.getRecordingSettings() || {};
      } catch (error) {
        console.error('❌ Failed to get recording settings:', error);
        return {};
      }
    });

    ipcMain.handle('settings:setRecordingSettings', (event, settings) => {
      try {
        const service = this.getSettingsService();
        if (service?.setRecordingSettings) {
          return service.setRecordingSettings(settings);
        }
        return false;
      } catch (error) {
        console.error('❌ Failed to set recording settings:', error);
        return false;
      }
    });

    ipcMain.handle('settings:getExportSettings', () => {
      try {
        const service = this.getSettingsService();
        return service?.getExportSettings() || {};
      } catch (error) {
        console.error('❌ Failed to get export settings:', error);
        return {};
      }
    });

    console.log('✅ Settings IPC handlers set up');
  }

  getSettingsService() {
    return this.serviceManager?.getService('settingsService');
  }

  cleanup() {
    console.log('🔧 Cleaning up settings handlers');
  }
}

module.exports = SettingsHandlers;