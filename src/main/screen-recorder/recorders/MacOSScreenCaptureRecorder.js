// src/main/screen-recorder/recorders/MacOSScreenCaptureRecorder.js
/**
 * Fixed macOS Screen Recorder using ONLY ScreenCaptureKit via Aperture v7
 * Properly implements the Aperture API without assuming internal structure
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
    
    // Aperture recorder instance
    this.aperture = null;
    this.currentRecorder = null;
    
    // File paths
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
      console.log('🍎 Initializing ScreenCaptureKit Recorder...');
      
      // Check macOS version
      if (process.platform !== 'darwin') {
        throw new Error('ScreenCaptureKit is only available on macOS');
      }

      const version = this.getMacOSVersion();
      if (version < 13) {
        throw new Error('ScreenCaptureKit requires macOS 13+ (Ventura or later)');
      }

      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });

      // Load and test Aperture v7
      await this.loadAndTestAperture();

      console.log('✅ ScreenCaptureKit Recorder initialized');
      console.log('🎯 Single stream: screen + system audio + microphone');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ScreenCaptureKit recorder:', error);
      throw error;
    }
  }

  /**
   * Load and test Aperture v7
   */
  async loadAndTestAperture() {
    try {
      console.log('📦 Loading Aperture v7...');
      
      // Import Aperture v7 (ES module)
      this.aperture = await import('aperture');
      
      console.log('📋 Aperture module structure:');
      console.log('- Available exports:', Object.keys(this.aperture));
      console.log('- recorder type:', typeof this.aperture.recorder);
      console.log('- screens function:', typeof this.aperture.screens);
      console.log('- audioDevices function:', typeof this.aperture.audioDevices);
      
      // Test basic functionality
      if (typeof this.aperture.screens !== 'function') {
        throw new Error('screens() function not available in Aperture module');
      }
      
      const screens = await this.aperture.screens();
      console.log(`✅ Found ${screens.length} screens via ScreenCaptureKit`);
      
      if (screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      // Test audio devices (optional)
      try {
        if (typeof this.aperture.audioDevices === 'function') {
          const audioDevices = await this.aperture.audioDevices();
          console.log(`🎤 Found ${audioDevices.length} audio devices`);
        } else {
          console.log('⚠️ audioDevices function not available');
        }
      } catch (audioError) {
        console.log('⚠️ Audio devices test failed (non-critical):', audioError.message);
      }
      
      // Test recorder object availability (NOT function)
      if (this.aperture.recorder && typeof this.aperture.recorder === 'object') {
        console.log('✅ Aperture recorder object available');
        
        // Check for required methods
        const requiredMethods = ['startRecording', 'stopRecording'];
        const availableMethods = requiredMethods.filter(method => 
          typeof this.aperture.recorder[method] === 'function'
        );
        
        console.log(`📋 Recorder methods: ${availableMethods.join(', ')}`);
        
        if (availableMethods.length !== requiredMethods.length) {
          const missing = requiredMethods.filter(m => !availableMethods.includes(m));
          throw new Error(`Missing recorder methods: ${missing.join(', ')}`);
        }
      } else {
        throw new Error('Aperture recorder object not available');
      }
      
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error('Aperture v7 not installed. Install with: npm install aperture@7');
      } else {
        throw new Error(`Failed to load Aperture v7: ${error.message}`);
      }
    }
  }

  /**
   * Start recording with ScreenCaptureKit
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
      
      // Generate output path
      this.outputPath = this.generateOutputPath(options);

      console.log('🍎 Starting ScreenCaptureKit recording...');
      console.log('📁 Output:', path.basename(this.outputPath));

      // Build recording configuration
      const recordingConfig = await this.buildApertureConfig(options);
      
      // Use Aperture's recorder object directly - NO function call needed
      console.log('🔧 Using Aperture recorder object...');
      
      if (!this.aperture.recorder) {
        throw new Error('Aperture recorder object not available');
      }
      
      // The recorder is a singleton object, not a function
      this.currentRecorder = this.aperture.recorder;
      
      console.log('✅ Using Aperture recorder singleton');
      console.log('Available methods:', Object.getOwnPropertyNames(this.currentRecorder).filter(name => typeof this.currentRecorder[name] === 'function'));

      // Start recording with the recorder object
      console.log('🎬 Starting recording...');
      await this.currentRecorder.startRecording(recordingConfig);

      this.isRecording = true;
      
      this.emit('started', {
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        method: 'screencapturekit-native',
        systemAudio: recordingConfig.recordAudio,
        microphone: recordingConfig.recordAudio && options.includeMicrophone
      });

      console.log('✅ ScreenCaptureKit recording started');
      
      return {
        success: true,
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        method: 'screencapturekit-native'
      };

    } catch (error) {
      console.error('❌ Failed to start ScreenCaptureKit recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Build Aperture configuration for ScreenCaptureKit
   * Based on Aperture README: https://github.com/wulkano/aperture-node
   */
  async buildApertureConfig(options) {
    const screens = await this.aperture.screens();
    
    // Find target screen
    let screenId = screens[0].id; // Default to first screen
    if (options.screenId) {
      const targetScreen = screens.find(s => s.id === options.screenId);
      if (targetScreen) {
        screenId = targetScreen.id;
      }
    }

    // Build Aperture configuration according to the README
    const config = {
      // Screen selection
      screenId: screenId,
      
      // Video settings
      fps: this.getFrameRateForQuality(options.videoQuality),
      showCursor: options.showCursor !== false,
      highlightClicks: options.highlightClicks || false,
      
      // Video codec
      videoCodec: 'h264' // Start with h264 for compatibility
    };

    // Add microphone device if specified
    if (options.includeMicrophone && options.audioInputId) {
      try {
        const audioDevices = await this.aperture.audioDevices();
        const targetMic = audioDevices.find(d => d.id === options.audioInputId);
        if (targetMic) {
          config.audioDeviceId = targetMic.id;
        }
      } catch (error) {
        console.warn('⚠️ Could not set specific microphone:', error.message);
      }
    }

    console.log('🔧 Aperture config:', {
      screenId: config.screenId,
      fps: config.fps,
      showCursor: config.showCursor,
      audioDeviceId: config.audioDeviceId || 'none',
      videoCodec: config.videoCodec
    });

    return config;
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

      // Stop the recording using Aperture's recorder object
      if (this.currentRecorder) {
        console.log('📹 Calling stopRecording on Aperture recorder...');
        
        // According to Aperture README, stopRecording() returns the file path directly
        const actualFilePath = await this.currentRecorder.stopRecording();
        
        console.log('📁 Aperture returned file path:', actualFilePath);
        
        // Update our output path to the actual path returned by Aperture
        this.outputPath = actualFilePath;
        
        this.currentRecorder = null;
      }

      // Verify file exists at the returned path
      const fileExists = await this.verifyOutputFile();
      if (!fileExists) {
        throw new Error(`Recording file not found at returned path: ${this.outputPath}`);
      }

      this.isRecording = false;
      const duration = Date.now() - this.startTime;
      
      this.emit('completed', {
        recordingId: this.recordingId,
        outputPath: this.outputPath,
        duration: duration,
        method: 'screencapturekit-native'
      });

      console.log('✅ ScreenCaptureKit recording completed:', path.basename(this.outputPath));

      return {
        success: true,
        outputPath: this.outputPath,
        duration: duration,
        method: 'screencapturekit-native'
      };

    } catch (error) {
      console.error('❌ Failed to stop ScreenCaptureKit recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Wait for file to exist (with timeout)
   */
  async waitForFile(filePath, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        await fs.access(filePath);
        console.log(`✅ File found: ${path.basename(filePath)}`);
        return true;
      } catch (error) {
        // File doesn't exist yet, wait a bit
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.warn(`⚠️ File not found after ${timeout}ms: ${path.basename(filePath)}`);
    return false;
  }

  /**
   * Find actual output file in common locations
   */
  async findActualOutputFile() {
    const timestamp = this.recordingId.split('-').slice(1).join('-');
    const possibleNames = [
      `screencapturekit-${timestamp}.mp4`,
      `recording-${timestamp}.mp4`,
      `aperture-${timestamp}.mp4`,
      `screen-recording-${timestamp}.mp4`
    ];
    
    const possibleDirs = [
      this.tempDir,
      os.homedir(),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Movies'),
      '/tmp'
    ];

    for (const dir of possibleDirs) {
      for (const name of possibleNames) {
        try {
          const testPath = path.join(dir, name);
          await fs.access(testPath);
          console.log(`🔍 Found file: ${testPath}`);
          return testPath;
        } catch (error) {
          // Continue searching
        }
      }
    }

    // Try to find any recent mp4 files
    try {
      for (const dir of possibleDirs) {
        const files = await fs.readdir(dir);
        const recentMp4s = files
          .filter(f => f.endsWith('.mp4'))
          .map(f => path.join(dir, f))
          .filter(async (fp) => {
            try {
              const stats = await fs.stat(fp);
              return Date.now() - stats.mtime.getTime() < 60000; // Within last minute
            } catch {
              return false;
            }
          });
        
        if (recentMp4s.length > 0) {
          console.log(`🔍 Found recent MP4: ${recentMp4s[0]}`);
          return recentMp4s[0];
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not search for recent files:', error.message);
    }

    return null;
  }

  /**
   * Verify output file exists and is valid
   */
  async verifyOutputFile() {
    try {
      const stats = await fs.stat(this.outputPath);
      return stats.isFile() && stats.size > 0;
    } catch (error) {
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
      console.warn('⚠️ Failed to get audio devices:', error.message);
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
      dependencies: {
        aperture: !!this.aperture,
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
        await this.currentRecorder.stopRecording();
      } catch (error) {
        console.warn('⚠️ Failed to stop recorder during cleanup:', error.message);
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