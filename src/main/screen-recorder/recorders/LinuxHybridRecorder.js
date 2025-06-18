// ============================================================================

// src/main/screen-recorder/core/LinuxHybridRecorder.js
/**
 * Linux Hybrid Recorder using Browser MediaRecorder + CPAL + FFmpeg
 * Similar to Windows but with Linux-specific optimizations
 */

const WindowsHybridRecorder = require('./WindowsHybridRecorder');

class LinuxHybridRecorder extends WindowsHybridRecorder {
  constructor() {
    super();
    console.log('🐧 Creating Linux Hybrid Recorder (extends Windows Hybrid)');
  }

  /**
   * Initialize Linux hybrid recorder
   */
  async initialize() {
    try {
      console.log('🐧 Initializing Linux Hybrid Recorder...');
      
      // Use parent initialization
      await super.initialize();
      
      // Linux-specific optimizations could go here
      console.log('✅ Linux Hybrid Recorder initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Linux Hybrid Recorder:', error);
      throw error;
    }
  }

  /**
   * Start recording with Linux-specific optimizations
   */
  async startRecording(options) {
    console.log('🐧 Starting Linux hybrid recording...');
    
    // Add Linux-specific audio handling if needed
    const linuxOptions = {
      ...options,
      // Linux might need specific CPAL settings
      linuxAudioSystem: this.detectLinuxAudioSystem()
    };
    
    const result = await super.startRecording(linuxOptions);
    result.method = 'linux-hybrid';
    
    return result;
  }

  /**
   * Detect Linux audio system (PulseAudio, ALSA, JACK, etc.)
   */
  detectLinuxAudioSystem() {
    // This could detect the audio system for optimized CPAL settings
    if (process.env.PULSE_SERVER || process.env.PULSE_RUNTIME_PATH) {
      return 'pulseaudio';
    } else if (process.env.JACK_DEFAULT_SERVER) {
      return 'jack';
    } else {
      return 'alsa';
    }
  }

  /**
   * Generate Linux-specific output path
   */
  generateFinalOutputPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `linux-hybrid-${timestamp}.mp4`;
    return path.join(require('os').tmpdir(), 'whisperdesk-recordings', filename);
  }
}

module.exports = LinuxHybridRecorder;