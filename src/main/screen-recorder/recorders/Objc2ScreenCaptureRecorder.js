/**
 * ScreenCaptureKit recorder using objc2 Rust bindings
 * Provides direct access to ScreenCaptureKit APIs for maximum performance and control
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class Objc2ScreenCaptureRecorder extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.isRecording = false;
    this.recordingId = null;
    this.startTime = null;
    
    // Native module
    this.nativeRecorder = null;
    this.nativeModule = null;
    
    // Output paths
    this.outputPath = null;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-objc2-recordings');
    
    // Recording options
    this.currentOptions = null;
  }

  /**
   * Initialize the objc2 ScreenCaptureKit recorder
   */
  async initialize() {
    try {
      console.log('🦀 Initializing objc2 ScreenCaptureKit Recorder...');
      
      // Check platform
      if (process.platform !== 'darwin') {
        throw new Error('objc2 ScreenCaptureKit is only available on macOS');
      }

      // Load native module
      await this.loadNativeModule();

      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });

      // Create native recorder instance
      this.nativeRecorder = new this.nativeModule.ScreenCaptureKitRecorder();

      // Test capabilities
      await this.testCapabilities();

      console.log('✅ objc2 ScreenCaptureKit Recorder initialized');
      console.log('🎯 Features: Direct ScreenCaptureKit API access, maximum performance');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize objc2 ScreenCaptureKit recorder:', error);
      throw error;
    }
  }

  /**
   * Load the native Rust module
   */
  async loadNativeModule() {
    try {
      // Try to load the native module
      // The exact path will depend on your build setup
      const modulePaths = [
        // Development build - napi-rs generated file
        path.join(__dirname, '../../../../native/whisperdesk-screencapturekit/whisperdesk-screencapturekit.darwin-arm64.node'),
        path.join(__dirname, '../../../../native/whisperdesk-screencapturekit/whisperdesk-screencapturekit.darwin-x64.node'),
        
        // Development build - raw cargo output
        path.join(__dirname, '../../../../native/whisperdesk-screencapturekit/target/release/libwhisperdesk_screencapturekit.dylib'),
        path.join(__dirname, '../../../../native/target/release/libwhisperdesk_screencapturekit.dylib'),
        
        // Production build (only if resourcesPath exists)
        ...(process.resourcesPath ? [
          path.join(process.resourcesPath, 'app.asar.unpacked', 'native', 'whisperdesk-screencapturekit.darwin-arm64.node'),
          path.join(process.resourcesPath, 'app.asar.unpacked', 'native', 'whisperdesk-screencapturekit.darwin-x64.node'),
          path.join(process.resourcesPath, 'native', 'whisperdesk-screencapturekit.darwin-arm64.node'),
          path.join(process.resourcesPath, 'native', 'whisperdesk-screencapturekit.darwin-x64.node'),
        ] : []),
        
        // Installed via npm (try-catch this since it might not exist)
        // require.resolve('whisperdesk-screencapturekit'),
      ];

      let loadError = null;
      for (const modulePath of modulePaths) {
        try {
          if (await this.fileExists(modulePath)) {
            console.log(`🦀 Loading native objc2 module from: ${modulePath}`);
            this.nativeModule = require(modulePath);
            
            // Initialize the module
            this.nativeModule.initScreencapturekit();
            
            console.log('✅ Native objc2 module loaded successfully');
            return;
          }
        } catch (error) {
          loadError = error;
          console.warn(`⚠️ Failed to load from ${modulePath}:`, error.message);
        }
      }

      // If we get here, no module was found
      throw new Error(`Native objc2 module not found. Searched paths: ${modulePaths.join(', ')}. Last error: ${loadError?.message}`);
      
    } catch (error) {
      throw new Error(`Failed to load native objc2 module: ${error.message}`);
    }
  }

  /**
   * Test recorder capabilities
   */
  async testCapabilities() {
    try {
      // Test screen enumeration
      const screens = this.nativeRecorder.getAvailableScreens();
      if (!screens || screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      console.log(`📺 Found ${screens.length} screen(s) via objc2`);

      // Test audio device enumeration
      try {
        const audioDevices = this.nativeRecorder.getAvailableAudioDevices();
        console.log(`🔊 Found ${audioDevices.length} audio device(s) via objc2`);
      } catch (error) {
        console.warn('⚠️ Audio devices not available:', error.message);
      }

      console.log('🦀 objc2 ScreenCaptureKit capabilities verified');
      
    } catch (error) {
      throw new Error(`Capability test failed: ${error.message}`);
    }
  }

  /**
   * Start recording with objc2 ScreenCaptureKit
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    if (!this.nativeRecorder) {
      throw new Error('Native recorder not initialized');
    }

    try {
      this.currentOptions = options;
      this.recordingId = `objc2-screencapturekit-${Date.now()}`;
      this.startTime = Date.now();
      
      console.log('🦀 Starting objc2 ScreenCaptureKit recording...');

      // Generate output path
      this.outputPath = this.generateOutputPath(options);

      // Build native configuration
      const nativeConfig = this.buildNativeConfiguration(options);
      
      console.log('🔧 objc2 Recording configuration:', {
        screenId: options.screenId,
        outputPath: this.outputPath,
        width: nativeConfig.width,
        height: nativeConfig.height,
        fps: nativeConfig.fps,
        captureAudio: nativeConfig.capture_audio,
        showCursor: nativeConfig.show_cursor
      });

      // Start recording via native module
      this.nativeRecorder.startRecording(options.screenId, nativeConfig);

      this.isRecording = true;
      
      this.emit('started', {
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        method: 'objc2-screencapturekit',
        nativeAccess: true,
        directAPI: true
      });

      console.log('✅ objc2 ScreenCaptureKit recording started');
      
      return {
        success: true,
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        method: 'objc2-screencapturekit'
      };

    } catch (error) {
      console.error('❌ Failed to start objc2 recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Build native configuration object
   */
  buildNativeConfiguration(options) {
    const config = {
      output_path: this.outputPath,
      show_cursor: options.showCursor !== false,
      capture_audio: options.includeSystemAudio || options.includeMicrophone || false,
    };

    // Video settings
    if (options.width) config.width = options.width;
    if (options.height) config.height = options.height;
    if (options.fps) config.fps = options.fps;
    
    // Audio settings
    if (options.audioInputId && options.audioInputId !== 'default') {
      config.audio_device_id = options.audioInputId;
    }

    // Quality settings
    switch (options.videoQuality) {
      case 'low':
        config.fps = config.fps || 15;
        config.pixel_format = '420v'; // More compressed
        break;
      case 'high':
        config.fps = config.fps || 60;
        config.pixel_format = 'bgra'; // High quality
        break;
      default: // medium
        config.fps = config.fps || 30;
        break;
    }

    return config;
  }

  /**
   * Stop objc2 ScreenCaptureKit recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { 
        success: true, 
        message: 'No recording in progress', 
        outputPath: null 
      };
    }

    try {
      console.log('🦀 Stopping objc2 ScreenCaptureKit recording...');

      // Stop recording via native module
      const outputPath = this.nativeRecorder.stopRecording();

      this.isRecording = false;
      const duration = Date.now() - this.startTime;

      this.emit('stopped', {
        recordingId: this.recordingId,
        outputPath: outputPath,
        duration: duration,
        method: 'objc2-screencapturekit'
      });

      console.log('✅ objc2 ScreenCaptureKit recording stopped');
      console.log(`📁 Output file: ${outputPath}`);
      console.log(`⏱️ Duration: ${Math.round(duration / 1000)}s`);

      // Reset state
      this.recordingId = null;
      this.startTime = null;
      this.outputPath = null;
      this.currentOptions = null;

      return {
        success: true,
        outputPath: outputPath,
        duration: duration,
        method: 'objc2-screencapturekit'
      };

    } catch (error) {
      console.error('❌ Failed to stop objc2 recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Get available screens via objc2
   */
  async getAvailableScreens() {
    if (!this.nativeRecorder) {
      throw new Error('Native recorder not initialized');
    }

    try {
      const screens = this.nativeRecorder.getAvailableScreens();
      
      return {
        success: true,
        screens: screens.map(screen => ({
          id: screen.id,
          name: screen.name,
          width: screen.width,
          height: screen.height,
          isDisplay: screen.is_display,
          primary: screen.id.includes('display:1') // Assume first display is primary
        })),
        method: 'objc2-screencapturekit'
      };
    } catch (error) {
      console.error('❌ Failed to get screens via objc2:', error);
      throw error;
    }
  }

  /**
   * Get available audio devices via objc2
   */
  async getAvailableAudioDevices() {
    if (!this.nativeRecorder) {
      throw new Error('Native recorder not initialized');
    }

    try {
      const devices = this.nativeRecorder.getAvailableAudioDevices();
      
      return {
        success: true,
        devices: devices.map(device => ({
          id: device.id,
          name: device.name,
          type: device.device_type,
          isDefault: device.name.toLowerCase().includes('built-in')
        })),
        method: 'objc2-screencapturekit'
      };
    } catch (error) {
      console.error('❌ Failed to get audio devices via objc2:', error);
      throw error;
    }
  }

  /**
   * Check recording permissions
   */
  async checkPermissions() {
    // ScreenCaptureKit handles permissions internally
    // This would be implemented based on your app's permission handling
    return {
      screen: true, // ScreenCaptureKit will prompt if needed
      microphone: true // Will be checked when audio devices are accessed
    };
  }

  /**
   * Get current recording status
   */
  getStatus() {
    const nativeStatus = this.nativeRecorder ? this.nativeRecorder.getStatus() : null;
    
    return {
      isRecording: this.isRecording,
      recordingId: this.recordingId,
      outputPath: this.outputPath,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      method: 'objc2-screencapturekit',
      nativeStatus: nativeStatus,
      capabilities: {
        directAPI: true,
        nativePerformance: true,
        maxQuality: true,
        systemAudio: true,
        microphone: true,
        windowCapture: true,
        displayCapture: true
      }
    };
  }

  /**
   * Generate output file path
   */
  generateOutputPath(options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `objc2-screencapturekit-${timestamp}.mov`;
    
    if (options.outputPath) {
      return path.resolve(options.outputPath, filename);
    }
    
    return path.join(this.tempDir, filename);
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.isRecording && this.nativeRecorder) {
        try {
          this.nativeRecorder.stopRecording();
        } catch (error) {
          console.warn('⚠️ Error during cleanup stop:', error.message);
        }
      }

      this.isRecording = false;
      this.recordingId = null;
      this.startTime = null;
      this.outputPath = null;
      this.currentOptions = null;

      console.log('🧹 objc2 ScreenCaptureKit recorder cleaned up');
    } catch (error) {
      console.error('❌ Error during objc2 cleanup:', error);
    }
  }

  /**
   * Destroy the recorder instance
   */
  destroy() {
    this.cleanup();
    this.removeAllListeners();
    this.nativeRecorder = null;
    this.nativeModule = null;
  }
}

// Integration helper class
class Objc2Integration {
  /**
   * Add objc2 ScreenCaptureKit recorder to platform router
   */
  static addToRouter(platformRouter) {
    if (process.platform !== 'darwin') {
      console.log('⏭️ Skipping objc2 ScreenCaptureKit integration on non-macOS platform');
      return;
    }

    try {
      // Register the objc2 recorder as highest priority
      platformRouter.registerRecorder('objc2-screencapturekit', Objc2ScreenCaptureRecorder, {
        priority: 100, // Highest priority
        platform: 'darwin',
        minVersion: '13.0',
        features: ['screen', 'audio', 'window', 'display'],
        performance: 'maximum',
        api: 'direct'
      });

      console.log('✅ objc2 ScreenCaptureKit integration added to platform router');
    } catch (error) {
      console.error('❌ Failed to add objc2 integration to router:', error);
    }
  }
}

module.exports = Objc2ScreenCaptureRecorder;
module.exports.Objc2Integration = Objc2Integration; 