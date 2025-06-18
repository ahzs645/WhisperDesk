// ============================================================================

// src/main/screen-recorder/PlatformAwareScreenRecorderService.js
/**
 * Platform-aware screen recorder service that automatically selects
 * the best recording method for each platform
 */

const { EventEmitter } = require('events');
const PlatformRecordingRouter = require('./PlatformRecordingRouter');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('../types');

class PlatformAwareScreenRecorderService extends EventEmitter {
  constructor() {
    super();
    
    // Core components
    this.router = new PlatformRecordingRouter();
    this.recorder = null;
    this.selectedMethod = null;
    
    // Service state
    this.isInitialized = false;
    this.currentRecordingId = null;
    
    // Platform info
    this.platform = process.platform;
    this.capabilities = null;
  }

  /**
   * Initialize the platform-aware service (Fix 3: Simplified Recording Method Selection)
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Platform-aware service already initialized');
      return true;
    }

    try {
      console.log(`🚀 Initializing Platform-Aware Screen Recorder (${this.platform})...`);
      
      // Use simplified initialization with priority fallback
      this.recorder = await this.initializeScreenRecorder();
      this.capabilities = this.getSimplifiedCapabilities();
      
      // Set up event forwarding
      this.setupEventForwarding();
      
      this.isInitialized = true;
      
      console.log('✅ Platform-Aware Screen Recorder initialized');
      console.log('🎯 Selected method:', this.selectedMethod);
      console.log('🔧 Capabilities:', this.capabilities);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Platform-Aware Screen Recorder:', error);
      throw error;
    }
  }

  /**
   * Simplified screen recorder initialization with priority fallback
   */
  async initializeScreenRecorder() {
    try {
      // Try ScreenCaptureKit first (macOS only)
      if (process.platform === 'darwin') {
        console.log('🧪 Trying ScreenCaptureKit Node.js...');
        const ScreenCaptureKitNodeRecorder = require('../recorders/ScreenCaptureKitNodeRecorder');
        const recorder = new ScreenCaptureKitNodeRecorder();
        
        if (await recorder.initialize()) {
          this.selectedMethod = 'screencapturekit-node';
          console.log('✅ ScreenCaptureKit Node.js initialized successfully');
          return recorder;
        }
      }
      
      // Fallback to browser recording for all platforms
      console.log('🧪 Falling back to browser recording...');
      const BrowserFallbackRecorder = require('../recorders/BrowserFallbackRecorder');
      const recorder = new BrowserFallbackRecorder();
      
      await recorder.initialize();
      this.selectedMethod = 'browser-fallback';
      console.log('✅ Browser fallback recorder initialized');
      return recorder;
      
    } catch (error) {
      console.warn('Native recording failed, using browser fallback');
      const BrowserFallbackRecorder = require('../recorders/BrowserFallbackRecorder');
      const recorder = new BrowserFallbackRecorder();
      await recorder.initialize();
      this.selectedMethod = 'browser-fallback';
      return recorder;
    }
  }

  /**
   * Get simplified capabilities based on selected method
   */
  getSimplifiedCapabilities() {
    switch (this.selectedMethod) {
      case 'screencapturekit-node':
        return {
          platform: 'darwin',
          systemAudio: true,
          microphone: true,
          screenOnly: true,
          audioOnly: true,
          transcriptionOptimized: true
        };
      case 'browser-fallback':
        return {
          platform: 'cross-platform',
          systemAudio: false,
          microphone: true,
          screenOnly: true,
          audioOnly: false,
          transcriptionOptimized: false
        };
      default:
        return {
          platform: this.platform,
          systemAudio: false,
          microphone: false,
          screenOnly: false,
          audioOnly: false,
          transcriptionOptimized: false
        };
    }
  }

