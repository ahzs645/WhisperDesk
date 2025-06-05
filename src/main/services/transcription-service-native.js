// src/main/services/transcription-service-native.js - GRACEFUL BINARY HANDLING
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
    this.binaryStatus = null;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('Native transcription service already initialized');
      return;
    }

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Initialize binary manager (NO AUTO-FIXING)
      const binaryAvailable = await this.binaryManager.initialize();
      this.binaryStatus = await this.binaryManager.getStatus();
      
      // Initialize providers with graceful handling
      await this.initializeProviders(binaryAvailable);
      
      this.isInitialized = true;
      console.log('Native transcription service initialized');
      console.log(`Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
      
      // Log binary status for debugging
      if (!binaryAvailable) {
        console.warn('⚠️ Native Whisper provider is disabled due to missing binary');
        console.warn('💡 Run "npm run build:whisper" to enable native transcription');
      }
      
    } catch (error) {
      console.error('Error initializing native transcription service:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async initializeProviders(binaryAvailable) {
    // Initialize Native Whisper provider with graceful handling
    try {
      const nativeWhisperProvider = new NativeWhisperProvider(this.modelManager, this.binaryManager);
      
      // Only initialize if binary is available
      if (binaryAvailable) {
        await nativeWhisperProvider.initialize();
        
        // Forward events with better logging
        nativeWhisperProvider.on('progress', (data) => {
          console.log('📊 Provider progress event:', data.progress);
          this.emit('progress', data);
        });
        
        nativeWhisperProvider.on('error', (data) => {
          console.log('❌ Provider error event:', data.error);
          this.emit('error', data);
        });
        
        nativeWhisperProvider.on('complete', (data) => {
          console.log('✅ Provider complete event');
          this.emit('complete', data);
        });
        
        console.log('✅ Native Whisper provider initialized');
      } else {
        console.warn('⚠️ Skipping Native Whisper provider initialization - binary not available');
      }
      
      // Create provider object with availability info
      this.providers.set('whisper-native', {
        getName: () => 'whisper-native',
        getDescription: () => binaryAvailable 
          ? 'Local whisper.cpp transcription' 
          : 'Local whisper.cpp transcription (binary not available)',
        isAvailable: () => binaryAvailable,
        getCapabilities: () => binaryAvailable 
          ? nativeWhisperProvider.getCapabilities() 
          : { error: 'Binary not available. Run: npm run build:whisper' },
        processFile: binaryAvailable 
          ? (...args) => nativeWhisperProvider.processFile(...args)
          : () => {
              throw new Error('Native Whisper is not available. The whisper.cpp binary was not found.\n\nTo fix this:\n1. Run "npm run build:whisper"\n2. Restart the application\n\nTechnical details: ' + JSON.stringify(this.binaryStatus.recommendation || 'Binary not found'));
            },
        // Include the actual provider if available
        _actualProvider: binaryAvailable ? nativeWhisperProvider : null,
        _binaryStatus: this.binaryStatus
      });
      
    } catch (error) {
      console.warn('⚠️ Failed to initialize Native Whisper provider:', error.message);
      
      // Create a disabled provider for UI display
      this.providers.set('whisper-native', {
        getName: () => 'whisper-native',
        getDescription: () => 'Local whisper.cpp transcription (initialization failed)',
        isAvailable: () => false,
        getCapabilities: () => ({ error: error.message }),
        processFile: () => {
          throw new Error('Native Whisper failed to initialize: ' + error.message);
        },
        _actualProvider: null,
        _binaryStatus: this.binaryStatus
      });
    }

    // Initialize Deepgram provider (graceful fallback)
    try {
      const deepgramProvider = new DeepgramProvider();
      await deepgramProvider.initialize();
      
      // Forward events
      deepgramProvider.on('progress', (data) => this.emit('progress', data));
      deepgramProvider.on('error', (data) => this.emit('error', data));
      deepgramProvider.on('complete', (data) => this.emit('complete', data));
      
      this.providers.set('deepgram', {
        getName: () => 'deepgram',
        getDescription: () => 'Deepgram Nova API (cloud transcription)',
        isAvailable: () => deepgramProvider.isAvailable(),
        getCapabilities: () => deepgramProvider.getCapabilities(),
        processFile: (...args) => deepgramProvider.processFile(...args),
        _actualProvider: deepgramProvider
      });
      
      console.log('✅ Deepgram provider initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize Deepgram provider:', error.message);
      
      // Create a disabled provider for UI display
      this.providers.set('deepgram', {
        getName: () => 'deepgram',
        getDescription: () => 'Deepgram Nova API (unavailable - check dependencies)',
        isAvailable: () => false,
        getCapabilities: () => ({ error: error.message }),
        processFile: () => {
          throw new Error('Deepgram provider failed to initialize: ' + error.message);
        },
        _actualProvider: null
      });
    }

    // Set default provider based on availability with intelligent fallback
    const nativeProvider = this.providers.get('whisper-native');
    const deepgramProvider = this.providers.get('deepgram');
    
    if (nativeProvider && nativeProvider.isAvailable()) {
      this.defaultProvider = 'whisper-native';
      console.log('✅ Default provider set to: whisper-native');
    } else if (deepgramProvider && deepgramProvider.isAvailable()) {
      this.defaultProvider = 'deepgram';
      console.log('⚠️ Native Whisper not available, falling back to: deepgram');
    } else {
      // No providers available - still set default for UI purposes
      this.defaultProvider = 'whisper-native';
      console.warn('⚠️ No transcription providers are available');
    }
  }

  // Return properly formatted provider info for UI with helpful error messages
  getProviders() {
    return Array.from(this.providers.values()).map(provider => {
      const isAvailable = provider.isAvailable();
      const capabilities = provider.getCapabilities();
      
      let description = provider.getDescription();
      let errorInfo = null;
      
      // Add helpful error information for disabled providers
      if (!isAvailable) {
        if (provider.getName() === 'whisper-native' && provider._binaryStatus) {
          errorInfo = {
            reason: 'Binary not available',
            recommendation: provider._binaryStatus.recommendation,
            technicalDetails: {
              binaryPath: provider._binaryStatus.whisperBinaryPath,
              binaryExists: provider._binaryStatus.binaryExists,
              platform: provider._binaryStatus.platform
            }
          };
          
          if (!provider._binaryStatus.binaryExists) {
            description = 'Local whisper.cpp (binary not found - run "npm run build:whisper")';
          } else if (!provider._binaryStatus.binaryExecutable) {
            description = 'Local whisper.cpp (binary not executable)';
          } else {
            description = 'Local whisper.cpp (binary has issues)';
          }
        }
      }
      
      return {
        id: provider.getName(),
        name: this.getProviderDisplayName(provider.getName()),
        description,
        isAvailable,
        capabilities,
        errorInfo
      };
    });
  }

  // Convert internal provider names to user-friendly display names
  getProviderDisplayName(providerName) {
    const displayNames = {
      'whisper-native': 'Native Whisper',
      'deepgram': 'Deepgram Nova',
      'whisper': 'Whisper'
    };
    
    return displayNames[providerName] || providerName;
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

    // Check if provider is available and give helpful error message
    if (!selectedProvider.isAvailable()) {
      const errorInfo = selectedProvider._binaryStatus;
      
      let errorMessage = `The ${this.getProviderDisplayName(provider)} provider is not available.`;
      
      if (provider === 'whisper-native' && errorInfo) {
        errorMessage += `\n\nReason: ${errorInfo.recommendation || 'Binary not found'}`;
        errorMessage += `\n\nTo fix this:`;
        errorMessage += `\n1. Run "npm run build:whisper" in your terminal`;
        errorMessage += `\n2. Restart WhisperDesk`;
        errorMessage += `\n\nBinary should be located at: ${errorInfo.whisperBinaryPath}`;
      }
      
      throw new Error(errorMessage);
    }

    try {
      // Validate file exists
      await fs.access(filePath);
      
      // Add transcription to active list with better tracking
      this.activeTranscriptions.set(transcriptionId, {
        filePath,
        provider,
        startTime: Date.now(),
        status: 'processing',
        lastProgress: 0
      });

      // Emit start event
      this.emit('start', {
        transcriptionId,
        filePath,
        provider,
        options
      });

      console.log(`Attempting transcription with ${provider}...`);
      const result = await selectedProvider.processFile(filePath, {
        ...options,
        transcriptionId
      });

      // Update active transcriptions
      this.activeTranscriptions.set(transcriptionId, {
        ...this.activeTranscriptions.get(transcriptionId),
        status: 'completed',
        endTime: Date.now()
      });

      // Make sure to emit the complete event here too
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
      
      // Intelligent fallback logic
      if (provider === 'whisper-native' && this.providers.has('deepgram')) {
        const deepgramProvider = this.providers.get('deepgram');
        if (deepgramProvider.isAvailable()) {
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

      // Provide helpful error messages to user
      let userFriendlyError = error.message;
      
      if (error.message.includes('Binary not available') || error.message.includes('whisper.cpp binary was not found')) {
        // Already has helpful message from provider
        userFriendlyError = error.message;
      } else if (error.message.includes('model')) {
        userFriendlyError = 'Transcription model error. Please check if the selected model is downloaded and try again.';
      } else if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        userFriendlyError = 'Transcription binary not found. Please run "npm run build:whisper" and restart the application.';
      }
      
      throw new Error(userFriendlyError);
      
    } finally {
      // Clean up after some time
      setTimeout(() => {
        this.activeTranscriptions.delete(transcriptionId);
      }, 60000); // Remove after 1 minute
    }
  }

  /**
   * Get helpful information about binary status for UI
   */
  getBinaryStatus() {
    return this.binaryStatus;
  }

  /**
   * Get helpful guidance for users when binary is not available
   */
  getSetupGuidance() {
    if (!this.binaryStatus) {
      return {
        isSetupNeeded: true,
        guidance: 'Initializing...'
      };
    }

    if (this.binaryStatus.binaryExists && this.binaryStatus.binaryExecutable && 
        this.binaryStatus.dependencyCheck?.success && this.binaryStatus.testResult?.success) {
      return {
        isSetupNeeded: false,
        guidance: 'Everything is ready!'
      };
    }

    return {
      isSetupNeeded: true,
      guidance: this.binaryStatus.recommendation || 'Unknown issue - check binary setup',
      technicalDetails: this.binaryStatus
    };
  }

  // Rest of the methods remain the same...
  async processRealtime(audioStream, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const selectedProvider = this.providers.get(provider);
    
    if (!selectedProvider) {
      throw new Error(`Provider '${provider}' not available`);
    }

    if (!selectedProvider.isAvailable()) {
      throw new Error(`Provider '${provider}' is not available`);
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
    if (provider && provider._actualProvider && typeof provider._actualProvider.cancel === 'function') {
      await provider._actualProvider.cancel(transcriptionId);
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
      availableProviders: Array.from(this.providers.keys()),
      binaryStatus: this.binaryStatus
    };
  }

  async cleanup() {
    // Clean up all providers
    for (const provider of this.providers.values()) {
      if (provider._actualProvider && typeof provider._actualProvider.cleanup === 'function') {
        try {
          await provider._actualProvider.cleanup();
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