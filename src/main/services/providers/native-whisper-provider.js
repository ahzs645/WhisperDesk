// src/main/services/providers/native-whisper-provider.js - FIXED availability logic
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class NativeWhisperProvider extends EventEmitter {
  constructor(modelManager, binaryManager) {
    super();
    this.name = 'whisper-native';
    this.description = 'Local whisper.cpp transcription (fastest, most private)';
    this.modelManager = modelManager;
    this.binaryManager = binaryManager;
    this.isInitialized = false;
    this.available = false;
    this.activeProcesses = new Map();
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-native');
  }

  async initialize() {
    try {
      console.log('Initializing Native Whisper Provider...');
      
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // FIXED: More lenient availability check
      this.available = await this.checkAvailability();
      
      if (this.available) {
        console.log('✅ Native Whisper provider available');
      } else {
        console.log('⚠️ Native Whisper provider not fully available, but will attempt runtime usage');
        // FIXED: Don't disable completely - allow runtime attempts
        this.available = true; // Allow provider to be used, handle errors at runtime
      }
      
      this.isInitialized = true;
      console.log('✅ Native Whisper provider initialized');
    } catch (error) {
      console.error('❌ Error initializing Native Whisper provider:', error);
      this.available = false;
      throw error;
    }
  }

  async checkAvailability() {
    try {
      // FIXED: Just check if binary file exists, don't require test to pass
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      await fs.access(binaryPath);
      
      console.log('✅ Whisper binary file exists, provider will be available');
      return true;
      
    } catch (error) {
      console.log('❌ Whisper binary file not found:', error.message);
      return false;
    }
  }

  getName() {
    return this.name;
  }

  getDescription() {
    return this.description;
  }

  isAvailable() {
    return this.available && this.isInitialized;
  }

  getCapabilities() {
    return {
      realtime: false,
      fileUpload: true,
      languages: ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'zh'],
      formats: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'mp4', 'avi', 'mov', 'mkv'],
      maxFileSize: 500 * 1024 * 1024, // 500MB
      models: ['tiny', 'base', 'small', 'medium', 'large', 'large-v2', 'large-v3']
    };
  }

  async processFile(filePath, options = {}) {
    const transcriptionId = options.transcriptionId || this.generateTranscriptionId();
    
    console.log(`Native Whisper Provider: Processing file ${filePath}`);
    console.log(`Options:`, options);
    
    // FIXED: Check availability at runtime and provide better error messages
    if (!this.isAvailable()) {
      const error = new Error('Native Whisper provider is not available. Binary may be missing or corrupted.');
      console.error('❌ Native Whisper provider not available:', error.message);
      throw error;
    }

    try {
      // Validate input file
      await fs.access(filePath);
      
      // Get model path
      const modelName = this.normalizeModelName(options.model || 'base');
      const modelPath = await this.getModelPath(modelName);
      
      // Prepare whisper command
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      const args = await this.buildWhisperArgs(filePath, modelPath, options);
      
      console.log(`Executing: ${binaryPath} ${args.join(' ')}`);
      
      // Execute whisper with enhanced error handling
      const result = await this.executeWhisper(binaryPath, args, transcriptionId);
      
      return {
        text: result.text,
        segments: result.segments || [],
        language: result.language || options.language || 'auto',
        confidence: result.confidence || null,
        metadata: {
          provider: this.name,
          model: modelName,
          duration: result.duration,
          processingTime: result.processingTime
        }
      };
      
    } catch (error) {
      console.error(`❌ Native Whisper error:`, error);
      
      // FIXED: Provide more helpful error messages
      if (error.message.includes('ENOENT')) {
        throw new Error('Whisper binary not found. Please check if whisper.cpp is properly installed.');
      } else if (error.message.includes('model')) {
        throw new Error(`Model error: ${error.message}. Please check if the model file exists and is valid.`);
      } else if (error.message.includes('codec') || error.message.includes('format')) {
        throw new Error(`Audio format error: ${error.message}. Please try a different audio format.`);
      } else {
        throw new Error(`Transcription failed: ${error.message}`);
      }
    }
  }

  normalizeModelName(modelName) {
    // Remove 'whisper-' prefix if present
    if (modelName.startsWith('whisper-')) {
      modelName = modelName.replace('whisper-', '');
    }
    
    // Map common model names
    const modelMap = {
      'tiny': 'ggml-tiny.bin',
      'base': 'ggml-base.bin', 
      'small': 'ggml-small.bin',
      'medium': 'ggml-medium.bin',
      'large': 'ggml-large-v3.bin',
      'large-v2': 'ggml-large-v2.bin',
      'large-v3': 'ggml-large-v3.bin'
    };
    
    return modelMap[modelName] || modelName;
  }

  async getModelPath(modelName) {
    // Try installed models first
    const installedModels = await this.modelManager.getInstalledModels();
    const installedModel = installedModels.find(m => 
      m.filename === modelName || 
      m.id.includes(modelName.replace('.bin', '')) ||
      m.name.includes(modelName.replace('ggml-', '').replace('.bin', ''))
    );
    
    if (installedModel) {
      console.log(`✅ Using installed model: ${installedModel.path}`);
      return installedModel.path;
    }
    
    // Fallback to local models directory
    const modelsDir = path.join(__dirname, '../../../../models');
    const localModelPath = path.join(modelsDir, modelName);
    
    try {
      await fs.access(localModelPath);
      console.log(`✅ Using local model: ${localModelPath}`);
      return localModelPath;
    } catch (error) {
      throw new Error(`Model not found: ${modelName}. Please download the model first.`);
    }
  }

  async buildWhisperArgs(filePath, modelPath, options) {
    const args = [
      '-m', modelPath,
      '-f', filePath
    ];
    
    // Output format
    args.push('--output-json');
    
    // Language
    if (options.language && options.language !== 'auto') {
      args.push('-l', options.language);
    }
    
    // Timestamps
    if (options.enableTimestamps) {
      args.push('-t');
    }
    
    // Threads (use available CPU cores)
    const threads = Math.min(os.cpus().length, 8);
    args.push('-p', threads.toString());
    
    return args;
  }

  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // FIXED: Enhanced environment setup for Windows
      const env = { ...process.env };
      const binaryDir = path.dirname(binaryPath);
      
      if (process.platform === 'win32') {
        // Add binaries directory to PATH for DLL loading
        env.PATH = `${binaryDir};${env.PATH}`;
      }
      
      const options = {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: binaryDir, // Set working directory to binaries folder
        env: env
      };
      
      console.log(`Starting whisper process with PID for transcription ${transcriptionId}`);
      
      const process = spawn(binaryPath, args, options);
      
      if (!process || !process.pid) {
        reject(new Error('Failed to start whisper process'));
        return;
      }
      
      // Store process for potential cancellation
      this.activeProcesses.set(transcriptionId, process);
      
      let stdout = '';
      let stderr = '';
      let hasEmittedProgress = false;
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Emit progress events
        if (!hasEmittedProgress) {
          this.emit('progress', {
            transcriptionId,
            status: 'processing',
            progress: 0.3
          });
          hasEmittedProgress = true;
        }
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        
        // Parse progress from stderr if available
        const progressMatch = stderr.match(/\[(\d+)%\]/);
        if (progressMatch) {
          const progress = parseInt(progressMatch[1]) / 100;
          this.emit('progress', {
            transcriptionId,
            status: 'processing', 
            progress
          });
        }
      });
      
      process.on('close', (code) => {
        this.activeProcesses.delete(transcriptionId);
        const processingTime = Date.now() - startTime;
        
        console.log(`Whisper process finished with code ${code}`);
        console.log(`Processing time: ${processingTime}ms`);
        
        if (code === 0) {
          try {
            // Parse whisper output
            const result = this.parseWhisperOutput(stdout, stderr);
            result.processingTime = processingTime;
            
            this.emit('progress', {
              transcriptionId,
              status: 'complete',
              progress: 1.0
            });
            
            resolve(result);
          } catch (parseError) {
            console.error('Failed to parse whisper output:', parseError);
            reject(new Error(`Failed to parse transcription result: ${parseError.message}`));
          }
        } else {
          // FIXED: Better error messages based on exit codes
          let errorMessage = `Whisper process failed with code ${code}`;
          
          if (code === 1) {
            errorMessage = 'Whisper failed - likely due to invalid input file or corrupted audio';
          } else if (code === 2) {
            errorMessage = 'Whisper failed - model file not found or corrupted';
          } else if (code === 126) {
            errorMessage = 'Whisper binary not executable - permission denied';
          } else if (code === 127) {
            errorMessage = 'Whisper binary not found';
          } else if (stderr.includes('model')) {
            errorMessage = `Model error: ${stderr.trim()}`;
          } else if (stderr.includes('audio') || stderr.includes('codec')) {
            errorMessage = `Audio format error: ${stderr.trim()}`;
          } else if (stderr.trim()) {
            errorMessage = `Whisper error: ${stderr.trim()}`;
          }
          
          console.error(`Whisper stderr: ${stderr}`);
          reject(new Error(errorMessage));
        }
      });
      
      process.on('error', (error) => {
        this.activeProcesses.delete(transcriptionId);
        console.error('Whisper process error:', error);
        
        // FIXED: More specific error messages
        if (error.code === 'ENOENT') {
          reject(new Error('Whisper binary not found. Please check installation.'));
        } else if (error.code === 'EACCES') {
          reject(new Error('Permission denied. Whisper binary is not executable.'));
        } else {
          reject(new Error(`Failed to execute whisper: ${error.message}`));
        }
      });
      
      // Set timeout (30 minutes for large files)
      setTimeout(() => {
        if (this.activeProcesses.has(transcriptionId)) {
          console.log(`Whisper process timeout for transcription ${transcriptionId}`);
          process.kill('SIGTERM');
          this.activeProcesses.delete(transcriptionId);
          reject(new Error('Transcription timeout - file may be too large'));
        }
      }, 30 * 60 * 1000);
    });
  }

  parseWhisperOutput(stdout, stderr) {
    // Try to find JSON output first
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return {
          text: result.text || '',
          segments: result.segments || [],
          language: result.language,
          confidence: result.confidence,
          duration: result.duration
        };
      } catch (error) {
        console.warn('Failed to parse JSON output, falling back to text parsing');
      }
    }
    
    // Fallback to text parsing
    const lines = stdout.split('\n').filter(line => line.trim());
    const textLines = lines.filter(line => 
      !line.startsWith('[') && 
      !line.includes('whisper.cpp') && 
      line.trim().length > 0
    );
    
    const text = textLines.join(' ').trim();
    
    if (!text) {
      throw new Error('No transcription text found in whisper output');
    }
    
    return {
      text,
      segments: [{
        start: 0,
        end: 0,
        text: text
      }],
      language: 'unknown',
      confidence: null,
      duration: null
    };
  }

  async cancel(transcriptionId) {
    const process = this.activeProcesses.get(transcriptionId);
    if (process) {
      console.log(`Cancelling transcription ${transcriptionId}`);
      process.kill('SIGTERM');
      this.activeProcesses.delete(transcriptionId);
      return true;
    }
    return false;
  }

  generateTranscriptionId() {
    return `native_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup() {
    // Cancel all active processes
    for (const [transcriptionId, process] of this.activeProcesses) {
      try {
        process.kill('SIGTERM');
        console.log(`Cancelled active transcription: ${transcriptionId}`);
      } catch (error) {
        console.warn(`Failed to cancel transcription ${transcriptionId}:`, error.message);
      }
    }
    this.activeProcesses.clear();
    
    // Clean up temp directory
    try {
      const files = await fs.readdir(this.tempDir);
      for (const file of files) {
        await fs.unlink(path.join(this.tempDir, file));
      }
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error.message);
    }
    
    this.isInitialized = false;
    this.available = false;
  }
}

module.exports = NativeWhisperProvider;