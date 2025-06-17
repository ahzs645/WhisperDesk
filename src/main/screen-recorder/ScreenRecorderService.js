/**
 * @fileoverview Main screen recorder service - orchestrates all screen recording components
 */

const { EventEmitter } = require('events');
const { systemPreferences } = require('electron');
const ScreenRecorderEngine = require('./core/ScreenRecorderEngine');
const DeviceManager = require('./managers/DeviceManager');
const FileManager = require('./managers/FileManager');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('./types');

/**
 * Main screen recorder service
 * Orchestrates all screen recording functionality
 */
class ScreenRecorderService extends EventEmitter {
  constructor() {
    super();
    
    // Core components
    this.engine = null;
    this.deviceManager = null;
    this.fileManager = null;
    
    // Service state
    this.isInitialized = false;
    this.currentRecordingId = null;
    
    // Configuration
    this.config = {
      enablePermissionChecks: process.platform === 'darwin',
      autoCleanup: true,
      maxConcurrentRecordings: 1
    };
  }

  /**
   * Initialize the screen recorder service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Screen recorder service already initialized');
      return true;
    }

    try {
      console.log('🔧 Initializing Screen Recorder Service...');
      
      // Initialize core components
      await this.initializeComponents();
      
      // Set up event forwarding
      this.setupEventForwarding();
      
      // Check initial permissions
      if (this.config.enablePermissionChecks) {
        await this.checkInitialPermissions();
      }
      
      this.isInitialized = true;
      console.log('✅ Screen Recorder Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Screen Recorder Service:', error);
      throw error;
    }
  }

  /**
   * Initialize all core components
   */
  async initializeComponents() {
    // Initialize recording engine
    this.engine = new ScreenRecorderEngine();
    await this.engine.initialize();
    
    // Initialize device manager
    this.deviceManager = new DeviceManager();
    await this.deviceManager.initialize();
    
    // Initialize file manager
    this.fileManager = new FileManager();
    await this.fileManager.initialize();
    
    console.log('✅ All screen recorder components initialized');
  }

  /**
   * Set up event forwarding from components
   */
  setupEventForwarding() {
    // Forward engine events
    if (this.engine) {
      Object.values(RECORDING_EVENTS).forEach(eventName => {
        this.engine.on(eventName, (data) => {
          this.emit(eventName, data);
        });
      });
    }
    
    // Forward device manager events
    if (this.deviceManager) {
      this.deviceManager.on(RECORDING_EVENTS.DEVICES_REFRESHED, (data) => {
        this.emit(RECORDING_EVENTS.DEVICES_REFRESHED, data);
      });
      
      this.deviceManager.on(RECORDING_EVENTS.AUDIO_DEVICES_UPDATED, (data) => {
        this.emit(RECORDING_EVENTS.AUDIO_DEVICES_UPDATED, data);
      });
    }
    
    // Forward file manager events
    if (this.fileManager) {
      this.fileManager.on('recordingCompleted', (data) => {
        // This is handled internally, but we could emit additional events if needed
      });
    }
    
    console.log('✅ Event forwarding set up');
  }

  /**
   * Check initial system permissions
   */
  async checkInitialPermissions() {
    try {
      const permissions = await this.deviceManager.checkPermissions();
      
      if (permissions.screen !== 'granted') {
        console.warn('⚠️ Screen recording permission not granted');
      }
      
      if (permissions.microphone !== 'granted') {
        console.warn('⚠️ Microphone permission not granted');
      }
      
      return permissions;
    } catch (error) {
      console.warn('⚠️ Failed to check initial permissions:', error);
      return { screen: 'unknown', microphone: 'unknown' };
    }
  }

