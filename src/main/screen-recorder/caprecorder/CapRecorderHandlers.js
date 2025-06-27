/**
 * @fileoverview CapRecorder IPC handlers
 * Handles IPC communication for the CapRecorder-based screen recording service
 */

const { ipcMain } = require('electron');

/**
 * CapRecorder IPC handlers
 * Provides IPC communication for CapRecorder screen recording functionality
 */
class CapRecorderHandlers {
  constructor(capRecorderService) {
    this.service = capRecorderService;
    this.registeredHandlers = new Set();
  }

  /**
   * Setup all IPC handlers
   */
  setup() {
    console.log('🔧 Setting up CapRecorder IPC handlers...');
    
    try {
      this.setupRecordingHandlers();
      this.setupDeviceHandlers();
      this.setupStatusHandlers();
      this.setupPermissionHandlers();
      
      console.log('✅ CapRecorder IPC handlers set up successfully');
      console.log('🔍 Registered handlers:', Array.from(this.registeredHandlers));
    } catch (error) {
      console.error('❌ Failed to setup CapRecorder IPC handlers:', error);
    }
  }

  /**
   * Setup recording control handlers
   */
  setupRecordingHandlers() {
    // Start recording
    this.registerHandler('screenRecorder:startRecording', async (event, options) => {
      try {
        console.log('🎬 IPC: Starting recording with options:', options);
        const result = await this.service.startRecording(options);
        console.log('🎬 IPC: Start recording result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Failed to start recording:', error);
        return {
          success: false,
          error: error.message,
          type: 'IPC_ERROR'
        };
      }
    });

    // Stop recording
    this.registerHandler('screenRecorder:stopRecording', async (event) => {
      try {
        console.log('🛑 IPC: Stopping recording');
        const result = await this.service.stopRecording();
        console.log('🛑 IPC: Stop recording result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Failed to stop recording:', error);
        return {
          success: false,
          error: error.message,
          type: 'IPC_ERROR'
        };
      }
    });

    // Pause recording
    this.registerHandler('screenRecorder:pauseRecording', async (event) => {
      try {
        console.log('⏸️ IPC: Pausing recording');
        const result = await this.service.pauseRecording();
        console.log('⏸️ IPC: Pause recording result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Failed to pause recording:', error);
        return {
          success: false,
          error: error.message,
          type: 'IPC_ERROR'
        };
      }
    });

    // Resume recording
    this.registerHandler('screenRecorder:resumeRecording', async (event) => {
      try {
        console.log('▶️ IPC: Resuming recording');
        const result = await this.service.resumeRecording();
        console.log('▶️ IPC: Resume recording result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Failed to resume recording:', error);
        return {
          success: false,
          error: error.message,
          type: 'IPC_ERROR'
        };
      }
    });

    // Cancel recording
    this.registerHandler('screenRecorder:cancelRecording', async (event) => {
      try {
        console.log('🚫 IPC: Canceling recording');
        const result = await this.service.cancelRecording();
        console.log('🚫 IPC: Cancel recording result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Failed to cancel recording:', error);
        return {
          success: false,
          error: error.message,
          type: 'IPC_ERROR'
        };
      }
    });
  }

  /**
   * Setup device enumeration handlers
   */
  setupDeviceHandlers() {
    // Get available screens
    this.registerHandler('screenRecorder:getAvailableScreens', async (event) => {
      try {
        console.log('📺 IPC: Getting available screens');
        const screens = this.service.getAvailableScreens();
        console.log('📺 IPC: Available screens:', screens.length);
        return {
          success: true,
          screens
        };
      } catch (error) {
        console.error('❌ IPC: Failed to get available screens:', error);
        return {
          success: false,
          error: error.message,
          screens: []
        };
      }
    });

    // Get available windows
    this.registerHandler('screenRecorder:getAvailableWindows', async (event) => {
      try {
        console.log('🪟 IPC: Getting available windows');
        const windows = this.service.getAvailableWindows();
        console.log('🪟 IPC: Available windows:', windows.length);
        return {
          success: true,
          windows
        };
      } catch (error) {
        console.error('❌ IPC: Failed to get available windows:', error);
        return {
          success: false,
          error: error.message,
          windows: []
        };
      }
    });

    // Update audio devices (for compatibility with existing UI)
    this.registerHandler('screenRecorder:updateAudioDevices', async (event) => {
      try {
        console.log('🔊 IPC: Updating audio devices (compatibility handler)');
        // CapRecorder handles audio device management internally
        // This is primarily for UI compatibility
        return {
          success: true,
          message: 'CapRecorder handles audio devices internally'
        };
      } catch (error) {
        console.error('❌ IPC: Failed to update audio devices:', error);
        return {
          success: false,
          error: error.message,
          type: 'IPC_ERROR'
        };
      }
    });

    // Refresh devices (for compatibility with existing UI)
    this.registerHandler('screenRecorder:refreshDevices', async (event) => {
      try {
        console.log('🔄 IPC: Refreshing devices');
        const screens = this.service.getAvailableScreens();
        const windows = this.service.getAvailableWindows();
        console.log(`🔄 IPC: Refreshed ${screens.length} screens and ${windows.length} windows`);
        return {
          success: true,
          screens,
          windows
        };
      } catch (error) {
        console.error('❌ IPC: Failed to refresh devices:', error);
        return {
          success: false,
          error: error.message,
          screens: [],
          windows: []
        };
      }
    });
  }

