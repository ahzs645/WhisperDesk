const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');
const FormData = require('form-data');
const transcriptionStore = require('./transcription-store');

// Import providers
const WhisperProvider = require('./providers/whisper-provider');
const DeepgramProvider = require('./providers/deepgram-provider');

class TranscriptionService extends EventEmitter {
  constructor(modelManager) {
    super();
    this.providers = new Map();
    this.activeTranscriptions = new Map();
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-transcription');
    this.defaultProvider = 'whisper';
    this.modelManager = modelManager;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Transcription service already initialized');
      return;
    }

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Initialize providers
      await this.initializeProviders();
      
      this.isInitialized = true;
      console.log('Transcription service initialized');
      console.log(`Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    } catch (error) {
      console.error('Error initializing transcription service:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async initializeProviders() {
    // Initialize Whisper provider
    if (!this.providers.has('whisper')) {
      const whisperProvider = new WhisperProvider(this.modelManager);
      await whisperProvider.initialize();
      this.providers.set('whisper', whisperProvider);
    }

    // Initialize Deepgram provider
    if (!this.providers.has('deepgram')) {
      const deepgramProvider = new DeepgramProvider();
      await deepgramProvider.initialize();
      this.providers.set('deepgram', deepgramProvider);
    }
  }

  getProviders() {
    return Array.from(this.providers.entries()).map(([id, provider]) => {
      const capabilities = provider.getCapabilities();
      const availableModels = provider.getAvailableModels ? provider.getAvailableModels() : [];
      
      // Handle different model formats
      const models = Array.isArray(availableModels) ? availableModels.map(model => {
        // If model is already an object with the required properties
        if (typeof model === 'object' && model !== null) {
          return {
            id: model.id || model,
            name: model.name || model,
            size: model.size || 'Unknown',
            accuracy: model.accuracy || 'Unknown',
            speed: model.speed || 'Unknown',
            description: model.description || ''
          };
        }
        // If model is a string
        return {
          id: model,
          name: model,
          size: provider.getModelSize ? provider.getModelSize(model) : 'Unknown',
          accuracy: provider.getModelAccuracy ? provider.getModelAccuracy(model) : 'Unknown',
          speed: provider.getModelSpeed ? provider.getModelSpeed(model) : 'Unknown',
          description: provider.getModelDescription ? provider.getModelDescription(model) : ''
        };
      }) : [];

      return {
        id,
        name: provider.getName(),
        description: provider.getDescription(),
        capabilities: {
          realtime: capabilities.realtime || false,
          fileTranscription: capabilities.fileTranscription || false,
          speakerDiarization: capabilities.speakerDiarization || false,
          languageDetection: capabilities.languageDetection || false,
          wordTimestamps: capabilities.wordTimestamps || false
        },
        isAvailable: provider.isAvailable(),
        models
      };
    });
  }

  async startTranscription(options = {}) {
    const {
      provider = this.defaultProvider,
      model = 'base',
      language = 'auto',
      enableSpeakerDiarization = true,
      enableTimestamps = true,
      maxSpeakers = 10,
      audioSource = 'microphone',
      deviceId = 'default'
    } = options;

    const transcriptionId = this.generateTranscriptionId();
    
    try {
      const selectedProvider = this.providers.get(provider);
      if (!selectedProvider) {
        throw new Error(`Provider ${provider} not found`);
      }

      if (!selectedProvider.isAvailable()) {
        throw new Error(`Provider ${provider} is not available`);
      }

      const transcriptionOptions = {
        transcriptionId,
        model,
        language,
        enableSpeakerDiarization,
        enableTimestamps,
        maxSpeakers,
        audioSource,
        deviceId
      };

      // Start transcription with the selected provider
      const result = await selectedProvider.startTranscription(transcriptionOptions);
      
      // Track active transcription
      this.activeTranscriptions.set(transcriptionId, {
        provider: selectedProvider,
        options: transcriptionOptions,
        startTime: Date.now(),
        status: 'active'
      });

      // Set up event forwarding
      this.setupProviderEventForwarding(selectedProvider, transcriptionId);

      this.emit('transcriptionStarted', {
        transcriptionId,
        provider,
        options: transcriptionOptions
      });

      return {
        success: true,
        transcriptionId,
        provider,
        result
      };

    } catch (error) {
      this.emit('transcriptionError', {
        transcriptionId,
        error: error.message
      });
      
      throw error;
    }
  }

  async stopTranscription(transcriptionId) {
    if (!transcriptionId) {
      // Stop all active transcriptions
      const promises = Array.from(this.activeTranscriptions.keys())
        .map(id => this.stopTranscription(id));
      
      await Promise.all(promises);
      return { success: true };
    }

    const transcription = this.activeTranscriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription ${transcriptionId} not found`);
    }

    try {
      await transcription.provider.stopTranscription(transcriptionId);
      
      transcription.status = 'stopped';
      transcription.endTime = Date.now();
      
      this.activeTranscriptions.delete(transcriptionId);
      
      this.emit('transcriptionStopped', { transcriptionId });
      
      return { success: true };
    } catch (error) {
      this.emit('transcriptionError', {
        transcriptionId,
        error: error.message
      });
      
      throw error;
    }
  }

  async processFile(filePath, options = {}) {
    const transcriptionId = this.generateTranscriptionId();
    
    try {
      // Get default settings if not provided
      const {
        provider = this.defaultProvider,
        model = 'whisper-base',  // Default to 'whisper-base' if not specified
        language = 'auto',
        enableSpeakerDiarization = true,
        enableTimestamps = true,
        maxSpeakers = 10,
        outputFormat = 'json'  // Changed from 'txt' to 'json' for better compatibility
      } = options;

      console.log('Processing file with options:', {
        provider,
        model,
        language,
        outputFormat
      });

      const selectedProvider = this.providers.get(provider);
      if (!selectedProvider) {
        throw new Error(`Provider ${provider} not found`);
      }

      if (!selectedProvider.isAvailable()) {
        throw new Error(`Provider ${provider} is not available`);
      }

      // Ensure model is a string and not empty
      if (!model || typeof model !== 'string' || model.trim() === '') {
        throw new Error('Invalid model: model name must be a non-empty string');
      }

      // Ensure model has 'whisper-' prefix
      const modelName = model.startsWith('whisper-') ? model : `whisper-${model}`;

      const transcriptionOptions = {
        transcriptionId,
        model: modelName,
        language,
        enableSpeakerDiarization,
        enableTimestamps,
        maxSpeakers,
        outputFormat
      };

      // Set up event forwarding
      this.setupProviderEventForwarding(selectedProvider, transcriptionId);

      // Process the file with the selected provider
      const result = await selectedProvider.processFile(filePath, transcriptionOptions);

      // Clean up event handlers
      this.cleanupProviderEventHandlers(selectedProvider, transcriptionId);

      return result;
    } catch (error) {
      console.error('Error processing file:', error);
      this.emit('transcriptionError', {
        transcriptionId,
        error: error.message
      });
      throw error;
    }
  }

  setupProviderEventForwarding(provider, transcriptionId) {
    // Forward provider events with transcription ID
    const events = ['progress', 'result', 'error', 'complete'];
    
    events.forEach(eventName => {
      const handler = (data) => {
        this.emit(`transcription:${eventName}`, {
          transcriptionId,
          ...data
        });
      };
      
      provider.on(eventName, handler);
      
      // Store handler for cleanup
      if (!provider._eventHandlers) {
        provider._eventHandlers = new Map();
      }
      provider._eventHandlers.set(`${transcriptionId}:${eventName}`, handler);
    });
  }

  cleanupProviderEventHandlers(provider, transcriptionId) {
    if (!provider._eventHandlers) return;
    
    const events = ['progress', 'result', 'error', 'complete'];
    events.forEach(eventName => {
      const handlerKey = `${transcriptionId}:${eventName}`;
      const handler = provider._eventHandlers.get(handlerKey);
      if (handler) {
        provider.removeListener(eventName, handler);
        provider._eventHandlers.delete(handlerKey);
      }
    });
  }

  async getTranscriptionStatus(transcriptionId) {
    const transcription = this.activeTranscriptions.get(transcriptionId);
    if (!transcription) {
      return null;
    }

    return {
      transcriptionId,
      status: transcription.status,
      provider: transcription.provider.getName(),
      options: transcription.options,
      startTime: transcription.startTime,
      endTime: transcription.endTime,
      duration: transcription.endTime ? 
        transcription.endTime - transcription.startTime : 
        Date.now() - transcription.startTime,
      result: transcription.result,
      error: transcription.error
    };
  }

  async getAllActiveTranscriptions() {
    const transcriptions = [];
    
    for (const [id, transcription] of this.activeTranscriptions) {
      transcriptions.push(await this.getTranscriptionStatus(id));
    }
    
    return transcriptions;
  }

  async cancelTranscription(transcriptionId) {
    const transcription = this.activeTranscriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription ${transcriptionId} not found`);
    }

    try {
      if (transcription.provider.cancelTranscription) {
        await transcription.provider.cancelTranscription(transcriptionId);
      } else {
        await transcription.provider.stopTranscription(transcriptionId);
      }
      
      transcription.status = 'cancelled';
      transcription.endTime = Date.now();
      
      this.cleanupProviderEventHandlers(transcription.provider, transcriptionId);
      this.activeTranscriptions.delete(transcriptionId);
      
      this.emit('transcriptionCancelled', { transcriptionId });
      
      return { success: true };
    } catch (error) {
      this.emit('transcriptionError', {
        transcriptionId,
        error: error.message
      });
      
      throw error;
    }
  }

  async getProviderCapabilities(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return provider.getCapabilities();
  }

  async getProviderModels(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (provider.getAvailableModels) {
      return provider.getAvailableModels();
    }

    return [];
  }

  async testProvider(providerId, options = {}) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    if (provider.test) {
      return provider.test(options);
    }

    return {
      success: true,
      available: provider.isAvailable(),
      message: 'Provider test not implemented'
    };
  }

  generateTranscriptionId() {
    return `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup() {
    try {
      // Stop all active transcriptions
      const stopPromises = Array.from(this.activeTranscriptions.keys())
        .map(id => this.stopTranscription(id).catch(console.error));
      
      await Promise.all(stopPromises);

      // Cleanup providers
      for (const provider of this.providers.values()) {
        if (provider.cleanup) {
          await provider.cleanup();
        }
      }

      // Clean up temp files
      try {
        const files = await fs.readdir(this.tempDir);
        await Promise.all(
          files.map(file => 
            fs.unlink(path.join(this.tempDir, file)).catch(() => {})
          )
        );
      } catch (error) {
        console.error('Error cleaning up temp files:', error);
      }

    } catch (error) {
      console.error('Error during transcription service cleanup:', error);
    }
  }

  // Utility methods
  async convertAudioFormat(inputPath, outputPath, options = {}) {
    const {
      format = 'wav',
      sampleRate = 16000,
      channels = 1,
      bitRate = '16k'
    } = options;

    const args = [
      '-i', inputPath,
      '-acodec', 'pcm_s16le',
      '-ar', sampleRate.toString(),
      '-ac', channels.toString(),
      '-ab', bitRate,
      '-y',
      outputPath
    ];

    return new Promise((resolve, reject) => {
      const process = spawn('ffmpeg', args);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Audio conversion failed with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  async getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', filePath,
        '-f', 'null',
        '-'
      ];

      const process = spawn('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath]);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(output);
            resolve(info);
          } catch (error) {
            reject(new Error('Failed to parse audio info'));
          }
        } else {
          reject(new Error(`Failed to get audio info, code: ${code}`));
        }
      });

      process.on('error', reject);
    });
  }
}

module.exports = TranscriptionService;

