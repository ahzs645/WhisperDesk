// ============================================================================

// src/main/screen-recorder/services/CPALMicrophone.js
/**
 * Enhanced CPAL Microphone service using native node-cpal module
 * Provides high-quality microphone recording with minimal latency
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const { createWriteStream } = require('fs');

class CPALMicrophone extends EventEmitter {
  constructor() {
    super();
    
    // Core properties
    this.isRecording = false;
    this.isInitialized = false;
    this.cpal = null;
    
    // Recording state
    this.streamHandle = null;
    this.outputPath = null;
    this.writeStream = null;
    this.recordingBuffer = [];
    
    // Configuration
    this.deviceId = null;
    this.sampleRate = 44100;
    this.channels = 2;
    this.sampleFormat = 'f32';
    this.bufferSize = 4096;
    
    // Device info
    this.availableDevices = [];
    this.selectedDevice = null;
    this.streamConfig = null;
  }

  /**
   * Initialize CPAL microphone service
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🎤 Initializing CPAL Microphone Service...');
      
      // Load native CPAL module
      await this.loadCPALModule();
      
      // Get available audio devices
      await this.refreshDevices();
      
      // Set default device if none selected
      if (!this.selectedDevice && this.availableDevices.length > 0) {
        this.selectedDevice = this.getDefaultInputDevice();
      }

      this.isInitialized = true;
      console.log('✅ CPAL Microphone Service initialized');
      
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize CPAL:', error);
      throw error;
    }
  }

  /**
   * Load the native CPAL module
   */
  async loadCPALModule() {
    try {
      this.cpal = require('node-cpal');
      console.log('✅ Native CPAL module loaded successfully');
    } catch (error) {
      throw new Error(`Failed to load node-cpal module: ${error.message}`);
    }
  }

  /**
   * Refresh available audio devices
   */
  async refreshDevices() {
    try {
      this.availableDevices = this.cpal.getDevices();
      console.log(`📱 Found ${this.availableDevices.length} audio devices`);
      
      // Log available input devices
      const inputDevices = this.availableDevices.filter(device => 
        device.supportedInputConfigs && device.supportedInputConfigs.length > 0
      );
      
      console.log('🎤 Available input devices:');
      inputDevices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.name} (${device.deviceId})`);
      });
      
      return this.availableDevices;
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
      this.availableDevices = [];
      return [];
    }
  }

  /**
   * Get default input device
   */
  getDefaultInputDevice() {
    try {
      return this.cpal.getDefaultInputDevice();
    } catch (error) {
      console.warn('⚠️ Failed to get default input device:', error.message);
      // Fallback to first available input device
      const inputDevices = this.availableDevices.filter(device => 
        device.supportedInputConfigs && device.supportedInputConfigs.length > 0
      );
      return inputDevices.length > 0 ? inputDevices[0] : null;
    }
  }

  /**
   * Get available audio input devices
   */
  async getAvailableDevices() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.availableDevices.filter(device => 
      device.supportedInputConfigs && device.supportedInputConfigs.length > 0
    );
  }

  /**
   * Start recording with CPAL - with better device handling
   */
  async startRecording(options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      // ✅ FIXED: Better device ID handling
      let deviceId = options.deviceId;
      
      // Handle different device ID formats
      if (deviceId === 'default' || !deviceId) {
        // Try to get the actual default device
        const defaultDevice = this.getDefaultInputDevice();
        if (defaultDevice) {
          deviceId = defaultDevice.deviceId;
          console.log(`🎤 Using default device: ${defaultDevice.name} (${deviceId})`);
        } else {
          // Try the first available input device
          const inputDevices = this.availableDevices.filter(device => 
            device.supportedInputConfigs && device.supportedInputConfigs.length > 0
          );
          
          if (inputDevices.length > 0) {
            deviceId = inputDevices[0].deviceId;
            console.log(`🎤 Using first available device: ${inputDevices[0].name} (${deviceId})`);
          } else {
            throw new Error('No audio input devices available');
          }
        }
      }
      
      // Verify the device exists
      const device = this.availableDevices.find(d => d.deviceId === deviceId);
      if (!device) {
        // List available devices for debugging
        console.log('🎤 Available devices:');
        this.availableDevices.forEach((dev, index) => {
          console.log(`  ${index + 1}. ${dev.name} (${dev.deviceId})`);
        });
        
        throw new Error(`Audio device not found: ${deviceId}. Available devices: ${this.availableDevices.length}`);
      }

      // Continue with recording setup...
      this.deviceId = deviceId;
      this.outputPath = options.outputPath || this.generateOutputPath();
      
      // Set recording parameters
      this.sampleRate = options.sampleRate || 44100;
      this.channels = options.channels || 2;
      this.sampleFormat = options.sampleFormat || 'f32';
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(this.outputPath), { recursive: true });

      // Get optimal stream configuration
      this.streamConfig = this.getOptimalStreamConfig(device);
      
      // Create write stream for output
      this.writeStream = createWriteStream(this.outputPath);
      this.recordingBuffer = [];
      
      // Create CPAL input stream
      this.streamHandle = this.cpal.createInputStream({
        deviceId: this.deviceId,
        config: this.streamConfig,
        onData: (audioData) => {
          this.handleAudioData(audioData);
        }
      });
      
      this.isRecording = true;
      
      this.emit('started', {
        outputPath: this.outputPath,
        sampleRate: this.streamConfig.sampleRate,
        channels: this.streamConfig.channels,
        deviceId: this.deviceId,
        deviceName: device.name
      });
      
      console.log(`🎤 CPAL recording started: ${this.outputPath}`);
      console.log(`   Device: ${device.name}`);
      console.log(`   Config: ${this.streamConfig.sampleRate}Hz, ${this.streamConfig.channels}ch, ${this.streamConfig.sampleFormat}`);
      
      return { 
        success: true, 
        outputPath: this.outputPath,
        config: this.streamConfig,
        device: device.name
      };
      
    } catch (error) {
      console.error('❌ Failed to start CPAL recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Get optimal stream configuration for device
   */
  getOptimalStreamConfig(device) {
    try {
      // Try to get default configuration
      const defaultConfig = this.cpal.getDefaultInputConfig(device.deviceId);
      
      // Override with our preferences if supported
      const supportedConfigs = device.supportedInputConfigs || [];
      
      // Find best matching configuration
      let bestConfig = defaultConfig;
      
      for (const config of supportedConfigs) {
        // Prefer our target sample rate if supported
        if (config.minSampleRate <= this.sampleRate && 
            config.maxSampleRate >= this.sampleRate &&
            config.channels >= this.channels) {
          bestConfig = {
            sampleRate: this.sampleRate,
            channels: Math.min(this.channels, config.channels),
            sampleFormat: config.sampleFormat
          };
          break;
        }
      }
      
      return bestConfig;
      
    } catch (error) {
      console.warn('⚠️ Failed to get optimal config, using defaults:', error.message);
      return {
        sampleRate: this.sampleRate,
        channels: this.channels,
        sampleFormat: this.sampleFormat
      };
    }
  }

  /**
   * Handle incoming audio data
   */
  handleAudioData(audioData) {
    if (!this.isRecording || !this.writeStream) {
      return;
    }

    try {
      // Convert Float32Array to Buffer for WAV writing
      const buffer = this.convertAudioDataToBuffer(audioData);
      
      // Store in buffer for potential processing
      this.recordingBuffer.push(buffer);
      
      // Write to file stream
      this.writeStream.write(buffer);
      
      // Emit progress event
      this.emit('data', {
        samples: audioData.length,
        bytes: buffer.length,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('❌ Error handling audio data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Convert Float32Array audio data to Buffer
   */
  convertAudioDataToBuffer(audioData) {
    // Convert Float32Array to 16-bit PCM
    const samples = audioData.length;
    const buffer = Buffer.alloc(samples * 2); // 2 bytes per sample for 16-bit
    
    for (let i = 0; i < samples; i++) {
      // Convert float (-1.0 to 1.0) to 16-bit integer (-32768 to 32767)
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      const intSample = Math.round(sample * 32767);
      buffer.writeInt16LE(intSample, i * 2);
    }
    
    return buffer;
  }

  /**
   * Stop recording
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress' };
    }

    try {
      console.log('🛑 Stopping CPAL recording...');
      
      // Close CPAL stream
      if (this.streamHandle) {
        this.cpal.closeStream(this.streamHandle);
        this.streamHandle = null;
      }
      
      // Close write stream
      if (this.writeStream) {
        await new Promise((resolve, reject) => {
          this.writeStream.end((error) => {
            if (error) reject(error);
            else resolve();
          });
        });
        this.writeStream = null;
      }
      
      // Write WAV header to make it a proper audio file
      await this.finalizeWAVFile();
      
      this.isRecording = false;
      
      this.emit('completed', { 
        outputPath: this.outputPath,
        samples: this.recordingBuffer.length,
        duration: this.calculateDuration()
      });
      
      console.log('✅ CPAL recording stopped:', this.outputPath);
      
      return {
        success: true,
        outputPath: this.outputPath,
        method: 'cpal-native'
      };
      
    } catch (error) {
      console.error('❌ Failed to stop CPAL recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Finalize WAV file with proper header
   */
  async finalizeWAVFile() {
    try {
      const stats = await fs.stat(this.outputPath);
      const audioDataSize = stats.size;
      
      // Create WAV header
      const header = this.createWAVHeader(audioDataSize);
      
      // Read existing audio data
      const audioData = await fs.readFile(this.outputPath);
      
      // Write complete WAV file
      const completeWAV = Buffer.concat([header, audioData]);
      await fs.writeFile(this.outputPath, completeWAV);
      
      console.log('✅ WAV file finalized with header');
      
    } catch (error) {
      console.warn('⚠️ Failed to finalize WAV file:', error.message);
      // File is still usable as raw PCM, just without proper header
    }
  }

  /**
   * Create WAV file header
   */
  createWAVHeader(audioDataSize) {
    const sampleRate = this.streamConfig?.sampleRate || 44100;
    const channels = this.streamConfig?.channels || 2;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    const totalSize = 36 + audioDataSize;

    const header = Buffer.alloc(44);
    let offset = 0;

    // RIFF header
    header.write('RIFF', offset); offset += 4;
    header.writeUInt32LE(totalSize, offset); offset += 4;
    header.write('WAVE', offset); offset += 4;

    // fmt chunk
    header.write('fmt ', offset); offset += 4;
    header.writeUInt32LE(16, offset); offset += 4; // chunk size
    header.writeUInt16LE(1, offset); offset += 2;  // audio format (PCM)
    header.writeUInt16LE(channels, offset); offset += 2;
    header.writeUInt32LE(sampleRate, offset); offset += 4;
    header.writeUInt32LE(byteRate, offset); offset += 4;
    header.writeUInt16LE(blockAlign, offset); offset += 2;
    header.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    header.write('data', offset); offset += 4;
    header.writeUInt32LE(audioDataSize, offset);

    return header;
  }

  /**
   * Calculate recording duration
   */
  calculateDuration() {
    if (!this.streamConfig || this.recordingBuffer.length === 0) {
      return 0;
    }
    
    const totalSamples = this.recordingBuffer.reduce((sum, buffer) => 
      sum + (buffer.length / 2), 0); // 2 bytes per sample
    
    return totalSamples / (this.streamConfig.sampleRate * this.streamConfig.channels);
  }

  /**
   * Pause recording (if supported)
   */
  async pauseRecording() {
    if (this.streamHandle) {
      try {
        this.cpal.pauseStream(this.streamHandle);
        this.emit('paused');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to pause CPAL stream:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'No active stream to pause' };
  }

  /**
   * Resume recording (if supported)
   */
  async resumeRecording() {
    if (this.streamHandle) {
      try {
        this.cpal.resumeStream(this.streamHandle);
        this.emit('resumed');
        return { success: true };
      } catch (error) {
        console.error('❌ Failed to resume CPAL stream:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'No active stream to resume' };
  }

  /**
   * Get recording status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      isInitialized: this.isInitialized,
      deviceId: this.deviceId,
      deviceName: this.selectedDevice?.name || 'Unknown',
      outputPath: this.outputPath,
      sampleRate: this.streamConfig?.sampleRate || this.sampleRate,
      channels: this.streamConfig?.channels || this.channels,
      duration: this.calculateDuration(),
      bufferCount: this.recordingBuffer.length
    };
  }

  /**
   * Generate output path for recording
   */
  generateOutputPath() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cpal-microphone-${timestamp}.wav`;
    return path.join(require('os').tmpdir(), 'whisperdesk-recordings', filename);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('🧹 Cleaning up CPAL microphone...');
    
    try {
      if (this.streamHandle) {
        this.cpal.closeStream(this.streamHandle);
        this.streamHandle = null;
      }
    } catch (error) {
      console.warn('⚠️ Error closing CPAL stream:', error.message);
    }
    
    try {
      if (this.writeStream) {
        this.writeStream.destroy();
        this.writeStream = null;
      }
    } catch (error) {
      console.warn('⚠️ Error closing write stream:', error.message);
    }
    
    this.isRecording = false;
    this.outputPath = null;
    this.recordingBuffer = [];
  }

  /**
   * Destroy microphone service
   */
  destroy() {
    this.cleanup();
    this.removeAllListeners();
    this.isInitialized = false;
    this.cpal = null;
  }
}

module.exports = CPALMicrophone;
