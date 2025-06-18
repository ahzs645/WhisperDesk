/**
 * @fileoverview Main process IPC handlers for screen recorder service
 */

const { ipcMain } = require('electron');

/**
 * Main process IPC handlers for screen recorder
 */
class ScreenRecorderHandlers {
  constructor(screenRecorderService) {
    this.service = screenRecorderService;
    this.registeredHandlers = new Set();
  }

  /**
   * Set up all IPC handlers
   */
  setup() {
    console.log('🔧 Setting up Screen Recorder IPC handlers...');

    try {
      // Core recording handlers
      this.registerHandler('screenRecorder:startRecording', this.handleStartRecording.bind(this));
      this.registerHandler('screenRecorder:stopRecording', this.handleStopRecording.bind(this));
      this.registerHandler('screenRecorder:pauseRecording', this.handlePauseRecording.bind(this));
      this.registerHandler('screenRecorder:resumeRecording', this.handleResumeRecording.bind(this));
      this.registerHandler('screenRecorder:getStatus', this.handleGetStatus.bind(this));

      // Device and screen handlers
      this.registerHandler('screenRecorder:getAvailableScreens', this.handleGetAvailableScreens.bind(this));
      this.registerHandler('screenRecorder:updateAudioDevices', this.handleUpdateAudioDevices.bind(this));
      this.registerHandler('screenRecorder:validateDevices', this.handleValidateDevices.bind(this));

      // Permission handlers
      this.registerHandler('screenRecorder:checkPermissions', this.handleCheckPermissions.bind(this));
      this.registerHandler('screenRecorder:requestPermissions', this.handleRequestPermissions.bind(this));

      // File management handlers
      this.registerHandler('screenRecorder:confirmComplete', this.handleConfirmComplete.bind(this));
      this.registerHandler('screenRecorder:getRecordings', this.handleGetRecordings.bind(this));
      this.registerHandler('screenRecorder:deleteRecording', this.handleDeleteRecording.bind(this));

      // Utility handlers
      this.registerHandler('screenRecorder:validateRecording', this.handleValidateRecording.bind(this));
      this.registerHandler('screenRecorder:handleError', this.handleError.bind(this));
      this.registerHandler('screenRecorder:forceCleanup', this.handleForceCleanup.bind(this));

      console.log('✅ Screen Recorder IPC handlers set up successfully');
    } catch (error) {
      console.error('❌ Failed to set up Screen Recorder IPC handlers:', error);
      throw error;
    }
  }

  /**
   * Register an IPC handler with cleanup tracking
   */
  registerHandler(channel, handler) {
    if (this.registeredHandlers.has(channel)) {
      console.warn(`⚠️ Handler for ${channel} already registered, removing old one`);
      ipcMain.removeHandler(channel);
    }
    
    ipcMain.handle(channel, handler);
    this.registeredHandlers.add(channel);
  }

  // Core recording handlers
  async handleStartRecording(event, options) {
    try {
      console.log('🎬 IPC: Starting recording with options:', options);
      return await this.service.startRecording(options);
    } catch (error) {
      console.error('❌ IPC: Start recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleStopRecording(event) {
    try {
      console.log('🛑 IPC: Stopping recording');
      return await this.service.stopRecording();
    } catch (error) {
      console.error('❌ IPC: Stop recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handlePauseRecording(event) {
    try {
      console.log('⏸️ IPC: Pausing recording');
      return this.service.pauseRecording();
    } catch (error) {
      console.error('❌ IPC: Pause recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleResumeRecording(event) {
    try {
      console.log('▶️ IPC: Resuming recording');
      return this.service.resumeRecording();
    } catch (error) {
      console.error('❌ IPC: Resume recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGetStatus(event) {
    try {
      return this.service.getStatus();
    } catch (error) {
      console.error('❌ IPC: Get status failed:', error);
      return {
        isRecording: false,
        isPaused: false,
        currentRecordingId: null,
        error: error.message
      };
    }
  }

  // Device and screen handlers
  async handleGetAvailableScreens(event, refresh = false) {
    try {
      return await this.service.getAvailableScreens(refresh);
    } catch (error) {
      console.error('❌ IPC: Get available screens failed:', error);
      return { success: false, error: error.message, screens: [] };
    }
  }

  async handleUpdateAudioDevices(event, audioDevices) {
    try {
      return this.service.updateAudioDevices(audioDevices);
    } catch (error) {
      console.error('❌ IPC: Update audio devices failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleValidateDevices(event, screenId, audioId) {
    try {
      return this.service.validateDeviceSelection(screenId, audioId);
    } catch (error) {
      console.error('❌ IPC: Validate devices failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Permission handlers
  async handleCheckPermissions(event) {
    try {
      return await this.service.checkPermissions();
    } catch (error) {
      console.error('❌ IPC: Check permissions failed:', error);
      return { screen: 'unknown', microphone: 'unknown', error: error.message };
    }
  }

  async handleRequestPermissions(event) {
    try {
      console.log('🔐 IPC: Requesting permissions');
      
      if (this.service?.deviceManager?.requestPermissions) {
        const result = await this.service.deviceManager.requestPermissions();
        console.log('✅ Permission request result:', result);
        return result;
      } else {
        return { 
          success: false, 
          error: 'Permission request not available',
          screen: 'unknown',
          microphone: 'unknown'
        };
      }
    } catch (error) {
      console.error('❌ IPC: Permission request failed:', error);
      return { 
        success: false, 
        error: error.message,
        screen: 'unknown',
        microphone: 'unknown'
      };
    }
  }

  // File management handlers
  async handleConfirmComplete(event, actualFilePath) {
    try {
      return await this.service.confirmRecordingComplete(actualFilePath);
    } catch (error) {
      console.error('❌ IPC: Confirm complete failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleGetRecordings(event) {
    try {
      return await this.service.getRecordings();
    } catch (error) {
      console.error('❌ IPC: Get recordings failed:', error);
      return { success: false, error: error.message, recordings: [] };
    }
  }

  async handleDeleteRecording(event, filePath) {
    try {
      return await this.service.deleteRecording(filePath);
    } catch (error) {
      console.error('❌ IPC: Delete recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Utility handlers
  async handleValidateRecording(event) {
    try {
      return this.service.validateRecording();
    } catch (error) {
      console.error('❌ IPC: Validate recording failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleError(event, errorData) {
    try {
      return this.service.handleRecordingError(errorData);
    } catch (error) {
      console.error('❌ IPC: Handle error failed:', error);
      return { success: false, error: error.message };
    }
  }

  async handleForceCleanup(event) {
    try {
      return this.service.forceCleanup();
    } catch (error) {
      console.error('❌ IPC: Force cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up all registered handlers
   */
  cleanup() {
    console.log('🔧 Cleaning up Screen Recorder IPC handlers...');
    
    this.registeredHandlers.forEach(channel => {
      try {
        ipcMain.removeHandler(channel);
      } catch (error) {
        console.warn(`⚠️ Failed to remove handler for ${channel}:`, error.message);
      }
    });
    
    this.registeredHandlers.clear();
    console.log('✅ Screen Recorder IPC handlers cleaned up');
  }
}

module.exports = ScreenRecorderHandlers;