  /**
   * Start a new recording
   * @param {import('./types').RecordingOptions} options - Recording options
   * @returns {Promise<import('./types').RecordingResult>}
   */
  async startRecording(options = {}) {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Screen recorder service not initialized',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    try {
      // Validate options
      const validation = await this.validateRecordingOptions(options);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.issues.join(', ')}`,
          type: ERROR_TYPES.VALIDATION_ERROR
        };
      }

      // Get screen source information
      const screenSource = await this.getScreenSourceInfo(options.screenId);
      if (!screenSource) {
        return {
          success: false,
          error: `Screen source '${options.screenId}' not found`,
          type: ERROR_TYPES.DEVICE_ERROR
        };
      }

      // Generate recording ID and file info
      this.currentRecordingId = this.generateRecordingId();
      const filename = this.fileManager.generateFilename({
        prefix: options.filename ? options.filename.replace(/\.[^/.]+$/, '') : 'recording',
        extension: '.webm'
      });
      const outputPath = this.fileManager.getRecordingPath(filename, options.recordingDirectory);

      // Register recording with file manager
      this.fileManager.registerRecording(this.currentRecordingId, {
        filename,
        path: outputPath,
        expectedPath: outputPath
      });

      // Start recording with engine
      const result = await this.engine.startRecording(options, screenSource);
      
      if (result.success) {
        console.log(`🎬 Recording started: ${this.currentRecordingId}`);
      } else {
        // Clean up on failure
        this.currentRecordingId = null;
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.currentRecordingId = null;
      
      return {
        success: false,
        error: error.message,
        type: ERROR_TYPES.START_ERROR
      };
    }
  }

  /**
   * Stop the current recording
   * @returns {Promise<import('./types').RecordingResult>}
   */
  async stopRecording() {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Screen recorder service not initialized',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    try {
      const result = await this.engine.stopRecording();
      
      if (result.success && !result.wasAlreadyStopped) {
        console.log(`🛑 Recording stopped: ${this.currentRecordingId}`);
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      
      return {
        success: false,
        error: error.message,
        type: ERROR_TYPES.STOP_ERROR
      };
    }
  }

  /**
   * Confirm recording completion with actual file path
   * @param {string} actualFilePath - Actual path where file was saved
   * @returns {Promise<import('./types').RecordingResult>}
   */
  async confirmRecordingComplete(actualFilePath) {
    if (!this.isInitialized || !this.currentRecordingId) {
      return {
        success: false,
        error: 'No active recording to confirm',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    try {
      // Confirm with engine
      const engineResult = await this.engine.confirmRecordingComplete(actualFilePath);
      
      if (engineResult.success) {
        // Complete with file manager
        await this.fileManager.completeRecording(this.currentRecordingId, actualFilePath);
        
        console.log(`✅ Recording confirmed complete: ${this.currentRecordingId}`);
        this.currentRecordingId = null;
      }

      return engineResult;

    } catch (error) {
      console.error('❌ Failed to confirm recording completion:', error);
      
      return {
        success: false,
        error: error.message,
        type: ERROR_TYPES.FILE_ERROR
      };
    }
  }

  /**
   * Pause the current recording
   * @returns {import('./types').RecordingResult}
   */
  pauseRecording() {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Screen recorder service not initialized',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    return this.engine.pauseRecording();
  }

  /**
   * Resume the paused recording
   * @returns {import('./types').RecordingResult}
   */
  resumeRecording() {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Screen recorder service not initialized',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    return this.engine.resumeRecording();
  }

  /**
   * Validate recording has started
   */
  validateRecording() {
    if (this.isInitialized && this.engine) {
      this.engine.validateRecording();
    }
  }

  /**
   * Handle recording error
   * @param {Error|string} error - Error that occurred
   */
  handleRecordingError(error) {
    if (this.isInitialized && this.engine) {
      this.engine.handleRecordingError(error);
      this.currentRecordingId = null;
    }
  }

  /**
   * Get current recording status
   * @returns {import('./types').RecordingStatus}
   */
  getStatus() {
    if (!this.isInitialized) {
      return {
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: 'Service not initialized',
        hasActiveProcess: false,
        recordingValidated: false
      };
    }

    const status = this.engine.getStatus();
    
    // Add device information
    if (this.deviceManager) {
      status.availableDevices = this.deviceManager.getFormattedDevices();
    }

    return status;
  }

  /**
   * Get available screen sources
   * @param {boolean} refresh - Whether to refresh device list
   * @returns {Promise<Array<import('./types').ScreenSource>>}
   */
  async getAvailableScreens(refresh = false) {
    if (!this.isInitialized || !this.deviceManager) {
      return [];
    }

    return await this.deviceManager.getAvailableScreens(refresh);
  }

  /**
   * Update audio devices from renderer
   * @param {Array<import('./types').AudioDevice>} audioDevices - Audio devices
   */
  updateAudioDevices(audioDevices) {
    if (this.isInitialized && this.deviceManager) {
      this.deviceManager.updateAudioDevices(audioDevices);
    }
  }

  /**
   * Validate device selection
   * @param {string} screenId - Screen ID
   * @param {string} audioId - Audio device ID
   * @returns {import('./types').DeviceValidation}
   */
  validateDeviceSelection(screenId, audioId) {
    if (!this.isInitialized || !this.deviceManager) {
      return { valid: false, issues: ['Service not initialized'] };
    }

    return this.deviceManager.validateDeviceSelection(screenId, audioId);
  }

  /**
   * Check system permissions
   * @returns {Promise<import('./types').PermissionStatus>}
   */
  async checkPermissions() {
    if (!this.isInitialized || !this.deviceManager) {
      return { screen: 'unknown', microphone: 'unknown' };
    }

    return await this.deviceManager.checkPermissions();
  }

  /**
   * Request system permissions
   * @returns {Promise<import('./types').PermissionStatus>}
   */
  async requestPermissions() {
    if (!this.isInitialized || !this.deviceManager) {
      return { screen: 'unknown', microphone: 'unknown' };
    }

    return await this.deviceManager.requestPermissions();
  }

  /**
   * Get all recordings
   * @returns {Promise<Array>}
   */
  async getRecordings() {
    if (!this.isInitialized || !this.fileManager) {
      return [];
    }

    return await this.fileManager.getAllRecordings();
  }

  /**
   * Delete a recording
   * @param {string} filePath - Path to recording file
   * @returns {Promise<Object>}
   */
  async deleteRecording(filePath) {
    if (!this.isInitialized || !this.fileManager) {
      return { success: false, error: 'Service not initialized' };
    }

    return await this.fileManager.deleteRecording(filePath);
  }

  /**
   * Force cleanup of resources
   */
  forceCleanup() {
    console.log('🧹 Force cleanup requested');
    
    if (this.engine) {
      this.engine.cleanup();
    }
    
    if (this.fileManager && this.config.autoCleanup) {
      this.fileManager.cleanupOldFiles().catch(error => {
        console.warn('⚠️ Auto cleanup failed:', error);
      });
    }
    
    this.currentRecordingId = null;
  }

  /**
   * Validate recording options
   * @param {import('./types').RecordingOptions} options - Options to validate
   * @returns {Promise<import('./types').DeviceValidation>}
   */
  async validateRecordingOptions(options) {
    const issues = [];

    // Check required fields
    if (!options.screenId) {
      issues.push('Screen ID is required');
    }

    // Validate device selection
    if (this.deviceManager && options.screenId) {
      const deviceValidation = this.deviceManager.validateDeviceSelection(
        options.screenId,
        options.audioInputId
      );
      
      if (!deviceValidation.valid) {
        issues.push(...deviceValidation.issues);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get screen source information
   * @param {string} screenId - Screen ID
   * @returns {Promise<import('./types').ScreenSource|null>}
   */
  async getScreenSourceInfo(screenId) {
    if (!this.deviceManager) {
      return null;
    }

    return this.deviceManager.getDeviceInfo(screenId);
  }

  /**
   * Generate unique recording ID
   * @returns {string}
   */
  generateRecordingId() {
    return `recording-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up all resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Screen Recorder Service');
    
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    
    if (this.deviceManager) {
      this.deviceManager.destroy();
      this.deviceManager = null;
    }
    
    if (this.fileManager) {
      this.fileManager.destroy();
      this.fileManager = null;
    }
    
    this.currentRecordingId = null;
    this.isInitialized = false;
  }

  /**
   * Destroy the service
   */
  destroy() {
    console.log('🗑️ Destroying Screen Recorder Service');
    
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = ScreenRecorderService; 