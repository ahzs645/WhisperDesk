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

    // FIXED: Set default provider based on availability with intelligent fallback
    const nativeProvider = this.providers.get('whisper-native');
    const deepgramProvider = this.providers.get('deepgram');
    
    if (nativeProvider && nativeProvider.isAvailable()) {
      this.defaultProvider = 'whisper-native';
      console.log('✅ Default provider set to: whisper-native');
    } else if (deepgramProvider && deepgramProvider.isAvailable()) {
      this.defaultProvider = 'deepgram';
      console.log('⚠️ Native Whisper not available, falling back to: deepgram');
    } else if (nativeProvider) {
      // FIXED: Even if native provider reports as unavailable, try to use it
      // Runtime errors will be handled gracefully
      this.defaultProvider = 'whisper-native';
      console.log('⚠️ Using whisper-native despite availability issues - will handle runtime errors');
    } else {
      throw new Error('No transcription providers available');
    }
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

    // FIXED: Don't check isAvailable() here - let the provider handle runtime availability
    // This allows for graceful runtime error handling instead of blocking all attempts
    console.log(`✅ Using provider: ${provider} (availability will be checked at runtime)`);

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

      // FIXED: Process with selected provider, with better error handling
      console.log(`Attempting transcription with ${provider}...`);
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

      console.log(`✅ Transcription completed successfully with ${provider}`);
      return {
        transcriptionId,
        ...result
      };

    } catch (error) {
      console.error(`❌ Transcription failed with ${provider}:`, error.message);
      
      // FIXED: Intelligent fallback logic
      if (provider === 'whisper-native' && this.providers.has('deepgram')) {
        console.log('🔄 Attempting fallback to Deepgram provider...');
        try {
          const fallbackResult = await this.processFile(filePath, {
            ...options,
            provider: 'deepgram',
            transcriptionId
          });
          
          console.log('✅ Fallback to Deepgram successful');
          return fallbackResult;
        } catch (fallbackError) {
          console.error('❌ Fallback to Deepgram also failed:', fallbackError.message);
          // Continue with original error handling
        }
      }
      
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

      // FIXED: Provide more helpful error messages to user
      let userFriendlyError = error.message;
      
      if (error.message.includes('not available') && provider === 'whisper-native') {
        userFriendlyError = 'Local transcription is not available. This may be due to missing dependencies or binary issues. Please try updating the app or contact support.';
      } else if (error.message.includes('model')) {
        userFriendlyError = 'Transcription model error. Please check if the selected model is downloaded and try again.';
      } else if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        userFriendlyError = 'Transcription binary not found. Please reinstall the application.';
      }
      
      throw new Error(userFriendlyError);
      
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