  /**
   * Setup status handlers
   */
  setupStatusHandlers() {
    // Get recording status
    this.registerHandler('screenRecorder:getStatus', async (event) => {
      try {
        console.log('📊 IPC: Getting recording status');
        const status = this.service.getStatus();
        console.log('📊 IPC: Current status:', status);
        return status;
      } catch (error) {
        console.error('❌ IPC: Failed to get status:', error);
        return {
          isInitialized: false,
          isRecording: false,
          isPaused: false,
          currentRecordingId: null,
          error: error.message
        };
      }
    });

    // Get enhanced status (for compatibility with existing UI)
    this.registerHandler('screenRecorder:getEnhancedStatus', async (event) => {
      try {
        console.log('📊 IPC: Getting enhanced recording status');
        const status = this.service.getStatus();
        
        // Add enhanced status fields for compatibility
        const enhancedStatus = {
          ...status,
          recordingState: status.isRecording ? (status.isPaused ? 'paused' : 'recording') : 'stopped',
          deviceStatus: {
            screensAvailable: this.service.getAvailableScreens().length > 0,
            windowsAvailable: this.service.getAvailableWindows().length > 0
          },
          lastError: null,
          recordingDuration: status.isRecording ? 'unknown' : 0,
          outputFormat: 'mp4/ogg',
          quality: 'high'
        };
        
        console.log('📊 IPC: Enhanced status:', enhancedStatus);
        return enhancedStatus;
      } catch (error) {
        console.error('❌ IPC: Failed to get enhanced status:', error);
        return {
          isInitialized: false,
          isRecording: false,
          isPaused: false,
          recordingState: 'error',
          error: error.message
        };
      }
    });

    // Get recording info (for compatibility with existing UI)
    this.registerHandler('screenRecorder:getRecordingInfo', async (event) => {
      try {
        console.log('📋 IPC: Getting recording info');
        const status = this.service.getStatus();
        const recordingInfo = {
          recordingId: status.currentRecordingId,
          outputPath: status.currentOutputPath,
          isRecording: status.isRecording,
          isPaused: status.isPaused,
          format: 'mp4/ogg',
          quality: 'high',
          method: 'caprecorder'
        };
        console.log('📋 IPC: Recording info:', recordingInfo);
        return recordingInfo;
      } catch (error) {
        console.error('❌ IPC: Failed to get recording info:', error);
        return {
          recordingId: null,
          outputPath: null,
          isRecording: false,
          isPaused: false,
          error: error.message
        };
      }
    });
  }

  /**
   * Setup permission handlers
   */
  setupPermissionHandlers() {
    // Check permissions
    this.registerHandler('screenRecorder:checkPermissions', async (event) => {
      try {
        console.log('🔐 IPC: Checking permissions');
        const permissions = this.service.checkPermissions();
        console.log('🔐 IPC: Permissions:', permissions);
        return {
          success: true,
          permissions
        };
      } catch (error) {
        console.error('❌ IPC: Failed to check permissions:', error);
        return {
          success: false,
          error: error.message,
          permissions: {
            screen: 'unknown',
            microphone: 'unknown'
          }
        };
      }
    });

    // Request permissions
    this.registerHandler('screenRecorder:requestPermissions', async (event) => {
      try {
        console.log('🔐 IPC: Requesting permissions');
        const result = await this.service.requestPermissions();
        console.log('🔐 IPC: Permission request result:', result);
        return result;
      } catch (error) {
        console.error('❌ IPC: Failed to request permissions:', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
  }

  /**
   * Register an IPC handler
   * @param {string} channel - IPC channel name
   * @param {Function} handler - Handler function
   */
  registerHandler(channel, handler) {
    if (this.registeredHandlers.has(channel)) {
      console.warn(`⚠️ Handler for ${channel} already registered, removing old one`);
      ipcMain.removeHandler(channel);
    }
    
    ipcMain.handle(channel, handler);
    this.registeredHandlers.add(channel);
    console.log(`✅ Registered handler: ${channel}`);
  }

  /**
   * Setup event forwarding from service to renderer
   * @param {BrowserWindow} mainWindow - Main window for sending events
   */
  setupEventForwarding(mainWindow) {
    if (!mainWindow) {
      console.warn('⚠️ No main window provided for event forwarding');
      return;
    }

    console.log('🔧 Setting up CapRecorder event forwarding...');

    // Recording started
    this.service.on('recordingStarted', (data) => {
      console.log('📡 Forwarding recordingStarted event:', data);
      mainWindow.webContents.send('screenRecorder:recordingStarted', data);
    });

    // Recording stopped
    this.service.on('recordingStopped', (data) => {
      console.log('📡 Forwarding recordingStopped event:', data);
      mainWindow.webContents.send('screenRecorder:recordingStopped', data);
    });

    // Recording paused
    this.service.on('recordingPaused', (data) => {
      console.log('📡 Forwarding recordingPaused event:', data);
      mainWindow.webContents.send('screenRecorder:recordingPaused', data);
    });

    // Recording resumed
    this.service.on('recordingResumed', (data) => {
      console.log('📡 Forwarding recordingResumed event:', data);
      mainWindow.webContents.send('screenRecorder:recordingResumed', data);
    });

    // Recording canceled
    this.service.on('recordingCanceled', (data) => {
      console.log('📡 Forwarding recordingCanceled event:', data);
      mainWindow.webContents.send('screenRecorder:recordingCanceled', data);
    });

    console.log('✅ CapRecorder event forwarding set up');
  }

  /**
   * Cleanup handlers
   */
  cleanup() {
    console.log('🧹 Cleaning up CapRecorder IPC handlers...');
    
    this.registeredHandlers.forEach(channel => {
      try {
        ipcMain.removeHandler(channel);
        console.log(`🗑️ Removed handler: ${channel}`);
      } catch (error) {
        console.warn(`⚠️ Failed to remove handler ${channel}:`, error);
      }
    });
    
    this.registeredHandlers.clear();
    console.log('✅ CapRecorder IPC handlers cleanup completed');
  }
}

module.exports = CapRecorderHandlers;
