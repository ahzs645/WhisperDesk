// src/main/services/providers/native-whisper-provider-dll.js
// Updated to support whisper-cli.exe (non-deprecated) for both DLL-based (Windows) and static (macOS/Linux) builds

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
    this.executableName = this.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    
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
    console.log('🔧 Initializing NativeWhisperProvider (whisper-cli compatible)...');
    console.log(`🔧 Platform: ${this.platform}`);
    console.log(`🔧 Build type: ${this.buildType}`);
    console.log(`🔧 Executable: ${this.executableName}`);

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Temp directory: ${this.tempDir}`);

      // Set availability based on binary test
      this.available = await this.checkAvailability();

      if (this.available) {
        console.log('✅ NativeWhisperProvider initialized successfully');
        console.log(`🔧 Using ${this.buildType} build with ${this.executableName}`);
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
        console.warn(`❌ Whisper binary (${this.executableName}) not available`);
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
      console.log(`📊 Binary type: ${testResult.binaryType}`);
      console.log(`📊 Build type: ${testResult.buildType || this.buildType}`);
      return true;

    } catch (error) {
      console.error('❌ Native provider availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Build whisper-cli arguments (compatible with modern whisper-cli.exe)
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

    // Modern whisper-cli.exe arguments
    const args = [
      '--model', modelPath,     // ← UPDATED: Using --model instead of -m
      '--file', filePath,       // ← UPDATED: Using --file instead of -f
    ];

    // Add progress reporting (modern whisper-cli supports this)
    args.push('--print-progress', 'true');

    // Language settings
    if (language && language !== 'auto') {
      args.push('--language', language);  // ← UPDATED: Using --language instead of -l
    }

    // Task
    if (task === 'translate') {
      args.push('--translate');
    }

    // Output format - VTT with timestamps
    if (enableTimestamps !== false) {
      args.push('--output-vtt');           // ← UPDATED: Using --output-vtt for modern format
    }

    // Advanced options
    if (temperature > 0) {
      args.push('--temperature', temperature.toString());
    }

    if (bestOf > 1) {
      args.push('--best-of', bestOf.toString());
    }

    // Speaker diarization (if supported)
    if (enableSpeakerDiarization && !disableDiarization && !forceTranscription) {
      // Check if diarization is supported by this version
      args.push('--diarize');  // ← UPDATED: Modern diarization flag
    }

    // Audio processing options for better quality
    args.push('--threads', Math.min(4, os.cpus().length).toString());

    console.log(`🔧 Built ${this.buildType} whisper-cli args:`, args.join(' '));
    return args;
  }

  /**
   * Execute whisper-cli with proper DLL support on Windows
   */
  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting whisper-cli transcription: ${transcriptionId}`);
      console.log(`📍 Binary: ${binaryPath}`);
      console.log(`📍 Executable: ${this.executableName}`);
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
        
        // Parse progress from stdout (whisper-cli format)
        const progressMatch = output.match(/\[(\d+)%\]/) || 
                             output.match(/progress\s*[:=]\s*(\d+)%/i) ||
                             output.match(/(\d+)% complete/i);
        
        if (progressMatch) {
          const newProgress = parseInt(progressMatch[1]);
          if (newProgress !== progress) {
            progress = newProgress;
            this.emit('progress', { transcriptionId, progress });
            console.log(`📊 Progress: ${newProgress}%`);
          }
        }
      });

      // Handle stderr (progress and status info)
      whisperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 whisper-cli stderr: ${output.trim()}`);
        
        // Parse progress from stderr as well
        const progressMatch = output.match(/progress\s*[:=]\s*(\d+)%/i) ||
                             output.match(/(\d+)% complete/i) ||
                             output.match(/\[(\d+)%\]/);
        
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
        console.log(`🏁 whisper-cli process completed with code: ${code}`);
        console.log(`📊 Stdout length: ${stdout.length}, Stderr length: ${stderr.length}`);

        if (code === 0) {
          try {
            // Parse output from whisper-cli
            const result = await this.parseWhisperCliOutput(transcriptionId, stdout, stderr);
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
        console.error('❌ Failed to start whisper-cli process:', error.message);
        
        // Provide specific error message for DLL issues on Windows
        if (this.platform === 'win32' && error.code === 'ENOENT') {
          reject(new Error(`Failed to start whisper-cli.exe. Make sure all DLL files are present in ${path.dirname(binaryPath)}`));
        } else {
          reject(new Error(`Failed to start whisper-cli process: ${error.message}`));
        }
      });

      // Timeout
      const timeout = setTimeout(() => {
        console.warn('⏰ whisper-cli process timeout, killing...');
        whisperProcess.kill('SIGTERM');
        reject(new Error('Transcription timeout'));
      }, 10 * 60 * 1000);

      whisperProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parse whisper-cli output (modern format)
   */
  async parseWhisperCliOutput(transcriptionId, stdout, stderr) {
    let transcriptionText = '';
    let transcriptionData = null;
    let outputSource = 'unknown';

    // Strategy 1: Parse modern VTT format from stdout (whisper-cli --output-vtt)
    if (stdout) {
      console.log('📄 Parsing VTT from whisper-cli stdout...');
      const vttResult = this.parseVTTFromStdout(stdout);
      if (vttResult.text) {
        transcriptionText = vttResult.text;
        transcriptionData = vttResult.data;
        outputSource = 'stdout_vtt';
        console.log(`✅ VTT parsing successful: ${transcriptionText.length} chars`);
      }
    }

    // Strategy 2: Parse plain text output from whisper-cli
    if (!transcriptionText && stdout) {
      console.log('📄 Attempting to extract plain text from whisper-cli stdout...');
      transcriptionText = this.extractPlainTextFromStdout(stdout);
      if (transcriptionText) {
        outputSource = 'stdout_text';
        console.log(`✅ Plain text extraction: ${transcriptionText.length} chars`);
      }
    }

    // Strategy 3: Look for generated VTT files (whisper-cli creates these)
    if (!transcriptionText) {
      console.log('📄 Looking for generated VTT files...');
      const vttFile = await this.findGeneratedVTTFile();
      if (vttFile) {
        const vttContent = await fs.readFile(vttFile, 'utf8');
        const vttResult = this.parseVTTContent(vttContent);
        if (vttResult.text) {
          transcriptionText = vttResult.text;
          transcriptionData = vttResult.data;
          outputSource = 'vtt_file';
          console.log(`✅ VTT file parsing successful: ${transcriptionText.length} chars`);
          
          // Clean up the VTT file
          try {
            await fs.unlink(vttFile);
          } catch (cleanupError) {
            console.warn('⚠️ Failed to clean up VTT file:', cleanupError.message);
          }
        }
      }
    }

    if (!transcriptionText) {
      console.error('❌ No transcription output found from whisper-cli');
      console.log('📝 Stdout preview:', stdout.substring(0, 500));
      console.log('📝 Stderr preview:', stderr.substring(0, 500));
      throw new Error('No transcription output found - Check whisper-cli binary output');
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
        platform: this.platform,
        executableName: this.executableName
      }
    };

    console.log(`✅ Transcription processed (${result.text.length} chars) via ${outputSource}`);
    console.log(`📊 Build type: ${this.buildType}`);
    console.log(`📊 Executable: ${this.executableName}`);
    return result;
  }

  /**
   * Find generated VTT file from whisper-cli
   */
  async findGeneratedVTTFile() {
    try {
      const files = await fs.readdir(this.tempDir);
      const vttFiles = files.filter(file => file.endsWith('.vtt'));
      
      if (vttFiles.length > 0) {
        // Return the most recent VTT file
        const vttPath = path.join(this.tempDir, vttFiles[vttFiles.length - 1]);
        return vttPath;
      }
    } catch (error) {
      console.warn('⚠️ Error looking for VTT files:', error.message);
    }
    
    return null;
  }

  /**
   * Parse VTT content (WEBVTT format)
   */
  parseVTTContent(vttContent) {
    const lines = vttContent.split('\n').filter(line => line.trim());
    const segments = [];
    let fullText = '';
    
    // Skip WEBVTT header
    let startIndex = 0;
    if (lines[0] && lines[0].includes('WEBVTT')) {
      startIndex = 1;
    }
    
    // Parse VTT format: timestamp line followed by text
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for timestamp lines (00:00:00.000 --> 00:00:07.000)
      const timestampMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
      
      if (timestampMatch) {
        const [, startTime, endTime] = timestampMatch;
        
        // Next line should be the text
        if (i + 1 < lines.length) {
          const text = lines[i + 1].trim();
          
          if (text) {
            const start = this.parseTimeToSeconds(startTime);
            const end = this.parseTimeToSeconds(endTime);
            
            segments.push({
              id: segments.length,
              start,
              end,
              text,
              confidence: 0.9,
              words: []
            });
            
            fullText += (fullText ? ' ' : '') + text;
          }
          
          i++; // Skip the text line in next iteration
        }
      }
    }
    
    return {
      text: fullText,
      data: segments.length > 0 ? { segments } : null
    };
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
   * Parse time string to seconds (HH:MM:SS.mmm)
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
      !line.includes('system_info') &&
      !line.includes('WEBVTT')
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
    } else if (stderr.includes('unknown argument') || stderr.includes('unrecognized')) {
      return 'Binary argument error - whisper-cli may be incompatible version';
    } else if (stderr.trim()) {
      return `whisper-cli error: ${stderr.trim()}`;
    } else {
      return `whisper-cli process failed with exit code ${code}`;
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
      console.log(`🔧 Executable: ${this.executableName}`);

      // Build arguments for whisper-cli
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

      // Execute whisper-cli
      this.emit('progress', { transcriptionId, progress: 0 });
      const result = await this.executeWhisper(binaryPath, args, transcriptionId);

      // Emit completion
      this.emit('complete', { transcriptionId, result });
      console.log(`✅ Transcription completed successfully with ${this.buildType} whisper-cli`);
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
    return `Local whisper.cpp (${this.buildType}) with ${this.executableName}`;
  }

  getInfo() {
    return {
      name: `Native Whisper (${this.buildType})`,
      description: `Local whisper.cpp with ${this.buildType} build using ${this.executableName}`,
      available: this.available,
      buildType: this.buildType,
      platform: this.platform,
      executableName: this.executableName,
      binaryPath: this.binaryManager.getWhisperBinaryPath(),
      capabilities: {
        languages: 'auto-detect + 50+ languages',
        maxFileSize: '2GB',
        formats: ['mp3', 'wav', 'mp4', 'avi', 'mov', 'm4a', 'flac'],
        realtime: false,
        offline: true,
        musicTranscription: true,
        modernFormat: true
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
      buildType: this.buildType,
      executableName: this.executableName,
      modernCLI: true
    };
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = NativeWhisperProviderDLL;