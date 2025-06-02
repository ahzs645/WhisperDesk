const TranscriptionService = require('./transcription-service');
const { EventEmitter } = require('events');

class EnhancedTranscriptionService extends EventEmitter {
  constructor(modelManager) {
    super();
    this.transcriptionService = new TranscriptionService(modelManager);
    this.setupEventForwarding();
  }

  async initialize() {
    return this.transcriptionService.initialize();
  }

  setupEventForwarding() {
    // Forward all events from the base service
    this.transcriptionService.on('transcription:progress', (data) => {
      console.log('Transcription progress:', data);
      this.emit('progress', data);
    });

    this.transcriptionService.on('transcription:complete', (data) => {
      console.log('Transcription complete:', data);
      this.emit('complete', data);
    });

    this.transcriptionService.on('transcription:error', (data) => {
      console.error('Transcription error:', data);
      this.emit('error', data);
    });
  }

  async processFile(filePath, options = {}) {
    const transcriptionId = `tx_${Date.now()}`;
    
    try {
      // Emit start event
      this.emit('progress', { 
        transcriptionId, 
        stage: 'starting', 
        progress: 0,
        message: 'Initializing transcription...' 
      });

      // Add progress tracking wrapper
      const enhancedOptions = {
        ...options,
        transcriptionId,
        onProgress: (progress) => {
          this.emit('progress', { transcriptionId, ...progress });
        }
      };

      const result = await this.transcriptionService.processFile(filePath, enhancedOptions);
      
      // Emit completion
      this.emit('complete', { transcriptionId, result });
      
      return result;
    } catch (error) {
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  getProviders() {
    return this.transcriptionService.getProviders();
  }
}

module.exports = EnhancedTranscriptionService;
