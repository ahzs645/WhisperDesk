// src/main/ipc-handlers/screen-recorder-handlers.js - FIXED: Add file confirmation handler
const { ipcMain, desktopCapturer } = require('electron');

class ScreenRecorderHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up screen recorder IPC handlers...');
    
    this.setupDeviceHandlers();
    this.setupRecordingHandlers();
    this.setupRecordingManagement();
    this.setupPermissionHandlers();
    
    console.log('✅ Screen recorder IPC handlers set up');
  }

  setupDeviceHandlers() {
    ipcMain.handle('screenRecorder:getAvailableScreens', async () => {
      try {
        const deviceManager = this.getDeviceManager();
        if (deviceManager?.getAvailableScreens) {
          return await deviceManager.getAvailableScreens();
        } else {
          // Fallback to direct desktopCapturer
          const sources = await desktopCapturer.getSources({ types: ['screen'] });
          return sources.map((source, index) => ({
            id: source.id,
            name: source.name || `Screen ${index + 1}`,
            type: 'screen'
          }));
        }
      } catch (error) {
        console.error('❌ Failed to get available screens:', error);
        return [{ id: 'screen:0', name: 'Primary Display', type: 'screen' }];
      }
    });

    ipcMain.handle('screenRecorder:updateAudioDevices', async (event, audioDevices) => {
      try {
        const deviceManager = this.getDeviceManager();
        if (deviceManager?.updateAudioDevices) {
          deviceManager.updateAudioDevices(audioDevices);
        }
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to update audio devices:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('screenRecorder:validateDevices', async (event, screenId, audioId) => {
      try {
        const deviceManager = this.getDeviceManager();
        if (deviceManager?.validateDeviceSelection) {
          return deviceManager.validateDeviceSelection(screenId, audioId);
        }
        return { valid: true, issues: [] };
      } catch (error) {
        console.error('❌ Failed to validate devices:', error);
        return { valid: false, issues: [error.message] };
      }
    });
  }

  setupRecordingHandlers() {
    ipcMain.handle('screenRecorder:startRecording', async (event, options) => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (!screenRecorder?.startRecording) {
          console.warn('⚠️ Screen recorder service not available');
          return {
            success: false,
            error: 'Screen recorder service not available. Please restart the application.',
            type: 'service_unavailable'
          };
        }

        // Validate devices if device manager is available
        const deviceManager = this.getDeviceManager();
        if (deviceManager?.validateDeviceSelection) {
          const validation = deviceManager.validateDeviceSelection(
            options.screenId,
            options.audioInputId
          );

          if (!validation.valid) {
            return {
              success: false,
              error: `Device validation failed: ${validation.issues.join(', ')}`,
              type: 'validation_error'
            };
          }
        }

        return await screenRecorder.startRecording(options);
      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        return {
          success: false,
          error: error.message,
          type: 'start_error',
          details: {
            platform: process.platform,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    ipcMain.handle('screenRecorder:stopRecording', async () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.stopRecording) {
          return await screenRecorder.stopRecording();
        } else {
          return { success: true, message: 'No recording was in progress' };
        }
      } catch (error) {
        console.error('❌ Failed to stop recording:', error);
        return { success: false, error: error.message, type: 'stop_error' };
      }
    });

    // FIXED: New handler for confirming recording completion with actual file path
    ipcMain.handle('screenRecorder:confirmComplete', async (event, actualFilePath) => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.confirmRecordingComplete) {
          return await screenRecorder.confirmRecordingComplete(actualFilePath);
        } else {
          return { success: false, error: 'Screen recorder service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to confirm recording completion:', error);
        return { success: false, error: error.message, type: 'confirm_error' };
      }
    });

    ipcMain.handle('screenRecorder:pauseRecording', async () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.pauseRecording) {
          return screenRecorder.pauseRecording();
        } else {
          return { success: false, error: 'Screen recorder service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to pause recording:', error);
        return { success: false, error: error.message, type: 'pause_error' };
      }
    });

    ipcMain.handle('screenRecorder:resumeRecording', async () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.resumeRecording) {
          return screenRecorder.resumeRecording();
        } else {
          return { success: false, error: 'Screen recorder service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to resume recording:', error);
        return { success: false, error: error.message, type: 'resume_error' };
      }
    });
  }

  setupRecordingManagement() {
    ipcMain.handle('screenRecorder:getStatus', () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.getStatus) {
          const status = screenRecorder.getStatus();
          
          // Add device information if device manager is available
          const deviceManager = this.getDeviceManager();
          if (deviceManager?.getFormattedDevices) {
            const deviceInfo = deviceManager.getFormattedDevices();
            status.availableDevices = deviceInfo;
          }
          
          console.log('📊 Enhanced screen recorder status requested:', status);
          return status;
        } else {
          console.warn('⚠️ Screen recorder service not available, returning fallback status');
          return this.getFallbackStatus();
        }
      } catch (error) {
        console.error('❌ Failed to get recording status:', error);
        return {
          isRecording: false,
          isPaused: false,
          duration: 0,
          error: error.message,
          availableDevices: { screens: [], audio: [] },
          hasActiveProcess: false,
          recordingValidated: false
        };
      }
    });

    ipcMain.handle('screenRecorder:getRecordings', async () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.getRecordings) {
          return await screenRecorder.getRecordings();
        } else {
          return [];
        }
      } catch (error) {
        console.error('❌ Failed to get recordings:', error);
        return [];
      }
    });

    ipcMain.handle('screenRecorder:deleteRecording', async (event, filePath) => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.deleteRecording) {
          return await screenRecorder.deleteRecording(filePath);
        } else {
          return { success: false, error: 'Screen recorder service not available' };
        }
      } catch (error) {
        console.error('❌ Failed to delete recording:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('screenRecorder:forceCleanup', () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.forceCleanup) {
          screenRecorder.forceCleanup();
          return { success: true, message: 'Cleanup completed' };
        } else {
          return { success: true, message: 'No service to clean up' };
        }
      } catch (error) {
        console.error('❌ Failed to force cleanup:', error);
        return { success: false, error: error.message };
      }
    });
  }

  setupPermissionHandlers() {
    ipcMain.handle('screenRecorder:checkPermissions', async () => {
      try {
        const deviceManager = this.getDeviceManager();
        if (deviceManager?.checkPermissions) {
          return await deviceManager.checkPermissions();
        }
        return { screen: 'unknown', microphone: 'unknown' };
      } catch (error) {
        console.error('❌ Failed to check permissions:', error);
        return { screen: 'unknown', microphone: 'unknown' };
      }
    });

    ipcMain.handle('screenRecorder:requestPermissions', async () => {
      try {
        const deviceManager = this.getDeviceManager();
        if (deviceManager?.requestPermissions) {
          return await deviceManager.requestPermissions();
        }
        return { screen: 'granted', microphone: 'granted' };
      } catch (error) {
        console.error('❌ Failed to request permissions:', error);
        return { screen: 'unknown', microphone: 'unknown' };
      }
    });

    // Validation and error handling
    ipcMain.handle('screenRecorder:validateRecording', async () => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.validateRecording) {
          screenRecorder.validateRecording();
          return { success: true };
        }
        return { success: false, error: 'Screen recorder service not available' };
      } catch (error) {
        console.error('❌ Failed to validate recording:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('screenRecorder:handleError', async (event, errorData) => {
      try {
        const screenRecorder = this.getScreenRecorder();
        if (screenRecorder?.handleRecordingError) {
          screenRecorder.handleRecordingError(errorData);
          return { success: true };
        }
        return { success: false, error: 'Screen recorder service not available' };
      } catch (error) {
        console.error('❌ Failed to handle recording error:', error);
        return { success: false, error: error.message };
      }
    });
  }

  getFallbackStatus() {
    return {
      isRecording: false,
      isPaused: false,
      duration: 0,
      error: 'Screen recorder service not available',
      availableDevices: {
        screens: ['screen:0'],
        audio: ['default'],
        deviceNames: {
          screens: { 'screen:0': 'Primary Display' },
          audio: { 'default': 'Default Audio Input' }
        }
      },
      hasActiveProcess: false,
      recordingValidated: false
    };
  }

  getScreenRecorder() {
    return this.serviceManager?.getService('screenRecorder');
  }

  getDeviceManager() {
    return this.serviceManager?.getService('deviceManager');
  }

  cleanup() {
    console.log('🔧 Cleaning up screen recorder handlers');
    // Remove any specific event listeners if needed
  }
}

module.exports = ScreenRecorderHandlers;