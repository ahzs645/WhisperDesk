import PlatformRecorderBridge from './PlatformRecorderBridge.js';

class ScreenRecorderServiceRenderer {
  constructor() {
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.statusPollingInterval = null;
    this.platformBridge = new PlatformRecorderBridge();
    this.isInitialized = false;
    this.isRecording = false; // Track recording state locally
  }

  async initialize(updateStateCallback, addToEventLogCallback) {
    this.updateStateCallback = updateStateCallback;
    this.addToEventLogCallback = addToEventLogCallback;

    try {
      this.addToEventLog('Initializing platform-aware screen recorder...');

      // Initialize the platform bridge
      await this.platformBridge.initialize();
      
      // Set up bridge callbacks
      this.setupPlatformBridgeEvents();

      // Get initial status and devices
      await this.refreshDevices();
      await this.refreshStatus();

      // Start status polling
      this.startStatusPolling();

      this.isInitialized = true;
      this.addToEventLog('Platform-aware screen recorder initialized');
      return true;
    } catch (error) {
      this.addToEventLog(`Failed to initialize: ${error.message}`);
      throw error;
    }
  }

  setupPlatformBridgeEvents() {
    // Set up started event
    this.platformBridge.onStarted = (data) => {
      this.addToEventLog(`Platform recording started: ${data.method || 'unknown'}`);
      this.isRecording = true; // Update local state
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: true,
          recordingValidated: true,
          isPaused: false,
          localError: null,
          recordingDuration: 0 // Reset duration on start
        });
      }
    };

    // Set up stopped event
    this.platformBridge.onStopped = (data) => {
      this.addToEventLog(`Platform recording stopped: ${data.outputPath}`);
      this.isRecording = false; // Update local state
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: false,
          recordingValidated: false,
          isPaused: false,
          recordingDuration: 0 // Reset duration on stop
        });
      }
    };

    // Set up error event
    this.platformBridge.onError = (error) => {
      this.addToEventLog(`Platform recording error: ${error.message}`);
      this.isRecording = false; // Update local state
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: false,
          recordingValidated: false,
          isPaused: false,
          recordingDuration: 0, // Reset duration on error
          localError: error.message
        });
      }
    };

    // ✅ FIXED: Only update duration when recording is active
    this.platformBridge.onProgress = (data) => {
      if (this.updateStateCallback && data.isRecording) {
        // Ensure we have a consistent duration in seconds
        let durationSeconds;
        if (data.duration > 59000) {
          // Likely milliseconds
          durationSeconds = Math.floor(data.duration / 1000);
        } else {
          // Likely seconds already
          durationSeconds = Math.floor(data.duration);
        }
        
        this.updateStateCallback({
          recordingDuration: durationSeconds,
          isRecording: data.isRecording,
          isPaused: data.isPaused || false
        });
      }
    };
  }

  async startRecording(options) {
    try {
      const cleanOptions = this.cleanOptionsForIPC(options);
      this.addToEventLog(`Starting platform recording: ${JSON.stringify(cleanOptions)}`);
      
      const result = await this.platformBridge.startRecording(cleanOptions);
      
      this.addToEventLog('Platform recording started successfully');
      return result;
    } catch (error) {
      this.addToEventLog(`Platform recording start error: ${error.message}`);
      throw error;
    }
  }

  async stopRecording() {
    try {
      this.addToEventLog('Stopping platform recording...');
      
      const result = await this.platformBridge.stopRecording();
      
      // Log where the file was saved
      if (result.outputPath) {
        this.addToEventLog(`Recording saved to: ${result.outputPath}`);
      }
      
      this.addToEventLog('Platform recording stopped successfully');
      return result;
    } catch (error) {
      this.addToEventLog(`Platform recording stop error: ${error.message}`);
      throw error;
    }
  }

  async pauseRecording() {
    try {
      this.addToEventLog('Pausing platform recording...');
      
      // Platform bridge might not support pause, fallback gracefully
      if (this.platformBridge.pauseRecording) {
        const result = await this.platformBridge.pauseRecording();
        this.addToEventLog('Platform recording paused');
        return result;
      } else {
        this.addToEventLog('Pause not supported by platform bridge');
        return { success: false, error: 'Pause not supported' };
      }
    } catch (error) {
      this.addToEventLog(`Platform recording pause error: ${error.message}`);
      throw error;
    }
  }

  async resumeRecording() {
    try {
      this.addToEventLog('Resuming platform recording...');
      
      // Platform bridge might not support resume, fallback gracefully
      if (this.platformBridge.resumeRecording) {
        const result = await this.platformBridge.resumeRecording();
        this.addToEventLog('Platform recording resumed');
        return result;
      } else {
        this.addToEventLog('Resume not supported by platform bridge');
        return { success: false, error: 'Resume not supported' };
      }
    } catch (error) {
      this.addToEventLog(`Platform recording resume error: ${error.message}`);
      throw error;
    }
  }

  async getStatus() {
    try {
      return await this.platformBridge.getStatus();
    } catch (error) {
      console.warn('Failed to get platform status:', error);
      return {
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: error.message
      };
    }
  }

  async refreshDevices() {
    try {
      this.addToEventLog('Refreshing devices...');
      
      // Get device lists from both main process and renderer
      let screens = [];
      let audio = [];

      // Try to get screens from main process first
      try {
        if (window.electronAPI?.screenRecorder?.getAvailableScreens) {
          const screenResult = await window.electronAPI.screenRecorder.getAvailableScreens(true);
          if (screenResult.success && screenResult.screens && screenResult.screens.length > 0) {
            screens = screenResult.screens;
            this.addToEventLog(`✅ Got ${screens.length} screens from main process`);
          } else {
            this.addToEventLog('⚠️ Main process returned no screens, trying fallback...');
          }
        }
      } catch (error) {
        console.warn('Failed to get screens from main process:', error);
        this.addToEventLog(`⚠️ Main process screen enumeration failed: ${error.message}`);
      }

      // ✅ FALLBACK: If main process returns no screens, use renderer fallback
      if (screens.length === 0) {
        try {
          if (window.electronAPI?.desktopCapturer?.getSources) {
            this.addToEventLog('🔄 Using renderer fallback for screen enumeration...');
            const sources = await window.electronAPI.desktopCapturer.getSources({
              types: ['screen'],
              thumbnailSize: { width: 0, height: 0 }
            });
            
            screens = sources.map((source, index) => ({
              id: source.id,
              name: source.name || `Display ${index + 1}`,
              type: 'screen',
              displayId: source.display_id
            }));
            
            this.addToEventLog(`✅ Fallback found ${screens.length} screens`);
          } else if (navigator.mediaDevices?.getDisplayMedia) {
            // Ultimate fallback: Create a generic screen option
            screens = [{
              id: 'screen:0:0',
              name: 'Primary Display',
              type: 'screen'
            }];
            this.addToEventLog('✅ Using generic screen fallback');
          }
        } catch (fallbackError) {
          console.warn('Fallback screen enumeration failed:', fallbackError);
          this.addToEventLog(`❌ Fallback screen enumeration failed: ${fallbackError.message}`);
          
          // Ultimate fallback
          screens = [{
            id: 'screen:0:0',
            name: 'Primary Display',
            type: 'screen'
          }];
        }
      }

      // ✅ IMPROVED: Better audio device enumeration without duplicates
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === 'audioinput');
          
          // Create a Set to track unique device IDs
          const seenDeviceIds = new Set();
          
          audio = audioInputs
            .filter(device => {
              // Skip devices without proper IDs or duplicate IDs
              if (!device.deviceId || device.deviceId === 'default' || seenDeviceIds.has(device.deviceId)) {
                return false;
              }
              seenDeviceIds.add(device.deviceId);
              return true;
            })
            .map(device => ({
              id: device.deviceId,
              name: device.label || `Audio Input ${device.deviceId.slice(-4)}`,
              type: 'audioinput',
              deviceId: device.deviceId
            }));
          
          // ✅ Add a proper default option at the beginning
          if (audio.length > 0) {
            audio.unshift({
              id: 'default',
              name: 'Default Audio Input',
              type: 'audioinput',
              deviceId: 'default',
              isDefault: true
            });
          }
          
          this.addToEventLog(`✅ Found ${audio.length} unique audio devices`);
        }
      } catch (error) {
        console.warn('Failed to enumerate audio devices:', error);
        this.addToEventLog(`⚠️ Audio enumeration failed: ${error.message}`);
      }

      // Fallback devices if none found
      if (screens.length === 0) {
        screens = [
          { 
            id: 'screen:0:0', 
            name: 'Primary Display', 
            type: 'screen'
          }
        ];
        this.addToEventLog('🔧 Using minimal screen fallback');
      }

      if (audio.length === 0) {
        audio = [
          { 
            id: 'default', 
            name: 'Default Microphone', 
            type: 'audioinput',
            deviceId: 'default',
            isDefault: true
          }
        ];
        this.addToEventLog('🔧 Using default audio fallback');
      }

      const devices = { screens, audio };
      
      if (this.updateStateCallback) {
        this.updateStateCallback({
          availableDevices: devices,
          devicesInitialized: true,
          loadingDevices: false
        });
      }

      this.addToEventLog(`✅ Devices refreshed: ${screens.length} screens, ${audio.length} audio`);
      this.addToEventLog(`📱 Screens: ${screens.map(s => s.name).join(', ')}`);
      this.addToEventLog(`🎤 Audio: ${audio.map(a => a.name).join(', ')}`);
      
      return devices;

    } catch (error) {
      this.addToEventLog(`❌ Device refresh failed: ${error.message}`);
      
      // Emergency fallback
      const fallbackDevices = {
        screens: [{ id: 'screen:0:0', name: 'Primary Display', type: 'screen' }],
        audio: [{ id: 'default', name: 'Default Microphone', type: 'audioinput', deviceId: 'default', isDefault: true }]
      };
      
      if (this.updateStateCallback) {
        this.updateStateCallback({
          availableDevices: fallbackDevices,
          devicesInitialized: true,
          loadingDevices: false
        });
      }
      
      return fallbackDevices;
    }
  }

  async refreshStatus() {
    try {
      const status = await this.getStatus();
      
      if (this.updateStateCallback && status) {
        // ✅ FIXED: Only update duration if not currently recording
        const updates = {
          isRecording: status.isRecording || false,
          isPaused: status.isPaused || false,
          recordingValidated: status.recordingValidated || false
        };
        
        // Only update duration from status if we're not actively recording
        if (!status.isRecording) {
          const durationSeconds = status.duration ? Math.floor(status.duration / 1000) : 0;
          updates.recordingDuration = durationSeconds;
        }
        
        this.updateStateCallback(updates);
      }

      return status;
    } catch (error) {
      console.warn('Failed to refresh status:', error);
      return null;
    }
  }

  // ✅ FIXED: Disable status polling during recording
  startStatusPolling() {
    this.statusPollingInterval = setInterval(() => {
      // Only poll status when NOT recording to avoid overriding live progress
      if (!this.isRecording) {
        this.refreshStatus().catch(error => {
          console.warn('Status polling error:', error);
        });
      }
    }, 5000); // Reduced frequency
  }

  stopStatusPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  cleanOptionsForIPC(options) {
    // Only send serializable options to IPC
    const allowedKeys = [
      'screenId',
      'audioInputId', 
      'includeMicrophone',
      'includeSystemAudio',
      'videoQuality',
      'audioQuality',
      'recordingDirectory',
      'filename'
    ];
    
    const cleanOptions = {};
    allowedKeys.forEach(key => {
      if (options[key] !== undefined && options[key] !== null) {
        try {
          JSON.stringify(options[key]); // Test if serializable
          cleanOptions[key] = options[key];
        } catch (error) {
          console.warn(`Skipping non-serializable option ${key}:`, error);
        }
      }
    });
    
    return cleanOptions;
  }

  updateState(updates) {
    if (this.updateStateCallback) {
      this.updateStateCallback(updates);
    }
  }

  addToEventLog(event) {
    if (this.addToEventLogCallback) {
      this.addToEventLogCallback(event);
    } else {
      console.log(`[ScreenRecorderServiceRenderer] ${event}`);
    }
  }

  // ✅ Add method to test Aperture system specifically
  async testApertureSystem() {
    try {
      return await this.platformBridge.testApertureSystem();
    } catch (error) {
      return [`❌ Aperture test failed: ${error.message}`];
    }
  }

  cleanup() {
    this.addToEventLog('Cleaning up platform-aware screen recorder service...');
    
    this.stopStatusPolling();
    
    if (this.platformBridge) {
      this.platformBridge.cleanup();
    }
    
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.isInitialized = false;
  }
}

export default ScreenRecorderServiceRenderer;