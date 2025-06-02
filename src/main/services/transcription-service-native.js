const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const transcriptionStore = require('./transcription-store');

// Import managers and providers
const BinaryManager = require('./binary-manager');
const NativeWhisperProvider = require('./providers/native-whisper-provider');
const DeepgramProvider = require('./providers/deepgram-provider');

class NativeTranscriptionService extends EventEmitter {
  constructor(modelManager) {
    super();
    this.providers = new Map();
    this.activeTranscriptions = new Map();
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-transcription');
    this.defaultProvider = 'whisper-native';
    this.modelManager = modelManager;
    this.binaryManager = new BinaryManager();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Native transcription service already initialized');
      return;
    }

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Initialize binary manager
      await this.binaryManager.initialize();
      
      // Initialize providers
      await this.initializeProviders();
      
      this.isInitialized = true;
      console.log('Native transcription service initialized');
      console.log(`Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    } catch (error) {
      console.error('Error initializing native transcription service:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async initializeProviders() {
    // Initialize Native Whisper provider
    if (!this.providers.has('whisper-native')) {
      try {
        const nativeWhisperProvider = new NativeWhisperProvider(this.modelManager, this.binaryManager);
        await nativeWhisperProvider.initialize();
        
        // Forward events
        nativeWhisperProvider.on('progress', (data) => this.emit('progress', data));
        nativeWhisperProvider.on('error', (data) => this.emit('error', data));
        nativeWhisperProvider.on('complete', (data) => this.emit('complete', data));
        
        this.providers.set('whisper-native', nativeWhisperProvider);
        console.log('✅ Native Whisper provider initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Native Whisper provider:', error.message);
      }
    }

    // Initialize Deepgram provider (keep as fallback)
    if (!this.providers.has('deepgram')) {
      try {
        const deepgramProvider = new DeepgramProvider();
        await deepgramProvider.initialize();
        
        // Forward events
        deepgramProvider.on('progress', (data) => this.emit('progress', data));
        deepgramProvider.on('error', (data) => this.emit('error', data));
        deepgramProvider.on('complete', (data) => this.emit('complete', data));
        
        this.providers.set('deepgram', deepgramProvider);
        console.log('✅ Deepgram provider initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Deepgram provider:', error.message);
      }
    }

    // Set default provider based on availability
    if (this.providers.has('whisper-native')) {
      this.defaultProvider = 'whisper-native';
    } else if (this.providers.has('deepgram')) {
      this.defaultProvider = 'deepgram';
    } else {
      throw new Error('No transcription providers available');
    }

    console.log(`Default provider set to: ${this.defaultProvider}`);
  }

  getProviders() {
    return Array.from(this.providers.values()).map(provider => ({
      name: provider.getName(),
      description: provider.getDescription(),
      isAvailable: provider.isAvailable(),
      capabilities: provider.getCapabilities()
    }));
  }

  getProvider(name) {
    return this.providers.get(name);
  }

  async processFile(filePath, options = {}) {
    const transcriptionId = options.transcriptionId || this.generateTranscriptionId();
    const provider = options.provider || this.defaultProvider;
    
    console.log(`Processing file with provider: ${provider}`);
    
    if (!this.isInitialized) {
      throw new Error('Transcription service not initialized');
    }

    const selectedProvider = this.providers.get(provider);
    if (!selectedProvider) {
      throw new Error(`Provider '${provider}' not available`);
    }

    if (!selectedProvider.isAvailable()) {
      throw new Error(`Provider '${provider}' is not available`);
    }

    try {
      // Validate file exists
      await fs.access(filePath);
      
      // Add to active transcriptions
      this.activeTranscriptions.set(transcriptionId, {
        filePath,
        provider,
        startTime: Date.now(),
        status: 'processing'
      });

      // Emit start event
      this.emit('start', {
        transcriptionId,
        filePath,
        provider,
        options
      });

      // Process with selected provider
      const result = await selectedProvider.processFile(filePath, {
        ...options,
        transcriptionId
      });

      // Store result (skip for now since saveTranscription doesn't exist)
      // await transcriptionStore.saveTranscription(transcriptionId, {
      //   ...result,
      //   filePath,
      //   provider,
      //   options,
      //   createdAt: new Date().toISOString()
      // });

      // Update active transcriptions
      this.activeTranscriptions.set(transcriptionId, {
        ...this.activeTranscriptions.get(transcriptionId),
        status: 'completed',
        endTime: Date.now()
      });

      // Emit completion event
      this.emit('complete', {
        transcriptionId,
        result,
        provider
      });

      return {
        transcriptionId,
        ...result
      };

    } catch (error) {
      // Update active transcriptions
      this.activeTranscriptions.set(transcriptionId, {
        ...this.activeTranscriptions.get(transcriptionId),
        status: 'failed',
        error: error.message,
        endTime: Date.now()
      });

      // Emit error event
      this.emit('error', {
        transcriptionId,
        error: error.message,
        provider
      });

      throw error;
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.activeTranscriptions.delete(transcriptionId);
      }, 60000); // Remove after 1 minute
    }
  }

  async processRealtime(audioStream, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const selectedProvider = this.providers.get(provider);
    
    if (!selectedProvider) {
      throw new Error(`Provider '${provider}' not available`);
    }

    const capabilities = selectedProvider.getCapabilities();
    if (!capabilities.realtime) {
      throw new Error(`Provider '${provider}' does not support realtime transcription`);
    }

    return selectedProvider.processRealtime(audioStream, options);
  }

  getActiveTranscriptions() {
    return Array.from(this.activeTranscriptions.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  async cancelTranscription(transcriptionId) {
    const transcription = this.activeTranscriptions.get(transcriptionId);
    if (!transcription) {
      throw new Error(`Transcription ${transcriptionId} not found`);
    }

    const provider = this.providers.get(transcription.provider);
    if (provider && typeof provider.cancel === 'function') {
      await provider.cancel(transcriptionId);
    }

    this.activeTranscriptions.delete(transcriptionId);
    
    this.emit('cancelled', {
      transcriptionId,
      provider: transcription.provider
    });
  }

  generateTranscriptionId() {
    return `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getTranscriptionHistory(limit = 50) {
    return transcriptionStore.getTranscriptions(limit);
  }

  async getTranscription(transcriptionId) {
    return transcriptionStore.getTranscription(transcriptionId);
  }

  async deleteTranscription(transcriptionId) {
    return transcriptionStore.deleteTranscription(transcriptionId);
  }

  async clearHistory() {
    return transcriptionStore.clearTranscriptions();
  }

  async getStats() {
    const history = await this.getTranscriptionHistory(1000);
    const providers = {};
    let totalDuration = 0;
    let totalFiles = history.length;

    for (const transcription of history) {
      const provider = transcription.provider || 'unknown';
      if (!providers[provider]) {
        providers[provider] = { count: 0, duration: 0 };
      }
      providers[provider].count++;
      
      if (transcription.metadata && transcription.metadata.duration) {
        providers[provider].duration += transcription.metadata.duration;
        totalDuration += transcription.metadata.duration;
      }
    }

    return {
      totalFiles,
      totalDuration,
      providers,
      activeTranscriptions: this.activeTranscriptions.size,
      availableProviders: Array.from(this.providers.keys())
    };
  }

  async cleanup() {
    // Clean up all providers
    for (const provider of this.providers.values()) {
      if (typeof provider.cleanup === 'function') {
        try {
          await provider.cleanup();
        } catch (error) {
          console.warn(`Failed to cleanup provider ${provider.getName()}:`, error.message);
        }
      }
    }

    // Clean up temp directory
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }

    this.activeTranscriptions.clear();
    this.isInitialized = false;
  }

  // Compatibility methods for existing code
  async transcribeFile(filePath, options = {}) {
    return this.processFile(filePath, options);
  }

  async transcribeRealtime(audioStream, options = {}) {
    return this.processRealtime(audioStream, options);
  }
}

module.exports = NativeTranscriptionService;

