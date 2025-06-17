/**
 * @fileoverview Renderer-side screen recorder service - communicates with main process via IPC
 */

/**
 * Renderer-side screen recorder service
 * Acts as a proxy to the main process screen recorder service
 */
class ScreenRecorderServiceRenderer {
    constructor() {
      this.updateStateCallback = null;
      this.addToEventLogCallback = null;
      this.statusPollingInterval = null;
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
  
        // Get initial status and devices
        await this.refreshDevices();
        await this.refreshStatus();
  
        // Start periodic status polling
        this.startStatusPolling();
  
        this.addToEventLog('Screen recorder service initialized');
        return true;
      } catch (error) {
        this.addToEventLog(`Failed to initialize: ${error.message}`);
        throw error;
      }
    }
  
    /**
     * Start recording with given options
     * @param {Object} options - Recording options
     */
    async startRecording(options) {
      try {
        this.addToEventLog(`Starting recording with options: ${JSON.stringify(options)}`);
  
        // Clean the options object to ensure it's serializable
        const cleanOptions = this.cleanOptionsForIPC(options);
        
        const result = await window.electronAPI.screenRecorder.startRecording(cleanOptions);
        
        if (result.success) {
          this.addToEventLog('Recording started successfully');
          await this.refreshStatus();
        } else {
          this.addToEventLog(`Recording failed: ${result.error}`);
          throw new Error(result.error);
        }
  
        return result;
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
        
        const result = await window.electronAPI.screenRecorder.stopRecording();
        
        if (result.success) {
          this.addToEventLog('Recording stopped successfully');
          await this.refreshStatus();
        } else {
          this.addToEventLog(`Stop failed: ${result.error}`);
        }
  
        return result;
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
        
        const result = await window.electronAPI.screenRecorder.pauseRecording();
        
        if (result.success) {
          this.addToEventLog('Recording paused');
          await this.refreshStatus();
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
        
        const result = await window.electronAPI.screenRecorder.resumeRecording();
        
        if (result.success) {
          this.addToEventLog('Recording resumed');
          await this.refreshStatus();
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
          cleanOptions[key] = options[key];
        }
      });
  
      return cleanOptions;
    }
  
    /**
     * Add event to log
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
      this.updateStateCallback = null;
      this.addToEventLogCallback = null;
    }
  }
  
  export default ScreenRecorderServiceRenderer;