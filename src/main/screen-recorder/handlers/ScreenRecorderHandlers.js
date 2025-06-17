/**
 * @fileoverview Centralized IPC handlers for screen recorder functionality
 */

const { ipcMain, desktopCapturer } = require('electron');
const { ERROR_TYPES } = require('../types');

/**
 * Centralized screen recorder IPC handlers
 * Handles all IPC communication for screen recording functionality
 */
class ScreenRecorderHandlers {
  constructor(screenRecorderService) {
    this.screenRecorderService = screenRecorderService;
  }

  /**
   * Set up all IPC handlers
   */
  setup() {
    console.log('🔧 Setting up centralized screen recorder IPC handlers...');
    
    this.setupDeviceHandlers();
    this.setupRecordingHandlers();
    this.setupRecordingManagement();
    this.setupPermissionHandlers();
    this.setupFileHandlers();
    
    console.log('✅ Centralized screen recorder IPC handlers set up');
  }

  /**
   * Set up device-related IPC handlers
   */
  setupDeviceHandlers() {
    // Get available screens
    ipcMain.handle('screenRecorder:getAvailableScreens', async () => {
      try {
        if (this.screenRecorderService) {
          return await this.screenRecorderService.getAvailableScreens(true);
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

    // Update audio devices from renderer
    ipcMain.handle('screenRecorder:updateAudioDevices', async (event, audioDevices) => {
      try {
        if (this.screenRecorderService) {
          this.screenRecorderService.updateAudioDevices(audioDevices);
        }
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to update audio devices:', error);
        return { success: false, error: error.message };
      }
    });

    // Validate device selection
    ipcMain.handle('screenRecorder:validateDevices', async (event, screenId, audioId) => {
      try {
        if (this.screenRecorderService) {
          return this.screenRecorderService.validateDeviceSelection(screenId, audioId);
        }
        return { valid: true, issues: [] };
      } catch (error) {
        console.error('❌ Failed to validate devices:', error);
        return { valid: false, issues: [error.message] };
      }
    });
  }

  /**
   * Set up recording control IPC handlers
   */
  setupRecordingHandlers() {
    // Start recording
    ipcMain.handle('screenRecorder:startRecording', async (event, options) => {
      try {
        if (!this.screenRecorderService) {
          console.warn('⚠️ Screen recorder service not available');
          return {
            success: false,
            error: 'Screen recorder service not available. Please restart the application.',
            type: ERROR_TYPES.SERVICE_UNAVAILABLE
          };
        }

        console.log('🎬 Starting recording with options:', options);
        const result = await this.screenRecorderService.startRecording(options);
        
        if (result.success) {
          console.log('✅ Recording started successfully');
        } else {
          console.error('❌ Recording failed to start:', result.error);
        }
        
        return result;
        
      } catch (error) {
        console.error('❌ Failed to start recording:', error);
        return {
          success: false,
          error: error.message,
          type: ERROR_TYPES.START_ERROR,
          details: {
            platform: process.platform,
            timestamp: new Date().toISOString()
          }
        };
      }
    });

    // Stop recording
    ipcMain.handle('screenRecorder:stopRecording', async () => {
      try {
        if (this.screenRecorderService) {
          const result = await this.screenRecorderService.stopRecording();
          console.log('🛑 Stop recording result:', result);
          return result;
        } else {
          return { success: true, message: 'No recording was in progress' };
        }
      } catch (error) {
        console.error('❌ Failed to stop recording:', error);
        return { 
          success: false, 
          error: error.message, 
          type: ERROR_TYPES.STOP_ERROR 
        };
      }
    });

    // Confirm recording completion
    ipcMain.handle('screenRecorder:confirmComplete', async (event, actualFilePath) => {
      try {
        if (this.screenRecorderService) {
          const result = await this.screenRecorderService.confirmRecordingComplete(actualFilePath);
          console.log('✅ Recording completion confirmed:', result);
          return result;
        } else {
          return { 
            success: false, 
            error: 'Screen recorder service not available',
            type: ERROR_TYPES.SERVICE_UNAVAILABLE
          };
        }
      } catch (error) {
        console.error('❌ Failed to confirm recording completion:', error);
        return { 
          success: false, 
          error: error.message, 
          type: ERROR_TYPES.FILE_ERROR 
        };
      }
    });

    // Pause recording
    ipcMain.handle('screenRecorder:pauseRecording', async () => {
      try {
        if (this.screenRecorderService) {
          const result = this.screenRecorderService.pauseRecording();
          console.log('⏸️ Pause recording result:', result);
          return result;
        } else {
          return { 
            success: false, 
            error: 'Screen recorder service not available',
            type: ERROR_TYPES.SERVICE_UNAVAILABLE
          };
        }
      } catch (error) {
        console.error('❌ Failed to pause recording:', error);
        return { 
          success: false, 
          error: error.message, 
          type: ERROR_TYPES.PAUSE_ERROR 
        };
      }
    });

    // Resume recording
    ipcMain.handle('screenRecorder:resumeRecording', async () => {
      try {
        if (this.screenRecorderService) {
          const result = this.screenRecorderService.resumeRecording();
          console.log('▶️ Resume recording result:', result);
          return result;
        } else {
          return { 
            success: false, 
            error: 'Screen recorder service not available',
            type: ERROR_TYPES.SERVICE_UNAVAILABLE
          };
        }
      } catch (error) {
        console.error('❌ Failed to resume recording:', error);
        return { 
          success: false, 
          error: error.message, 
          type: ERROR_TYPES.RESUME_ERROR 
        };
      }
    });
  }

  /**
   * Set up recording management IPC handlers
   */
  setupRecordingManagement() {
    // Get recording status
    ipcMain.handle('screenRecorder:getStatus', () => {
      try {
        if (this.screenRecorderService) {
          const status = this.screenRecorderService.getStatus();
          console.log('📊 Screen recorder status requested:', {
            isRecording: status.isRecording,
            isPaused: status.isPaused,
            duration: status.duration,
            hasActiveProcess: status.hasActiveProcess
          });
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

    // Get all recordings
    ipcMain.handle('screenRecorder:getRecordings', async () => {
      try {
        if (this.screenRecorderService) {
          return await this.screenRecorderService.getRecordings();
        } else {
          return [];
        }
      } catch (error) {
        console.error('❌ Failed to get recordings:', error);
        return [];
      }
    });

    // Delete recording
    ipcMain.handle('screenRecorder:deleteRecording', async (event, filePath) => {
      try {
        if (this.screenRecorderService) {
          const result = await this.screenRecorderService.deleteRecording(filePath);
          console.log('🗑️ Delete recording result:', result);
          return result;
        } else {
          return { 
            success: false, 
            error: 'Screen recorder service not available',
            type: ERROR_TYPES.SERVICE_UNAVAILABLE
          };
        }
      } catch (error) {
        console.error('❌ Failed to delete recording:', error);
        return { 
          success: false, 
          error: error.message,
          type: ERROR_TYPES.FILE_ERROR
        };
      }
    });

    // Force cleanup
    ipcMain.handle('screenRecorder:forceCleanup', () => {
      try {
        if (this.screenRecorderService) {
          this.screenRecorderService.forceCleanup();
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

  /**
   * Set up permission-related IPC handlers
   */
  setupPermissionHandlers() {
    // Check permissions
    ipcMain.handle('screenRecorder:checkPermissions', async () => {
      try {
        if (this.screenRecorderService) {
          return await this.screenRecorderService.checkPermissions();
        }
        return { screen: 'unknown', microphone: 'unknown' };
      } catch (error) {
        console.error('❌ Failed to check permissions:', error);
        return { screen: 'unknown', microphone: 'unknown' };
      }
    });

    // Request permissions
    ipcMain.handle('screenRecorder:requestPermissions', async () => {
      try {
        if (this.screenRecorderService) {
          return await this.screenRecorderService.requestPermissions();
        }
        return { screen: 'granted', microphone: 'granted' };
      } catch (error) {
        console.error('❌ Failed to request permissions:', error);
        return { screen: 'unknown', microphone: 'unknown' };
      }
    });
  }

  /**
   * Set up file-related IPC handlers
   */
  setupFileHandlers() {
    // Validate recording
    ipcMain.handle('screenRecorder:validateRecording', async () => {
      try {
        if (this.screenRecorderService) {
          this.screenRecorderService.validateRecording();
          return { success: true };
        }
        return { 
          success: false, 
          error: 'Screen recorder service not available',
          type: ERROR_TYPES.SERVICE_UNAVAILABLE
        };
      } catch (error) {
        console.error('❌ Failed to validate recording:', error);
        return { 
          success: false, 
          error: error.message,
          type: ERROR_TYPES.VALIDATION_ERROR
        };
      }
    });

    // Handle recording error
    ipcMain.handle('screenRecorder:handleError', async (event, errorData) => {
      try {
        if (this.screenRecorderService) {
          this.screenRecorderService.handleRecordingError(errorData);
          return { success: true };
        }
        return { 
          success: false, 
          error: 'Screen recorder service not available',
          type: ERROR_TYPES.SERVICE_UNAVAILABLE
        };
      } catch (error) {
        console.error('❌ Failed to handle recording error:', error);
        return { 
          success: false, 
          error: error.message,
          type: ERROR_TYPES.SERVICE_UNAVAILABLE
        };
      }
    });
  }

  /**
   * Get fallback status when service is not available
   * @returns {Object} Fallback status object
   */
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
      recordingValidated: false,
      state: 'idle'
    };
  }

  /**
   * Update the screen recorder service reference
   * @param {ScreenRecorderService} service - New service instance
   */
  updateService(service) {
    this.screenRecorderService = service;
    console.log('🔄 Screen recorder service reference updated');
  }

  /**
   * Clean up IPC handlers
   */
  cleanup() {
    console.log('🧹 Cleaning up screen recorder IPC handlers');
    
    // Remove all screen recorder related IPC handlers
    const handlers = [
      'screenRecorder:getAvailableScreens',
      'screenRecorder:updateAudioDevices',
      'screenRecorder:validateDevices',
      'screenRecorder:startRecording',
      'screenRecorder:stopRecording',
      'screenRecorder:confirmComplete',
      'screenRecorder:pauseRecording',
      'screenRecorder:resumeRecording',
      'screenRecorder:getStatus',
      'screenRecorder:getRecordings',
      'screenRecorder:deleteRecording',
      'screenRecorder:forceCleanup',
      'screenRecorder:checkPermissions',
      'screenRecorder:requestPermissions',
      'screenRecorder:validateRecording',
      'screenRecorder:handleError'
    ];

    handlers.forEach(handler => {
      try {
        ipcMain.removeHandler(handler);
      } catch (error) {
        // Handler might not exist, ignore
      }
    });

    console.log('✅ Screen recorder IPC handlers cleaned up');
  }
}

module.exports = ScreenRecorderHandlers; 