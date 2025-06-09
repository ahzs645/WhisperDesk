// src/main/main.js - ENHANCED IPC HANDLERS for proper device management
// Add this to your existing main.js file, replacing the existing screen recorder setup

const DeviceManager = require('./services/device-manager');

// Add to your services initialization
async function initializeEnhancedDeviceManager() {
  try {
    console.log('🔧 Initializing Enhanced Device Manager...');
    const DeviceManagerClass = require('./services/device-manager');
    services.deviceManager = new DeviceManagerClass();
    await services.deviceManager.initialize();
    
    console.log('✅ Enhanced Device Manager initialized successfully');
  } catch (error) {
    console.error('❌ Enhanced Device Manager failed to initialize:', error);
    console.warn('⚠️ Device manager will use fallback mode');
  }
}

// ENHANCED Screen Recorder IPC Handlers - REPLACE existing ones
function setupEnhancedScreenRecorderHandlers() {
  console.log('🔧 Setting up ENHANCED screen recorder IPC handlers...');

  // Enhanced device enumeration
  ipcMain.handle('screenRecorder:getAvailableScreens', async () => {
    try {
      if (services.deviceManager) {
        return await services.deviceManager.getAvailableScreens();
      } else {
        // Fallback using desktopCapturer directly
        const { desktopCapturer } = require('electron');
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

  // Enhanced audio device enumeration (to be called from renderer)
  ipcMain.handle('screenRecorder:updateAudioDevices', async (event, audioDevices) => {
    try {
      if (services.deviceManager) {
        services.deviceManager.updateAudioDevices(audioDevices);
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to update audio devices:', error);
      return { success: false, error: error.message };
    }
  });

  // Enhanced device validation
  ipcMain.handle('screenRecorder:validateDevices', async (event, screenId, audioId) => {
    try {
      if (services.deviceManager) {
        return services.deviceManager.validateDeviceSelection(screenId, audioId);
      }
      return { valid: true, issues: [] };
    } catch (error) {
      console.error('❌ Failed to validate devices:', error);
      return { valid: false, issues: [error.message] };
    }
  });

  // Permission management
  ipcMain.handle('screenRecorder:checkPermissions', async () => {
    try {
      if (services.deviceManager) {
        return await services.deviceManager.checkPermissions();
      }
      return { screen: 'unknown', microphone: 'unknown' };
    } catch (error) {
      console.error('❌ Failed to check permissions:', error);
      return { screen: 'unknown', microphone: 'unknown' };
    }
  });

  ipcMain.handle('screenRecorder:requestPermissions', async () => {
    try {
      if (services.deviceManager) {
        return await services.deviceManager.requestPermissions();
      }
      return { screen: 'granted', microphone: 'granted' };
    } catch (error) {
      console.error('❌ Failed to request permissions:', error);
      return { screen: 'unknown', microphone: 'unknown' };
    }
  });

  // Enhanced start recording
  ipcMain.handle('screenRecorder:startRecording', async (event, options) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.startRecording === 'function') {
        // Validate devices first
        if (services.deviceManager) {
          const validation = services.deviceManager.validateDeviceSelection(
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
        
        return await services.screenRecorder.startRecording(options);
      } else {
        console.warn('⚠️ Screen recorder service not available');
        return {
          success: false,
          error: 'Screen recorder service not available. Please restart the application.',
          type: 'service_unavailable'
        };
      }
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

  // Recording validation (called by renderer when MediaRecorder starts)
  ipcMain.handle('screenRecorder:validateRecording', async () => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.validateRecording === 'function') {
        services.screenRecorder.validateRecording();
        return { success: true };
      }
      return { success: false, error: 'Screen recorder service not available' };
    } catch (error) {
      console.error('❌ Failed to validate recording:', error);
      return { success: false, error: error.message };
    }
  });

  // Recording error handling (called by renderer if MediaRecorder fails)
  ipcMain.handle('screenRecorder:handleError', async (event, errorData) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.handleRecordingError === 'function') {
        services.screenRecorder.handleRecordingError(errorData);
        return { success: true };
      }
      return { success: false, error: 'Screen recorder service not available' };
    } catch (error) {
      console.error('❌ Failed to handle recording error:', error);
      return { success: false, error: error.message };
    }
  });

  // Enhanced status with real device info
  ipcMain.handle('screenRecorder:getStatus', () => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.getStatus === 'function') {
        const status = services.screenRecorder.getStatus();
        
        // Enhance with device manager info
        if (services.deviceManager) {
          const deviceInfo = services.deviceManager.getFormattedDevices();
          status.availableDevices = deviceInfo;
        }
        
        console.log('📊 Enhanced screen recorder status requested:', status);
        return status;
      } else {
        console.warn('⚠️ Screen recorder service not available, returning fallback status');
        const fallbackStatus = {
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
        return fallbackStatus;
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

  // Keep existing handlers for compatibility
  ipcMain.handle('screenRecorder:stopRecording', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.stopRecording === 'function') {
        return await services.screenRecorder.stopRecording();
      } else {
        return { success: true, message: 'No recording was in progress' };
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      return { success: false, error: error.message, type: 'stop_error' };
    }
  });

  ipcMain.handle('screenRecorder:pauseRecording', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.pauseRecording === 'function') {
        return services.screenRecorder.pauseRecording();
      } else {
        return { success: false, error: 'Screen recorder service not available' };
      }
    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      return { success: false, error: error.message, type: 'pause_error' };
    }
  });

  ipcMain.handle('screenRecorder:resumeRecording', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.resumeRecording === 'function') {
        return services.screenRecorder.resumeRecording();
      } else {
        return { success: false, error: 'Screen recorder service not available' };
      }
    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      return { success: false, error: error.message, type: 'resume_error' };
    }
  });

  ipcMain.handle('screenRecorder:getRecordings', async (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.getRecordings === 'function') {
        return await services.screenRecorder.getRecordings();
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
      if (services.screenRecorder && typeof services.screenRecorder.deleteRecording === 'function') {
        return await services.screenRecorder.deleteRecording(filePath);
      } else {
        return { success: false, error: 'Screen recorder service not available' };
      }
    } catch (error) {
      console.error('❌ Failed to delete recording:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('screenRecorder:forceCleanup', (event) => {
    try {
      if (services.screenRecorder && typeof services.screenRecorder.forceCleanup === 'function') {
        services.screenRecorder.forceCleanup();
        return { success: true, message: 'Cleanup completed' };
      } else {
        return { success: true, message: 'No service to clean up' };
      }
    } catch (error) {
      console.error('❌ Failed to force cleanup:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Enhanced screen recorder IPC handlers set up');
}

// Add this to your service initialization in main.js
async function initializeServices() {
  console.log('🔧 Initializing services...');
  
  try {
    // Initialize each service individually with error handling
    await initializeModelManager();
    await initializeTranscriptionService();
    await initializeAudioService();
    await initializeSettingsService();
    await initializeExportService();
    
    // 🔴 NEW: Initialize enhanced device manager FIRST
    await initializeEnhancedDeviceManager();
    
    // 🔴 FIXED: Initialize screen recorder AFTER device manager
    await initializeEnhancedScreenRecorderSafe();
    
    console.log('✅ Services initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Service initialization had errors:', error);
    console.warn('⚠️ Some services may not be available, but app will continue...');
    return false;
  }
}

// Update the setupAllIpcHandlers function
function setupAllIpcHandlers() {
  console.log('🔧 Setting up ALL IPC handlers...');

  // Basic IPC handlers that should always work
  setupBasicIpcHandlers();
  
  // 🔴 UPDATED: Setup enhanced screen recorder handlers
  setupEnhancedScreenRecorderHandlers();
  
  console.log('✅ All IPC handlers set up');
}