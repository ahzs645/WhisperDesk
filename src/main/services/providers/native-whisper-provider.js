// src/main/services/providers/native-whisper-provider.js - FIXED VERSION
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class NativeWhisperProvider extends EventEmitter {
  constructor(modelManager, binaryManager) {
    super();
    this.modelManager = modelManager;
    this.binaryManager = binaryManager;
    this.isInitialized = false;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-native');
    this.currentTranscriptionId = null;
    this.supportedLanguages = [
      'auto', 'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl',
      'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el',
      'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt',
      'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl',
      'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq',
      'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka',
      'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk',
      'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln',
      'ha', 'ba', 'jw', 'su'
    ];
  }

  getName() {
    return 'Native Whisper';
  }

  getDescription() {
    return 'OpenAI Whisper using native whisper.cpp implementation';
  }

  isAvailable() {
    return this.isInitialized;
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      await this.binaryManager.ensureWhisperBinary();
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      
      try {
        await fs.access(binaryPath);
        await this.binaryManager.testBinary();
      } catch (error) {
        console.log('Native Whisper binary not available, provider will be disabled');
        this.isInitialized = false;
        return false;
      }
      
      await fs.mkdir(this.tempDir, { recursive: true });
      this.isInitialized = true;
      console.log('Native Whisper provider initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Native Whisper provider:', error);
      this.isInitialized = false;
      return false;
    }
  }

  getCapabilities() {
    return {
      realtime: false,
      fileTranscription: true,
      speakerDiarization: false,
      languageDetection: true,
      wordTimestamps: true,
      supportedFormats: ['wav', 'mp3', 'flac', 'm4a', 'ogg', 'opus'],
      supportedLanguages: this.supportedLanguages
    };
  }

  async processFile(filePath, options = {}) {
    const {
      transcriptionId,
      model = 'whisper-base',
      language = 'auto',
      task = 'transcribe',
      enableTimestamps = true,
      temperature = 0.0,
      bestOf = 5
    } = options;

    // Store the transcription ID for use in events
    this.currentTranscriptionId = transcriptionId;

    if (!this.isInitialized) {
      throw new Error('Native Whisper provider not initialized');
    }

    try {
      const modelPath = this.modelManager.getModelPath(model);
      if (!modelPath) {
        throw new Error(`Model ${model} not found. Please download it first.`);
      }

      // Build command args - use VTT output which works reliably
      const args = this.buildWhisperArgs({
        modelPath,
        filePath,
        language,
        task,
        enableTimestamps,
        temperature,
        bestOf
      });

      console.log('Running whisper.cpp with args:', args);

      // Execute whisper.cpp
      const result = await this.executeWhisper(args, transcriptionId);

      // Parse the VTT format output
      return this.parseVTTOutput(result.stdout, filePath);

    } catch (error) {
      console.error('Native Whisper processing failed:', error);
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  buildWhisperArgs(options) {
    const {
      modelPath,
      filePath,
      language,
      task,
      enableTimestamps,
      temperature,
      bestOf
    } = options;

    const args = [
      '-m', modelPath,
      '-f', filePath,
      '--print-progress'
    ];

    // Language settings
    if (language !== 'auto') {
      args.push('-l', language);
    }

    // Task
    if (task === 'translate') {
      args.push('--translate');
    }

    // Advanced options
    if (temperature > 0) {
      args.push('--temperature', temperature.toString());
    }

    if (bestOf > 1) {
      args.push('--best-of', bestOf.toString());
    }

    // Output format - don't use --output-json, use default VTT format
    if (enableTimestamps) {
      // Default output includes timestamps in VTT format
    } else {
      args.push('--no-timestamps');
    }

    return args;
  }

  async executeWhisper(args, transcriptionId) {
    const binaryPath = this.binaryManager.getWhisperBinaryPath();

    return new Promise((resolve, reject) => {
      const process = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.parseProgress(output, transcriptionId);
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.parseProgress(output, transcriptionId);
      });

      process.on('close', (code) => {
        console.log(`Whisper process finished with code: ${code}`);
        console.log('Stdout length:', stdout.length);
        
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          console.error('Whisper stderr:', stderr);
          reject(new Error(`whisper.cpp failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute whisper.cpp: ${error.message}`));
      });

      // 10 minute timeout
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Transcription timeout'));
      }, 600000);
    });
  }

  parseProgress(output, transcriptionId) {
    // Parse progress from whisper.cpp output
    const progressPatterns = [
      /\[(\d+)\]/,
      /(\d+)%/,
      /progress = (\d+\.\d+)%/
    ];

    for (const pattern of progressPatterns) {
      const match = output.match(pattern);
      if (match) {
        const progress = parseFloat(match[1]);
        this.emit('progress', {
          transcriptionId,
          progress,
          stage: 'transcribing',
          message: `Processing: ${progress}%`
        });
        break;
      }
    }

    if (output.includes('loading model')) {
      this.emit('progress', {
        transcriptionId,
        progress: 10,
        stage: 'loading_model',
        message: 'Loading model...'
      });
    } else if (output.includes('processing')) {
      this.emit('progress', {
        transcriptionId,
        progress: 25,
        stage: 'processing_audio',
        message: 'Processing audio...'
      });
    }
  }

  parseVTTOutput(stdout, inputFilePath) {
    try {
      console.log('Parsing VTT output...');
      console.log('Raw stdout preview:', stdout.substring(0, 500));
      
      const lines = stdout.split('\n').filter(line => line.trim());
      const segments = [];
      let fullText = '';
      
      // Parse VTT format: [00:00:00.000 --> 00:00:07.000]   text content
      for (const line of lines) {
        const vttMatch = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)/);
        
        if (vttMatch) {
          const [, startTime, endTime, text] = vttMatch;
          
          const start = this.parseTimeToSeconds(startTime);
          const end = this.parseTimeToSeconds(endTime);
          const segmentText = text.trim();
          
          if (segmentText) {
            segments.push({
              id: segments.length,
              start,
              end,
              text: segmentText,
              confidence: 0.9, // Default confidence for whisper.cpp
              words: []
            });
            
            fullText += (fullText ? ' ' : '') + segmentText;
          }
        }
      }
      
      // If no segments found, try to extract plain text
      if (segments.length === 0) {
        console.log('No VTT segments found, extracting plain text...');
        const textLines = lines.filter(line => 
          !line.includes('[') && 
          !line.includes('whisper') && 
          !line.includes('model') &&
          line.trim().length > 0
        );
        
        fullText = textLines.join(' ').trim();
        
        if (fullText) {
          segments.push({
            id: 0,
            start: 0,
            end: 0,
            text: fullText,
            confidence: 0.8,
            words: []
          });
        }
      }
      
      const result = {
        text: fullText || 'Transcription completed',
        language: 'unknown', // whisper.cpp doesn't always output language in VTT
        segments,
        metadata: {
          provider: 'native-whisper',
          model: 'whisper',
          duration: segments.length > 0 ? Math.max(...segments.map(s => s.end)) : 0,
          segments_count: segments.length,
          created_at: new Date().toISOString()
        }
      };
      
      console.log(`Parsed ${segments.length} segments, total text length: ${fullText.length}`);

      // Emit completion event
      if (this.currentTranscriptionId) {
        this.emit('complete', { 
          transcriptionId: this.currentTranscriptionId, 
          result 
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Error parsing VTT output:', error);
      console.log('Problematic output:', stdout);
      
      // Emit error event
      if (this.currentTranscriptionId) {
        this.emit('error', { 
          transcriptionId: this.currentTranscriptionId, 
          error: error.message 
        });
      }

      // Return basic result with error info
      return {
        text: `Transcription completed but failed to parse output: ${error.message}`,
        segments: [],
        language: 'unknown',
        metadata: {
          provider: 'native-whisper',
          error: error.message,
          created_at: new Date().toISOString()
        }
      };
    }
  }

  parseTimeToSeconds(timeStr) {
    // Parse HH:MM:SS.mmm format
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
    } catch (error) {
      console.warn('Failed to cleanup temp files:', error.message);
    }
  }
}

module.exports = NativeWhisperProvider;