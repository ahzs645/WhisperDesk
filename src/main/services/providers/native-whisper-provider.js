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
   * Build command line arguments based on detected format - FIXED
   */
  buildWhisperArgs(audioPath, modelPath, transcriptionId, options = {}) {
    const outputFile = path.join(this.tempDir, transcriptionId);
    const args = [];

    if (this.argumentStyle === 'whisper-cli') {
      // New whisper-cli argument format - FIXED: Use --output-file instead of --output-dir
      args.push('--file', audioPath);
      args.push('--model', modelPath);
      args.push('--output-file', outputFile); // ✅ FIXED: This is the correct argument
      
      // Optional parameters
      if (options.language && options.language !== 'auto') {
        args.push('--language', options.language);
      }
      
      // Output format
      args.push('--output-txt');
      args.push('--output-json');
      
      // Additional options - be smarter about diarization
      // Only enable diarization if explicitly requested and not disabled
      if (options.enableSpeakerDiarization && !options.disableDiarization) {
        args.push('--diarize');
      }
      
      if (options.temperature !== undefined) {
        args.push('--temperature', options.temperature.toString());
      }
      
      // Add useful options for better output
      args.push('--print-progress'); // Show progress in output
      
      // Add no-fallback to prevent multiple attempts that might cause duplicates
      args.push('--no-fallback');

    } else {
      // Legacy argument format (fallback)
      args.push('-f', audioPath);
      args.push('-m', modelPath);
      args.push('-of', outputFile); // Use -of instead of -o
      
      if (options.language && options.language !== 'auto') {
        args.push('-l', options.language);
      }
      
      args.push('-otxt');
      args.push('-ojson');
      args.push('-pp'); // print progress
      args.push('-nf'); // no fallback
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

      // Handle stderr (contains progress and status info)
      whisperProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 Whisper stderr: ${output.trim()}`);
        
        // Parse progress from stderr (whisper outputs progress here)
        // Look for patterns like "progress = 42%" or "progress=42%"
        const progressMatch = output.match(/progress\s*=\s*(\d+)%/i);
        if (progressMatch) {
          const newProgress = parseInt(progressMatch[1]); // Keep as 0-100 range for UI
          if (newProgress !== progress * 100) { // Only emit if progress changed
            progress = newProgress / 100; // Store as 0-1 internally
            this.emit('progress', { 
              transcriptionId, 
              progress: newProgress  // Send 0-100 to UI
            });
            console.log(`📊 Progress updated: ${newProgress}%`);
          }
        }
      });

      // Handle process completion
      whisperProcess.on('close', async (code) => {
        console.log(`🏁 Whisper process completed with code: ${code}`);

        if (code === 0) {
          try {
            // Parse output files
            const result = await this.parseOutputFiles(transcriptionId);
            this.emit('progress', { transcriptionId, progress: 100 }); // Send 100 for completion
            // Don't emit complete here - it will be emitted in processFile
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
          } else if (stderr.includes('unknown argument')) {
            errorMessage = 'Binary argument error - binary may be incompatible version';
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
   * Parse output files from whisper - FIXED with better file detection
   */
  async parseOutputFiles(transcriptionId) {
    const outputFiles = {
      txt: path.join(this.tempDir, `${transcriptionId}.txt`),
      json: path.join(this.tempDir, `${transcriptionId}.json`)
    };

    let transcriptionText = '';
    let transcriptionData = null;

    // Try to read text output
    try {
      transcriptionText = await fs.readFile(outputFiles.txt, 'utf8');
      console.log(`✅ Read text output from: ${outputFiles.txt}`);
    } catch (error) {
      console.log(`📄 Text file not found: ${outputFiles.txt}`);
    }

    // Try to read JSON output for detailed data
    try {
      const jsonContent = await fs.readFile(outputFiles.json, 'utf8');
      transcriptionData = JSON.parse(jsonContent);
      console.log(`✅ Read JSON output from: ${outputFiles.json}`);
    } catch (error) {
      console.log(`📄 JSON file not found or invalid: ${outputFiles.json}`);
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

    // If still no text, try to read any .txt files in the temp directory
    if (!transcriptionText) {
      try {
        const files = await fs.readdir(this.tempDir);
        const txtFiles = files.filter(f => f.endsWith('.txt'));
        
        for (const txtFile of txtFiles) {
          try {
            const content = await fs.readFile(path.join(this.tempDir, txtFile), 'utf8');
            if (content.trim()) {
              transcriptionText = content;
              console.log(`✅ Found text output in: ${txtFile}`);
              break;
            }
          } catch (e) {
            // Continue to next file
          }
        }
      } catch (error) {
        console.warn('⚠️ Could not scan temp directory for output files');
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

    console.log(`✅ Final transcription text: ${transcriptionText}`); // Log the transcription text

    // Check if the transcription is mostly music
    const isMostlyMusic = this.detectMusicContent(transcriptionText);
    
    return {
      text: transcriptionText.trim(),
      data: transcriptionData,
      provider: 'whisper-native',
      model: 'local',
      timestamp: new Date().toISOString(),
      metadata: {
        isMostlyMusic,
        suggestion: isMostlyMusic ? 'Consider disabling speaker diarization for music-only files' : null
      }
    };
  }

  /**
   * Detect if content is mostly music
   */
  detectMusicContent(text) {
    const musicIndicators = [
      '[Music]', '[music]', '[MUSIC]', 
      '(Music)', '(music)', '(MUSIC)',
      '♪', '♫', '🎵', '🎶'
    ];
    
    const lines = text.split('\n').filter(line => line.trim()); // Remove empty lines
    const musicLines = lines.filter(line => 
      musicIndicators.some(indicator => line.toLowerCase().includes(indicator.toLowerCase()))
    );
    
    // Return true if any line contains music indicators
    return musicLines.length > 0;
  }

  /**
   * Process file for transcription - FIXED
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
        options.model || 'tiny'  // Default to tiny model
      );

      if (!modelPath) {
        throw new Error(`Model not found: ${options.model || 'tiny'}`);
      }

      console.log(`🔍 Using model: ${modelPath}`);

      // Build arguments - FIXED: Pass transcriptionId for output file naming
      const args = this.buildWhisperArgs(filePath, modelPath, transcriptionId, options);

      // Execute whisper
      this.emit('progress', { transcriptionId, progress: 0 }); // Send 0-100 range
      const result = await this.executeWhisper(binaryPath, args, transcriptionId);

      // Only emit complete event once here - this is the final result
      this.emit('complete', { transcriptionId, result });
      console.log(`✅ Transcription completed successfully with whisper-native`);
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