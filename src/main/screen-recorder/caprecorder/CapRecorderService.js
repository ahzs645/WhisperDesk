/**
 * @fileoverview CapRecorder-based screen recording service
 * Uses the @firstform/caprecorder library for high-performance screen recording
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;

// Safely import CapRecorder with fallback for CI environments
let CapRecorder, listAvailableScreens, listAvailableWindows, hasScreenCapturePermission;
let capRecorderAvailable = false;

try {
  const capRecorderModule = require('@firstform/caprecorder');
  CapRecorder = capRecorderModule.CapRecorder;
  listAvailableScreens = capRecorderModule.listAvailableScreens;
  listAvailableWindows = capRecorderModule.listAvailableWindows;
  hasScreenCapturePermission = capRecorderModule.hasScreenCapturePermission;
  capRecorderAvailable = true;
  console.log('✅ CapRecorder native module loaded successfully');
} catch (error) {
  console.warn('⚠️ CapRecorder native module not available:', error.message);
  console.log('🔧 Using fallback implementation for CI/testing environments');
  capRecorderAvailable = false;
  
  // Provide mock implementations for CI environments
  CapRecorder = class MockCapRecorder {
    constructor() {
      this.isRecording = false;
    }
    async start() { throw new Error('CapRecorder not available in this environment'); }
    async stop() { throw new Error('CapRecorder not available in this environment'); }
    async pause() { throw new Error('CapRecorder not available in this environment'); }
    async resume() { throw new Error('CapRecorder not available in this environment'); }
  };
  
  listAvailableScreens = async () => [];
  listAvailableWindows = async () => [];
  hasScreenCapturePermission = async () => false;
}

/**
 * CapRecorder-based screen recording service
 * Provides a high-performance, cross-platform screen recording solution
 */
class CapRecorderService extends EventEmitter {
  constructor() {
    super();
    
    // CapRecorder instance
    this.recorder = null;
    
    // Service state
    this.isInitialized = false;
    this.isRecording = false;
    this.isPaused = false;
    this.currentRecordingId = null;
    this.currentOutputPath = null;
    
    // Configuration
    this.config = {
      defaultFps: 30,
      defaultOutputDir: path.join(process.cwd(), 'recordings'),
      captureSystemAudio: true,
      enablePermissionChecks: true
    };
  }

