// src/main/screen-recorder/core/EnhancedScreenRecorderEngine.js
const { EventEmitter } = require('events');
const ApertureV7Recorder = require('../../services/aperture-recorder');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('../types');

/**
 * Enhanced Screen Recorder Engine with Aperture v7 integration for superior macOS system audio
 */
class EnhancedScreenRecorderEngine extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.state = RECORDING_STATES.IDLE;
    this.isRecording = false;
    this.isPaused = false;
    this.recordingValidated = false;
    
    // Platform-specific recorders
    this.apertureV7Recorder = null; // macOS with ScreenCaptureKit v7
    this.fallbackRecorder = null;   // Browser-based fallback
    
    // Current recording context
    this.currentMethod = null;
    this.recordingId = null;
    this.startTime = null;
    this.duration = 0;
    this.durationTimer = null;
  }

  /**
   * Initialize the enhanced recording engine
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Enhanced Screen Recorder Engine with Aperture v7...');
      
      // Determine best recording method for this platform
      this.currentMethod = await this.determineBestRecordingMethod();
      
      // Initialize the appropriate recorder
      await this.initializeRecorder();
      
      console.log(`✅ Enhanced engine initialized with method: ${this.currentMethod}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize enhanced engine:', error);
      throw error;
    }
  }

  /**
   * Determine the best recording method based on platform and capabilities
   */
  async determineBestRecordingMethod() {
    // Priority order for recording methods
    const methods = [
      {
        name: 'aperture-v7',
        check: () => this.checkApertureV7Availability(),
        capabilities: {
          systemAudio: true,
          quality: 'excellent',
          performance: 'excellent',
          stability: 'excellent'
        }
      },
      {
        name: 'browser',
        check: () => this.checkBrowserCapabilities(),
        capabilities: {
          systemAudio: false, // Limited system audio support
          quality: 'good',
          performance: 'good',
          stability: 'good'
        }
      }
    ];

    for (const method of methods) {
      try {
        const available = await method.check();
        if (available) {
          console.log(`✅ Selected recording method: ${method.name}`, method.capabilities);
          return method.name;
        }
      } catch (error) {
        console.warn(`⚠️ Method ${method.name} not available:`, error.message);
      }
    }

    throw new Error('No suitable recording method available');
  }

  /**
   * Check if Aperture v7 is available (macOS 13+ with ScreenCaptureKit)
   */
  async checkApertureV7Availability() {
    if (process.platform !== 'darwin') {
      return false;
    }

    try {
      // Check macOS version
      const version = this.getMacOSVersion();
      if (version < 13) {
        console.log('ℹ️ macOS version too old for ScreenCaptureKit, falling back to browser');
        return false;
      }

      // Try to load Aperture v7 ESM
      const aperture = await import('aperture');
      if (!aperture || !aperture.screens) {
        console.log('ℹ️ Aperture v7 not properly available, falling back to browser');
        return false;
      }

      // Test basic functionality
      const screens = await aperture.screens();
      if (screens.length === 0) {
        console.log('ℹ️ No screens available via Aperture, falling back to browser');
        return false;
      }

      console.log(`✅ Aperture v7 available with ${screens.length} screens`);
      return true;

    } catch (error) {
      console.log('ℹ️ Aperture v7 not available, falling back to browser:', error.message);
      return false;
    }
  }

  /**
   * Check browser recording capabilities
   */
  async checkBrowserCapabilities() {
    // Browser recording is always available as fallback
    return true;
  }

  /**
   * Initialize the appropriate recorder
   */
  async initializeRecorder() {
    switch (this.currentMethod) {
      case 'aperture-v7':
        await this.initializeApertureV7Recorder();
        break;
      case 'browser':
        await this.initializeBrowserRecorder();
        break;
      default:
        throw new Error(`Unknown recording method: ${this.currentMethod}`);
    }
  }

  /**
   * Initialize Aperture v7 recorder for macOS
   */
  async initializeApertureV7Recorder() {
    this.apertureV7Recorder = new ApertureV7Recorder();
    await this.apertureV7Recorder.initialize();

    // Forward events
    this.apertureV7Recorder.on('started', (data) => {
      this.recordingValidated = true;
      this.emit(RECORDING_EVENTS.STARTED, {
        ...data,
        method: 'aperture-v7',
        systemAudioCapable: true,
        apiVersion: 'v7'
      });
    });

    this.apertureV7Recorder.on('completed', (data) => {
      this.emit(RECORDING_EVENTS.COMPLETED, {
        ...data,
        method: 'aperture-v7',
        apiVersion: 'v7'
      });
    });

    this.apertureV7Recorder.on('error', (error) => {
      this.emit(RECORDING_EVENTS.ERROR, {
        error: error.message,
        method: 'aperture-v7',
        apiVersion: 'v7'
      });
    });

    console.log('✅ Aperture v7 recorder initialized');
  }

  /**
   * Initialize browser-based recorder (fallback)
   */
  async initializeBrowserRecorder() {
    // This would integrate with your existing browser-based recorder
    console.log('✅ Browser recorder initialized (fallback mode)');
  }

  /**
   * Start recording with enhanced capabilities
   */
  async startRecording(options, screenSource) {
    if (this.isRecording) {
      return { 
        success: false, 
        error: 'Already recording',
        type: ERROR_TYPES.START_ERROR
      };
    }

    try {
      this.setState(RECORDING_STATES.STARTING);
      
      // Prepare recording options with v7 enhancements
      const enhancedOptions = this.prepareRecordingOptions(options, screenSource);
      
      // Log recording method and capabilities
      this.logRecordingCapabilities(enhancedOptions);
      
      // Start recording with the appropriate method
      let result;
      switch (this.currentMethod) {
        case 'aperture-v7':
          result = await this.startApertureV7Recording(enhancedOptions);
          break;
        case 'browser':
          result = await this.startBrowserRecording(enhancedOptions);
          break;
        default:
          throw new Error(`Unknown recording method: ${this.currentMethod}`);
      }

      if (result.success) {
        this.isRecording = true;
        this.recordingId = result.recordingId;
        this.startTime = Date.now();
        this.startDurationTimer();
        this.setState(RECORDING_STATES.RECORDING);
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to start enhanced recording:', error);
      this.cleanup();
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.START_ERROR
      };
    }
  }

  /**
   * Prepare recording options with v7 enhancements
   */
  prepareRecordingOptions(options, screenSource) {
    const enhancedOptions = {
      ...options,
      screenSource,
      recordingMethod: this.currentMethod,
      apiVersion: 'v7',
      timestamp: new Date().toISOString()
    };

    // Platform-specific enhancements for v7
    if (this.currentMethod === 'aperture-v7') {
      enhancedOptions.systemAudioMethod = 'screencapturekit-v7';
      enhancedOptions.audioQualityEnhanced = true;
      
      // Enable system audio by default on macOS with Aperture v7
      if (enhancedOptions.includeSystemAudio === undefined) {
        enhancedOptions.includeSystemAudio = true;
      }
    }

    return enhancedOptions;
  }

  /**
   * Log recording capabilities and method
   */
  logRecordingCapabilities(options) {
    const capabilities = {
      method: this.currentMethod,
      apiVersion: this.currentMethod === 'aperture-v7' ? 'v7' : 'browser',
      systemAudio: options.includeSystemAudio,
      microphone: options.includeMicrophone,
      platform: process.platform,
      quality: options.videoQuality
    };

    console.log('🎯 Enhanced recording capabilities:', capabilities);

    if (this.currentMethod === 'aperture-v7') {
      console.log('🍎 Using ScreenCaptureKit v7 for superior macOS system audio');
      console.log('📦 Aperture v7 ESM API with native performance');
    } else {
      console.log('🌐 Using browser APIs (limited system audio support)');
    }
  }

  /**
   * Start Aperture v7 recording
   */
  async startApertureV7Recording(options) {
    return await this.apertureV7Recorder.startRecording(options);
  }

  /**
   * Start browser recording (fallback)
   */
  async startBrowserRecording(options) {
    // This would call your existing browser-based recording logic
    return {
      success: true,
      recordingId: `browser-${Date.now()}`,
      systemAudio: false // Limited browser system audio
    };
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { 
        success: true, 
        message: 'No recording in progress', 
        wasAlreadyStopped: true 
      };
    }

    try {
      this.setState(RECORDING_STATES.STOPPING);
      this.stopDurationTimer();

      let result;
      switch (this.currentMethod) {
        case 'aperture-v7':
          result = await this.apertureV7Recorder.stopRecording();
          break;
        case 'browser':
          result = await this.stopBrowserRecording();
          break;
        default:
          throw new Error(`Unknown recording method: ${this.currentMethod}`);
      }

      this.isRecording = false;
      this.setState(RECORDING_STATES.COMPLETED);

      return {
        ...result,
        method: this.currentMethod,
        apiVersion: this.currentMethod === 'aperture-v7' ? 'v7' : 'browser',
        duration: this.duration
      };

    } catch (error) {
      console.error('❌ Failed to stop enhanced recording:', error);
      this.cleanup();
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.STOP_ERROR
      };
    }
  }

  /**
   * Stop browser recording
   */
  async stopBrowserRecording() {
    return {
      success: true,
      outputPath: 'browser-recording.webm'
    };
  }

  /**
   * Get current status with enhanced information
   */
  getStatus() {
    const baseStatus = {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      duration: this.duration,
      recordingValidated: this.recordingValidated,
      state: this.state,
      method: this.currentMethod
    };

    // Add method-specific capabilities
    switch (this.currentMethod) {
      case 'aperture-v7':
        return {
          ...baseStatus,
          systemAudioCapable: true,
          systemAudioMethod: 'screencapturekit-v7',
          platform: 'macos',
          qualityLevel: 'excellent',
          apiVersion: 'v7'
        };
      case 'browser':
        return {
          ...baseStatus,
          systemAudioCapable: false,
          systemAudioMethod: 'browser-limited',
          platform: 'cross-platform',
          qualityLevel: 'good',
          apiVersion: 'browser'
        };
      default:
        return baseStatus;
    }
  }

  /**
   * Get recording method information
   */
  getMethodInfo() {
    const methods = {
      'aperture-v7': {
        name: 'Aperture v7 + ScreenCaptureKit',
        platform: 'macOS 13+',
        systemAudio: 'Native ScreenCaptureKit v7',
        quality: 'Excellent',
        performance: 'Excellent',
        features: ['System Audio', 'High Quality', 'Low CPU', 'Native macOS', 'ESM API']
      },
      'browser': {
        name: 'Browser MediaRecorder',
        platform: 'Cross-platform',
        systemAudio: 'Limited (getDisplayMedia)',
        quality: 'Good',
        performance: 'Good',
        features: ['Cross-platform', 'No dependencies', 'Standard Web APIs']
      }
    };

    return methods[this.currentMethod] || null;
  }

  // Utility methods
  getMacOSVersion() {
    const os = require('os');
    const release = os.release();
    const parts = release.split('.');
    const major = parseInt(parts[0]);
    return major - 9; // Rough Darwin to macOS version mapping
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`🔄 Enhanced recorder state: ${oldState} → ${newState} (${this.currentMethod})`);
  }

  startDurationTimer() {
    this.durationTimer = setInterval(() => {
      if (this.isRecording && !this.isPaused && this.startTime) {
        this.duration = Date.now() - this.startTime;
        
        this.emit(RECORDING_EVENTS.PROGRESS, {
          duration: this.duration,
          method: this.currentMethod,
          apiVersion: this.currentMethod === 'aperture-v7' ? 'v7' : 'browser',
          isRecording: this.isRecording,
          isPaused: this.isPaused
        });
      }
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up enhanced recorder...');
    
    this.stopDurationTimer();
    
    if (this.apertureV7Recorder) {
      await this.apertureV7Recorder.cleanup();
    }
    
    this.isRecording = false;
    this.isPaused = false;
    this.recordingValidated = false;
    this.recordingId = null;
    this.setState(RECORDING_STATES.IDLE);
  }

  destroy() {
    console.log('🗑️ Destroying enhanced recorder...');
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = EnhancedScreenRecorderEngine;