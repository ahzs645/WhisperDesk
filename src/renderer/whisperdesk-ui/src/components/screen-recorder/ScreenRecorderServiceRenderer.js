/**
 * @fileoverview Renderer-side screen recorder service - integrates with recording handler
 */

import ScreenRecorderHandler from './ScreenRecorderHandler.js';

/**
 * Renderer-side screen recorder service
 * Acts as a proxy to the main process screen recorder service
 */
class ScreenRecorderServiceRenderer {
  constructor() {
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.statusPollingInterval = null;
    this.recordingHandler = new ScreenRecorderHandler();
    this.isInitialized = false;
  }

  /**
   * Initialize the renderer service
   * @param {Function} updateStateCallback - Callback to update component state
   * @param {Function} addToEventLogCallback - Callback to add events to log
   */
  async initialize(updateStateCallback, addToEventLogCallback) {
    this.updateStateCallback = updateStateCallback;
    this.addToEventLogCallback = addToEventLogCallback;

    try {
      // Check if screen recorder API is available
      if (!window.electronAPI?.screenRecorder) {
        throw new Error('Screen recorder API not available');
      }

      this.addToEventLog('Initializing screen recorder service...');

      // Set up recording handler callbacks
      this.setupRecordingHandlerEvents();

      // Get initial status and devices
      await this.refreshDevices();
      await this.refreshStatus();

      // Start periodic status polling
      this.startStatusPolling();

      this.isInitialized = true;
      this.addToEventLog('Screen recorder service initialized');
      return true;
    } catch (error) {
      this.addToEventLog(`Failed to initialize: ${error.message}`);
      throw error;
    }
  }

