// src/main/services/providers/native-whisper-provider.js - FIXED VERSION
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
      const testResult = await this.binaryManager.testBinaryWithResult();
      
      if (testResult.success) {
        this.argumentStyle = testResult.argumentFormat || 'whisper-cli';
        console.log(`🔍 Detected argument format: ${this.argumentStyle}`);
      } else {
        console.warn('⚠️ Could not detect binary format, using default: whisper-cli');
        this.argumentStyle = 'whisper-cli';
      }
    } catch (error) {
      console.warn('⚠️ Binary format detection failed:', error.message);
      this.argumentStyle = 'whisper-cli';
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
      const installedModels = await this.modelManager.getInstalled();
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
   * Build command line arguments based on detected format
   */
  buildWhisperArgs(audioPath, modelPath, options = {}) {
    const outputDir = this.tempDir;
    const args = [];

    if (this.argumentStyle === 'whisper-cli') {
      // New whisper-cli argument format
      args.push('--file', audioPath);
      args.push('--model', modelPath);
      args.push('--output-dir', outputDir);
      
      // Optional parameters
      if (options.language && options.language !== 'auto') {
        args.push('--language', options.language);
      }
      
      if (options.enableTimestamps !== false) {
        args.push('--timestamp');
      }
      
      // Output format
      args.push('--output-txt');
      args.push('--output-json');
      
      // Additional options
      if (options.enableSpeakerDiarization) {
        args.push('--diarize');
      }
      
      if (options.temperature !== undefined) {
        args.push('--temperature', options.temperature.toString());
      }
      
      if (options.maxTokens) {
        args.push('--max-tokens', options.maxTokens.toString());
      }

    } else {
      // Legacy argument format (fallback)
      args.push('-f', audioPath);
      args.push('-m', modelPath);
      args.push('-o', outputDir);
      
      if (options.language && options.language !== 'auto') {
        args.push('-l', options.language);
      }
      
      if (options.enableTimestamps !== false) {
        args.push('-t');
      }
      
      args.push('-otxt');
      args.push('-ojson');
    }

    console.log(`🔧 Built whisper args (${this.argumentStyle}):`, args.join(' '));
    return args;
  }

  /**
   * Execute whisper binary with proper error handling
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

      // Handle stdout
      whisperProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Emit progress based on output patterns
        const progressMatch = output.match(/\[(\d+)%\]/);
        if (progressMatch) {
          progress = parseInt(progressMatch[1]) / 100;
          this.emit('progress', { transcriptionId, progress });
        }
        
        // Look for other progress indicators
        if (output.includes('processing') || output.includes('transcribing')) {
          progress = Math.min(progress + 0.1, 0.9);
          this.emit('progress', { transcriptionId, progress });
        }
      });

      // Handle stderr
      whisperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 Whisper stderr: ${output.trim()}`);
      });

      // Handle process completion
      whisperProcess.on('close', async (code) => {
        console.log(`🏁 Whisper process completed with code: ${code}`);

        if (code === 0) {
          try {
            // Parse output files
            const result = await this.parseOutputFiles(transcriptionId);
            this.emit('progress', { transcriptionId, progress: 1.0 });
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse output files:', parseError.message);
            reject(new Error(`Failed to parse transcription output: ${parseError.message}`));
          }
        } else {
          // Handle specific error codes
          let errorMessage = `Whisper process failed with exit code ${code}`;
          
          if (code === 3221225501) {
            errorMessage = 'Access violation error - likely missing Visual C++ runtime or corrupted binary';
          } else if (stderr.includes('model') && stderr.includes('not found')) {
            errorMessage = 'Model file not found or corrupted';
          } else if (stderr.includes('audio') && stderr.includes('format')) {
            errorMessage = 'Unsupported audio format';
          } else if (stderr.trim()) {
            errorMessage = `Whisper error: ${stderr.trim()}`;
          }

          console.error(`❌ ${errorMessage}`);
          console.error(`📝 Full stderr: ${stderr}`);
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
   * Parse output files from whisper
   */
  async parseOutputFiles(transcriptionId) {
    const outputFiles = {
      txt: path.join(this.tempDir, `${transcriptionId}.txt`),
      json: path.join(this.tempDir, `${transcriptionId}.json`),
      // Try alternative naming patterns
      altTxt: path.join(this.tempDir, 'output.txt'),
      altJson: path.join(this.tempDir, 'output.json')
    };

    let transcriptionText = '';
    let transcriptionData = null;

    // Try to read text output
    for (const txtFile of [outputFiles.txt, outputFiles.altTxt]) {
      try {
        transcriptionText = await fs.readFile(txtFile, 'utf8');
        console.log(`✅ Read text output from: ${txtFile}`);
        break;
      } catch (error) {
        console.log(`📄 Text file not found: ${txtFile}`);
      }
    }

    // Try to read JSON output for detailed data
    for (const jsonFile of [outputFiles.json, outputFiles.altJson]) {
      try {
        const jsonContent = await fs.readFile(jsonFile, 'utf8');
        transcriptionData = JSON.parse(jsonContent);
        console.log(`✅ Read JSON output from: ${jsonFile}`);
        break;
      } catch (error) {
        console.log(`📄 JSON file not found or invalid: ${jsonFile}`);
      }
    }

    // If no text from files, try to extract from JSON
    if (!transcriptionText && transcriptionData) {
      if (transcriptionData.text) {
        transcriptionText = transcriptionData.text;
      } else if (transcriptionData.segments) {
        transcriptionText = transcriptionData.segments
          .map(segment => segment.text)
          .join(' ');
      }
    }

    // Clean up temporary files
    try {
      for (const file of Object.values(outputFiles)) {
        await fs.unlink(file).catch(() => {}); // Ignore errors
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up some temp files:', error.message);
    }

    if (!transcriptionText) {
      throw new Error('No transcription output found');
    }

    return {
      text: transcriptionText.trim(),
      data: transcriptionData,
      provider: 'whisper-native',
      model: 'local',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Process file for transcription
   */
  async processFile(filePath, options = {}) {
    if (!this.available) {
      throw new Error('Native whisper provider is not available');
    }

    const transcriptionId = `transcription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get binary path
      const binaryPath = this.binaryManager.getWhisperBinaryPath();

      // Get model path
      const modelPath = await this.modelManager.getCompatibleModelPath(
        options.model || 'base'
      );

      if (!modelPath) {
        throw new Error(`Model not found: ${options.model || 'base'}`);
      }

      // Build arguments
      const args = this.buildWhisperArgs(filePath, modelPath, options);

      // Execute whisper
      this.emit('progress', { transcriptionId, progress: 0.0 });
      const result = await this.executeWhisper(binaryPath, args, transcriptionId);

      this.emit('complete', { transcriptionId, result });
      return result;

    } catch (error) {
      console.error(`❌ Transcription failed: ${error.message}`);
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  /**
   * Get provider information
   */
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

  isAvailable() {
    return this.available;
  }
}

module.exports = NativeWhisperProvider;