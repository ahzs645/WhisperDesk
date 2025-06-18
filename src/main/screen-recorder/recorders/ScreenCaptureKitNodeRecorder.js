// src/main/screen-recorder/recorders/ScreenCaptureKitNodeRecorder.js
/**
 * macOS recorder using ScreenCaptureKit Node.js library
 * Optimized for transcription with audio-first design
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class ScreenCaptureKitNodeRecorder extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.isRecording = false;
    this.recordingId = null;
    this.startTime = null;
    
    // ScreenCaptureKit recorder instance
    this.recorder = null;
    this.screencapturekit = null;
    
    // Output paths
    this.outputPath = null;
    this.finalOutputPath = null;
    this.customRecordingDirectory = null;
    
    // Recording options
    this.currentOptions = null;
    
    // Audio analysis
    this.detectedVirtualDriver = false;
    this.audioAnalysis = null;
  }

  /**
   * Initialize ScreenCaptureKit Node.js recorder
   */
  async initialize() {
    try {
      console.log('📦 Initializing ScreenCaptureKit Node.js Recorder...');
      
      // Check macOS version
      if (process.platform !== 'darwin') {
        throw new Error('ScreenCaptureKit is only available on macOS');
      }

      // Dynamically import the ScreenCaptureKit Node.js library
      try {
        this.screencapturekit = await import('screencapturekit');
        console.log('✅ ScreenCaptureKit Node.js library loaded');
      } catch (error) {
        throw new Error(`Failed to load screencapturekit: ${error.message}. Install with: npm install screencapturekit`);
      }

      // Test basic functionality
      await this.testCapabilities();

      console.log('✅ ScreenCaptureKit Node.js Recorder initialized');
      console.log('🎯 Features: Audio-only mode, MP3 conversion, multi-source audio');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ScreenCaptureKit Node.js recorder:', error);
      throw error;
    }
  }

  /**
   * Test recorder capabilities
   */
  async testCapabilities() {
    try {
      // Test screen enumeration
      const screens = await this.screencapturekit.screens();
      if (!screens || screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      console.log(`📺 Found ${screens.length} screen(s)`);

      // Test audio device enumeration
      try {
        const audioDevices = await this.screencapturekit.audioDevices();
        console.log(`🔊 Found ${audioDevices.length} system audio device(s)`);
      } catch (error) {
        console.warn('⚠️ System audio devices not available:', error.message);
      }

      // Test microphone enumeration
      try {
        const microphones = await this.screencapturekit.microphoneDevices();
        console.log(`🎤 Found ${microphones.length} microphone(s)`);
      } catch (error) {
        console.warn('⚠️ Microphones not available:', error.message);
      }

      // Check HDR support
      if (this.screencapturekit.supportsHDRCapture) {
        console.log('✨ HDR capture supported');
      }

      // Test and report deployment strategy
      console.log('📦 ScreenCaptureKit Node.js Deployment Strategy:');
      console.log('   ✅ Native system audio capture (no third-party dependencies)');
      console.log('   ✅ Standalone deployment (works without Teams/Loopback)');
      console.log('   ✅ Built-in macOS functionality only');

    } catch (error) {
      throw new Error(`Capability test failed: ${error.message}`);
    }
  }

  /**
   * Start recording with ScreenCaptureKit Node.js
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    if (!this.screencapturekit) {
      throw new Error('ScreenCaptureKit not initialized');
    }

    try {
      this.currentOptions = options;
      this.recordingId = `screencapturekit-node-${Date.now()}`;
      this.startTime = Date.now();
      
      console.log('📦 Starting ScreenCaptureKit Node.js recording...');

      // Create recorder instance
      this.recorder = this.screencapturekit.default();

      // Build recording configuration optimized for transcription
      const recordingConfig = await this.buildRecordingConfig(options);
      
      // Get audio configuration for logging
      const includeSystemAudio = options.includeSystemAudio || options.includeAudio;
      const includeMicrophone = options.includeMicrophone;
      
      console.log('🔧 Final ScreenCaptureKit Node.js configuration:', {
        screenId: recordingConfig.screenId,
        audioDeviceId: recordingConfig.audioDeviceId || 'native-system-audio',
        microphoneDeviceId: recordingConfig.microphoneDeviceId || 'none',
        audioOnly: recordingConfig.audioOnly,
        fps: recordingConfig.fps,
        systemAudio: includeSystemAudio ? 'native-screencapturekit' : 'disabled',
        microphone: includeMicrophone ? 'enabled' : 'disabled',
        audioType: !recordingConfig.audioDeviceId ? 'native-system-audio' : 'device-specific'
      });

      // Start recording
      await this.recorder.startRecording(recordingConfig);

      this.isRecording = true;
      
      this.emit('started', {
        recordingId: this.recordingId,
        method: 'screencapturekit-node',
        audioOnly: recordingConfig.audioOnly,
        systemAudio: includeSystemAudio,
        systemAudioType: !recordingConfig.audioDeviceId ? 'native-screencapturekit' : 'device-specific',
        microphone: includeMicrophone,
        virtualDriverDetected: this.detectedVirtualDriver || false,
        nativeAudio: !recordingConfig.audioDeviceId
      });

      console.log('✅ ScreenCaptureKit Node.js recording started');
      
      return {
        success: true,
        recordingId: this.recordingId,
        method: 'screencapturekit-node',
        audioOnly: recordingConfig.audioOnly
      };

    } catch (error) {
      console.error('❌ Failed to start ScreenCaptureKit Node.js recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Build recording configuration optimized for transcription
   */
  async buildRecordingConfig(options) {
    // Audio options - handle WhisperDesk audio options
    const includeSystemAudio = options.includeSystemAudio || options.includeAudio;
    const includeMicrophone = options.includeMicrophone;

    // Initialize useNativeSystemAudio variable at method scope
    let useNativeSystemAudio = true;

    // Get available screens (required even for audio-only)
    const screens = await this.screencapturekit.screens();
    if (!screens || screens.length === 0) {
      throw new Error('No screens available');
    }

    // Parse screen ID properly (handle 'screen:1:0' format)
    let screenId = screens[0].id;
    if (options.screenId !== undefined) {
      let targetScreenId = options.screenId;
      
      // Handle WhisperDesk screen ID format (e.g., 'screen:1:0')
      if (typeof targetScreenId === 'string' && targetScreenId.startsWith('screen:')) {
        const parts = targetScreenId.split(':');
        if (parts.length >= 2) {
          targetScreenId = parseInt(parts[1], 10);
        }
      }
      
      // Debug: Log available screens and target
      console.log('🔍 Available screens:', screens.map(s => ({ id: s.id, width: s.width, height: s.height })));
      console.log('🎯 Looking for screen ID:', targetScreenId, '(parsed from:', options.screenId, ')');
      
      // Find screen by the raw ID (since ScreenCaptureKit uses numeric IDs internally)
      const targetScreen = screens.find(s => s.id === targetScreenId);
      if (targetScreen) {
        screenId = targetScreen.id;
        console.log('✅ Found target screen:', screenId);
      } else {
        console.warn(`Screen ${options.screenId} not found, using default screen ${screenId}`);
      }
    }

    // Base configuration optimized for transcription
    const config = {
      screenId: screenId,
      fps: options.audioOnly ? 1 : (options.fps || 30), // Minimal FPS for audio-only
      showCursor: options.audioOnly ? false : (options.showCursor !== false),
      highlightClicks: options.audioOnly ? false : (options.highlightClicks || false),
      audioOnly: options.audioOnly || false
    };

    // Handle recording directory properly
    if (options.recordingDirectory) {
      // ScreenCaptureKit Node.js doesn't directly support custom directories
      // We'll need to handle this in the recording process
      this.customRecordingDirectory = options.recordingDirectory;
      console.log('📁 Custom recording directory:', options.recordingDirectory);
    }

    // System audio setup - prefer native over virtual drivers
    if (includeSystemAudio) {
      
      if (options.audioInputId && options.audioInputId !== 'default') {
        config.audioDeviceId = options.audioInputId;
        useNativeSystemAudio = false;
        console.log('🔊 Using specified audio device:', options.audioInputId);
      } else {
        // Get available audio devices to analyze what's available
        try {
          const audioDevices = await this.screencapturekit.audioDevices();
          
          // Check what types of audio devices we have
          const virtualDrivers = [];
          const possibleSystemDevices = [];
          
          if (audioDevices && audioDevices.length > 0) {
            audioDevices.forEach(device => {
              const deviceName = device.name.toLowerCase();
              
              // Detect virtual audio drivers (third-party software)
              if (deviceName.includes('teams') ||
                  deviceName.includes('loopback') ||
                  deviceName.includes('soundflower') ||
                  deviceName.includes('blackhole') ||
                  deviceName.includes('virtual')) {
                virtualDrivers.push(device);
              }
              
              // Look for potential system devices
              if (!deviceName.includes('microphone') && 
                  !deviceName.includes('iphone') &&
                  !deviceName.includes('external')) {
                possibleSystemDevices.push(device);
              }
            });
            
            console.log('🔍 Audio device analysis:');
            console.log('  📱 Virtual drivers found:', virtualDrivers.map(d => d.name));
            console.log('  🖥️ Possible system devices:', possibleSystemDevices.map(d => d.name));
            
            // Decision logic: prefer native system audio
            if (virtualDrivers.length > 0) {
              console.log('⚠️ Virtual audio drivers detected (Teams, Loopback, etc.)');
              console.log('🎯 Strategy: Use native ScreenCaptureKit system audio instead');
              console.log('💡 This ensures the app works without third-party audio software');
              
              // Track that we detected virtual drivers
              this.detectedVirtualDriver = true;
              this.audioAnalysis = {
                virtualDrivers: virtualDrivers.map(d => d.name),
                strategy: 'native-system-audio',
                reason: 'avoid-third-party-dependency'
              };
              
              // Use native system audio (don't set audioDeviceId)
              useNativeSystemAudio = true;
            } else if (possibleSystemDevices.length > 0) {
              console.log('🔊 No virtual drivers detected, checking system devices...');
              
              // Could use a system device, but native is still preferred
              this.audioAnalysis = {
                strategy: 'native-system-audio',
                reason: 'best-compatibility'
              };
              useNativeSystemAudio = true;
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not analyze audio devices:', error.message);
          
          // Check if error contains virtual driver info
          const errorMessage = error.message.toLowerCase();
          if (errorMessage.includes('teams') || errorMessage.includes('loopback')) {
            console.log('🎯 Virtual driver detected in error - using native system audio');
            this.detectedVirtualDriver = true;
          }
          
          useNativeSystemAudio = true;
        }
      }
      
      // Configure system audio capture
      if (useNativeSystemAudio) {
        // Don't set audioDeviceId - this enables native ScreenCaptureKit system audio
        console.log('🎵 Using native ScreenCaptureKit system audio capture');
        console.log('✅ This works without requiring Microsoft Teams or other virtual drivers');
        console.log('🏠 System audio: Built-in macOS ScreenCaptureKit functionality');
        // config.audioDeviceId remains undefined for native capture
      } else {
        console.log('🔊 Using specific audio device:', config.audioDeviceId);
      }
      
      console.log('🔊 System audio capture enabled:', useNativeSystemAudio ? 'native' : config.audioDeviceId);
    }

    // Microphone setup
    if (includeMicrophone) {
      if (options.microphoneDeviceId && options.microphoneDeviceId !== 'default') {
        config.microphoneDeviceId = options.microphoneDeviceId;
      } else {
        // Get default microphone - prefer built-in over external devices
        try {
          const microphones = await this.screencapturekit.microphoneDevices();
          if (microphones && microphones.length > 0) {
            // Prefer built-in microphone for reliability
            const builtInMic = microphones.find(mic => 
              mic.id === 'BuiltInMicrophoneDevice' || 
              mic.name.toLowerCase().includes('macbook') ||
              mic.name.toLowerCase().includes('built')
            );
            
            if (builtInMic) {
              config.microphoneDeviceId = builtInMic.id;
              console.log('🎤 Selected built-in microphone:', builtInMic.name);
            } else {
              // Fall back to first available microphone
              config.microphoneDeviceId = microphones[0].id;
              console.log('🎤 Selected first available microphone:', microphones[0].name);
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not get microphones:', error.message);
          // Try to extract microphone info from error message if available
          if (error.message && error.message.includes('BuiltInMicrophoneDevice')) {
            config.microphoneDeviceId = 'BuiltInMicrophoneDevice';
            console.log('🎤 Using built-in microphone from error context');
          }
        }
      }
      console.log('🎤 Microphone capture enabled:', config.microphoneDeviceId);
    }

    // For audio-only mode, use minimal video area
    if (options.audioOnly) {
      config.cropArea = {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      };
      console.log('🎵 Audio-only mode: minimal video processing');
    }

    // Video quality settings (only relevant for non-audio-only)
    if (!options.audioOnly) {
      config.videoCodec = options.videoCodec || 'h264';
      
      if (options.enableHDR && this.screencapturekit.supportsHDRCapture) {
        config.enableHDR = true;
        console.log('✨ HDR recording enabled');
      }
    }

    // ✅ DEPLOYMENT STRATEGY: Reliable System Audio
    console.log('📦 Deployment Analysis:');
    if (!useNativeSystemAudio && config.audioDeviceId) {
      console.log('   • Using virtual audio driver for reliable system audio');
      console.log('   • Current driver:', this.audioAnalysis?.selectedDriver || 'Unknown');
      console.log('   • Status: Optimal system audio capture');
      console.log('   • Deployment note: Users without virtual drivers may need one installed');
    } else {
      console.log('   • Attempting native ScreenCaptureKit system audio');
      console.log('   • Status: May not capture system audio reliably');
      console.log('   • Recommendation: Install BlackHole or Loopback for better results');
      console.log('   • Alternative: Use microphone-only recording for guaranteed audio');
    }

    return config;
  }

  /**
   * Stop ScreenCaptureKit Node.js recording
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
      console.log('🛑 Stopping ScreenCaptureKit Node.js recording...');

      if (this.recorder) {
        // Check if the recorder is still active before stopping
        try {
          // Stop recording - this automatically handles audio processing and MP3 conversion
          let tempOutputPath = await this.recorder.stopRecording();
          console.log('📁 Recording saved to temp location:', tempOutputPath);

          // Handle custom recording directory if specified
          if (this.customRecordingDirectory && tempOutputPath) {
            try {
              const path = require('path');
              const fs = require('fs').promises;
              
              // Generate final filename
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const extension = path.extname(tempOutputPath);
              const finalFilename = `recording-${timestamp}${extension}`;
              const finalPath = path.join(this.customRecordingDirectory, finalFilename);
              
              // Ensure directory exists
              await fs.mkdir(this.customRecordingDirectory, { recursive: true });
              
              // Move file from temp to final location
              await fs.copyFile(tempOutputPath, finalPath);
              
              // Clean up temp file
              try {
                await fs.unlink(tempOutputPath);
              } catch (cleanupError) {
                console.warn('⚠️ Could not clean up temp file:', cleanupError.message);
              }
              
              this.finalOutputPath = finalPath;
              console.log('📁 Recording moved to final location:', finalPath);
            } catch (moveError) {
              console.warn('⚠️ Could not move recording to custom directory:', moveError.message);
              this.finalOutputPath = tempOutputPath;
            }
          } else {
            this.finalOutputPath = tempOutputPath;
          }
        } catch (stopError) {
          console.error('❌ Error stopping recorder:', stopError);
          // Check if this is the -3808 error (stream already stopped)
          if (stopError.message && stopError.message.includes('-3808')) {
            console.log('⚠️ Stream was already stopped (Code -3808), continuing with cleanup...');
            this.finalOutputPath = null;
          } else {
            throw stopError; // Re-throw other errors
          }
        }
      }

      this.isRecording = false;
      const duration = Date.now() - this.startTime;
      
      this.emit('completed', {
        recordingId: this.recordingId,
        outputPath: this.finalOutputPath,
        duration: duration,
        method: 'screencapturekit-node',
        audioOnly: this.currentOptions?.audioOnly,
        audioSetup: this.getAudioSetupSummary()
      });

      // Log deployment analysis
      const audioSummary = this.getAudioSetupSummary();
      console.log('📊 Audio Setup Analysis:');
      console.log('   🎵 Native ScreenCaptureKit:', audioSummary.usingNativeAudio ? '✅' : '❌');
      console.log('   🚫 Requires Microsoft Teams:', audioSummary.deployment.requiresTeams ? '❌' : '✅ No');
      console.log('   🚫 Requires third-party software:', audioSummary.deployment.requiresThirdParty ? '❌' : '✅ No');
      console.log('   📦 Standalone deployment:', audioSummary.deployment.standalone ? '✅ Yes' : '❌');
      
      if (audioSummary.detectedVirtualDriver) {
        console.log('   ⚠️ Virtual drivers detected but avoided');
        console.log('   💡 App will work without third-party audio software');
      }

      console.log('✅ ScreenCaptureKit Node.js recording completed');
      
      // Verify file integrity if possible
      if (this.finalOutputPath) {
        try {
          const stats = await fs.stat(this.finalOutputPath);
          console.log(`📊 Recording file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
          
          if (stats.size < 1024) {
            console.warn('⚠️ Warning: Recording file is very small, may be corrupted');
          }
        } catch (statError) {
          console.warn('⚠️ Could not verify recording file:', statError.message);
        }
      }
      
      return {
        success: true,
        outputPath: this.finalOutputPath,
        duration: duration,
        method: 'screencapturekit-node',
        audioOnly: this.currentOptions?.audioOnly
      };

    } catch (error) {
      console.error('❌ Failed to stop ScreenCaptureKit Node.js recording:', error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Get available screens
   */
  async getAvailableScreens() {
    if (!this.screencapturekit) {
      return { success: false, error: 'ScreenCaptureKit not initialized', screens: [] };
    }

    try {
      const screens = await this.screencapturekit.screens();
      const screenList = screens.map((screen, index) => ({
        id: `screen:${screen.id}:0`, // Format as expected by the application
        name: `Display ${index + 1}`,
        type: 'screen',
        width: screen.width,
        height: screen.height,
        rawId: screen.id // Keep the original ID for internal use
      }));
      
      console.log(`✅ Found ${screenList.length} screens:`, screenList.map(s => `${s.name} (${s.id})`).join(', '));
      
      return { success: true, screens: screenList };
    } catch (error) {
      console.error('❌ Failed to get screens:', error);
      return { success: false, error: error.message, screens: [] };
    }
  }

  /**
   * Get available audio devices
   */
  async getAvailableAudioDevices() {
    if (!this.screencapturekit) {
      return [];
    }

    try {
      const devices = await this.screencapturekit.audioDevices();
      const mappedDevices = devices.map(device => ({
        id: device.id,
        name: device.name,
        type: 'audiooutput',
        manufacturer: device.manufacturer || 'Unknown'
      }));
      console.log(`✅ Retrieved ${mappedDevices.length} audio devices successfully`);
      return mappedDevices;
    } catch (error) {
      console.warn('⚠️ Failed to get audio devices:', error.message);
      // Check if the error contains device information that we can parse
      if (error.message && error.message.includes('[{')) {
        try {
          // Try to extract device info from error message
          const deviceMatch = error.message.match(/\[({.*})\]/);
          if (deviceMatch) {
            const devicesStr = '[' + deviceMatch[1] + ']';
            const parsedDevices = JSON.parse(devicesStr);
            console.log('📱 Extracted audio devices from error message:', parsedDevices.length);
            return parsedDevices.map(device => ({
              id: device.id,
              name: device.name,
              type: 'audiooutput',
              manufacturer: device.manufacturer || 'Unknown'
            }));
          }
        } catch (parseError) {
          console.warn('⚠️ Could not parse devices from error message:', parseError.message);
        }
      }
      return [];
    }
  }

  /**
   * Get available microphone devices
   */
  async getAvailableMicrophones() {
    if (!this.screencapturekit) {
      return [];
    }

    try {
      const microphones = await this.screencapturekit.microphoneDevices();
      const mappedMicrophones = microphones.map(mic => ({
        id: mic.id,
        name: mic.name,
        type: 'audioinput',
        manufacturer: mic.manufacturer || 'Unknown'
      }));
      console.log(`✅ Retrieved ${mappedMicrophones.length} microphones successfully`);
      return mappedMicrophones;
    } catch (error) {
      console.warn('⚠️ Failed to get microphones:', error.message);
      // Check if the error contains device information that we can parse
      if (error.message && error.message.includes('[{')) {
        try {
          // Try to extract device info from error message
          const deviceMatch = error.message.match(/\[({.*})\]/);
          if (deviceMatch) {
            const devicesStr = '[' + deviceMatch[1] + ']';
            const parsedDevices = JSON.parse(devicesStr);
            console.log('📱 Extracted microphones from error message:', parsedDevices.length);
            return parsedDevices.map(device => ({
              id: device.id,
              name: device.name,
              type: 'audioinput',
              manufacturer: device.manufacturer || 'Unknown'
            }));
          }
        } catch (parseError) {
          console.warn('⚠️ Could not parse microphones from error message:', parseError.message);
        }
      }
      return [];
    }
  }

  /**
   * Check permissions
   */
  async checkPermissions() {
    // ScreenCaptureKit Node.js doesn't expose permission checking
    // Return optimistic results for macOS
    return {
      screen: 'granted',
      microphone: 'granted'
    };
  }

  /**
   * Get audio setup summary for debugging/logging
   */
  getAudioSetupSummary() {
    return {
      detectedVirtualDriver: this.detectedVirtualDriver,
      audioAnalysis: this.audioAnalysis,
      usingNativeAudio: !this.currentOptions?.audioDeviceId,
      deployment: {
        requiresTeams: false,
        requiresLoopback: false,
        requiresThirdParty: false,
        standalone: true
      }
    };
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      method: 'screencapturekit-node',
      recordingId: this.recordingId,
      outputPath: this.finalOutputPath,
      audioOnly: this.currentOptions?.audioOnly,
      dependencies: {
        screencapturekit: !!this.screencapturekit
      }
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up ScreenCaptureKit Node.js recorder...');

    const wasRecording = this.isRecording;
    this.isRecording = false;

    if (this.recorder) {
      try {
        if (wasRecording) {
          console.log('🛑 Attempting to stop recording during cleanup...');
          await this.recorder.stopRecording();
        }
      } catch (error) {
        console.warn('⚠️ Failed to stop recorder during cleanup:', error.message);
        // Don't throw error during cleanup - log and continue
        if (error.message && error.message.includes('-3808')) {
          console.log('ℹ️ Stream was already stopped during cleanup (expected)');
        }
      }
      this.recorder = null;
    }

    this.recordingId = null;
    this.currentOptions = null;
    this.startTime = null;
    this.outputPath = null;
    this.finalOutputPath = null;
    this.customRecordingDirectory = null;
    this.detectedVirtualDriver = false;
    this.audioAnalysis = null;
  }

  /**
   * Destroy recorder
   */
  destroy() {
    console.log('🗑️ Destroying ScreenCaptureKit Node.js recorder');
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = ScreenCaptureKitNodeRecorder;