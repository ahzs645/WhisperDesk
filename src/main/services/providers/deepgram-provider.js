const { EventEmitter } = require('events');
const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs').promises;
const FormData = require('form-data');

class DeepgramProvider extends EventEmitter {
  constructor() {
    super();
    this.name = 'Deepgram Nova';
    this.description = 'Deepgram Nova API for high-accuracy cloud transcription';
    this.isInitialized = false;
    this.apiKey = null;
    this.baseUrl = 'https://api.deepgram.com/v1';
    this.activeConnections = new Map();
  }

  async initialize() {
    try {
      // API key will be set from settings
      this.isInitialized = true;
      console.log('Deepgram provider initialized');
    } catch (error) {
      console.error('Error initializing Deepgram provider:', error);
      this.isInitialized = false;
    }
  }

  getName() {
    return this.name;
  }

  getDescription() {
    return this.description;
  }

  isAvailable() {
    return this.isInitialized && this.apiKey !== null;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  getCapabilities() {
    return {
      realTimeTranscription: true,
      fileTranscription: true,
      speakerDiarization: true,
      languageDetection: true,
      timestamps: true,
      wordLevelTimestamps: true,
      confidence: true,
      punctuation: true,
      profanityFilter: true,
      redaction: true,
      summarization: true,
      topicDetection: true,
      intentRecognition: true,
      sentimentAnalysis: true,
      supportedFormats: [
        'wav', 'mp3', 'mp4', 'flac', 'm4a', 'ogg', 'opus', 'webm', 'aac'
      ],
      supportedLanguages: [
        'en', 'en-US', 'en-AU', 'en-GB', 'en-NZ', 'en-IN',
        'es', 'es-ES', 'es-419',
        'fr', 'fr-FR', 'fr-CA',
        'de', 'de-DE',
        'it', 'it-IT',
        'pt', 'pt-BR', 'pt-PT',
        'ru', 'ru-RU',
        'hi', 'hi-IN',
        'ja', 'ja-JP',
        'ko', 'ko-KR',
        'zh', 'zh-CN', 'zh-TW',
        'nl', 'nl-NL',
        'sv', 'sv-SE',
        'pl', 'pl-PL',
        'tr', 'tr-TR',
        'uk', 'uk-UA',
        'ar', 'ar-SA'
      ]
    };
  }

  getAvailableModels() {
    return [
      {
        id: 'nova-2',
        name: 'Nova 2',
        description: 'Latest and most accurate model',
        tier: 'premium',
        features: ['high-accuracy', 'fast', 'multilingual']
      },
      {
        id: 'nova',
        name: 'Nova',
        description: 'High-accuracy general model',
        tier: 'premium',
        features: ['high-accuracy', 'multilingual']
      },
      {
        id: 'enhanced',
        name: 'Enhanced',
        description: 'Improved accuracy over base model',
        tier: 'standard',
        features: ['good-accuracy', 'fast']
      },
      {
        id: 'base',
        name: 'Base',
        description: 'Standard accuracy model',
        tier: 'standard',
        features: ['standard-accuracy', 'fast']
      }
    ];
  }

  async startTranscription(options) {
    const {
      transcriptionId,
      model = 'nova-2',
      language = 'en',
      enableSpeakerDiarization = true,
      enableTimestamps = true,
      maxSpeakers = 10,
      audioSource = 'microphone'
    } = options;

    if (!this.apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    try {
      // Create WebSocket connection for real-time transcription
      const wsUrl = this.buildWebSocketUrl({
        model,
        language,
        enableSpeakerDiarization,
        enableTimestamps,
        maxSpeakers
      });

      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      // Store connection
      this.activeConnections.set(transcriptionId, {
        ws,
        options,
        startTime: Date.now(),
        status: 'connecting'
      });

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(ws, transcriptionId);

      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          const connection = this.activeConnections.get(transcriptionId);
          if (connection) {
            connection.status = 'active';
          }
          
          this.emit('started', { transcriptionId });
          resolve({
            success: true,
            message: 'Real-time transcription started'
          });
        });

        ws.on('error', (error) => {
          this.emit('error', { transcriptionId, error: error.message });
          reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      });

    } catch (error) {
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  buildWebSocketUrl(options) {
    const {
      model = 'nova-2',
      language = 'en',
      enableSpeakerDiarization = true,
      enableTimestamps = true,
      maxSpeakers = 10
    } = options;

    const params = new URLSearchParams({
      model,
      language,
      punctuate: 'true',
      smart_format: 'true',
      interim_results: 'true'
    });

    if (enableSpeakerDiarization) {
      params.append('diarize', 'true');
      params.append('diarize_version', '2023-10-12');
      if (maxSpeakers > 1) {
        params.append('max_speakers', maxSpeakers.toString());
      }
    }

    if (enableTimestamps) {
      params.append('timestamps', 'true');
    }

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  setupWebSocketHandlers(ws, transcriptionId) {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message, transcriptionId);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      const connection = this.activeConnections.get(transcriptionId);
      if (connection) {
        connection.status = 'closed';
      }
      
      this.emit('stopped', { transcriptionId, code, reason: reason.toString() });
      this.activeConnections.delete(transcriptionId);
    });

    ws.on('error', (error) => {
      this.emit('error', { transcriptionId, error: error.message });
    });
  }

