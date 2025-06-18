import PlatformRecorderBridge from './PlatformRecorderBridge.js';

class ScreenRecorderServiceRenderer {
  constructor() {
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.statusPollingInterval = null;
    this.platformBridge = new PlatformRecorderBridge();
    this.isInitialized = false;
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
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: true,
          recordingValidated: true,
          isPaused: false,
          localError: null
        });
      }
    };

    // Set up stopped event
    this.platformBridge.onStopped = (data) => {
      this.addToEventLog(`Platform recording stopped: ${data.outputPath}`);
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: false,
          recordingValidated: false,
          isPaused: false,
          recordingDuration: 0
        });
      }
    };

    // Set up error event
    this.platformBridge.onError = (error) => {
      this.addToEventLog(`Platform recording error: ${error.message}`);
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: false,
          recordingValidated: false,
          isPaused: false,
          localError: error.message
        });
      }
    };

    // ✅ Set up progress event - this was missing!
    this.platformBridge.onProgress = (data) => {
      if (this.updateStateCallback) {
        // Convert milliseconds to seconds for display
        const durationSeconds = Math.floor(data.duration / 1000);
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

      // Try to get screens from main process
      try {
        if (window.electronAPI?.screenRecorder?.getAvailableScreens) {
          const screenResult = await window.electronAPI.screenRecorder.getAvailableScreens(true);
          if (screenResult.success) {
            screens = screenResult.screens || [];
          } else if (screenResult.screens) {
            screens = screenResult.screens;
          }
        }
      } catch (error) {
        console.warn('Failed to get screens from main process:', error);
      }

      // Try to get audio devices from renderer
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          audio = devices
            .filter(device => device.kind === 'audioinput')
            .map(device => ({
              id: device.deviceId,
              name: device.label || `Audio Input ${device.deviceId.slice(-4)}`,
              type: 'audioinput'
            }));
        }
      } catch (error) {
        console.warn('Failed to enumerate audio devices:', error);
      }

      // Fallback devices if none found
      if (screens.length === 0) {
        screens = [
          { id: '1', name: 'Display 1', type: 'screen' },
          { id: '2', name: 'Display 2', type: 'screen' }
        ];
      }

      if (audio.length === 0) {
        audio = [
          { id: 'default', name: 'Default Audio Input', type: 'audioinput' },
          { id: 'system', name: 'System Audio', type: 'audiooutput' }
        ];
      }

      const devices = { screens, audio };
      
      if (this.updateStateCallback) {
        this.updateStateCallback({
          availableDevices: devices,
          devicesInitialized: true
        });
      }

      this.addToEventLog(`Devices refreshed: ${screens.length} screens, ${audio.length} audio`);
      return devices;

    } catch (error) {
      this.addToEventLog(`Device refresh failed: ${error.message}`);
      throw error;
    }
  }

  async refreshStatus() {
    try {
      const status = await this.getStatus();
      
      if (this.updateStateCallback && status) {
        // Convert duration from milliseconds to seconds
        const durationSeconds = status.duration ? Math.floor(status.duration / 1000) : 0;
        
        this.updateStateCallback({
          isRecording: status.isRecording || false,
          isPaused: status.isPaused || false,
          recordingDuration: durationSeconds,
          recordingValidated: status.recordingValidated || false
        });
      }

      return status;
    } catch (error) {
      console.warn('Failed to refresh status:', error);
      return null;
    }
  }

  startStatusPolling() {
    // Poll status every 2 seconds
    this.statusPollingInterval = setInterval(() => {
      this.refreshStatus().catch(error => {
        console.warn('Status polling error:', error);
      });
    }, 2000);
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