// src/main/services/providers/native-whisper-provider.js - IMPROVED VERSION
const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

class NativeWhisperProvider extends EventEmitter {
  constructor(modelManager, binaryManager) {
    super();
    this.modelManager = modelManager;
    this.binaryManager = binaryManager;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-native');
    this.argumentStyle = 'whisper-cli'; // Default to new format
    this.available = false;
  }

  async initialize() {
    console.log('🔧 Initializing NativeWhisperProvider...');

    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log(`📁 Temp directory: ${this.tempDir}`);

      // Check binary availability and detect argument format
      await this.detectBinaryFormat();

      // Set availability based on binary test
      this.available = await this.checkAvailability();

      if (this.available) {
        console.log('✅ NativeWhisperProvider initialized successfully');
        console.log(`🔧 Using argument style: ${this.argumentStyle}`);
      } else {
        console.warn('⚠️ NativeWhisperProvider not available');
      }

    } catch (error) {
      console.error('❌ Failed to initialize NativeWhisperProvider:', error.message);
      this.available = false;
    }
  }

  /**
   * Detect binary format and argument style
   */
  async detectBinaryFormat() {
    try {
      // Try to test binary with result if method exists
      if (typeof this.binaryManager.testBinaryWithResult === 'function') {
        const testResult = await this.binaryManager.testBinaryWithResult();
        
        if (testResult.success) {
          this.argumentStyle = testResult.argumentFormat || 'whisper-cli';
          console.log(`🔍 Detected argument format: ${this.argumentStyle}`);
        } else {
          console.warn('⚠️ Could not detect binary format, using default: whisper-cli');
          this.argumentStyle = 'whisper-cli';
        }
      } else {
        // Fallback: test binary directly
        const testResult = await this.testBinaryDirectly();
        this.argumentStyle = testResult.argumentFormat || 'whisper-cli';
        console.log(`🔍 Binary format detected via direct test: ${this.argumentStyle}`);
      }
    } catch (error) {
      console.warn('⚠️ Binary format detection failed:', error.message);
      this.argumentStyle = 'whisper-cli';
    }
  }

  /**
   * Direct binary test when testBinaryWithResult is not available
   */
  async testBinaryDirectly() {
    try {
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      const { spawn } = require('child_process');
      
      return new Promise((resolve) => {
        const testProcess = spawn(binaryPath, ['--help'], { stdio: 'pipe' });
        let output = '';
        
        testProcess.stdout.on('data', (data) => output += data.toString());
        testProcess.stderr.on('data', (data) => output += data.toString());
        
        testProcess.on('close', () => {
          // Check output for argument format indicators
          if (output.includes('--output-file') || output.includes('-of')) {
            resolve({ success: true, argumentFormat: 'whisper-cli' });
          } else {
            resolve({ success: true, argumentFormat: 'legacy' });
          }
        });
        
        testProcess.on('error', () => {
          resolve({ success: false, argumentFormat: 'whisper-cli' });
        });
        
        setTimeout(() => {
          testProcess.kill();
          resolve({ success: false, argumentFormat: 'whisper-cli' });
        }, 5000);
      });
    } catch (error) {
      return { success: false, argumentFormat: 'whisper-cli' };
    }
  }

  /**
   * Check if provider is available
   */
  async checkAvailability() {
    try {
      // Check if binary exists and is executable
      const binaryExists = await this.binaryManager.ensureWhisperBinary();
      if (!binaryExists) {
        console.warn('❌ Whisper binary not available');
        return false;
      }

      // Check if we have at least one model
      const installedModels = await this.modelManager.getInstalledModels();
      if (installedModels.length === 0) {
        console.warn('⚠️ No models installed for native provider');
        return false;
      }

      console.log('✅ Native whisper provider is available');
      return true;

    } catch (error) {
      console.error('❌ Native provider availability check failed:', error.message);
      return false;
    }
  }

  /**
   * Build command line arguments - IMPROVED with better compatibility
   */
  buildWhisperArgs(audioPath, modelPath, transcriptionId, options = {}) {
    const args = [];

    if (this.argumentStyle === 'whisper-cli') {
      // New whisper-cli argument format
      args.push('--file', audioPath);
      args.push('--model', modelPath);
      
      // Optional parameters
      if (options.language && options.language !== 'auto') {
        args.push('--language', options.language);
      }
      
      // IMPROVED settings for better speech detection (FIXED - removed problematic args)
      args.push('--no-speech-thold', '0.15');    // Lower threshold for speech detection
      args.push('--audio-ctx', '1500');          // Audio context size
      args.push('--word-thold', '0.01');         // Word timestamp threshold
      args.push('--print-progress');             // Show progress
      args.push('--no-fallback');               // Disable temperature fallback
      args.push('--best-of', '5');              // Number of best candidates
      args.push('--threads', '4');              // Number of threads
      args.push('--temperature', '0.2');        // Sampling temperature
      args.push('--entropy-thold', '1.5');      // Entropy threshold
      
      // Use correct argument for suppressing non-speech tokens (FIXED)
      args.push('--suppress-nst');              // Suppress non-speech tokens
      
      // Try file output first, fallback to stdout parsing
      const outputFile = path.join(this.tempDir, transcriptionId);
      args.push('--output-file', outputFile);
      args.push('--output-txt');
      args.push('--output-json');
      args.push('--output-json-full');
      
      // Enable diarization if explicitly requested and not disabled
      if (options.enableSpeakerDiarization && !options.disableDiarization) {
        args.push('--diarize');
      }

    } else {
      // Legacy argument format (fallback) - simpler and more compatible
      args.push('-f', audioPath);
      args.push('-m', modelPath);
      args.push('--print-progress');
      
      if (options.language && options.language !== 'auto') {
        args.push('-l', options.language);
      }
      
      // Basic settings for legacy format
      args.push('-t', '4');     // threads
      args.push('-bo', '5');    // best of
      args.push('-pp');         // print progress
      
      if (options.enableSpeakerDiarization && !options.disableDiarization) {
        args.push('-di');
      }
    }

    console.log(`🔧 Built whisper args (${this.argumentStyle}):`, args.join(' '));
    return args;
  }

  /**
   * Execute whisper binary with improved error handling and output parsing
   */
  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting whisper transcription: ${transcriptionId}`);
      console.log(`📍 Binary: ${binaryPath}`);
      console.log(`📋 Args: ${args.join(' ')}`);

      const whisperProcess = spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      let progress = 0;

      // Handle stdout (may contain transcription output)
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

      // Handle stderr (contains progress and status info)
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
            // Try to parse output files first, fallback to stdout parsing
            const result = await this.parseOutput(transcriptionId, stdout, stderr);
            this.emit('progress', { transcriptionId, progress: 100 });
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse output:', parseError.message);
            reject(new Error(`Failed to parse transcription output: ${parseError.message}`));
          }
        } else {
          // Handle errors with better diagnostics
          const errorMessage = this.buildErrorMessage(code, stderr);
          console.error(`❌ ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      // Handle process errors
      whisperProcess.on('error', (error) => {
        console.error('❌ Failed to start whisper process:', error.message);
        reject(new Error(`Failed to start whisper process: ${error.message}`));
      });

      // Set timeout for long-running processes
      const timeout = setTimeout(() => {
        console.warn('⏰ Whisper process timeout, killing...');
        whisperProcess.kill('SIGTERM');
        reject(new Error('Transcription timeout'));
      }, 10 * 60 * 1000); // 10 minutes

      whisperProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Improved output parsing with multiple fallback strategies
   */
  async parseOutput(transcriptionId, stdout, stderr) {
    let transcriptionText = '';
    let transcriptionData = null;

    // Strategy 1: Try to read JSON/TXT files (if --output-file was used)
    const outputFiles = {
      txt: path.join(this.tempDir, `${transcriptionId}.txt`),
      json: path.join(this.tempDir, `${transcriptionId}.json`)
    };

    // Try JSON file first
    try {
      const jsonContent = await fs.readFile(outputFiles.json, 'utf8');
      transcriptionData = JSON.parse(jsonContent);
      console.log(`✅ Read JSON output from: ${outputFiles.json}`);
      
      if (transcriptionData) {
        if (transcriptionData.text) {
          transcriptionText = transcriptionData.text;
        } else if (transcriptionData.segments) {
          transcriptionText = transcriptionData.segments
            .map(segment => segment.text.trim())
            .join(' ');
        }
      }
    } catch (error) {
      console.log(`📄 JSON file not available: ${error.message}`);
    }

    // Try TXT file if no JSON text
    if (!transcriptionText) {
      try {
        transcriptionText = await fs.readFile(outputFiles.txt, 'utf8');
        console.log(`✅ Read text output from: ${outputFiles.txt}`);
      } catch (error) {
        console.log(`📄 TXT file not available: ${error.message}`);
      }
    }

    // Strategy 2: Parse VTT format from stdout (fallback)
    if (!transcriptionText && stdout) {
      console.log('📄 Attempting to parse VTT from stdout...');
      transcriptionText = this.parseVTTFromStdout(stdout);
    }

    // Strategy 3: Extract any readable text from stdout
    if (!transcriptionText && stdout) {
      console.log('📄 Attempting to extract plain text from stdout...');
      transcriptionText = this.extractPlainTextFromStdout(stdout);
    }

    // Clean up temporary files
    await this.cleanupTempFiles([outputFiles.txt, outputFiles.json]);

    if (!transcriptionText) {
      console.error('❌ No transcription output found in any format');
      throw new Error('No transcription output found - Check whisper binary output');
    }

    transcriptionText = transcriptionText.trim();

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
        outputSource: transcriptionData ? 'json' : 'stdout'
      }
    };

    console.log(`✅ Final transcription processed (${result.text.length} chars) via ${result.metadata.outputSource}`);
    return result;
  }

  /**
   * Parse VTT format from stdout
   */
  parseVTTFromStdout(stdout) {
    const lines = stdout.split('\n').filter(line => line.trim());
    let fullText = '';
    
    for (const line of lines) {
      // Look for VTT format: [00:00:00.000 --> 00:00:07.000]   text content
      const vttMatch = line.match(/\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)/);
      
      if (vttMatch) {
        const [, , , text] = vttMatch;
        const segmentText = text.trim();
        
        if (segmentText) {
          fullText += (fullText ? ' ' : '') + segmentText;
        }
      }
    }
    
    return fullText;
  }

  /**
   * Extract plain text from stdout as last resort
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
    if (code === 3221225501) {
      return 'Access violation error - likely missing Visual C++ runtime or corrupted binary';
    } else if (stderr.includes('model') && stderr.includes('not found')) {
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
   * Clean up temporary files
   */
  async cleanupTempFiles(filePaths) {
    for (const file of filePaths) {
      try {
        await fs.access(file);
        await fs.unlink(file);
        console.log(`🗑️ Cleaned up: ${file}`);
      } catch (e) {
        // File doesn't exist, skip it
      }
    }
  }

  /**
   * Detect if content is mostly music
   */
  detectMusicContent(text) {
    if (!text) return false;
    
    const musicIndicators = [
      '[Music]', '[music]', '[MUSIC]', 
      '(Music)', '(music)', '(MUSIC)',
      '♪', '♫', '🎵', '🎶'
    ];
    
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return false;
    
    const musicLines = lines.filter(line => 
      musicIndicators.some(indicator => line.toLowerCase().includes(indicator.toLowerCase()))
    );
    
    const musicPercentage = (musicLines.length / lines.length) * 100;
    return musicPercentage > 80;
  }

  /**
   * Process file for transcription - IMPROVED
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

      // Build arguments
      const args = this.buildWhisperArgs(filePath, modelPath, transcriptionId, options);

      // Execute whisper
      this.emit('progress', { transcriptionId, progress: 0 });
      const result = await this.executeWhisper(binaryPath, args, transcriptionId);

      // Emit completion
      this.emit('complete', { transcriptionId, result });
      console.log(`✅ Transcription completed successfully with whisper-native`);
      return result;

    } catch (error) {
      console.error(`❌ Transcription failed: ${error.message}`);
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  // ... keep all your existing getter methods (getName, getDescription, etc.)
  getName() {
    return 'whisper-native';
  }

  getDescription() {
    return 'Local whisper.cpp transcription using whisper-cli binary';
  }

  getInfo() {
    return {
      name: 'Native Whisper',
      description: 'Local whisper.cpp transcription using whisper-cli binary',
      available: this.available,
      argumentStyle: this.argumentStyle,
      binaryPath: this.binaryManager.getWhisperBinaryPath(),
      capabilities: {
        languages: 'auto-detect + 50+ languages',
        maxFileSize: '2GB',
        formats: ['mp3', 'wav', 'mp4', 'avi', 'mov', 'm4a', 'flac'],
        realtime: false,
        offline: true
      }
    };
  }

  getCapabilities() {
    return {
      languages: 'auto-detect + 50+ languages',
      maxFileSize: '2GB',
      formats: ['mp3', 'wav', 'mp4', 'avi', 'mov', 'm4a', 'flac'],
      realtime: false,
      offline: true
    };
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = NativeWhisperProvider;