  /**
   * Set up recording handler event callbacks
   */
  setupRecordingHandlerEvents() {
    this.recordingHandler.onStarted = (data) => {
      this.addToEventLog(`Recording started: ${data.outputPath}`);
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: true,
          recordingValidated: true,
          isPaused: false
        });
      }
    };

    this.recordingHandler.onStopped = async (data) => {
      this.addToEventLog(`Recording stopped: ${data.outputPath}`);
      
      // Confirm with backend
      try {
        if (window.electronAPI?.screenRecorder?.confirmComplete) {
          const confirmResult = await window.electronAPI.screenRecorder.confirmComplete(data.outputPath);
          if (confirmResult.success) {
            this.addToEventLog(`✅ Recording confirmed with backend: ${confirmResult.outputPath}`);
          } else {
            this.addToEventLog(`❌ Backend confirmation failed: ${confirmResult.error}`);
          }
        }
      } catch (error) {
        this.addToEventLog(`❌ Backend confirmation error: ${error.message}`);
      }

      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: false,
          recordingValidated: false,
          isPaused: false,
          recordingDuration: 0
        });
      }
    };

    this.recordingHandler.onError = (error) => {
      this.addToEventLog(`Recording error: ${error.message}`);
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: false,
          recordingValidated: false,
          isPaused: false,
          localError: error.message
        });
      }
    };

    this.recordingHandler.onProgress = (data) => {
      if (this.updateStateCallback) {
        this.updateStateCallback({
          recordingDuration: data.duration
        });
      }
    };

    this.recordingHandler.onPaused = () => {
      this.addToEventLog('Recording paused');
      if (this.updateStateCallback) {
        this.updateStateCallback({ isPaused: true });
      }
    };

    this.recordingHandler.onResumed = () => {
      this.addToEventLog('Recording resumed');
      if (this.updateStateCallback) {
        this.updateStateCallback({ isPaused: false });
      }
    };
  }

  /**
   * Start recording with given options
   * @param {Object} options - Recording options
   */
  async startRecording(options) {
    try {
      // Clean the options object for IPC
      const cleanOptions = this.cleanOptionsForIPC(options);
      this.addToEventLog(`Starting recording with options: ${JSON.stringify(cleanOptions)}`);
      
      // First, notify the backend that we're starting
      const backendResult = await window.electronAPI.screenRecorder.startRecording(cleanOptions);
      
      if (!backendResult.success) {
        throw new Error(backendResult.error);
      }

      // Now start the actual recording in the renderer
      await this.recordingHandler.startRecording({
        ...cleanOptions,
        outputPath: backendResult.outputPath
      });

      this.addToEventLog('Recording started successfully');
      return backendResult;
    } catch (error) {
      this.addToEventLog(`Start recording error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording() {
    try {
      this.addToEventLog('Stopping recording...');
      
      // Stop the renderer recording first
      const rendererResult = await this.recordingHandler.stopRecording();
      
      // Then notify the backend
      const backendResult = await window.electronAPI.screenRecorder.stopRecording();
      
      this.addToEventLog('Recording stopped successfully');
      return {
        success: true,
        outputPath: rendererResult.outputPath,
        duration: rendererResult.duration
      };
    } catch (error) {
      this.addToEventLog(`Stop recording error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pause the current recording
   */
  async pauseRecording() {
    try {
      this.addToEventLog('Pausing recording...');
      
      // Pause renderer recording
      const result = this.recordingHandler.pauseRecording();
      
      if (result.success) {
        // Notify backend
        await window.electronAPI.screenRecorder.pauseRecording();
      }

      return result;
    } catch (error) {
      this.addToEventLog(`Pause recording error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resume the paused recording
   */
  async resumeRecording() {
    try {
      this.addToEventLog('Resuming recording...');
      
      // Resume renderer recording
      const result = this.recordingHandler.resumeRecording();
      
      if (result.success) {
        // Notify backend
        await window.electronAPI.screenRecorder.resumeRecording();
      }

      return result;
    } catch (error) {
      this.addToEventLog(`Resume recording error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh available devices
   */
  async refreshDevices() {
    try {
      this.addToEventLog('Refreshing devices...');

      // Get screen devices
      const screens = await window.electronAPI.screenRecorder.getAvailableScreens();
      
      // Get audio devices from browser API
      const audioDevices = await this.getAudioDevicesFromBrowser();
      
      // Update audio devices in main process
      if (audioDevices.length > 0) {
        await window.electronAPI.screenRecorder.updateAudioDevices(audioDevices);
      }

      // Update state
      if (this.updateStateCallback) {
        this.updateStateCallback({
          availableDevices: {
            screens: screens || [],
            audio: audioDevices
          },
          devicesInitialized: true
        });
      }

      this.addToEventLog(`Devices refreshed: ${screens?.length || 0} screens, ${audioDevices.length} audio devices`);
      
    } catch (error) {
      this.addToEventLog(`Device refresh error: ${error.message}`);
      console.error('Failed to refresh devices:', error);
    }
  }

  /**
   * Get audio devices from browser MediaDevices API
   */
  async getAudioDevicesFromBrowser() {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        return [];
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          id: device.deviceId,
          name: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
          type: 'audioinput',
          groupId: device.groupId
        }));
    } catch (error) {
      console.warn('Failed to get audio devices:', error);
      return [];
    }
  }

  /**
   * Refresh recording status
   */
  async refreshStatus() {
    try {
      const status = await window.electronAPI.screenRecorder.getStatus();
      
      if (this.updateStateCallback) {
        this.updateStateCallback({
          isRecording: status.isRecording || false,
          isPaused: status.isPaused || false,
          recordingDuration: status.duration || 0,
          recordingValidated: status.recordingValidated || false
        });
      }
    } catch (error) {
      console.warn('Failed to refresh status:', error);
    }
  }

  /**
   * Get current status (for debug panel)
   * @returns {Promise<Object>} Current recording status
   */
  async getStatus() {
    try {
      const backendStatus = await window.electronAPI.screenRecorder.getStatus();
      
      // Combine with renderer status
      return {
        ...backendStatus,
        rendererRecording: this.recordingHandler.isRecording,
        rendererPaused: this.recordingHandler.isPaused,
        recordedChunks: this.recordingHandler.recordedChunks.length
      };
    } catch (error) {
      console.warn('Failed to get status:', error);
      return {
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: error.message
      };
    }
  }

  /**
   * Start periodic status polling
   */
  startStatusPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }

    this.statusPollingInterval = setInterval(() => {
      this.refreshStatus();
    }, 1000); // Poll every second
  }

  /**
   * Stop status polling
   */
  stopStatusPolling() {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  /**
   * Clean options object for IPC transmission
   * @param {Object} options - Original options
   * @returns {Object} Cleaned options
   */
  cleanOptionsForIPC(options) {
    // Create a clean object with only serializable properties
    const cleanOptions = {};
    
    // Copy basic properties
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

    allowedKeys.forEach(key => {
      if (options[key] !== undefined && options[key] !== null) {
        // Extra safety: ensure the value is serializable
        try {
          JSON.stringify(options[key]);
          cleanOptions[key] = options[key];
        } catch (error) {
          console.warn(`Skipping non-serializable option ${key}:`, error);
        }
      }
    });

    return cleanOptions;
  }

  /**
   * Add event to log (safe JSON stringify)
   * @param {string} event - Event message
   */
  addToEventLog(event) {
    if (this.addToEventLogCallback) {
      this.addToEventLogCallback(event);
    }
    console.log(`[ScreenRecorder] ${event}`);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopStatusPolling();
    this.recordingHandler.cleanup();
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.isInitialized = false;
  }
}

export default ScreenRecorderServiceRenderer;