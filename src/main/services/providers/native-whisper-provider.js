// src/main/services/providers/native-whisper-provider.js - FIXED FOR NEW WHISPER-CLI
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
      
      await fs.mkdir(this.tempDir, { recursive: true });
      
      this.available = await this.checkAvailability();
      
      if (this.available) {
        console.log('✅ Native Whisper provider available');
      } else {
        console.log('⚠️ Native Whisper provider not fully available, but will attempt runtime usage');
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
      await fs.access(filePath);
      
      const modelName = this.normalizeModelName(options.model || 'base');
      const modelPath = await this.getModelPath(modelName);
      
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      const args = await this.buildWhisperArgs(filePath, modelPath, options);
      
      console.log(`Executing: ${binaryPath} ${args.join(' ')}`);
      
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
    if (modelName.startsWith('whisper-')) {
      modelName = modelName.replace('whisper-', '');
    }
    
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
    
    try {
      const installedModels = await this.modelManager.getInstalledModels();
      console.log(`📋 Installed models: ${installedModels.map(m => m.id).join(', ')}`);
      
      let installedModel = installedModels.find(m => {
        const filename = path.basename(m.path);
        return filename === modelName;
      });
      
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
        
        try {
          await fs.access(installedModel.path);
          
          const filename = path.basename(installedModel.path);
          if (filename === modelName) {
            return installedModel.path;
          } else {
            const modelsDir = path.dirname(installedModel.path);
            const correctPath = path.join(modelsDir, modelName);
            
            try {
              await fs.access(correctPath);
              console.log(`✅ Found correctly named file: ${correctPath}`);
              return correctPath;
            } catch (error) {
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
    
    const modelsDir = this.modelManager.modelsDir;
    const possiblePaths = [
      path.join(modelsDir, modelName),
      path.join(modelsDir, `whisper-${modelName.replace('ggml-', '').replace('.bin', '')}.bin`),
      path.join(modelsDir, modelName.replace('ggml-', '').replace('.bin', '') + '.bin'),
    ];
    
    console.log(`🔍 Checking paths in models directory: ${modelsDir}`);
    for (const modelPath of possiblePaths) {
      try {
        await fs.access(modelPath);
        console.log(`✅ Found model at: ${modelPath}`);
        
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
    
    const baseModelName = modelName.replace('ggml-', '').replace('.bin', '');
    throw new Error(`Model not found: ${modelName}. Please download the '${baseModelName}' model first from the Models tab.`);
  }

// Quick fix for buildWhisperArgs function in native-whisper-provider.js
// Replace your buildWhisperArgs function with this:

async buildWhisperArgs(filePath, modelPath, options) {
  // Test if binary is new or old by trying --help
  const binaryPath = this.binaryManager.getWhisperBinaryPath();
  let useNewFormat = true;
  
  try {
    const { spawn } = require('child_process');
    const testProcess = spawn(binaryPath, ['--help'], { stdio: 'pipe' });
    let output = '';
    
    testProcess.stdout.on('data', (data) => output += data.toString());
    testProcess.stderr.on('data', (data) => output += data.toString());
    
    await new Promise((resolve) => {
      testProcess.on('close', () => resolve());
      setTimeout(() => {
        testProcess.kill();
        resolve();
      }, 3000);
    });
    
    // If output contains "deprecated" or old-style help, use old format
    if (output.includes('deprecated') || output.includes('usage: whisper')) {
      useNewFormat = false;
      console.log('🔧 Detected old binary format, using legacy arguments');
    }
  } catch (error) {
    console.warn('Could not test binary format, assuming new format');
  }
  
  // Build arguments based on detected format
  if (useNewFormat) {
    // NEW format (whisper-cli)
    const args = [
      '--model', modelPath,
      '--file', filePath,
      '--output-txt'
    ];
    
    if (options.language && options.language !== 'auto') {
      args.push('--language', options.language);
    }
    
    if (options.enableTimestamps) {
      args.push('--timestamps');
    }
    
    const threads = Math.min(require('os').cpus().length, 8);
    args.push('--threads', threads.toString());
    
    args.push('--output-dir', this.tempDir);
    
    return args;
  } else {
    // OLD format (legacy whisper)
    const args = [
      '-m', modelPath,
      '-f', filePath,
      '--output-txt'
    ];
    
    if (options.language && options.language !== 'auto') {
      args.push('-l', options.language);
    }
    
    if (options.enableTimestamps) {
      args.push('-t');
    }
    
    const threads = Math.min(require('os').cpus().length, 8);
    args.push('-p', threads.toString());
    
    return args;
  }
}

  async executeWhisper(binaryPath, args, transcriptionId) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const env = { ...process.env };
      const binaryDir = path.dirname(binaryPath);
      
      if (process.platform === 'win32') {
        env.PATH = `${binaryDir};${env.PATH}`;
      }
      
      const options = {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: binaryDir,
        env: env
      };
      
      console.log(`Starting whisper process with PID for transcription ${transcriptionId}`);
      
      let whisperProcess;
      
      try {
        whisperProcess = spawn(binaryPath, args, options);
      } catch (spawnError) {
        reject(new Error(`Failed to spawn whisper process: ${spawnError.message}`));
        return;
      }
      
      if (!whisperProcess || !whisperProcess.pid) {
        reject(new Error('Failed to start whisper process'));
        return;
      }
      
      this.activeProcesses.set(transcriptionId, whisperProcess);
      
      let stdout = '';
      let stderr = '';
      let hasEmittedProgress = false;
      
      whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        
        if (!hasEmittedProgress) {
          this.emit('progress', {
            transcriptionId,
            status: 'processing',
            progress: 0.3
          });
          hasEmittedProgress = true;
        }
      });
      
      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        
        // Handle deprecation warning gracefully
        if (stderr.includes('deprecated')) {
          console.log('ℹ️ Whisper binary shows deprecation warning (this is normal for newer versions)');
        }
        
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
      
      whisperProcess.on('close', (code) => {
        this.activeProcesses.delete(transcriptionId);
        const processingTime = Date.now() - startTime;
        
        console.log(`Whisper process finished with code ${code}`);
        console.log(`Processing time: ${processingTime}ms`);
        
        if (code === 0) {
          try {
            const result = this.parseWhisperOutput(stdout, stderr, args);
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
          let errorMessage = `Whisper process failed with code ${code}`;
          
          // Handle deprecation warnings more gracefully
          if (stderr.includes('deprecated') && code === 1) {
            // Check if there's actual transcription output despite the warning
            try {
              const result = this.parseWhisperOutput(stdout, stderr, args);
              if (result.text && result.text.trim().length > 0) {
                console.log('✅ Transcription succeeded despite deprecation warning');
                result.processingTime = processingTime;
                resolve(result);
                return;
              }
            } catch (parseError) {
              // Fall through to error handling
            }
            
            errorMessage = 'Whisper binary shows deprecation warning. Please update to whisper-cli.';
          } else if (code === 1) {
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
      
      whisperProcess.on('error', (error) => {
        this.activeProcesses.delete(transcriptionId);
        console.error('Whisper process error:', error);
        
        if (error.code === 'ENOENT') {
          reject(new Error('Whisper binary not found. Please check installation.'));
        } else if (error.code === 'EACCES') {
          reject(new Error('Permission denied. Whisper binary is not executable.'));
        } else {
          reject(new Error(`Failed to execute whisper: ${error.message}`));
        }
      });
      
      setTimeout(() => {
        if (this.activeProcesses.has(transcriptionId)) {
          console.log(`Whisper process timeout for transcription ${transcriptionId}`);
          whisperProcess.kill('SIGTERM');
          this.activeProcesses.delete(transcriptionId);
          reject(new Error('Transcription timeout - file may be too large'));
        }
      }, 30 * 60 * 1000);
    });
  }

  parseWhisperOutput(stdout, stderr, args) {
    // FIXED: Handle new whisper-cli output format
    
    // First, try to find output file from args
    const outputDirIndex = args.findIndex(arg => arg === '--output-dir');
    const inputFileIndex = args.findIndex(arg => arg === '--file');
    
    if (outputDirIndex !== -1 && inputFileIndex !== -1) {
      const outputDir = args[outputDirIndex + 1];
      const inputFile = args[inputFileIndex + 1];
      const baseName = path.basename(inputFile, path.extname(inputFile));
      
      // Try to read the output file
      const outputFile = path.join(outputDir, `${baseName}.txt`);
      try {
        const fs = require('fs');
        if (fs.existsSync(outputFile)) {
          const text = fs.readFileSync(outputFile, 'utf8').trim();
          if (text.length > 0) {
            console.log(`✅ Read transcription from output file: ${outputFile}`);
            
            // Clean up the output file
            try {
              fs.unlinkSync(outputFile);
            } catch (cleanupError) {
              console.warn('Could not clean up output file:', cleanupError.message);
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
        }
      } catch (fileError) {
        console.warn('Could not read output file:', fileError.message);
      }
    }
    
    // Fallback: Try to find JSON output first
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
    
    // Fallback to text parsing from stdout/stderr
    const allOutput = stdout + '\n' + stderr;
    const lines = allOutput.split('\n').filter(line => line.trim());
    
    // Filter out whisper metadata and warnings
    const textLines = lines.filter(line => {
      const l = line.toLowerCase();
      return !l.includes('whisper.cpp') && 
             !l.includes('loading model') &&
             !l.includes('deprecated') &&
             !l.includes('warning') &&
             !l.includes('system_info') &&
             !l.includes('sampling') &&
             !l.startsWith('[') && 
             line.trim().length > 0;
    });
    
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
    const whisperProcess = this.activeProcesses.get(transcriptionId);
    if (whisperProcess) {
      console.log(`Cancelling transcription ${transcriptionId}`);
      whisperProcess.kill('SIGTERM');
      this.activeProcesses.delete(transcriptionId);
      return true;
    }
    return false;
  }

  generateTranscriptionId() {
    return `native_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async cleanup() {
    for (const [transcriptionId, whisperProcess] of this.activeProcesses) {
      try {
        whisperProcess.kill('SIGTERM');
        console.log(`Cancelled active transcription: ${transcriptionId}`);
      } catch (error) {
        console.warn(`Failed to cancel transcription ${transcriptionId}:`, error.message);
      }
    }
    this.activeProcesses.clear();
    
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