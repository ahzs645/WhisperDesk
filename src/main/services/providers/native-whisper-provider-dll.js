// src/main/services/providers/native-whisper-provider-dll.js
// Updated to support both DLL-based (Windows) and static (macOS/Linux) builds

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

class NativeWhisperProviderDLL extends EventEmitter {
  constructor(modelManager, binaryManager) {
    super();
    this.modelManager = modelManager;
    this.binaryManager = binaryManager;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-native');
    this.available = false;
    this.platform = os.platform();
    this.buildType = this.platform === 'win32' ? 'dll-based' : 'static';
    
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

  async initialize() {
    console.log('🔧 Initializing NativeWhisperProvider (DLL-compatible)...');
    console.log(`🔧 Platform: ${this.platform}`);
    console.log(`🔧 Build type: ${this.buildType}`);

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Temp directory: ${this.tempDir}`);

      // Set availability based on binary test
      this.available = await this.checkAvailability();

      if (this.available) {
        console.log('✅ NativeWhisperProvider initialized successfully');
        console.log(`🔧 Using ${this.buildType} build method`);
      } else {
        console.warn('⚠️ NativeWhisperProvider not available');
      }

    } catch (error) {
      console.error('❌ Failed to initialize NativeWhisperProvider:', error.message);
      this.available = false;
    }
  }

  /**
   * Check if provider is available
   */
  async checkAvailability() {
    try {
      const binaryExists = await this.binaryManager.ensureWhisperBinary();
      if (!binaryExists) {
        console.warn('❌ Whisper binary/binaries not available');
        return false;
      }

      const installedModels = await this.modelManager.getInstalledModels();
      if (installedModels.length === 0) {
        console.warn('⚠️ No models installed for native provider');
        return false;
      }

      // Test the binary
      const testResult = await this.binaryManager.testBinaryWithResult();
      if (!testResult.success) {
        console.warn(`❌ Binary test failed: ${testResult.error}`);
        return false;
      }

      console.log('✅ Native whisper provider is available');
      console.log(`📊 Binary format: ${testResult.argumentFormat}`);
      console.log(`📊 Build type: ${testResult.buildType || this.buildType}`);
      return true;

    } catch (error) {
      console.error('❌ Native provider availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Build whisper arguments (compatible with both main.exe and whisper-cli)
   */
  buildWhisperArgs(options) {
    const {
      modelPath,
      filePath,
      language,
      task,
      enableTimestamps,
      temperature,
      bestOf,
      enableSpeakerDiarization,
      disableDiarization,
      forceTranscription = false
    } = options;

    // Base arguments that work with both main.exe and whisper-cli
    const args = [
      '-m', modelPath,
      '-f', filePath
    ];

    // Add progress reporting if supported
    args.push('--print-progress');

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

    // Speaker diarization (disable for music transcription)
    if (enableSpeakerDiarization && !disableDiarization && !forceTranscription) {
      args.push('-di');
    }

    // Output format - default with timestamps
    if (!enableTimestamps) {
      args.push('--no-timestamps');
    }

    console.log(`🔧 Built ${this.buildType} whisper args:`, args.join(' '));
    return args;
  }

  /**
   * Execute whisper with proper DLL support on Windows
   */
  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting whisper transcription: ${transcriptionId}`);
      console.log(`📍 Binary: ${binaryPath}`);
      console.log(`📍 Build type: ${this.buildType}`);
      console.log(`📋 Args: ${args.join(' ')}`);

      // For Windows DLL builds, we need to run from the binaries directory
      // so that all DLLs can be found
      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      };

      // On Windows with DLLs, set the working directory to binaries folder
      if (this.platform === 'win32') {
        spawnOptions.cwd = path.dirname(binaryPath);
        console.log(`🔧 Windows: Running from directory: ${spawnOptions.cwd}`);
      }

      const whisperProcess = spawn(binaryPath, args, spawnOptions);

      let stdout = '';
      let stderr = '';
      let progress = 0;

