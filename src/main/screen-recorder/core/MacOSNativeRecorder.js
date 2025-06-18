// ============================================================================

// src/main/screen-recorder/core/MacOSNativeRecorder.js
/**
 * macOS Native Recorder using pure Aperture v7 + ScreenCaptureKit
 * No browser dependencies - 100% native macOS recording
 */

const { EventEmitter } = require('events');
const CPALMicrophone = require('../services/CPALMicrophone');
const FFmpegMerger = require('../services/FFmpegMerger');
const ApertureV7Recorder = require('../../services/aperture-recorder');

class MacOSNativeRecorder extends EventEmitter {
  constructor() {
    super();
    
    // Components
    this.apertureRecorder = new ApertureV7Recorder();
    this.cpalMicrophone = null; // Will be initialized if available
    this.ffmpegMerger = new FFmpegMerger();
    
    // State
    this.isRecording = false;
    this.recordingId = null;
    this.outputPaths = {};
    this.finalOutputPath = null;
    this.cpalAvailable = false;
  }

  /**
   * Initialize macOS native recorder
   */
  async initialize() {
    try {
      console.log('🍎 Initializing macOS Native Recorder...');
      
      // Initialize core components (required)
      await this.apertureRecorder.initialize();
      await this.ffmpegMerger.initialize();
      
      // Try to initialize CPAL (optional)
      try {
        this.cpalMicrophone = new CPALMicrophone();
        await this.cpalMicrophone.initialize();
        this.cpalAvailable = true;
        console.log('✅ CPAL available for enhanced microphone recording');
      } catch (cpalError) {
        console.log('⚠️ CPAL not available, will use browser microphone fallback:', cpalError.message);
        this.cpalMicrophone = null;
        this.cpalAvailable = false;
      }
      
      // Set up event forwarding
      this.setupEventForwarding();
      
      console.log('✅ macOS Native Recorder initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize macOS Native Recorder:', error);
      throw error;
    }
  }

  /**
   * Set up event forwarding
   */
  setupEventForwarding() {
    // Forward aperture events
    if (this.apertureRecorder) {
      this.apertureRecorder.on('started', (data) => {
        this.emit('started', { ...data, method: 'macos-native' });
      });
      
      this.apertureRecorder.on('completed', (data) => {
        this.handleApertureCompleted(data);
      });
      
      this.apertureRecorder.on('error', (error) => {
        this.emit('error', { ...error, component: 'aperture' });
      });
    }
    
    // Forward CPAL events (if available)
    if (this.cpalMicrophone) {
      this.cpalMicrophone.on('completed', (data) => {
        this.handleCPALCompleted(data);
      });
      
      this.cpalMicrophone.on('error', (error) => {
        this.emit('error', { ...error, component: 'cpal' });
      });
    }
    
    // Forward FFmpeg events
    if (this.ffmpegMerger) {
      this.ffmpegMerger.on('completed', (data) => {
        this.handleMergeCompleted(data);
      });
      
      this.ffmpegMerger.on('progress', (progress) => {
        this.emit('merging', progress);
      });
    }
  }

