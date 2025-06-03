// src/main/services/providers/native-whisper-provider.js - FIXED VERSION
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
    this.argumentStyle = 'unknown';
  }

  async initialize() {
    try {
      console.log('Initializing Native Whisper Provider...');
      
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Detect binary format
      await this.detectBinaryFormat();
      
      this.available = await this.checkAvailability();
      
      if (this.available) {
        console.log('✅ Native Whisper provider available');
        console.log(`🔧 Binary format: ${this.argumentStyle}`);
      } else {
        console.log('⚠️ Native Whisper provider not fully available, but will attempt runtime usage');
        this.available = true; // Allow runtime attempts
      }
      
      this.isInitialized = true;
      console.log('✅ Native Whisper provider initialized');
    } catch (error) {
      console.error('❌ Error initializing Native Whisper provider:', error);
      this.available = false;
      throw error;
    }
  }

  async detectBinaryFormat() {
    try {
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      console.log(`🔍 Detecting binary format for: ${binaryPath}`);
      
      // Quick test to determine format
      const testResult = await this.quickBinaryTest(binaryPath);
      
      if (testResult.supportsNewFormat) {
        this.argumentStyle = 'new';
        console.log('✅ Detected NEW argument format (--file, --model)');
      } else if (testResult.supportsLegacyFormat) {
        this.argumentStyle = 'legacy';
        console.log('✅ Detected LEGACY argument format (-f, -m)');
      } else {
        // Fallback based on binary name
        const binaryName = path.basename(binaryPath).toLowerCase();
        if (binaryName.includes('whisper-cli') || binaryName.includes('whisper-cpp')) {
          this.argumentStyle = 'new';
          console.log('🔧 Fallback: Assuming NEW format based on binary name');
        } else {
          this.argumentStyle = 'legacy';
          console.log('🔧 Fallback: Assuming LEGACY format based on binary name');
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Could not detect binary format, defaulting to legacy:', error.message);
      this.argumentStyle = 'legacy';
    }
  }

  async quickBinaryTest(binaryPath) {
    return new Promise((resolve) => {
      const results = { supportsNewFormat: false, supportsLegacyFormat: false };
      
      try {
        const env = { ...process.env };
        const binaryDir = path.dirname(binaryPath);
        
        if (process.platform === 'win32') {
          env.PATH = `${binaryDir};${env.PATH}`;
        }
        
        // Test new format
        const testProcess = spawn(binaryPath, ['--help'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: binaryDir,
          env: env,
          timeout: 3000
        });
        
        let output = '';
        
        testProcess.stdout.on('data', (data) => output += data.toString());
        testProcess.stderr.on('data', (data) => output += data.toString());
        
        testProcess.on('close', (code) => {
          if (code === 0 || output.length > 50) {
            if (output.includes('--file') || output.includes('--model')) {
              results.supportsNewFormat = true;
            }
            if (output.includes('-f ') || output.includes('-m ')) {
              results.supportsLegacyFormat = true;
            }
          }
          resolve(results);
        });
        
        testProcess.on('error', () => {
          resolve(results);
        });
        
        setTimeout(() => {
          testProcess.kill('SIGTERM');
          resolve(results);
        }, 3000);
        
      } catch (error) {
        resolve(results);
      }
    });
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
      maxFileSize: 500 * 1024 * 1024,
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
      const args = this.buildWhisperArgs(filePath, modelPath, options);
      
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
      } else if (error.message.includes('3221225501') || error.message.includes('access violation')) {
        throw new Error('Binary crashed (access violation). The whisper.exe may be corrupted or incompatible with your system. Try downloading a fresh copy of WhisperDesk.');
      } else if (error.message.includes('model')) {
        throw new Error(`Model error: ${error.message}. Please check if the model file exists and is valid.`);
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
      // Use the model manager's compatible path method if available
      if (this.modelManager.getCompatibleModelPath) {
        const modelId = modelName.replace('ggml-', '').replace('.bin', '');
        return await this.modelManager.getCompatibleModelPath(`whisper-${modelId}`);
      }
      
      // Fallback to manual search
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
        
        const filename = path.basename(installedModel.path);
        if (filename === modelName) {
          return installedModel.path;
        } else {
          // Create compatible named version
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
      }
    } catch (error) {
      console.warn('⚠️ Error getting model path:', error.message);
    }
    
    const baseModelName = modelName.replace('ggml-', '').replace('.bin', '');
    throw new Error(`Model not found: ${modelName}. Please download the '${baseModelName}' model first from the Models tab.`);
  }

  buildWhisperArgs(filePath, modelPath, options) {
    console.log(`🔧 Building arguments for format: ${this.argumentStyle}`);
    
    let args = [];
    
    if (this.argumentStyle === 'new') {
      // NEW format (whisper-cli)
      args = [
        '--model', modelPath,
        '--file', filePath,
        '--output-txt'
      ];
      
      if (options.language && options.language !== 'auto') {
        args.push('--language', options.language);
      }
      
      if (options.enableTimestamps) {
        args.push('--word-thold', '0.01');
      }
      
      const threads = Math.min(require('os').cpus().length, 8);
      args.push('--threads', threads.toString());
      
    } else {
      // LEGACY format (older whisper binaries)
      args = [
        '-m', modelPath,
        '-f', filePath,
        '--output-txt'
      ];
      
      if (options.language && options.language !== 'auto') {
        args.push('-l', options.language);
      }
      
      if (options.enableTimestamps) {
        args.push('-nt');
      }
      
      const threads = Math.min(require('os').cpus().length, 8);
      args.push('-t', threads.toString());
      args.push('-p', '1');
    }
    
    console.log(`📋 Final arguments: ${args.join(' ')}`);
    return args;
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
      
      console.log(`Starting whisper process for transcription ${transcriptionId}`);
      
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
        
        // Parse progress from stderr
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
        
        if (code === 0 || (code === 1 && stdout.length > 0)) {
          try {
            const result = this.parseWhisperOutput(stdout, stderr, args, filePath);
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
          
          // Handle specific error codes
          if (code === 3221225501 || code === -1073741795) {
            errorMessage = 'Binary crashed (access violation). The whisper.exe may be corrupted or incompatible with your system. Try downloading a fresh copy of WhisperDesk.';
          } else if (stderr.includes('unknown argument') || stderr.includes('invalid option')) {
            errorMessage = `Argument format error: ${stderr.trim()}. The binary may use a different argument format than detected.`;
          } else if (code === 1 && stderr.includes('deprecated')) {
            // Try to parse output despite deprecation warning
            try {
              const result = this.parseWhisperOutput(stdout, stderr, args, filePath);
              if (result.text && result.text.trim().length > 0) {
                console.log('✅ Transcription succeeded despite deprecation warning');
                result.processingTime = processingTime;
                resolve(result);
                return;
              }
            } catch (parseError) {
              // Fall through to error
            }
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
      
      // Set timeout
      setTimeout(() => {
        if (this.activeProcesses.has(transcriptionId)) {
          console.log(`Whisper process timeout for transcription ${transcriptionId}`);
          whisperProcess.kill('SIGTERM');
          this.activeProcesses.delete(transcriptionId);
          reject(new Error('Transcription timeout - file may be too large'));
        }
      }, 30 * 60 * 1000); // 30 minutes
    });
  }

  // IMPROVED: Better output parsing with multiple strategies
  parseWhisperOutput(stdout, stderr, args, filePath) {
    console.log('🔍 Parsing whisper output...');
    
    // Strategy 1: Check for output files first
    try {
      const baseName = path.basename(filePath, path.extname(filePath));
      const possibleOutputFiles = [
        `${filePath}.txt`,
        path.join(process.cwd(), `${baseName}.txt`),
        path.join(this.tempDir, `${baseName}.txt`),
        `${baseName}.txt`
      ];
      
      const fs = require('fs');
      for (const outputFile of possibleOutputFiles) {
        try {
          if (fs.existsSync(outputFile)) {
            const text = fs.readFileSync(outputFile, 'utf8').trim();
            if (text.length > 0) {
              console.log(`✅ Read transcription from output file: ${outputFile}`);
              
              // Clean up
              try {
                fs.unlinkSync(outputFile);
              } catch (e) {
                console.warn('Could not clean up output file:', e.message);
              }
              
              return {
                text,
                segments: [{ start: 0, end: 0, text }],
                language: 'unknown',
                confidence: null,
                duration: null
              };
            }
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.warn('Could not check output files:', error.message);
    }
    
    // Strategy 2: Parse from stdout/stderr
    const allOutput = stdout + '\n' + stderr;
    console.log('📋 Raw output length:', allOutput.length);
    
    // Look for the actual transcription text
    const lines = allOutput.split('\n');
    const textLines = [];
    
    let foundTranscriptionStart = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip system messages and metadata
      if (line.includes('whisper_') || 
          line.includes('ggml_') ||
          line.includes('main: ') ||
          line.includes('output_txt:') ||
          line.includes('whisper_print_timings:') ||
          line.includes('load time') ||
          line.includes('sampling') ||
          line.startsWith('[') ||
          line.length < 3) {
        continue;
      }
      
      // Look for actual transcription content
      // Usually comes after "main: processing" line
      if (line.includes('main: processing')) {
        foundTranscriptionStart = true;
        continue;
      }
      
      if (foundTranscriptionStart && line.length > 5) {
        // This looks like transcription text
        textLines.push(line);
      }
    }
    
    let text = '';
    
    if (textLines.length > 0) {
      text = textLines.join(' ').trim();
    } else {
      // Fallback: look for any substantial text that doesn't look like system output
      const substantialLines = lines.filter(line => {
        const l = line.trim();
        return l.length > 10 && 
               !l.includes('whisper_') && 
               !l.includes('ggml_') && 
               !l.includes('main:') &&
               !l.includes('output_txt:') &&
               !l.includes('[') &&
               !l.includes('ms') &&
               !l.includes('load time') &&
               !l.includes('sample time');
      });
      
      if (substantialLines.length > 0) {
        text = substantialLines.join(' ').trim();
      }
    }
    
    // Clean up the text
    text = text
      .replace(/\[\d+:\d+:\d+\.\d+ --> \d+:\d+:\d+\.\d+\]/g, '') // Remove timestamps
      .replace(/\[BLANK_AUDIO\]/g, '') // Remove blank audio markers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (!text || text.length < 3) {
      console.error('❌ No transcription text found');
      console.log('📋 Raw stdout preview:', stdout.substring(0, 300));
      console.log('📋 Raw stderr preview:', stderr.substring(0, 300));
      
      throw new Error('No transcription text found. The audio may be empty, corrupted, or the binary failed to process it.');
    }
    
    console.log(`✅ Extracted transcription text (${text.length} characters)`);
    console.log(`📝 Preview: ${text.substring(0, 100)}...`);
    
    return {
      text,
      segments: [{ start: 0, end: 0, text }],
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