      // Capture stdout (primary output)
      whisperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Parse progress from stdout
        const progressMatch = output.match(/\[(\d+)%\]/);
        if (progressMatch) {
          progress = parseInt(progressMatch[1]);
          this.emit('progress', { transcriptionId, progress });
        }
      });

      // Handle stderr (progress and status info)
      whisperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 Whisper stderr: ${output.trim()}`);
        
        // Parse progress from stderr
        const progressMatch = output.match(/progress\s*=\s*(\d+)%/i);
        if (progressMatch) {
          const newProgress = parseInt(progressMatch[1]);
          if (newProgress !== progress) {
            progress = newProgress;
            this.emit('progress', { 
              transcriptionId, 
              progress: newProgress
            });
            console.log(`📊 Progress updated: ${newProgress}%`);
          }
        }
      });

      // Handle process completion
      whisperProcess.on('close', async (code) => {
        console.log(`🏁 Whisper process completed with code: ${code}`);
        console.log(`📊 Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);

        if (code === 0) {
          try {
            // Parse output
            const result = await this.parseWhisperOutput(transcriptionId, stdout, stderr);
            this.emit('progress', { transcriptionId, progress: 100 });
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse output:', parseError.message);
            reject(new Error(`Failed to parse transcription output: ${parseError.message}`));
          }
        } else {
          const errorMessage = this.buildErrorMessage(code, stderr);
          console.error(`❌ ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      whisperProcess.on('error', (error) => {
        console.error('❌ Failed to start whisper process:', error.message);
        
        // Provide specific error message for DLL issues on Windows
        if (this.platform === 'win32' && error.code === 'ENOENT') {
          reject(new Error(`Failed to start whisper process. Make sure all DLL files are present in ${path.dirname(binaryPath)}`));
        } else {
          reject(new Error(`Failed to start whisper process: ${error.message}`));
        }
      });

      // Timeout
      const timeout = setTimeout(() => {
        console.warn('⏰ Whisper process timeout, killing...');
        whisperProcess.kill('SIGTERM');
        reject(new Error('Transcription timeout'));
      }, 10 * 60 * 1000);

      whisperProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse whisper output (works with both main.exe and whisper-cli output)
   */
  async parseWhisperOutput(transcriptionId, stdout, stderr) {
    let transcriptionText = '';
    let transcriptionData = null;
    let outputSource = 'unknown';

    // Strategy 1: Parse VTT format from stdout (primary)
    if (stdout) {
      console.log('📄 Parsing VTT from stdout...');
      const vttResult = this.parseVTTFromStdout(stdout);
      if (vttResult.text) {
        transcriptionText = vttResult.text;
        transcriptionData = vttResult.data;
        outputSource = 'stdout_vtt';
        console.log(`✅ VTT parsing successful: ${transcriptionText.length} chars`);
      }
    }

    // Strategy 2: Extract plain text from stdout (fallback)
    if (!transcriptionText && stdout) {
      console.log('📄 Attempting to extract plain text from stdout...');
      transcriptionText = this.extractPlainTextFromStdout(stdout);
      if (transcriptionText) {
        outputSource = 'stdout_text';
        console.log(`✅ Plain text extraction: ${transcriptionText.length} chars`);
      }
    }

    if (!transcriptionText) {
      console.error('❌ No transcription output found');
      console.log('📝 Stdout preview:', stdout.substring(0, 500));
      console.log('📝 Stderr preview:', stderr.substring(0, 500));
      throw new Error('No transcription output found - Check whisper binary output');
    }

    transcriptionText = transcriptionText.trim();

    // Music detection
    const containsMusic = this.detectMusicContent(transcriptionText);
    
    const result = {
      text: transcriptionText,
      data: transcriptionData,
      provider: 'whisper-native',
      model: 'local',
      timestamp: new Date().toISOString(),
      metadata: {
        containsMusic,
        suggestion: containsMusic ? 'Content contains music sections' : null,
        outputSource,
        buildType: this.buildType,
        platform: this.platform
      }
    };

    console.log(`✅ Transcription processed (${result.text.length} chars) via ${outputSource}`);
    console.log(`📊 Build type: ${this.buildType}`);
    return result;
  }

  /**
   * Parse VTT format from stdout
   */
  parseVTTFromStdout(stdout) {
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
            confidence: 0.9,
            words: []
          });
          
          fullText += (fullText ? ' ' : '') + segmentText;
        }
      }
    }
    
    return {
      text: fullText,
      data: segments.length > 0 ? { segments } : null
    };
  }

  /**
   * Parse time string to seconds
   */
  parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0]);
    const milliseconds = parseInt(secondsParts[1] || 0);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  /**
   * Extract plain text from stdout as fallback
   */
  extractPlainTextFromStdout(stdout) {
    const lines = stdout.split('\n').filter(line => 
      line.trim().length > 0 &&
      !line.includes('[') && 
      !line.includes('whisper') && 
      !line.includes('model') &&
      !line.includes('progress') &&
      !line.includes('system_info')
    );
    
    return lines.join(' ').trim();
  }

  /**
   * Build comprehensive error message
   */
  buildErrorMessage(code, stderr) {
    if (this.platform === 'win32') {
      // Windows-specific error handling
      if (code === 3221225501 || code === -1073741515) {
        return 'DLL loading error - ensure all required DLL files (whisper.dll, ggml.dll, etc.) are present';
      } else if (stderr.includes('SDL2.dll')) {
        return 'SDL2.dll not found or incompatible version';
      }
    }
    
    if (stderr.includes('model') && stderr.includes('not found')) {
      return 'Model file not found or corrupted';
    } else if (stderr.includes('audio') && stderr.includes('format')) {
      return 'Unsupported audio format';
    } else if (stderr.includes('unknown argument')) {
      return 'Binary argument error - binary may be incompatible version';
    } else if (stderr.trim()) {
      return `Whisper error: ${stderr.trim()}`;
    } else {
      return `Whisper process failed with exit code ${code}`;
    }
  }

  /**
   * Enhanced music detection
   */
  detectMusicContent(text) {
    if (!text) return false;
    
    const musicIndicators = [
      '[Music]', '[music]', '[MUSIC]', 
      '(Music)', '(music)', '(MUSIC)',
      'Music playing', 'music playing', 'MUSIC PLAYING',
      '♪', '♫', '🎵', '🎶'
    ];
    
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return false;
    
    const musicLines = lines.filter(line => 
      musicIndicators.some(indicator => line.toLowerCase().includes(indicator.toLowerCase()))
    );
    
    const musicPercentage = (musicLines.length / lines.length) * 100;
    return musicPercentage > 50;
  }

  /**
   * Process file for transcription
   */
  async processFile(filePath, options = {}) {
    if (!this.available) {
      throw new Error('Native whisper provider is not available');
    }

    const transcriptionId = options.transcriptionId || `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get binary path
      const binaryPath = this.binaryManager.getWhisperBinaryPath();

      // Get model path
      const modelPath = await this.modelManager.getCompatibleModelPath(
        options.model || 'tiny'
      );

      if (!modelPath) {
        throw new Error(`Model not found: ${options.model || 'tiny'}`);
      }

      console.log(`🔍 Using model: ${modelPath}`);
      console.log(`🔧 Binary type: ${this.buildType}`);

      // Build arguments
      const args = this.buildWhisperArgs({
        modelPath,
        filePath,
        language: options.language || 'auto',
        task: options.task,
        enableTimestamps: options.enableTimestamps !== false,
        temperature: options.temperature || 0,
        bestOf: options.bestOf || 1,
        enableSpeakerDiarization: options.enableSpeakerDiarization,
        disableDiarization: options.disableDiarization
      });

      // Execute whisper
      this.emit('progress', { transcriptionId, progress: 0 });
      const result = await this.executeWhisper(binaryPath, args, transcriptionId);

      // Emit completion
      this.emit('complete', { transcriptionId, result });
      console.log(`✅ Transcription completed successfully with ${this.buildType} whisper`);
      return result;

    } catch (error) {
      console.error(`❌ Transcription failed: ${error.message}`);
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  // Standard provider methods
  getName() {
    return 'whisper-native';
  }

  getDescription() {
    return `Local whisper.cpp (${this.buildType}) with cross-platform support`;
  }

  getInfo() {
    return {
      name: `Native Whisper (${this.buildType})`,
      description: `Local whisper.cpp with ${this.buildType} build`,
      available: this.available,
      buildType: this.buildType,
      platform: this.platform,
      binaryPath: this.binaryManager.getWhisperBinaryPath(),
      capabilities: {
        languages: 'auto-detect + 50+ languages',
        maxFileSize: '2GB',
        formats: ['mp3', 'wav', 'mp4', 'avi', 'mov', 'm4a', 'flac'],
        realtime: false,
        offline: true,
        musicTranscription: true
      }
    };
  }

  getCapabilities() {
    return {
      realtime: false,
      fileTranscription: true,
      speakerDiarization: true,
      languageDetection: true,
      wordTimestamps: true,
      supportedFormats: ['wav', 'mp3', 'flac', 'm4a', 'ogg', 'opus'],
      supportedLanguages: this.supportedLanguages,
      maxFileSize: '2GB',
      offline: true,
      musicTranscription: true,
      buildType: this.buildType
    };
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = NativeWhisperProviderDLL;