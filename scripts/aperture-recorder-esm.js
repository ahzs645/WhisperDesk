// src/main/services/aperture-recorder-esm.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const EventEmitter = require('events');

/**
 * ESM-compatible Aperture-based screen recorder for macOS using ScreenCaptureKit
 * Handles the ESM nature of Aperture v7+ with dynamic imports
 */
class ApertureRecorderESM extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.isRecording = false;
    this.currentProcess = null;
    this.recordingId = null;
    
    // ESM module cache
    this.apertureModule = null;
    this.devicesAPI = null;
    this.recorderClass = null;
    
    // Paths
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-aperture');
    this.systemAudioPath = null;
    this.microphoneAudioPath = null;
    this.finalOutputPath = null;
    
    // Recording options
    this.currentOptions = null;
  }

  /**
   * Initialize Aperture recorder with ESM support
   */
  async initialize() {
    try {
      // Check if we're on macOS
      if (process.platform !== 'darwin') {
        throw new Error('Aperture recorder is only available on macOS');
      }

      // Check macOS version (ScreenCaptureKit requires macOS 13+)
      const version = this.getMacOSVersion();
      if (version < 13) {
        throw new Error('ScreenCaptureKit requires macOS 13+ (Ventura or later)');
      }

      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });

      // Load Aperture ESM module
      await this.loadApertureESM();

      console.log('✅ Aperture ESM recorder initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Aperture ESM recorder:', error);
      throw error;
    }
  }

  /**
   * Load Aperture ESM module with dynamic import
   */
  async loadApertureESM() {
    try {
      console.log('📦 Loading Aperture ESM module...');
      
      // Dynamic import for ESM
      const apertureESM = await import('aperture');
      this.apertureModule = apertureESM.default || apertureESM;
      
      console.log('✅ Aperture ESM loaded');
      console.log('📋 Available exports:', Object.keys(apertureESM));
      
      // Find the devices API
      this.devicesAPI = this.findDevicesAPI(apertureESM);
      if (!this.devicesAPI) {
        throw new Error('Could not find Aperture devices API');
      }
      console.log('✅ Devices API found');
      
      // Find the recorder class
      this.recorderClass = this.findRecorderClass(apertureESM);
      if (!this.recorderClass) {
        throw new Error('Could not find Aperture Recorder class');
      }
      console.log('✅ Recorder class found');
      
      // Test basic functionality
      await this.testBasicFunctionality();
      
    } catch (error) {
      console.error('❌ Failed to load Aperture ESM:', error);
      throw new Error(`Aperture ESM loading failed: ${error.message}`);
    }
  }

  /**
   * Find the devices API in the ESM structure
   */
  findDevicesAPI(apertureESM) {
    const possibleLocations = [
      apertureESM.Devices,
      apertureESM.default?.Devices,
      this.apertureModule?.Devices
    ];
    
    for (const api of possibleLocations) {
      if (api && typeof api.screen === 'function') {
        console.log('✅ Found devices API');
        return api;
      }
    }
    
    return null;
  }

  /**
   * Find the recorder class in the ESM structure
   */
  findRecorderClass(apertureESM) {
    const possibleClasses = [
      apertureESM.Recorder,
      apertureESM.default?.Recorder,
      this.apertureModule?.Recorder,
      // Sometimes the module itself is the recorder
      typeof this.apertureModule === 'function' ? this.apertureModule : null
    ];
    
    for (const cls of possibleClasses) {
      if (cls && typeof cls === 'function') {
        console.log('✅ Found recorder class');
        return cls;
      }
    }
    
    return null;
  }

  /**
   * Test basic functionality
   */
  async testBasicFunctionality() {
    try {
      // Test screen enumeration
      const screens = await this.devicesAPI.screen();
      console.log(`✅ Found ${screens.length} screens`);
      
      if (screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      // Test recorder creation
      const testRecorder = new this.recorderClass();
      console.log('✅ Test recorder created successfully');
      
    } catch (error) {
      console.warn('⚠️ Basic functionality test failed:', error.message);
      // Don't throw here - the specific functionality might still work
    }
  }

  /**
   * Start recording with Aperture ESM
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    if (!this.apertureModule || !this.devicesAPI || !this.recorderClass) {
      throw new Error('Aperture ESM not initialized');
    }

    try {
      this.currentOptions = options;
      this.recordingId = `aperture-esm-${Date.now()}`;
      
      // Generate file paths
      this.generateFilePaths();

      console.log('🎬 Starting Aperture ESM recording...');

      // Get available screens
      const screens = await this.devicesAPI.screen();
      if (screens.length === 0) {
        throw new Error('No screens available');
      }

      // Find the requested screen or use first available
      let targetScreen = screens[0];
      if (options.screenId) {
        const foundScreen = screens.find(s => s.id === options.screenId);
        if (foundScreen) {
          targetScreen = foundScreen;
        }
      }

      console.log('📺 Recording screen:', targetScreen.name || targetScreen.id);

      // Start the recording
      await this.startApertureESMRecording(targetScreen);

      this.isRecording = true;
      this.emit('started', {
        recordingId: this.recordingId,
        systemAudio: true,
        method: 'aperture-esm',
        screen: targetScreen.name || targetScreen.id
      });

      return {
        success: true,
        recordingId: this.recordingId,
        systemAudio: true,
        method: 'aperture-esm'
      };

    } catch (error) {
      console.error('❌ Failed to start Aperture ESM recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Start Aperture ESM recording process
   */
  async startApertureESMRecording(screen) {
    const recorder = new this.recorderClass();
    
    const options = {
      destination: new URL(`file://${this.systemAudioPath}`),
      targetID: screen.id,
      framesPerSecond: this.getFrameRate(),
      videoCodec: this.getVideoCodec(),
      recordSystemAudio: this.currentOptions.includeSystemAudio || true,
      showCursor: this.currentOptions.showCursor !== false,
      highlightClicks: this.currentOptions.highlightClicks || false
    };

    console.log('🎬 Starting recorder with options:', {
      screen: screen.name || screen.id,
      systemAudio: options.recordSystemAudio,
      fps: options.framesPerSecond
    });

    // Store recorder instance for later stopping
    this.currentRecorder = recorder;

    // Start recording
    await recorder.start('screen', options);
    
    console.log('✅ Aperture ESM recording started');
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
      console.log('🛑 Stopping Aperture ESM recording...');

      // Stop the recorder
      if (this.currentRecorder) {
        await this.currentRecorder.stop();
        this.currentRecorder = null;
      }

      // Determine final output path
      this.finalOutputPath = this.systemAudioPath;

      // Handle microphone audio if needed
      if (this.currentOptions.includeMicrophone && this.microphoneAudioPath) {
        await this.mergeAudioStreams();
      }

      this.isRecording = false;
      
      this.emit('completed', {
        recordingId: this.recordingId,
        outputPath: this.finalOutputPath,
        systemAudio: this.currentOptions.includeSystemAudio,
        microphone: this.currentOptions.includeMicrophone,
        method: 'aperture-esm'
      });

      return {
        success: true,
        outputPath: this.finalOutputPath,
        recordingId: this.recordingId,
        method: 'aperture-esm'
      };

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Get available screens using ESM API
   */
  async getAvailableScreens() {
    if (!this.devicesAPI) {
      throw new Error('Devices API not available');
    }

    try {
      const screens = await this.devicesAPI.screen();
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
   * Get available audio devices using ESM API
   */
  async getAvailableAudioDevices() {
    if (!this.devicesAPI || typeof this.devicesAPI.audio !== 'function') {
      return [];
    }

    try {
      const audioDevices = await this.devicesAPI.audio();
      return audioDevices.map(device => ({
        id: device.id,
        name: device.name || 'Unknown Audio Device',
        type: 'audio'
      }));
    } catch (error) {
      console.warn('⚠️ Failed to get audio devices:', error);
      return [];
    }
  }

  /**
   * Merge audio streams using FFmpeg
   */
  async mergeAudioStreams() {
    console.log('🔄 Merging audio streams...');

    this.finalOutputPath = path.join(
      path.dirname(this.systemAudioPath),
      `merged-${this.recordingId}.mp4`
    );

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', this.systemAudioPath,
        '-i', this.microphoneAudioPath,
        '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=3',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        this.finalOutputPath
      ];

      const mergeProcess = spawn('ffmpeg', ffmpegArgs);

      mergeProcess.on('error', reject);
      mergeProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Audio streams merged successfully');
          resolve();
        } else {
          reject(new Error(`FFmpeg merge failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Generate file paths for recording components
   */
  generateFilePaths() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `recording-${timestamp}`;

    this.systemAudioPath = path.join(this.tempDir, `${baseFilename}-system.mp4`);
    this.microphoneAudioPath = path.join(this.tempDir, `${baseFilename}-mic.aac`);
  }

  /**
   * Get frame rate from options
   */
  getFrameRate() {
    const quality = this.currentOptions?.videoQuality || 'medium';
    const frameRates = {
      low: 15,
      medium: 30,
      high: 60
    };
    return frameRates[quality] || 30;
  }

  /**
   * Get video codec
   */
  getVideoCodec() {
    // Use the Aperture enum if available, otherwise use string
    if (this.apertureModule?.VideoCodec) {
      return this.apertureModule.VideoCodec.h264;
    }
    return 'h264';
  }

  /**
   * Utility methods
   */
  getMacOSVersion() {
    const release = os.release();
    const parts = release.split('.');
    const major = parseInt(parts[0]);
    return major - 9; // Convert Darwin to macOS version
  }

  async cleanup() {
    console.log('🧹 Cleaning up Aperture ESM recorder...');

    this.isRecording = false;

    if (this.currentRecorder) {
      try {
        await this.currentRecorder.stop();
      } catch (error) {
        console.warn('⚠️ Failed to stop recorder during cleanup:', error);
      }
      this.currentRecorder = null;
    }

    // Clean up temporary files
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        if (file.startsWith('recording-')) {
          await fs.unlink(path.join(this.tempDir, file));
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean temp files:', error);
    }

    this.recordingId = null;
    this.currentOptions = null;
  }
}

module.exports = ApertureRecorderESM;