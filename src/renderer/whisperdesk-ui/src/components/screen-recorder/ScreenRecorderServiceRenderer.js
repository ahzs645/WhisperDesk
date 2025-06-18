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
    this.platformBridge.onStarted = (data) => {
      this.addToEventLog(`Platform recording started: ${data.method || 'unknown'}`);
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: true,
          recordingValidated: true,
          isPaused: false
        });
      }
    };

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
      
      this.addToEventLog('Platform recording stopped successfully');
      return result;
    } catch (error) {
      this.addToEventLog(`Platform recording stop error: ${error.message}`);
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

  // ... rest of the methods remain the same

  cleanup() {
    this.stopStatusPolling();
    this.platformBridge.cleanup();
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.isInitialized = false;
  }
}

export default ScreenRecorderServiceRenderer;