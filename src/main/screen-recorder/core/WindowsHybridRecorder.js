// ============================================================================

// src/main/screen-recorder/core/WindowsHybridRecorder.js
/**
 * Windows Hybrid Recorder using Browser MediaRecorder + CPAL + FFmpeg
 * Browser: Screen capture with system audio
 * CPAL: High-quality microphone recording
 * FFmpeg: Stream merging
 */

const { EventEmitter } = require('events');
const CPALMicrophone = require('../services/CPALMicrophone');
const FFmpegMerger = require('../services/FFmpegMerger');

class WindowsHybridRecorder extends EventEmitter {
  constructor() {
    super();
    
    // Components
    this.cpalMicrophone = new CPALMicrophone();
    this.ffmpegMerger = new FFmpegMerger();
    
    // State
    this.isRecording = false;
    this.recordingId = null;
    this.outputPaths = {};
    this.finalOutputPath = null;
    
    // Browser recording will be handled by renderer
    this.rendererRecording = null;
  }

  /**
   * Initialize Windows hybrid recorder
   */
  async initialize() {
    try {
      console.log('🪟 Initializing Windows Hybrid Recorder...');
      
      // Initialize CPAL and FFmpeg (browser handled by renderer)
      await this.cpalMicrophone.initialize();
      await this.ffmpegMerger.initialize();
      
      // Set up event forwarding
      this.setupEventForwarding();
      
      console.log('✅ Windows Hybrid Recorder initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Windows Hybrid Recorder:', error);
      throw error;
    }
  }

  /**
   * Set up event forwarding
   */
  setupEventForwarding() {
    // Forward CPAL events
    this.cpalMicrophone.on('completed', (data) => {
      this.handleCPALCompleted(data);
    });
    
    this.cpalMicrophone.on('error', (error) => {
      this.emit('error', { ...error, component: 'cpal' });
    });
    
    // Forward FFmpeg events
    this.ffmpegMerger.on('completed', (data) => {
      this.handleMergeCompleted(data);
    });
    
    this.ffmpegMerger.on('progress', (progress) => {
      this.emit('merging', progress);
    });
  }

  /**
   * Start recording with Windows hybrid approach
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.recordingId = `windows-hybrid-${Date.now()}`;
      this.outputPaths = {};
      
      console.log('🪟 Starting Windows hybrid recording...');
      
      // Start CPAL for microphone (if enabled)
      if (options.includeMicrophone) {
        const cpalResult = await this.cpalMicrophone.startRecording({
          deviceId: options.audioInputId,
          recordingId: this.recordingId
        });
        
        this.outputPaths.microphone = cpalResult.outputPath;
      }
      
      this.isRecording = true;
      
      // Browser recording will handle screen + system audio
      // This is coordinated by the renderer service
      
      console.log('✅ Windows hybrid recording started');
      
      return {
        success: true,
        method: 'windows-hybrid',
        systemAudio: options.includeSystemAudio || false,
        microphone: !!this.outputPaths.microphone,
        recordingId: this.recordingId
      };
      
    } catch (error) {
      console.error('❌ Failed to start Windows hybrid recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Notify that browser recording completed
   * Called by the renderer service when browser recording finishes
   */
  async notifyBrowserCompleted(browserOutputPath) {
    console.log('🌐 Browser recording completed:', browserOutputPath);
    this.outputPaths.screen = browserOutputPath;
    this.checkForMerge();
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress' };
    }

    try {
      console.log('🛑 Stopping Windows hybrid recording...');
      
      // Stop CPAL microphone
      if (this.cpalMicrophone.isRecording) {
        await this.cpalMicrophone.stopRecording();
      }
      
      this.isRecording = false;
      
      // Browser recording should be stopped by renderer
      // Final merge will happen when both streams are ready
      
      return {
        success: true,
        method: 'windows-hybrid',
        recordingId: this.recordingId
      };
      
    } catch (error) {
      console.error('❌ Failed to stop Windows hybrid recording:', error);
      this.cleanup();
      throw error;
    }
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
    // Merge if recording stopped and we have both sources
    if (!this.isRecording && this.outputPaths.screen && this.outputPaths.microphone) {
      this.mergeStreamFiles();
    } else if (!this.isRecording && this.outputPaths.screen && !this.outputPaths.microphone) {
      // Screen only - use as final output
      this.finalOutputPath = this.outputPaths.screen;
      this.emit('completed', {
        outputPath: this.finalOutputPath,
        method: 'windows-hybrid-screen-only',
        recordingId: this.recordingId
      });
    }
  }

  /**
   * Merge stream files using FFmpeg
   */
  async mergeStreamFiles() {
    try {
      console.log('🔄 Merging Windows hybrid streams...');
      
      const inputs = [
        { type: 'video', path: this.outputPaths.screen },
        { type: 'microphone', path: this.outputPaths.microphone }
      ];
      
      this.finalOutputPath = this.generateFinalOutputPath();
      
      await this.ffmpegMerger.mergeStreams(inputs, this.finalOutputPath, {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        audioBitrate: '128k'
      });
      
      console.log('✅ Windows hybrid streams merged:', this.finalOutputPath);
      
    } catch (error) {
      console.error('❌ Failed to merge Windows hybrid streams:', error);
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
      method: 'windows-hybrid-merged',
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
    const filename = `windows-hybrid-${timestamp}.mp4`;
    return path.join(require('os').tmpdir(), 'whisperdesk-recordings', filename);
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      method: 'windows-hybrid',
      recordingId: this.recordingId,
      components: {
        browser: !!this.outputPaths.screen,
        cpal: this.cpalMicrophone.isRecording,
        merger: this.ffmpegMerger.isProcessing
      },
      outputPaths: this.outputPaths,
      finalOutputPath: this.finalOutputPath
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Windows hybrid recorder...');
    
    this.cpalMicrophone.cleanup();
    this.ffmpegMerger.cleanup();
    
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

module.exports = WindowsHybridRecorder;