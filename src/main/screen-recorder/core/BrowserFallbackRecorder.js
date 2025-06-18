// ============================================================================

// src/main/screen-recorder/core/BrowserFallbackRecorder.js
/**
 * Browser Fallback Recorder - pure browser-based recording
 * Used when native methods are not available
 */

const { EventEmitter } = require('events');

class BrowserFallbackRecorder extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.recordingId = null;
  }

  /**
   * Initialize browser fallback recorder
   */
  async initialize() {
    console.log('🌐 Initializing Browser Fallback Recorder...');
    
    // This recorder is purely browser-based
    // All actual recording happens in the renderer process
    
    console.log('✅ Browser Fallback Recorder initialized');
    return true;
  }

  /**
   * Start recording (delegates to renderer)
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.recordingId = `browser-fallback-${Date.now()}`;
      this.isRecording = true;
      
      console.log('🌐 Starting browser fallback recording...');
      
      // Browser recording is handled entirely by renderer
      return {
        success: true,
        method: 'browser-fallback',
        systemAudio: false, // Limited browser system audio
        microphone: options.includeMicrophone || false,
        recordingId: this.recordingId
      };
      
    } catch (error) {
      console.error('❌ Failed to start browser fallback recording:', error);
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
      console.log('🛑 Stopping browser fallback recording...');
      
      this.isRecording = false;
      
      // Browser recording stop is handled by renderer
      return {
        success: true,
        method: 'browser-fallback',
        recordingId: this.recordingId
      };
      
    } catch (error) {
      console.error('❌ Failed to stop browser fallback recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      method: 'browser-fallback',
      recordingId: this.recordingId,
      note: 'Recording handled by renderer process'
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.isRecording = false;
    this.recordingId = null;
  }

  /**
   * Destroy recorder
   */
  destroy() {
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = BrowserFallbackRecorder;