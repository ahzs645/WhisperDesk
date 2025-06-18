// src/main/services/aperture-recorder.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const EventEmitter = require('events');

/**
 * Aperture v7 screen recorder for macOS using ScreenCaptureKit
 * Updated for the new v7 ESM API structure with proper file handling
 */
class ApertureV7Recorder extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.isRecording = false;
    this.recordingId = null;
    this.startTime = null;
    
    // Aperture v7 modules
    this.aperture = null;
    this.currentRecorder = null;
    
    // Paths
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-aperture-v7');
    this.systemAudioPath = null;
    this.microphoneAudioPath = null;
    this.finalOutputPath = null;
    this.userChosenDirectory = null; // ✅ NEW: Track user's chosen directory
    
    // Recording options
    this.currentOptions = null;
  }

  /**
   * Initialize Aperture v7 recorder
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

      // Load Aperture v7 ESM module
      await this.loadApertureV7();

      console.log('✅ Aperture v7 recorder initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Aperture v7 recorder:', error);
      throw error;
    }
  }

  /**
   * Load Aperture v7 ESM module
   */
  async loadApertureV7() {
    try {
      console.log('📦 Loading Aperture v7 ESM...');
      
      // Dynamic import for v7 ESM
      this.aperture = await import('aperture');
      
      console.log('✅ Aperture v7 loaded');
      console.log('📋 Available API:', Object.keys(this.aperture));
      
      // Test basic functionality
      await this.testV7API();
      
    } catch (error) {
      console.error('❌ Failed to load Aperture v7:', error);
      throw new Error(`Aperture v7 loading failed: ${error.message}`);
    }
  }

  /**
   * Test v7 API functionality
   */
  async testV7API() {
    try {
      // Test screen enumeration
      const screens = await this.aperture.screens();
      console.log(`✅ v7 API test: Found ${screens.length} screens`);
      
      if (screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      // Test audio devices
      try {
        const audioDevices = await this.aperture.audioDevices();
        console.log(`✅ v7 API test: Found ${audioDevices.length} audio devices`);
      } catch (audioError) {
        console.warn('⚠️ Audio devices test failed:', audioError.message);
      }
      
      // Test recorder object
      if (this.aperture.recorder && typeof this.aperture.recorder === 'object') {
        console.log('✅ v7 API test: Recorder object available');
      } else {
        throw new Error('Recorder object not available');
      }
      
    } catch (error) {
      console.warn('⚠️ v7 API test failed:', error.message);
      // Don't throw here - specific functionality might still work
    }
  }

  /**
   * Start recording with Aperture v7
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    if (!this.aperture) {
      throw new Error('Aperture v7 not initialized');
    }

    try {
      this.currentOptions = options;
      this.recordingId = `aperture-v7-${Date.now()}`;
      this.startTime = Date.now();
      
      // ✅ NEW: Store user's chosen directory
      this.userChosenDirectory = options.recordingDirectory;
      
      // Generate file paths (still use temp for Aperture, but plan for final location)
      this.generateFilePaths();

      console.log('🎬 Starting Aperture v7 recording...');
      console.log('📁 User chosen directory:', this.userChosenDirectory);
      console.log('📁 Temp recording path:', this.systemAudioPath);

      // Get available screens using v7 API
      const screens = await this.aperture.screens();
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

      // Start recording with v7 API
      await this.startV7Recording(targetScreen);

      this.isRecording = true;
      
      this.emit('started', {
        recordingId: this.recordingId,
        systemAudio: options.includeSystemAudio || false,
        method: 'aperture-v7',
        screen: targetScreen.name || targetScreen.id
      });

      return {
        success: true,
        recordingId: this.recordingId,
        systemAudio: options.includeSystemAudio || false,
        method: 'aperture-v7'
      };

    } catch (error) {
      console.error('❌ Failed to start Aperture v7 recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Start recording using v7 API
   */
  async startV7Recording(screen) {
    try {
      // Prepare v7 recording options
      const recordingOptions = {
        destination: this.systemAudioPath,
        screen: screen.id,
        showCursor: this.currentOptions.showCursor !== false,
        highlightClicks: this.currentOptions.highlightClicks || false,
        recordAudio: this.currentOptions.includeSystemAudio || false
      };

      // Add audio device if specified
      if (this.currentOptions.includeSystemAudio && this.currentOptions.audioInputId) {
        // Get available audio devices
        const audioDevices = await this.aperture.audioDevices();
        const targetAudioDevice = audioDevices.find(d => d.id === this.currentOptions.audioInputId);
        if (targetAudioDevice) {
          recordingOptions.audioDeviceId = targetAudioDevice.id;
        }
      }

      console.log('🎬 Starting v7 recorder with options:', {
        screen: recordingOptions.screen,
        audio: recordingOptions.recordAudio,
        destination: path.basename(recordingOptions.destination)
      });

      // Start recording using v7 recorder API
      this.currentRecorder = this.aperture.recorder;
      
      // The v7 API might use different method names
      if (typeof this.currentRecorder.startRecording === 'function') {
        await this.currentRecorder.startRecording(recordingOptions);
      } else if (typeof this.currentRecorder.record === 'function') {
        // Alternative method name
        await this.currentRecorder.record(recordingOptions);
      } else if (typeof this.currentRecorder.start === 'function') {
        // Another alternative
        await this.currentRecorder.start(recordingOptions);
      } else {
        // Find available methods
        const methods = Object.getOwnPropertyNames(this.currentRecorder)
          .filter(name => typeof this.currentRecorder[name] === 'function');
        throw new Error(`No recording method found. Available methods: ${methods.join(', ')}`);
      }
      
      console.log('✅ Aperture v7 recording started successfully');
      
    } catch (error) {
      console.error('❌ v7 recording start failed:', error);
      throw error;
    }
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
      console.log('🛑 Stopping Aperture v7 recording...');

      // Stop the v7 recorder
      if (this.currentRecorder) {
        try {
          // Try different stop method names
          if (typeof this.currentRecorder.stopRecording === 'function') {
            await this.currentRecorder.stopRecording();
          } else if (typeof this.currentRecorder.stop === 'function') {
            await this.currentRecorder.stop();
          } else {
            console.warn('⚠️ No stop method found on recorder');
          }
        } catch (stopError) {
          console.warn('⚠️ Stop method failed:', stopError.message);
        }
        
        this.currentRecorder = null;
      }

      // ✅ NEW: Handle file moving to user's chosen directory
      await this.handleFileCompletion();

      this.isRecording = false;
      
      const duration = Date.now() - this.startTime;
      
      this.emit('completed', {
        recordingId: this.recordingId,
        outputPath: this.finalOutputPath,
        duration: duration,
        systemAudio: this.currentOptions.includeSystemAudio,
        microphone: this.currentOptions.includeMicrophone,
        method: 'aperture-v7'
      });

      return {
        success: true,
        outputPath: this.finalOutputPath,
        duration: duration,
        recordingId: this.recordingId,
        method: 'aperture-v7'
      };

    } catch (error) {
      console.error('❌ Failed to stop v7 recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * ✅ NEW: Handle file completion - move from temp to user's chosen directory
   */
  async handleFileCompletion() {
    try {
      console.log('📁 Handling file completion...');
      
      // Check if the temp file exists
      const tempExists = await this.fileExists(this.systemAudioPath);
      if (!tempExists) {
        console.warn('⚠️ Temp recording file not found:', this.systemAudioPath);
        this.finalOutputPath = this.systemAudioPath;
        return;
      }

      // If user chose a specific directory, move the file there
      if (this.userChosenDirectory) {
        try {
          // Ensure user's directory exists
          await fs.mkdir(this.userChosenDirectory, { recursive: true });
          
          // Generate final filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const finalFilename = `aperture-recording-${timestamp}.mp4`;
          this.finalOutputPath = path.join(this.userChosenDirectory, finalFilename);
          
          console.log('📁 Moving file from temp to user directory...');
          console.log('  From:', this.systemAudioPath);
          console.log('  To:', this.finalOutputPath);
          
          // Copy file to final location
          await fs.copyFile(this.systemAudioPath, this.finalOutputPath);
          
          // Verify the copy worked
          const finalExists = await this.fileExists(this.finalOutputPath);
          if (finalExists) {
            console.log('✅ File successfully moved to user directory');
            
            // Clean up temp file
            try {
              await fs.unlink(this.systemAudioPath);
              console.log('🧹 Temp file cleaned up');
            } catch (cleanupError) {
              console.warn('⚠️ Failed to clean up temp file:', cleanupError.message);
            }
          } else {
            console.warn('⚠️ File copy verification failed, keeping temp location');
            this.finalOutputPath = this.systemAudioPath;
          }
          
        } catch (moveError) {
          console.error('❌ Failed to move file to user directory:', moveError);
          console.log('📁 Keeping file in temp location');
          this.finalOutputPath = this.systemAudioPath;
        }
      } else {
        // No user directory specified, keep in temp
        console.log('📁 No user directory specified, keeping in temp location');
        this.finalOutputPath = this.systemAudioPath;
      }

      // Handle microphone audio if needed (separate recording)
      if (this.currentOptions.includeMicrophone && this.microphoneAudioPath) {
        await this.mergeAudioStreams();
      }

    } catch (error) {
      console.error('❌ File completion handling failed:', error);
      this.finalOutputPath = this.systemAudioPath; // Fallback to temp location
    }
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
   * Get available screens using v7 API
   */
  async getAvailableScreens() {
    if (!this.aperture) {
      throw new Error('Aperture v7 not available');
    }

    try {
      const screens = await this.aperture.screens();
      return screens.map(screen => ({
        id: screen.id,
        name: screen.name || 'Unknown Screen',
        type: 'screen'
      }));
    } catch (error) {
      console.error('❌ Failed to get screens via v7 API:', error);
      return [];
    }
  }

  /**
   * Get available audio devices using v7 API
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
        type: 'audio'
      }));
    } catch (error) {
      console.warn('⚠️ Failed to get audio devices via v7 API:', error);
      return [];
    }
  }

  /**
   * Merge audio streams using FFmpeg (for microphone + system audio)
   */
  async mergeAudioStreams() {
    console.log('🔄 Merging audio streams...');

    // Update final output path for merged version
    const mergedPath = this.finalOutputPath.replace('.mp4', '-merged.mp4');

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', this.finalOutputPath,        // System audio + video from Aperture
        '-i', this.microphoneAudioPath,    // Separate microphone audio
        '-filter_complex', 'amix=inputs=2:duration=first:dropout_transition=3',
        '-c:v', 'copy',                    // Copy video without re-encoding
        '-c:a', 'aac',                     // Re-encode audio to AAC
        '-b:a', '128k',                    // Audio bitrate
        '-movflags', '+faststart',         // Optimize for streaming
        mergedPath
      ];

      console.log('🎵 FFmpeg merge command:', 'ffmpeg', ffmpegArgs.join(' '));

      const mergeProcess = spawn('ffmpeg', ffmpegArgs);

      mergeProcess.on('error', reject);
      mergeProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Audio streams merged successfully');
          this.finalOutputPath = mergedPath;
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
   * Utility methods
   */
  getMacOSVersion() {
    const release = os.release();
    const parts = release.split('.');
    const major = parseInt(parts[0]);
    return major - 9; // Convert Darwin to macOS version
  }

  async cleanup() {
    console.log('🧹 Cleaning up Aperture v7 recorder...');

    this.isRecording = false;

    if (this.currentRecorder) {
      try {
        // Try to stop if still recording
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
    this.startTime = null;
    this.userChosenDirectory = null;
    this.finalOutputPath = null;
  }
}

module.exports = ApertureV7Recorder;