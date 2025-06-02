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
      // Ensure binary is available
      await this.binaryManager.ensureWhisperBinary();
      
      // Test binary - if this fails, the provider won't be available
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      try {
        await fs.access(binaryPath);
        await this.binaryManager.testBinary();
      } catch (error) {
        console.log('Native Whisper binary not available, provider will be disabled');
        this.isInitialized = false;
        return false;
      }
      
      // Create temp directory
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
      speakerDiarization: false, // whisper.cpp doesn't have built-in diarization
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
      outputFormat = 'json',
      enableTimestamps = true,
      enableWordTimestamps = true,
      temperature = 0.0,
      maxTokens = 0,
      bestOf = 5
    } = options;

    if (!this.isInitialized) {
      throw new Error('Native Whisper provider not initialized');
    }

    try {
      // Get model path
      const modelPath = this.modelManager.getModelPath(model);
      if (!modelPath) {
        throw new Error(`Model ${model} not found. Please download it first.`);
      }

      // Prepare output file
      const outputFileName = `transcription_${Date.now()}`;
      const outputDir = this.tempDir;

      // Build whisper.cpp command arguments
      const args = this.buildWhisperArgs({
        modelPath,
        filePath,
        outputDir,
        outputFileName,
        language,
        task,
        outputFormat,
        enableTimestamps,
        enableWordTimestamps,
        temperature,
        maxTokens,
        bestOf
      });

      console.log('Running whisper.cpp with args:', args);

      // Execute whisper.cpp
      const result = await this.executeWhisper(args, transcriptionId);

      // Parse and return result
      return this.parseWhisperOutput(outputDir, outputFileName, outputFormat, filePath);

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
      outputDir,
      outputFileName,
      language,
      task,
      outputFormat,
      enableTimestamps,
      enableWordTimestamps,
      temperature,
      maxTokens,
      bestOf
    } = options;

    const args = [
      '-m', modelPath,              // Model path
      '-f', filePath               // Input file
    ];

    // Language settings
    if (language !== 'auto') {
      args.push('-l', language);
    }

    // Task (transcribe or translate)
    if (task === 'translate') {
      args.push('--translate');
    }

    // Output format - whisper-cli uses different flags
    if (outputFormat === 'json') {
      args.push('--output-json');
    } else if (outputFormat === 'srt') {
      args.push('--output-srt');
    } else if (outputFormat === 'vtt') {
      args.push('--output-vtt');
    } else if (outputFormat === 'txt') {
      args.push('--output-txt');
    }

    // Advanced options
    if (temperature > 0) {
      args.push('--temperature', temperature.toString());
    }

    if (bestOf > 1) {
      args.push('--best-of', bestOf.toString());
    }

    // Additional quality options
    args.push('--print-progress');

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

      // Handle stdout
      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        this.parseProgress(output, transcriptionId);
      });

      // Handle stderr
      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.parseProgress(output, transcriptionId);
      });

      // Handle process completion
      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`whisper.cpp failed with code ${code}: ${stderr}`));
        }
      });

      // Handle process errors
      process.on('error', (error) => {
        reject(new Error(`Failed to execute whisper.cpp: ${error.message}`));
      });

      // Set timeout (5 minutes for large files)
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Transcription timeout'));
      }, 300000);
    });
  }

  parseProgress(output, transcriptionId) {
    // Parse progress from whisper.cpp output
    const progressPatterns = [
      /\[(\d+)\]/,                    // [50] style progress
      /(\d+)%/,                       // 50% style progress
      /progress = (\d+\.\d+)%/        // progress = 50.5% style
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

    // Parse stage information
    if (output.includes('loading model')) {
      this.emit('progress', {
        transcriptionId,
        progress: 10,
        stage: 'loading_model',
        message: 'Loading model...'
      });
    } else if (output.includes('processing audio')) {
      this.emit('progress', {
        transcriptionId,
        progress: 25,
        stage: 'processing_audio',
        message: 'Processing audio...'
      });
    }
  }

  async parseWhisperOutput(outputDir, outputFileName, format, inputFilePath) {
    // whisper-cli creates output files with the input filename + format extension
    const outputFile = `${inputFilePath}.${format}`;
    
    try {
      const content = await fs.readFile(outputFile, 'utf8');
      
      if (format === 'json') {
        const result = JSON.parse(content);
        return this.formatJsonResult(result);
      } else if (format === 'txt') {
        return {
          text: content.trim(),
          segments: [],
          language: 'unknown'
        };
      } else if (format === 'srt') {
        return this.parseSrtResult(content);
      } else if (format === 'vtt') {
        return this.parseVttResult(content);
      }
      
      throw new Error(`Unsupported output format: ${format}`);
    } catch (error) {
      throw new Error(`Failed to parse whisper output: ${error.message}`);
    } finally {
      // Clean up output file
      try {
        const outputFile = `${inputFilePath}.${format}`;
        await fs.unlink(outputFile);
      } catch (error) {
        console.warn('Failed to clean up output file:', error.message);
      }
    }
  }

  formatJsonResult(whisperResult) {
    // Extract segments from whisper.cpp JSON format
    const segments = whisperResult.transcription || [];
    
    // Convert segments to our format
    const formattedSegments = segments.map((segment, index) => ({
      id: index,
      start: segment.offsets ? segment.offsets.from / 1000 : 0, // Convert ms to seconds
      end: segment.offsets ? segment.offsets.to / 1000 : 0,
      text: segment.text ? segment.text.trim() : '',
      confidence: 1.0, // whisper.cpp doesn't provide confidence scores
      words: []
    }));
    
    // Combine all text
    const fullText = formattedSegments.map(s => s.text).join('').trim();
    
    return {
      text: fullText,
      language: whisperResult.result?.language || whisperResult.params?.language || 'unknown',
      segments: formattedSegments,
      metadata: {
        provider: 'native-whisper',
        model: whisperResult.model?.type || 'unknown',
        duration: formattedSegments.length > 0 ? formattedSegments[formattedSegments.length - 1].end : 0,
        created_at: new Date().toISOString()
      }
    };
  }

  parseSrtResult(content) {
    const segments = [];
    const blocks = content.trim().split('\n\n');
    
    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
        if (timeMatch) {
          const start = this.parseTimeToSeconds(timeMatch[1]);
          const end = this.parseTimeToSeconds(timeMatch[2]);
          const text = lines.slice(2).join(' ');
          
          segments.push({
            id: segments.length,
            start,
            end,
            text,
            confidence: 0
          });
        }
      }
    }

    return {
      text: segments.map(s => s.text).join(' '),
      segments,
      language: 'unknown',
      metadata: {
        provider: 'native-whisper',
        format: 'srt'
      }
    };
  }

  parseVttResult(content) {
    const segments = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/);
      
      if (timeMatch && i + 1 < lines.length) {
        const start = this.parseTimeToSeconds(timeMatch[1].replace('.', ','));
        const end = this.parseTimeToSeconds(timeMatch[2].replace('.', ','));
        const text = lines[i + 1];
        
        if (text && text.trim()) {
          segments.push({
            id: segments.length,
            start,
            end,
            text: text.trim(),
            confidence: 0
          });
        }
      }
    }

    return {
      text: segments.map(s => s.text).join(' '),
      segments,
      language: 'unknown',
      metadata: {
        provider: 'native-whisper',
        format: 'vtt'
      }
    };
  }

  parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split(',');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1]);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  async cleanup() {
    try {
      // Clean up temp directory
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