  handleWebSocketMessage(message, transcriptionId) {
    if (message.type === 'Results') {
      const result = this.formatRealtimeResult(message);
      
      if (message.is_final) {
        this.emit('result', { transcriptionId, result, isFinal: true });
      } else {
        this.emit('result', { transcriptionId, result, isFinal: false });
      }
    } else if (message.type === 'Metadata') {
      this.emit('metadata', { transcriptionId, metadata: message });
    } else if (message.type === 'SpeechStarted') {
      this.emit('speechStarted', { transcriptionId });
    } else if (message.type === 'UtteranceEnd') {
      this.emit('utteranceEnd', { transcriptionId });
    }
  }

  formatRealtimeResult(message) {
    const channel = message.channel;
    const alternatives = channel.alternatives || [];
    
    if (alternatives.length === 0) {
      return null;
    }

    const alternative = alternatives[0];
    
    return {
      text: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      words: alternative.words || [],
      speaker: channel.speaker || null,
      start: channel.start || 0,
      end: channel.end || 0,
      isFinal: message.is_final || false
    };
  }

  async stopTranscription(transcriptionId) {
    const connection = this.activeConnections.get(transcriptionId);
    if (!connection) {
      throw new Error(`Transcription session ${transcriptionId} not found`);
    }

    try {
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        // Send close frame
        connection.ws.send(JSON.stringify({ type: 'CloseStream' }));
        connection.ws.close();
      }

      connection.status = 'stopped';
      this.activeConnections.delete(transcriptionId);
      
      this.emit('stopped', { transcriptionId });

      return { success: true };
    } catch (error) {
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  async processFile(options) {
    const {
      transcriptionId,
      filePath,
      model = 'nova-2',
      language = 'en',
      enableSpeakerDiarization = true,
      enableTimestamps = true,
      maxSpeakers = 10
    } = options;

    if (!this.apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    try {
      this.emit('progress', { 
        transcriptionId, 
        progress: 0, 
        message: 'Uploading file...' 
      });

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      
      // Prepare request
      const url = `${this.baseUrl}/listen`;
      const params = this.buildRequestParams({
        model,
        language,
        enableSpeakerDiarization,
        enableTimestamps,
        maxSpeakers
      });

      this.emit('progress', { 
        transcriptionId, 
        progress: 25, 
        message: 'Processing...' 
      });

      // Make API request
      const response = await axios.post(url, fileBuffer, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'audio/wav' // Adjust based on file type
        },
        params,
        timeout: 300000 // 5 minutes timeout
      });

      this.emit('progress', { 
        transcriptionId, 
        progress: 90, 
        message: 'Formatting results...' 
      });

      const result = this.formatFileResult(response.data);

      this.emit('progress', { 
        transcriptionId, 
        progress: 100, 
        message: 'Complete' 
      });

      this.emit('complete', { transcriptionId, result });

      return result;

    } catch (error) {
      let errorMessage = error.message;
      
      if (error.response) {
        errorMessage = `API Error ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
      }

      this.emit('error', { transcriptionId, error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  buildRequestParams(options) {
    const {
      model = 'nova-2',
      language = 'en',
      enableSpeakerDiarization = true,
      enableTimestamps = true,
      maxSpeakers = 10
    } = options;

    const params = {
      model,
      language,
      punctuate: true,
      smart_format: true,
      paragraphs: true,
      utterances: true
    };

    if (enableSpeakerDiarization) {
      params.diarize = true;
      params.diarize_version = '2023-10-12';
      if (maxSpeakers > 1) {
        params.max_speakers = maxSpeakers;
      }
    }

    if (enableTimestamps) {
      params.timestamps = true;
    }

    return params;
  }

  formatFileResult(apiResponse) {
    const results = apiResponse.results;
    const channels = results.channels || [];
    
    if (channels.length === 0) {
      return {
        text: '',
        segments: [],
        metadata: {
          provider: 'deepgram',
          model: apiResponse.metadata?.model_info?.name || 'unknown',
          createdAt: new Date().toISOString()
        }
      };
    }

    const channel = channels[0];
    const alternatives = channel.alternatives || [];
    
    if (alternatives.length === 0) {
      return {
        text: '',
        segments: [],
        metadata: {
          provider: 'deepgram',
          model: apiResponse.metadata?.model_info?.name || 'unknown',
          createdAt: new Date().toISOString()
        }
      };
    }

    const alternative = alternatives[0];
    
    // Format segments
    const segments = [];
    
    if (alternative.paragraphs && alternative.paragraphs.paragraphs) {
      // Use paragraph-based segmentation
      alternative.paragraphs.paragraphs.forEach((paragraph, index) => {
        segments.push({
          id: index,
          start: paragraph.start || 0,
          end: paragraph.end || 0,
          text: paragraph.text || '',
          speaker: paragraph.speaker || null,
          confidence: paragraph.confidence || 0,
          words: paragraph.words || []
        });
      });
    } else if (alternative.words) {
      // Fallback to word-based segmentation
      let currentSegment = null;
      const segmentDuration = 30; // 30 seconds per segment
      
      alternative.words.forEach((word) => {
        if (!currentSegment || word.start - currentSegment.start > segmentDuration) {
          if (currentSegment) {
            segments.push(currentSegment);
          }
          
          currentSegment = {
            id: segments.length,
            start: word.start,
            end: word.end,
            text: word.word,
            speaker: word.speaker || null,
            confidence: word.confidence || 0,
            words: [word]
          };
        } else {
          currentSegment.text += ' ' + word.word;
          currentSegment.end = word.end;
          currentSegment.words.push(word);
        }
      });
      
      if (currentSegment) {
        segments.push(currentSegment);
      }
    }

    return {
      text: alternative.transcript || '',
      language: results.language || 'unknown',
      segments,
      metadata: {
        provider: 'deepgram',
        model: apiResponse.metadata?.model_info?.name || 'unknown',
        duration: apiResponse.metadata?.duration || 0,
        channels: apiResponse.metadata?.channels || 1,
        createdAt: new Date().toISOString(),
        confidence: alternative.confidence || 0,
        summary: alternative.summaries?.[0]?.summary || null
      }
    };
  }

  async test(options = {}) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    try {
      // Test API connectivity
      const response = await axios.get(`${this.baseUrl}/projects`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        },
        timeout: 10000
      });

      return {
        success: true,
        message: 'Deepgram API connection successful',
        projects: response.data?.projects?.length || 0
      };
    } catch (error) {
      let errorMessage = 'API connection failed';
      
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Invalid API key';
        } else if (error.response.status === 403) {
          errorMessage = 'API key does not have required permissions';
        } else {
          errorMessage = `API Error ${error.response.status}: ${error.response.statusText}`;
        }
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Network connection failed';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getUsage() {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/projects`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get usage: ${error.message}`);
    }
  }

  sendAudioData(transcriptionId, audioData) {
    const connection = this.activeConnections.get(transcriptionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`No active connection for transcription ${transcriptionId}`);
    }

    connection.ws.send(audioData);
  }

  async cleanup() {
    // Close all active WebSocket connections
    for (const [transcriptionId, connection] of this.activeConnections) {
      try {
        if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
      } catch (error) {
        console.error(`Error closing connection ${transcriptionId}:`, error);
      }
    }

    this.activeConnections.clear();
  }
}

module.exports = DeepgramProvider;