  /**
   * Set up event forwarding from recorder
   */
  setupEventForwarding() {
    if (!this.recorder) return;

    // Forward all recording events
    Object.values(RECORDING_EVENTS).forEach(eventName => {
      this.recorder.on(eventName, (data) => {
        this.emit(eventName, {
          ...data,
          method: this.selectedMethod,
          platform: this.platform,
          capabilities: this.capabilities
        });
      });
    });
  }

  /**
   * Start recording with platform-specific optimizations
   */
  async startRecording(options = {}) {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Service not initialized',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    try {
      console.log(`🎬 Starting ${this.selectedMethod} recording...`);
      
      // Add platform-specific enhancements to options
      const enhancedOptions = this.enhanceOptionsForPlatform(options);
      
      // Start recording with the selected recorder
      const result = await this.recorder.startRecording(enhancedOptions);
      
      if (result.success) {
        this.currentRecordingId = result.recordingId;
        console.log(`✅ ${this.selectedMethod} recording started`);
      }

      return {
        ...result,
        method: this.selectedMethod,
        platform: this.platform,
        capabilities: this.capabilities
      };

    } catch (error) {
      console.error(`❌ Failed to start ${this.selectedMethod} recording:`, error);
      return {
        success: false,
        error: error.message,
        type: ERROR_TYPES.START_ERROR,
        method: this.selectedMethod
      };
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording() {
    if (!this.isInitialized || !this.recorder) {
      return {
        success: false,
        error: 'Service not initialized',
        type: ERROR_TYPES.SERVICE_UNAVAILABLE
      };
    }

    try {
      console.log(`🛑 Stopping ${this.selectedMethod} recording...`);
      
      const result = await this.recorder.stopRecording();
      
      if (result.success) {
        console.log(`✅ ${this.selectedMethod} recording stopped`);
        this.currentRecordingId = null;
      }

      return {
        ...result,
        method: this.selectedMethod,
        platform: this.platform
      };

    } catch (error) {
      console.error(`❌ Failed to stop ${this.selectedMethod} recording:`, error);
      return {
        success: false,
        error: error.message,
        type: ERROR_TYPES.STOP_ERROR,
        method: this.selectedMethod
      };
    }
  }

  /**
   * Enhance options for current platform
   */
  enhanceOptionsForPlatform(options) {
    const enhanced = { ...options };

    switch (this.platform) {
      case 'darwin':
        // macOS: Always enable system audio with ScreenCaptureKit
        enhanced.includeSystemAudio = true;
        enhanced.systemAudioMethod = 'screencapturekit';
        enhanced.microphoneMethod = 'cpal';
        break;
        
      case 'win32':
        // Windows: Optimize for WASAPI/DirectSound
        enhanced.systemAudioMethod = 'browser';
        enhanced.microphoneMethod = 'cpal';
        enhanced.windowsAudioAPI = 'wasapi';
        break;
        
      case 'linux':
        // Linux: Detect and use best audio system
        enhanced.systemAudioMethod = 'browser';
        enhanced.microphoneMethod = 'cpal';
        enhanced.linuxAudioSystem = this.detectLinuxAudioSystem();
        break;
    }

    return enhanced;
  }

  /**
   * Detect Linux audio system
   */
  detectLinuxAudioSystem() {
    if (process.env.PULSE_SERVER || process.env.PULSE_RUNTIME_PATH) {
      return 'pulseaudio';
    } else if (process.env.JACK_DEFAULT_SERVER) {
      return 'jack';
    } else {
      return 'alsa';
    }
  }

  /**
   * Get current status with platform info
   */
  async getStatus() {
    const baseStatus = this.recorder ? this.recorder.getStatus() : {
      isRecording: false,
      isPaused: false,
      duration: 0
    };

    // Get available devices for the status
    let availableDevices = { screens: [], audio: [] };
    
    try {
      // Get screens from recorder
      const screenResult = await this.getAvailableScreens();
      if (screenResult.success && screenResult.screens) {
        availableDevices.screens = screenResult.screens;
      }
      
      // Get audio devices from recorder
      if (this.recorder && typeof this.recorder.getAvailableAudioDevices === 'function') {
        const audioDevices = await this.recorder.getAvailableAudioDevices();
        availableDevices.audio = audioDevices || [];
      }
      
      // Get microphones and add them to audio devices
      if (this.recorder && typeof this.recorder.getAvailableMicrophones === 'function') {
        const microphones = await this.recorder.getAvailableMicrophones();
        if (microphones && microphones.length > 0) {
          availableDevices.audio = [...availableDevices.audio, ...microphones];
        }
      }
      
      // Add default options if no devices found
      if (availableDevices.audio.length === 0) {
        availableDevices.audio = [
          { id: 'default', name: 'Default Microphone', type: 'audioinput' }
        ];
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to get devices for status:', error.message);
    }

    return {
      ...baseStatus,
      platform: this.platform,
      method: this.selectedMethod?.name || 'none',
      capabilities: this.capabilities,
      currentRecordingId: this.currentRecordingId,
      isInitialized: this.isInitialized,
      availableDevices: availableDevices
    };
  }

  /**
   * Get platform information
   */
  getPlatformInfo() {
    return {
      platform: this.platform,
      architecture: process.arch,
      selectedMethod: this.selectedMethod?.name || 'none',
      capabilities: this.capabilities,
      supportedFeatures: this.getSupportedFeatures()
    };
  }

  /**
   * Get supported features for current platform
   */
  getSupportedFeatures() {
    if (!this.capabilities) return [];

    const features = [];
    
    if (this.capabilities.systemAudio) {
      features.push(`System Audio (${this.capabilities.systemAudioMethod})`);
    }
    
    if (this.capabilities.microphone) {
      features.push(`Microphone (${this.capabilities.microphoneMethod})`);
    }
    
    if (this.capabilities.merger === 'ffmpeg') {
      features.push('FFmpeg Stream Merging');
    }
    
    features.push(`Quality: ${this.capabilities.quality}`);
    features.push(`Performance: ${this.capabilities.performance}`);
    
    return features;
  }

  /**
   * Pause recording (if supported)
   */
  async pauseRecording() {
    if (this.recorder && typeof this.recorder.pauseRecording === 'function') {
      return await this.recorder.pauseRecording();
    }
    return { success: false, error: 'Pause not supported by current recorder' };
  }

  /**
   * Resume recording (if supported)
   */
  async resumeRecording() {
    if (this.recorder && typeof this.recorder.resumeRecording === 'function') {
      return await this.recorder.resumeRecording();
    }
    return { success: false, error: 'Resume not supported by current recorder' };
  }

  /**
   * Update audio devices (delegate to recorder if supported)
   */
  async updateAudioDevices(audioDevices) {
    if (this.recorder && typeof this.recorder.updateAudioDevices === 'function') {
      return await this.recorder.updateAudioDevices(audioDevices);
    }
    
    // Default implementation - just return success
    console.log('📱 Audio devices updated:', audioDevices?.length || 0, 'devices');
    return { 
      success: true, 
      message: 'Audio devices updated (no specific recorder implementation)',
      devices: audioDevices || []
    };
  }

  /**
   * Get available screens (delegate to recorder if supported)
   */
  async getAvailableScreens(refresh = false) {
    if (this.recorder && typeof this.recorder.getAvailableScreens === 'function') {
      return await this.recorder.getAvailableScreens(refresh);
    }
    
    // Default implementation for basic screen detection
    try {
      const { screen } = require('electron');
      const displays = screen.getAllDisplays();
      
      const screens = displays.map((display, index) => ({
        id: display.id.toString(),
        name: `Display ${index + 1}`,
        primary: display.bounds.x === 0 && display.bounds.y === 0,
        bounds: display.bounds,
        workArea: display.workArea
      }));
      
      return { success: true, screens };
    } catch (error) {
      console.error('❌ Failed to get available screens:', error);
      return { success: false, error: error.message, screens: [] };
    }
  }

  /**
   * Check permissions (delegate to recorder if supported)
   */
  async checkPermissions() {
    if (this.recorder && typeof this.recorder.checkPermissions === 'function') {
      return await this.recorder.checkPermissions();
    }
    
    // Default implementation - assume permissions are needed
    return {
      screen: 'unknown',
      microphone: 'unknown',
      message: 'Permission check not implemented for current recorder'
    };
  }

  /**
   * Request permissions (delegate to recorder if supported)
   */
  async requestPermissions() {
    if (this.recorder && typeof this.recorder.requestPermissions === 'function') {
      return await this.recorder.requestPermissions();
    }
    
    // Default implementation
    return {
      success: false,
      error: 'Permission request not implemented for current recorder'
    };
  }

  /**
   * Validate device selection (delegate to recorder if supported)
   */
  async validateDeviceSelection(screenId, audioId) {
    if (this.recorder && typeof this.recorder.validateDeviceSelection === 'function') {
      return await this.recorder.validateDeviceSelection(screenId, audioId);
    }
    
    // Default validation
    return {
      success: true,
      message: 'Device validation not implemented for current recorder',
      screenId,
      audioId
    };
  }

  /**
   * Confirm recording complete (delegate to recorder if supported)
   */
  async confirmRecordingComplete(actualFilePath) {
    if (this.recorder && typeof this.recorder.confirmRecordingComplete === 'function') {
      return await this.recorder.confirmRecordingComplete(actualFilePath);
    }
    
    return {
      success: true,
      message: 'Recording completion confirmed',
      filePath: actualFilePath
    };
  }

  /**
   * Get recordings (delegate to recorder if supported)
   */
  async getRecordings() {
    if (this.recorder && typeof this.recorder.getRecordings === 'function') {
      return await this.recorder.getRecordings();
    }
    
    return {
      success: true,
      recordings: [],
      message: 'Recording list not implemented for current recorder'
    };
  }

  /**
   * Delete recording (delegate to recorder if supported)
   */
  async deleteRecording(filePath) {
    if (this.recorder && typeof this.recorder.deleteRecording === 'function') {
      return await this.recorder.deleteRecording(filePath);
    }
    
    return {
      success: false,
      error: 'Recording deletion not implemented for current recorder'
    };
  }

  /**
   * Validate recording (delegate to recorder if supported)
   */
  async validateRecording() {
    if (this.recorder && typeof this.recorder.validateRecording === 'function') {
      return await this.recorder.validateRecording();
    }
    
    return {
      success: true,
      message: 'Recording validation not implemented for current recorder'
    };
  }

  /**
   * Handle recording error (delegate to recorder if supported)
   */
  async handleRecordingError(errorData) {
    if (this.recorder && typeof this.recorder.handleRecordingError === 'function') {
      return await this.recorder.handleRecordingError(errorData);
    }
    
    console.error('🚨 Recording error handled:', errorData);
    return {
      success: true,
      message: 'Error handled by platform service',
      errorData
    };
  }

  /**
   * Force cleanup (delegate to recorder if supported)
   */
  async forceCleanup() {
    if (this.recorder && typeof this.recorder.forceCleanup === 'function') {
      return await this.recorder.forceCleanup();
    }
    
    this.cleanup();
    return {
      success: true,
      message: 'Platform service cleanup completed'
    };
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Platform-Aware Screen Recorder...');
    
    if (this.recorder) {
      this.recorder.cleanup();
      this.recorder = null;
    }
    
    this.currentRecordingId = null;
    this.isInitialized = false;
    this.selectedMethod = null;
    this.capabilities = null;
  }

  /**
   * Destroy the service
   */
  destroy() {
    console.log('🗑️ Destroying Platform-Aware Screen Recorder');
    
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = PlatformAwareScreenRecorderService;