  /**
   * Initialize the CapRecorder service
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ CapRecorder service already initialized');
      return true;
    }

    try {
      console.log('🔧 Initializing CapRecorder Service...');
      
      // Check if CapRecorder is available
      if (!capRecorderAvailable) {
        console.warn('⚠️ CapRecorder native module not available');
        console.log('🔧 Service will operate in limited mode for CI/testing environments');
        this.isInitialized = true;
        return true;
      }
      
      // Check permissions
      if (this.config.enablePermissionChecks) {
        const hasPermission = hasScreenCapturePermission();
        if (!hasPermission) {
          console.warn('⚠️ Screen capture permission not granted');
          console.log('📝 Please grant screen recording permission in System Preferences');
        }
      }
      
      // Create output directory
      await this.ensureOutputDirectory();
      
      this.isInitialized = true;
      console.log('✅ CapRecorder Service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize CapRecorder Service:', error);
      throw error;
    }
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDirectory() {
    try {
      await fs.access(this.config.defaultOutputDir);
    } catch (error) {
      console.log(`📁 Creating output directory: ${this.config.defaultOutputDir}`);
      await fs.mkdir(this.config.defaultOutputDir, { recursive: true });
    }
  }

  /**
   * Start a new recording
   * @param {Object} options - Recording options
   * @param {string} [options.outputPath] - Directory where recording will be saved
   * @param {number} [options.screenId] - ID of screen to record
   * @param {number} [options.windowId] - ID of window to record
   * @param {boolean} [options.captureSystemAudio] - Whether to capture system audio
   * @param {number} [options.fps] - Recording frame rate
   * @param {string} [options.filename] - Custom filename prefix
   * @returns {Promise<Object>} Recording result
   */
  async startRecording(options = {}) {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'CapRecorder service not initialized',
        type: 'SERVICE_UNAVAILABLE'
      };
    }

    if (!capRecorderAvailable) {
      return {
        success: false,
        error: 'CapRecorder native module not available in this environment',
        type: 'CAPRECORDER_UNAVAILABLE'
      };
    }

    if (this.isRecording) {
      return {
        success: false,
        error: 'Recording already in progress',
        type: 'ALREADY_RECORDING'
      };
    }

    try {
      console.log('🎬 Starting CapRecorder recording...', options);

      // Validate screen capture permission
      if (!hasScreenCapturePermission()) {
        return {
          success: false,
          error: 'Screen capture permission required. Please grant permission in System Preferences.',
          type: 'PERMISSION_DENIED'
        };
      }

      // Validate recording target
      if (!options.screenId && !options.windowId) {
        // Default to first available screen
        const screens = this.getAvailableScreens();
        if (screens.length === 0) {
          return {
            success: false,
            error: 'No screens available for recording',
            type: 'NO_SCREENS'
          };
        }
        options.screenId = screens[0].id;
        console.log(`📺 Using default screen: ${screens[0].name} (ID: ${screens[0].id})`);
      }

      // Generate recording ID and output path
      this.currentRecordingId = this.generateRecordingId();
      const outputDir = options.outputPath || this.config.defaultOutputDir;
      const filename = options.filename || `recording-${this.currentRecordingId}`;
      this.currentOutputPath = path.join(outputDir, filename);

      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Create CapRecorder instance
      this.recorder = new CapRecorder();

      // Configure recording options
      const recordingConfig = {
        outputPath: this.currentOutputPath,
        captureSystemAudio: options.captureSystemAudio !== false ? this.config.captureSystemAudio : false,
        fps: options.fps || this.config.defaultFps
      };

      // Add screen or window ID
      if (options.screenId) {
        recordingConfig.screenId = options.screenId;
      } else if (options.windowId) {
        recordingConfig.windowId = options.windowId;
      }

      console.log('📋 Recording configuration:', recordingConfig);

      // Start recording
      await this.recorder.startRecording(recordingConfig);

      // Update state
      this.isRecording = true;
      this.isPaused = false;

      console.log(`🎬 Recording started: ${this.currentRecordingId}`);
      console.log(`📁 Output path: ${this.currentOutputPath}`);

      // Emit recording started event
      this.emit('recordingStarted', {
        recordingId: this.currentRecordingId,
        outputPath: this.currentOutputPath,
        config: recordingConfig
      });

      return {
        success: true,
        recordingId: this.currentRecordingId,
        outputPath: this.currentOutputPath,
        config: recordingConfig
      };

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      
      // Cleanup on error
      this.isRecording = false;
      this.isPaused = false;
      this.currentRecordingId = null;
      this.currentOutputPath = null;
      
      if (this.recorder) {
        try {
          await this.recorder.cancelRecording();
        } catch (cleanupError) {
          console.warn('⚠️ Failed to cleanup recording:', cleanupError);
        }
        this.recorder = null;
      }

      return {
        success: false,
        error: error.message,
        type: 'RECORDING_ERROR'
      };
    }
  }

  /**
   * Stop the current recording
   * @returns {Promise<Object>} Stop result with output path
   */
  async stopRecording() {
    if (!this.isRecording || !this.recorder) {
      return {
        success: false,
        error: 'No recording in progress',
        type: 'NOT_RECORDING'
      };
    }

    try {
      console.log(`🛑 Stopping recording: ${this.currentRecordingId}`);

      // Stop recording and get final output path
      const finalOutputPath = await this.recorder.stopRecording();

      const recordingId = this.currentRecordingId;
      const outputPath = finalOutputPath || this.currentOutputPath;

      // Reset state
      this.isRecording = false;
      this.isPaused = false;
      this.currentRecordingId = null;
      this.currentOutputPath = null;
      this.recorder = null;

      console.log(`✅ Recording stopped: ${recordingId}`);
      console.log(`📁 Final output: ${outputPath}`);

      // Emit recording stopped event
      this.emit('recordingStopped', {
        recordingId,
        outputPath,
        success: true
      });

      return {
        success: true,
        recordingId,
        outputPath
      };

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);

      // Force cleanup
      this.isRecording = false;
      this.isPaused = false;
      this.currentRecordingId = null;
      this.currentOutputPath = null;
      this.recorder = null;

      return {
        success: false,
        error: error.message,
        type: 'STOP_ERROR'
      };
    }
  }

  /**
   * Pause the current recording
   * @returns {Promise<Object>} Pause result
   */
  async pauseRecording() {
    if (!this.isRecording || !this.recorder) {
      return {
        success: false,
        error: 'No recording in progress',
        type: 'NOT_RECORDING'
      };
    }

    if (this.isPaused) {
      return {
        success: false,
        error: 'Recording already paused',
        type: 'ALREADY_PAUSED'
      };
    }

    try {
      console.log(`⏸️ Pausing recording: ${this.currentRecordingId}`);

      await this.recorder.pauseRecording();
      this.isPaused = true;

      console.log(`⏸️ Recording paused: ${this.currentRecordingId}`);

      // Emit recording paused event
      this.emit('recordingPaused', {
        recordingId: this.currentRecordingId
      });

      return {
        success: true,
        recordingId: this.currentRecordingId
      };

    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      return {
        success: false,
        error: error.message,
        type: 'PAUSE_ERROR'
      };
    }
  }

  /**
   * Resume the current recording
   * @returns {Promise<Object>} Resume result
   */
  async resumeRecording() {
    if (!this.isRecording || !this.recorder) {
      return {
        success: false,
        error: 'No recording in progress',
        type: 'NOT_RECORDING'
      };
    }

    if (!this.isPaused) {
      return {
        success: false,
        error: 'Recording is not paused',
        type: 'NOT_PAUSED'
      };
    }

    try {
      console.log(`▶️ Resuming recording: ${this.currentRecordingId}`);

      await this.recorder.resumeRecording();
      this.isPaused = false;

      console.log(`▶️ Recording resumed: ${this.currentRecordingId}`);

      // Emit recording resumed event
      this.emit('recordingResumed', {
        recordingId: this.currentRecordingId
      });

      return {
        success: true,
        recordingId: this.currentRecordingId
      };

    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      return {
        success: false,
        error: error.message,
        type: 'RESUME_ERROR'
      };
    }
  }

  /**
   * Cancel the current recording
   * @returns {Promise<Object>} Cancel result
   */
  async cancelRecording() {
    if (!this.isRecording || !this.recorder) {
      return {
        success: false,
        error: 'No recording in progress',
        type: 'NOT_RECORDING'
      };
    }

    try {
      console.log(`🚫 Canceling recording: ${this.currentRecordingId}`);

      await this.recorder.cancelRecording();

      const recordingId = this.currentRecordingId;

      // Reset state
      this.isRecording = false;
      this.isPaused = false;
      this.currentRecordingId = null;
      this.currentOutputPath = null;
      this.recorder = null;

      console.log(`🚫 Recording canceled: ${recordingId}`);

      // Emit recording canceled event
      this.emit('recordingCanceled', {
        recordingId
      });

      return {
        success: true,
        recordingId
      };

    } catch (error) {
      console.error('❌ Failed to cancel recording:', error);

      // Force cleanup
      this.isRecording = false;
      this.isPaused = false;
      this.currentRecordingId = null;
      this.currentOutputPath = null;
      this.recorder = null;

      return {
        success: false,
        error: error.message,
        type: 'CANCEL_ERROR'
      };
    }
  }

  /**
   * Get current recording status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      currentRecordingId: this.currentRecordingId,
      currentOutputPath: this.currentOutputPath,
      platform: process.platform,
      method: 'caprecorder',
      capRecorderAvailable: capRecorderAvailable,
      capabilities: {
        screenCapture: capRecorderAvailable,
        windowCapture: capRecorderAvailable,
        systemAudio: capRecorderAvailable,
        pauseResume: capRecorderAvailable,
        crossPlatform: capRecorderAvailable
      }
    };
  }

  /**
   * Get available screens
   * @returns {Array} List of available screens
   */
  getAvailableScreens() {
    if (!capRecorderAvailable) {
      console.warn('⚠️ CapRecorder not available - returning empty screen list');
      return [];
    }
    
    try {
      return listAvailableScreens();
    } catch (error) {
      console.error('❌ Failed to get available screens:', error);
      return [];
    }
  }

  /**
   * Get available windows
   * @returns {Array} List of available windows
   */
  getAvailableWindows() {
    if (!capRecorderAvailable) {
      console.warn('⚠️ CapRecorder not available - returning empty window list');
      return [];
    }
    
    try {
      return listAvailableWindows();
    } catch (error) {
      console.error('❌ Failed to get available windows:', error);
      return [];
    }
  }

  /**
   * Check screen capture permissions
   * @returns {Object} Permission status
   */
  checkPermissions() {
    try {
      const hasPermission = hasScreenCapturePermission();
      return {
        screen: hasPermission ? 'granted' : 'denied',
        microphone: 'unknown' // CapRecorder handles audio permissions internally
      };
    } catch (error) {
      console.error('❌ Failed to check permissions:', error);
      return {
        screen: 'unknown',
        microphone: 'unknown'
      };
    }
  }

  /**
   * Request screen capture permissions
   * Note: This typically requires the user to manually grant permissions in system settings
   * @returns {Promise<Object>} Permission request result
   */
  async requestPermissions() {
    return {
      success: false,
      message: 'Please manually grant screen recording permission in System Preferences > Security & Privacy > Privacy > Screen Recording',
      instructions: {
        macOS: 'System Preferences > Security & Privacy > Privacy > Screen Recording',
        windows: 'Permissions are typically granted automatically',
        linux: 'Permissions depend on your desktop environment'
      }
    };
  }

  /**
   * Generate a unique recording ID
   * @returns {string} Unique recording ID
   */
  generateRecordingId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `rec_${timestamp}_${random}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up CapRecorder service...');
    
    if (this.isRecording && this.recorder) {
      try {
        await this.recorder.cancelRecording();
      } catch (error) {
        console.warn('⚠️ Failed to cancel recording during cleanup:', error);
      }
    }
    
    this.isRecording = false;
    this.isPaused = false;
    this.currentRecordingId = null;
    this.currentOutputPath = null;
    this.recorder = null;
    this.isInitialized = false;
    
    console.log('✅ CapRecorder service cleanup completed');
  }
}

module.exports = CapRecorderService;