  /**
   * Start recording with native macOS stack
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.recordingId = `macos-native-${Date.now()}`;
      this.outputPaths = {};
      
      console.log('🍎 Starting macOS native recording...');
      
      // Start Aperture v7 for screen + system audio
      const apertureResult = await this.apertureRecorder.startRecording({
        ...options,
        includeSystemAudio: true, // Always include with ScreenCaptureKit
        recordingId: this.recordingId
      });
      
      this.outputPaths.screen = apertureResult.outputPath;
      
      // Start CPAL for microphone (if enabled and available)
      if (options.includeMicrophone && this.cpalAvailable) {
        const cpalResult = await this.cpalMicrophone.startRecording({
          deviceId: options.audioInputId,
          recordingId: this.recordingId
        });
        
        this.outputPaths.microphone = cpalResult.outputPath;
      } else if (options.includeMicrophone && !this.cpalAvailable) {
        console.log('⚠️ Microphone requested but CPAL not available - using system audio only');
      }
      
      this.isRecording = true;
      
      console.log('✅ macOS native recording started:', {
        screen: this.outputPaths.screen ? 'Yes' : 'No',
        microphone: this.outputPaths.microphone ? 'Yes' : 'No'
      });
      
      return {
        success: true,
        method: 'macos-native',
        systemAudio: true,
        microphone: !!this.outputPaths.microphone,
        recordingId: this.recordingId
      };
      
    } catch (error) {
      console.error('❌ Failed to start macOS native recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress' };
    }

    try {
      console.log('🛑 Stopping macOS native recording...');
      
      // Stop both recorders simultaneously
      const stopPromises = [];
      
      if (this.apertureRecorder && this.apertureRecorder.isRecording) {
        stopPromises.push(this.apertureRecorder.stopRecording());
      }
      
      if (this.cpalMicrophone && this.cpalMicrophone.isRecording) {
        stopPromises.push(this.cpalMicrophone.stopRecording());
      }
      
      if (stopPromises.length > 0) {
        await Promise.all(stopPromises);
      }
      
      this.isRecording = false;
      
      // Merge streams if we have multiple sources
      if (this.outputPaths.screen && this.outputPaths.microphone) {
        await this.mergeStreamFiles();
      } else {
        // Single source - use as final output
        this.finalOutputPath = this.outputPaths.screen || this.outputPaths.microphone;
        if (this.finalOutputPath) {
          this.emit('completed', {
            outputPath: this.finalOutputPath,
            method: 'macos-native',
            recordingId: this.recordingId
          });
        }
      }
      
      return {
        success: true,
        outputPath: this.finalOutputPath,
        method: 'macos-native'
      };
      
    } catch (error) {
      console.error('❌ Failed to stop macOS native recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Handle Aperture completion
   */
  handleApertureCompleted(data) {
    console.log('🍎 Aperture recording completed:', data.outputPath);
    this.outputPaths.screen = data.outputPath;
    this.checkForMerge();
  }

  /**
   * Handle CPAL completion
   */
  handleCPALCompleted(data) {
    console.log('🎤 CPAL recording completed:', data.outputPath);
    this.outputPaths.microphone = data.outputPath;
    this.checkForMerge();
  }

  /**
   * Check if we should merge streams
   */
  checkForMerge() {
    // Only merge if recording has stopped and we have both sources
    if (!this.isRecording && this.outputPaths.screen && this.outputPaths.microphone) {
      this.mergeStreamFiles();
    }
  }

  /**
   * Merge stream files using FFmpeg
   */
  async mergeStreamFiles() {
    try {
      console.log('🔄 Merging macOS native streams...');
      
      const inputs = [
        { type: 'video', path: this.outputPaths.screen },
        { type: 'microphone', path: this.outputPaths.microphone }
      ];
      
      this.finalOutputPath = this.generateFinalOutputPath();
      
      await this.ffmpegMerger.mergeStreams(inputs, this.finalOutputPath, {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        audioBitrate: '192k'
      });
      
      console.log('✅ macOS native streams merged:', this.finalOutputPath);
      
    } catch (error) {
      console.error('❌ Failed to merge macOS native streams:', error);
      this.emit('error', error);
    }
  }

  /**
   * Handle merge completion
   */
  handleMergeCompleted(data) {
    this.finalOutputPath = data.outputPath;
    
    this.emit('completed', {
      outputPath: this.finalOutputPath,
      method: 'macos-native-merged',
      recordingId: this.recordingId,
      size: data.size,
      inputs: data.inputs
    });
  }

  /**
   * Generate final output path
   */
  generateFinalOutputPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `macos-native-${timestamp}.mp4`;
    return path.join(require('os').tmpdir(), 'whisperdesk-recordings', filename);
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      method: 'macos-native',
      recordingId: this.recordingId,
      components: {
        aperture: this.apertureRecorder ? this.apertureRecorder.isRecording : false,
        cpal: this.cpalMicrophone ? this.cpalMicrophone.isRecording : false,
        merger: this.ffmpegMerger ? this.ffmpegMerger.isProcessing : false
      },
      outputPaths: this.outputPaths,
      finalOutputPath: this.finalOutputPath
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('🧹 Cleaning up macOS native recorder...');
    
    if (this.apertureRecorder) {
      this.apertureRecorder.cleanup();
    }
    
    if (this.cpalMicrophone) {
      this.cpalMicrophone.cleanup();
    }
    
    if (this.ffmpegMerger) {
      this.ffmpegMerger.cleanup();
    }
    
    this.isRecording = false;
    this.recordingId = null;
    this.outputPaths = {};
    this.finalOutputPath = null;
  }

  /**
   * Destroy recorder
   */
  destroy() {
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = MacOSNativeRecorder;