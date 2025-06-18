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

    // Handle audio configuration
    let audioConfigured = false;

    // System audio + microphone: Complex case
    if (options.includeSystemAudio && options.includeMicrophone) {
      console.log('🎤🔊 Configuring system audio + microphone');
      // For system audio + microphone, we need to be careful
      // ScreenCaptureKit can capture system audio automatically
      // But adding a microphone device might interfere
      console.log('   Warning: System audio + microphone may have limitations');
      
      // Try to find a microphone for the combo
      try {
        const audioDevices = await this.aperture.audioDevices();
        let targetAudioId = options.audioInputId;
        if (targetAudioId === 'default') {
          const microphones = audioDevices.filter(d => 
            d.name.toLowerCase().includes('microphone') || 
            d.name.toLowerCase().includes('built-in')
          );
          if (microphones.length > 0) {
            targetAudioId = microphones[0].id;
            console.log(`🎤 Adding microphone: ${microphones[0].name}`);
            config.audioDeviceId = targetAudioId;
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not add microphone:', error.message);
      }
      
      audioConfigured = true;
    }
    // System audio only - THE KEY CHANGE
    else if (options.includeSystemAudio) {
      console.log('🔊 Configuring system audio only');
      
      // For system audio ONLY, explicitly DO NOT set audioDeviceId
      // ScreenCaptureKit captures system audio when:
      // 1. No audioDeviceId is specified, OR
      // 2. We explicitly enable system audio in ScreenCaptureKit
      
      console.log('   Strategy: Let ScreenCaptureKit capture system audio natively');
      console.log('   No audioDeviceId will be set (this enables system audio)');
      
      // DO NOT SET config.audioDeviceId - this is the key!
      // When audioDeviceId is undefined/not set, ScreenCaptureKit captures system audio
      
      audioConfigured = true;
    }
    // Microphone only
    else if (options.includeMicrophone && options.audioInputId) {
      console.log('🎤 Configuring microphone only');
      try {
        const audioDevices = await this.aperture.audioDevices();
        
        let targetAudioId = options.audioInputId;
        if (targetAudioId === 'default') {
          const microphones = audioDevices.filter(d => 
            d.name.toLowerCase().includes('microphone') || 
            d.name.toLowerCase().includes('built-in')
          );
          if (microphones.length > 0) {
            targetAudioId = microphones[0].id;
            console.log(`🎤 Using default microphone: ${microphones[0].name}`);
          }
        }
        
        const targetMic = audioDevices.find(d => d.id === targetAudioId);
        if (targetMic) {
          config.audioDeviceId = targetMic.id;
          console.log(`🎤 Selected microphone: ${targetMic.name}`);
          audioConfigured = true;
        } else {
          console.warn(`⚠️ Microphone device not found: ${targetAudioId}`);
        }
      } catch (error) {
        console.warn('⚠️ Could not configure microphone:', error.message);
      }
    }

    // CRITICAL: For system audio, config.audioDeviceId should be undefined
    // This tells ScreenCaptureKit to capture system audio instead of input audio

    console.log('🔧 Aperture config:', {
      screenId: config.screenId,
      fps: config.fps,
      showCursor: config.showCursor,
      audioDeviceId: config.audioDeviceId || 'UNDEFINED (enables system audio)',
      audioConfigured: audioConfigured,
      systemAudio: options.includeSystemAudio,
      microphone: options.includeMicrophone,
      videoCodec: config.videoCodec
    });

    // Add note about system audio capture mechanism
    if (options.includeSystemAudio) {
      console.log('📝 System Audio Capture Mode:');
      if (config.audioDeviceId) {
        console.log('   • Mode: Microphone + System Audio (may have limitations)');
        console.log(`   • Microphone: ${config.audioDeviceId}`);
      } else {
        console.log('   • Mode: Pure System Audio (audioDeviceId = undefined)');
        console.log('   • This tells ScreenCaptureKit to capture computer audio output');
      }
      console.log('   • Depends on: Screen recording permission + system audio entitlements');
      console.log('   • Test: Play music/video during recording');
    }

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
        const tempFilePath = await this.currentRecorder.stopRecording();
        
        console.log('📁 Aperture returned temp file path:', tempFilePath);
        
        // Move file from temp location to user's desired directory
        const finalFilePath = await this.moveToFinalLocation(tempFilePath);
        
        // Update our output path to the final location
        this.outputPath = finalFilePath;
        
        this.currentRecorder = null;
      }

      // Verify file exists at the final location
      const fileExists = await this.verifyOutputFile();
      if (!fileExists) {
        throw new Error(`Recording file not found at final location: ${this.outputPath}`);
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
   * @param {string} filePath - File path to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>}
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
   * Move recording from temp location to final desired location
   * @param {string} tempFilePath - Temp file path from Aperture
   * @returns {string} Final file path
   */
  async moveToFinalLocation(tempFilePath) {
    try {
      // Generate final file path using original desired directory
      const originalBasename = path.basename(this.outputPath);
      const finalFilePath = this.outputPath; // This was already set with desired directory
      
      console.log('📁 Moving file from temp to final location...');
      console.log(`   From: ${tempFilePath}`);
      console.log(`   To: ${finalFilePath}`);
      
      // Ensure the target directory exists
      const targetDir = path.dirname(finalFilePath);
      await fs.mkdir(targetDir, { recursive: true });
      
      // Move (rename) the file from temp to final location
      await fs.rename(tempFilePath, finalFilePath);
      
      // Verify the move was successful
      const stats = await fs.stat(finalFilePath);
      console.log(`✅ File moved successfully (${Math.round(stats.size / 1024)}KB)`);
      
      return finalFilePath;
      
    } catch (error) {
      console.error('❌ Failed to move recording file:', error);
      
      // If move fails, try copying instead
      try {
        console.log('🔄 Attempting to copy file instead...');
        await fs.copyFile(tempFilePath, this.outputPath);
        
        // Verify copy succeeded
        await fs.stat(this.outputPath);
        console.log('✅ File copied successfully');
        
        // Clean up temp file
        try {
          await fs.unlink(tempFilePath);
          console.log('🧹 Temp file cleaned up');
        } catch (cleanupError) {
          console.warn('⚠️ Could not clean up temp file:', cleanupError.message);
        }
        
        return this.outputPath;
        
      } catch (copyError) {
        console.error('❌ Copy also failed:', copyError);
        
        // If both move and copy fail, just use the temp file
        console.log('⚠️ Using temp file location as fallback');
        return tempFilePath;
      }
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