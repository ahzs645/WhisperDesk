// src/main/screen-recorder/recorders/MacOSScreenCaptureRecorder.js
/**
 * Simplified macOS Screen Recorder using ONLY ScreenCaptureKit
 * No CPAL, No FFmpeg merging - ScreenCaptureKit handles everything natively
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class MacOSScreenCaptureRecorder extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.isRecording = false;
    this.recordingId = null;
    this.startTime = null;
    
    // ScreenCaptureKit only
    this.aperture = null;
    this.currentRecorder = null;
    
    // Single output file (no merging needed)
    this.outputPath = null;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-screencapturekit');
    
    // Recording options
    this.currentOptions = null;
  }

  /**
   * Initialize ScreenCaptureKit recorder
   */
  async initialize() {
    try {
      console.log('🍎 Initializing Simplified macOS ScreenCaptureKit Recorder...');
      
      // Check macOS version (ScreenCaptureKit requires macOS 13+)
      if (process.platform !== 'darwin') {
        throw new Error('ScreenCaptureKit is only available on macOS');
      }

      const version = this.getMacOSVersion();
      if (version < 13) {
        throw new Error('ScreenCaptureKit requires macOS 13+ (Ventura or later)');
      }

      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });

      // Load Aperture v7 for ScreenCaptureKit access
      await this.loadApertureV7();

      console.log('✅ Simplified macOS ScreenCaptureKit Recorder initialized');
      console.log('🎯 Features: Native screen + system audio + microphone in single stream');
      console.log('🚫 No CPAL dependency');
      console.log('🚫 No FFmpeg merging needed');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ScreenCaptureKit recorder:', error);
      throw error;
    }
  }

  /**
   * Load Aperture v7 for ScreenCaptureKit access
   */
  async loadApertureV7() {
    try {
      console.log('📦 Loading Aperture v7 for ScreenCaptureKit...');
      this.aperture = await import('aperture');
      
      // Test ScreenCaptureKit availability
      const screens = await this.aperture.screens();
      console.log(`✅ ScreenCaptureKit available with ${screens.length} screens`);
      
      if (screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
    } catch (error) {
      console.error('❌ Failed to load ScreenCaptureKit:', error);
      throw new Error(`ScreenCaptureKit loading failed: ${error.message}`);
    }
  }

  /**
   * Start recording with pure ScreenCaptureKit
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    if (!this.aperture) {
      throw new Error('ScreenCaptureKit not initialized');
    }

    try {
      this.currentOptions = options;
      this.recordingId = `screencapturekit-${Date.now()}`;
      this.startTime = Date.now();
      
      // Generate single output file path
      this.outputPath = this.generateOutputPath(options);

      console.log('🍎 Starting ScreenCaptureKit recording...');
      console.log('📁 Output path:', this.outputPath);
      console.log('🎯 Single stream: screen + system audio + microphone');

      // Get screen and audio configuration
      const recordingConfig = await this.buildRecordingConfig(options);
      
      // Start ScreenCaptureKit recording
      await this.startScreenCaptureKit(recordingConfig);

      this.isRecording = true;
      
      this.emit('started', {
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        method: 'screencapturekit-native',
        systemAudio: recordingConfig.includeSystemAudio,
        microphone: recordingConfig.includeMicrophone,
        singleStream: true
      });

      console.log('✅ ScreenCaptureKit recording started successfully');
      
      return {
        success: true,
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        method: 'screencapturekit-native',
        systemAudio: recordingConfig.includeSystemAudio,
        microphone: recordingConfig.includeMicrophone
      };

    } catch (error) {
      console.error('❌ Failed to start ScreenCaptureKit recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Build ScreenCaptureKit recording configuration
   */
  async buildRecordingConfig(options) {
    const screens = await this.aperture.screens();
    
    // Find target screen
    let targetScreen = screens[0]; // Default to first screen
    if (options.screenId) {
      const foundScreen = screens.find(s => s.id === options.screenId);
      if (foundScreen) {
        targetScreen = foundScreen;
      }
    }

    // Get audio devices if needed
    let audioDevices = [];
    if (options.includeMicrophone) {
      try {
        audioDevices = await this.aperture.audioDevices();
      } catch (error) {
        console.warn('⚠️ Could not get audio devices:', error.message);
      }
    }

    const config = {
      screen: targetScreen,
      destination: this.outputPath,
      
      // Audio configuration - ScreenCaptureKit handles all natively
      includeSystemAudio: options.includeSystemAudio !== false, // Default true
      includeMicrophone: options.includeMicrophone || false,
      
      // Video quality
      videoQuality: options.videoQuality || 'medium',
      frameRate: this.getFrameRateForQuality(options.videoQuality),
      
      // Audio quality
      audioQuality: 'high', // ScreenCaptureKit provides high quality by default
      audioSampleRate: 44100,
      
      // Recording options
      showCursor: options.showCursor !== false,
      highlightClicks: options.highlightClicks || false,
      
      // Output format
      format: 'mp4' // ScreenCaptureKit outputs MP4 directly
    };

    // Add specific microphone device if requested
    if (config.includeMicrophone && options.audioInputId && audioDevices.length > 0) {
      const targetMicrophone = audioDevices.find(d => d.id === options.audioInputId);
      if (targetMicrophone) {
        config.microphoneDevice = targetMicrophone;
      }
    }

    console.log('🔧 ScreenCaptureKit config:', {
      screen: config.screen.name,
      systemAudio: config.includeSystemAudio,
      microphone: config.includeMicrophone,
      quality: config.videoQuality,
      format: config.format
    });

    return config;
  }

  /**
   * Start ScreenCaptureKit recording with unified configuration
   */
  async startScreenCaptureKit(config) {
    try {
      // Build Aperture recording options for ScreenCaptureKit
      const apertureOptions = {
        destination: config.destination,
        screen: config.screen.id,
        
        // Video settings
        fps: config.frameRate,
        showCursor: config.showCursor,
        highlightClicks: config.highlightClicks,
        
        // Audio settings - ScreenCaptureKit handles all audio natively
        recordAudio: config.includeSystemAudio || config.includeMicrophone,
        
        // Quality settings
        videoQuality: config.videoQuality
      };

      // Add system audio capture
      if (config.includeSystemAudio) {
        apertureOptions.captureSystemAudio = true;
      }

      // Add microphone capture
      if (config.includeMicrophone) {
        apertureOptions.captureMicrophone = true;
        if (config.microphoneDevice) {
          apertureOptions.microphoneDeviceId = config.microphoneDevice.id;
        }
      }

      console.log('🚀 Starting ScreenCaptureKit with options:', apertureOptions);

      // Start recording through Aperture's ScreenCaptureKit interface
      this.currentRecorder = this.aperture.recorder;
      
      if (typeof this.currentRecorder.startRecording === 'function') {
        await this.currentRecorder.startRecording(apertureOptions);
      } else if (typeof this.currentRecorder.record === 'function') {
        await this.currentRecorder.record(apertureOptions);
      } else {
        throw new Error('ScreenCaptureKit recording method not found');
      }
      
      console.log('✅ ScreenCaptureKit recording session started');
      
    } catch (error) {
      console.error('❌ ScreenCaptureKit start failed:', error);
      throw error;
    }
  }

  /**
   * Stop ScreenCaptureKit recording
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
      console.log('🛑 Stopping ScreenCaptureKit recording...');

      // Stop ScreenCaptureKit recorder
      if (this.currentRecorder) {
        try {
          if (typeof this.currentRecorder.stopRecording === 'function') {
            await this.currentRecorder.stopRecording();
          } else if (typeof this.currentRecorder.stop === 'function') {
            await this.currentRecorder.stop();
          }
        } catch (stopError) {
          console.warn('⚠️ Stop method failed:', stopError.message);
        }
        
        this.currentRecorder = null;
      }

      // Wait a moment for file to be finalized
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify output file exists
      const fileExists = await this.verifyOutputFile();
      if (!fileExists) {
        throw new Error(`Recording file not found: ${this.outputPath}`);
      }

      this.isRecording = false;
      
      const duration = Date.now() - this.startTime;
      
      this.emit('completed', {
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        duration: duration,
        method: 'screencapturekit-native',
        systemAudio: this.currentOptions.includeSystemAudio,
        microphone: this.currentOptions.includeMicrophone,
        singleFile: true // No merging needed
      });

      console.log('✅ ScreenCaptureKit recording completed:', this.outputPath);

      return {
        success: true,
        outputPath: this.outputPath,
        duration: duration,
        recordingId: this.recordingId,
        method: 'screencapturekit-native'
      };

    } catch (error) {
      console.error('❌ Failed to stop ScreenCaptureKit recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Verify output file exists and is valid
   */
  async verifyOutputFile() {
    try {
      const stats = await fs.stat(this.outputPath);
      return stats.isFile() && stats.size > 0;
    } catch (error) {
      console.warn('⚠️ Output file verification failed:', error.message);
      return false;
    }
  }

  /**
   * Generate output file path
   */
  generateOutputPath(options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screencapturekit-${timestamp}.mp4`;
    
    // Use user's chosen directory if specified, otherwise temp
    const outputDir = options.recordingDirectory || this.tempDir;
    return path.join(outputDir, filename);
  }

  /**
   * Get frame rate based on quality setting
   */
  getFrameRateForQuality(quality) {
    switch (quality) {
      case 'low': return 15;
      case 'medium': return 30;
      case 'high': return 60;
      default: return 30;
    }
  }

  /**
   * Get available screens
   */
  async getAvailableScreens() {
    if (!this.aperture) {
      return [];
    }

    try {
      const screens = await this.aperture.screens();
      return screens.map(screen => ({
        id: screen.id,
        name: screen.name || 'Unknown Screen',
        type: 'screen'
      }));
    } catch (error) {
      console.error('❌ Failed to get screens:', error);
      return [];
    }
  }

  /**
   * Get available audio devices
   */
  async getAvailableAudioDevices() {
    if (!this.aperture) {
      return [];
    }

    try {
      const audioDevices = await this.aperture.audioDevices();
      return audioDevices.map(device => ({
        id: device.id,
        name: device.name || 'Unknown Audio Device',
        type: 'microphone'
      }));
    } catch (error) {
      console.warn('⚠️ Failed to get audio devices:', error);
      return [];
    }
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      method: 'screencapturekit-native',
      recordingId: this.recordingId,
      outputPath: this.outputPath,
      singleStream: true,
      dependencies: {
        cpal: false,
        ffmpeg: false,
        screencapturekit: true
      }
    };
  }

  /**
   * Get macOS version
   */
  getMacOSVersion() {
    const release = os.release();
    const parts = release.split('.');
    const major = parseInt(parts[0]);
    return major - 9; // Convert Darwin to macOS version
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up ScreenCaptureKit recorder...');

    this.isRecording = false;

    if (this.currentRecorder) {
      try {
        if (typeof this.currentRecorder.stopRecording === 'function') {
          await this.currentRecorder.stopRecording();
        } else if (typeof this.currentRecorder.stop === 'function') {
          await this.currentRecorder.stop();
        }
      } catch (error) {
        console.warn('⚠️ Failed to stop recorder during cleanup:', error);
      }
      this.currentRecorder = null;
    }

    this.recordingId = null;
    this.currentOptions = null;
    this.startTime = null;
    this.outputPath = null;
  }

  /**
   * Destroy recorder
   */
  destroy() {
    console.log('🗑️ Destroying ScreenCaptureKit recorder');
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = MacOSScreenCaptureRecorder;