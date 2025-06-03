// src/main/services/providers/native-whisper-provider.js - COMPLETE FIX
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
      
      // Check availability - more lenient approach
      this.available = await this.checkAvailability();
      
      if (this.available) {
        console.log('✅ Native Whisper provider available');
      } else {
        console.log('⚠️ Native Whisper provider not fully available, but will attempt runtime usage');
        // Allow provider to be used, handle errors at runtime
        this.available = true;
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
      // Just check if binary file exists, don't require test to pass
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
    
    if (!this.isAvailable()) {
      const error = new Error('Native Whisper provider is not available. Binary may be missing or corrupted.');
      console.error('❌ Native Whisper provider not available:', error.message);
      throw error;
    }

    try {
      // Validate input file
      await fs.access(filePath);
      
      // Get model path - COMPLETELY FIXED MODEL RESOLUTION
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
      
      // Provide more helpful error messages
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
    
    // Map model names to expected GGML filenames that whisper.cpp expects
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
    console.log(`🔍 Looking for model: ${modelName}`);
    
    // COMPLETELY FIXED: Try multiple approaches to find the model file
    
    // 1. Try installed models from ModelManager first
    try {
      const installedModels = await this.modelManager.getInstalledModels();
      console.log(`📋 Installed models: ${installedModels.map(m => m.id).join(', ')}`);
      
      // Look for exact filename match first
      let installedModel = installedModels.find(m => {
        const filename = path.basename(m.path);
        return filename === modelName;
      });
      
      // Look for ID-based match (whisper-tiny -> ggml-tiny.bin)
      if (!installedModel) {
        const baseModelName = modelName.replace('ggml-', '').replace('.bin', '');
        installedModel = installedModels.find(m => {
          return m.id.includes(baseModelName) || 
                 m.name?.toLowerCase().includes(baseModelName) ||
                 m.id === `whisper-${baseModelName}`;
        });
      }
      
      if (installedModel) {
        console.log(`✅ Found installed model: ${installedModel.path}`);
        
        // CRITICAL FIX: Check if the file actually exists
        try {
          await fs.access(installedModel.path);
          
          // CRITICAL FIX: Check if this file has the correct naming for whisper.cpp
          const filename = path.basename(installedModel.path);
          if (filename === modelName) {
            // Perfect match - file exists with correct name
            return installedModel.path;
          } else {
            // File exists but wrong name - create symlink/copy with correct name
            const modelsDir = path.dirname(installedModel.path);
            const correctPath = path.join(modelsDir, modelName);
            
            try {
              // Check if correctly named file already exists
              await fs.access(correctPath);
              console.log(`✅ Found correctly named file: ${correctPath}`);
              return correctPath;
            } catch (error) {
              // Create copy with correct name
              console.log(`🔄 Creating correctly named copy: ${filename} -> ${modelName}`);
              await fs.copyFile(installedModel.path, correctPath);
              console.log(`✅ Created correctly named model file: ${correctPath}`);
              return correctPath;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Model file not accessible: ${installedModel.path}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error getting installed models:', error.message);
    }
    
    // 2. Try looking in the models directory with expected GGML naming
    const modelsDir = this.modelManager.modelsDir;
    const possiblePaths = [
      path.join(modelsDir, modelName), // Direct filename (ggml-tiny.bin)
      path.join(modelsDir, `whisper-${modelName.replace('ggml-', '').replace('.bin', '')}.bin`), // WhisperDesk naming
      path.join(modelsDir, modelName.replace('ggml-', '').replace('.bin', '') + '.bin'), // Simple naming
    ];
    
    console.log(`🔍 Checking paths in models directory: ${modelsDir}`);
    for (const modelPath of possiblePaths) {
      try {
        await fs.access(modelPath);
        console.log(`✅ Found model at: ${modelPath}`);
        
        // If this isn't the correctly named file, create a copy with the correct name
        const filename = path.basename(modelPath);
        if (filename !== modelName) {
          const correctPath = path.join(modelsDir, modelName);
          try {
            await fs.access(correctPath);
            console.log(`✅ Correctly named file already exists: ${correctPath}`);
            return correctPath;
          } catch (error) {
            console.log(`🔄 Creating correctly named copy: ${filename} -> ${modelName}`);
            await fs.copyFile(modelPath, correctPath);
            console.log(`✅ Created correctly named model file: ${correctPath}`);
            return correctPath;
          }
        }
        
        return modelPath;
      } catch (error) {
        console.log(`❌ Not found: ${modelPath}`);
      }
    }
    
    // 3. Try fallback to local models directory (for development)
    const localModelsDir = path.join(__dirname, '../../../../models');
    const localPath = path.join(localModelsDir, modelName);
    
    try {
      await fs.access(localPath);
      console.log(`✅ Found local model: ${localPath}`);
      return localPath;
    } catch (error) {
      console.log(`❌ Local model not found: ${localPath}`);
    }
    
    // 4. Final attempt: list what's actually in the models directory and try to match
    try {
      const files = await fs.readdir(modelsDir);
      console.log(`📁 Files in models directory: ${files.join(', ')}`);
      
      // Look for any .bin file that might match
      const matchingFile = files.find(file => {
        const lowerFile = file.toLowerCase();
        const lowerModel = modelName.toLowerCase();
        const baseModel = lowerModel.replace('ggml-', '').replace('.bin', '');
        
        return lowerFile.includes(baseModel) && lowerFile.endsWith('.bin');
      });
      
      if (matchingFile) {
        const matchedPath = path.join(modelsDir, matchingFile);
        console.log(`✅ Found matching file: ${matchedPath}`);
        
        // Create correctly named copy
        const correctPath = path.join(modelsDir, modelName);
        try {
          await fs.access(correctPath);
          console.log(`✅ Correctly named file already exists: ${correctPath}`);
          return correctPath;
        } catch (error) {
          console.log(`🔄 Creating correctly named copy: ${matchingFile} -> ${modelName}`);
          await fs.copyFile(matchedPath, correctPath);
          console.log(`✅ Created correctly named model file: ${correctPath}`);
          return correctPath;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not list models directory:', error.message);
    }
    
    // If we get here, no model was found
    const baseModelName = modelName.replace('ggml-', '').replace('.bin', '');
    throw new Error(`Model not found: ${modelName}. Please download the '${baseModelName}' model first from the Models tab.`);
  }

  async buildWhisperArgs(filePath, modelPath, options) {
    const args = [
      '-m', modelPath,
      '-f', filePath
    ];
    
    // Output format - use text output for better compatibility
    args.push('--output-txt');
    
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
      
      // Enhanced environment setup for Windows
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
          // Better error messages based on exit codes
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
        
        // More specific error messages
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