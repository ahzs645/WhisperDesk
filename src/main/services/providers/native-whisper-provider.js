// src/main/services/providers/native-whisper-provider.js - COMPREHENSIVE FIX for argument compatibility
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
    this.binaryVersion = null; // Track detected binary version
    this.argumentStyle = 'unknown'; // 'legacy', 'new', or 'unknown'
  }

  async initialize() {
    try {
      console.log('Initializing Native Whisper Provider...');
      
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Detect binary version and argument style
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
      
      // Test with --help first
      const helpResult = await this.testBinaryCommand(['-h']);
      
      if (helpResult.success) {
        const output = helpResult.output.toLowerCase();
        
        // Detect based on help output
        if (output.includes('--timestamps') || output.includes('--output-dir')) {
          this.argumentStyle = 'new';
          console.log('✅ Detected NEW argument style (whisper-cli format)');
        } else if (output.includes('-t') && output.includes('-p') && output.includes('-m')) {
          this.argumentStyle = 'legacy';
          console.log('✅ Detected LEGACY argument style (old whisper format)');
        } else {
          // Try to detect from binary name
          const binaryName = path.basename(binaryPath).toLowerCase();
          if (binaryName.includes('whisper-cli') || binaryName.includes('whisper-cpp')) {
            this.argumentStyle = 'new';
            console.log('🔧 Assuming NEW format based on binary name');
          } else {
            this.argumentStyle = 'legacy';
            console.log('🔧 Assuming LEGACY format as fallback');
          }
        }
      } else {
        // Fallback detection based on binary name
        const binaryName = path.basename(binaryPath).toLowerCase();
        if (binaryName.includes('whisper-cli')) {
          this.argumentStyle = 'new';
        } else {
          this.argumentStyle = 'legacy';
        }
        console.log(`🔧 Binary test failed, guessing format: ${this.argumentStyle}`);
      }
      
    } catch (error) {
      console.warn('⚠️ Could not detect binary format, using legacy as fallback:', error.message);
      this.argumentStyle = 'legacy';
    }
  }

  async testBinaryCommand(args) {
    return new Promise((resolve) => {
      try {
        const binaryPath = this.binaryManager.getWhisperBinaryPath();
        const env = { ...process.env };
        const binaryDir = path.dirname(binaryPath);
        
        if (process.platform === 'win32') {
          env.PATH = `${binaryDir};${env.PATH}`;
        }
        
        const testProcess = spawn(binaryPath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: binaryDir,
          env: env,
          timeout: 10000
        });
        
        let stdout = '';
        let stderr = '';
        
        testProcess.stdout.on('data', (data) => stdout += data.toString());
        testProcess.stderr.on('data', (data) => stderr += data.toString());
        
        testProcess.on('close', (code) => {
          const output = stdout + stderr;
          resolve({
            success: code === 0 || output.length > 0,
            exitCode: code,
            output: output
          });
        });
        
        testProcess.on('error', (error) => {
          resolve({
            success: false,
            exitCode: -1,
            output: error.message
          });
        });
        
        // Timeout fallback
        setTimeout(() => {
          testProcess.kill('SIGTERM');
          resolve({
            success: false,
            exitCode: -2,
            output: 'Timeout'
          });
        }, 10000);
        
      } catch (error) {
        resolve({
          success: false,
          exitCode: -1,
          output: error.message
        });
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

  // COMPLETELY REWRITTEN: Universal argument builder with format detection
  async buildWhisperArgs(filePath, modelPath, options) {
    console.log(`🔧 Building arguments for format: ${this.argumentStyle}`);
    
    const outputFile = path.join(this.tempDir, `output-${Date.now()}.txt`);
    
    // Ensure we know the argument style
    if (this.argumentStyle === 'unknown') {
      await this.detectBinaryFormat();
    }
    
    let args = [];
    
    if (this.argumentStyle === 'new') {
      // NEW format (whisper-cli / whisper-cpp style)
      args = [
        '--model', modelPath,
        '--file', filePath,
        '--output-txt',
        '--output-file', outputFile.replace('.txt', '') // Remove .txt as it's added automatically
      ];
      
      // Language (new format)
      if (options.language && options.language !== 'auto') {
        args.push('--language', options.language);
      }
      
      // Timestamps (new format uses --word-thold for word timestamps)
      if (options.enableTimestamps) {
        args.push('--word-thold', '0.01');
      }
      
      // Threads (new format)
      const threads = Math.min(require('os').cpus().length, 8);
      args.push('--threads', threads.toString());
      
    } else {
      // LEGACY format (old whisper style)
      args = [
        '-m', modelPath,
        '-f', filePath,
        '--output-txt',
        '-of', outputFile.replace('.txt', '') // Output file prefix
      ];
      
      // Language (legacy format)
      if (options.language && options.language !== 'auto') {
        args.push('-l', options.language);
      }
      
      // Timestamps (legacy format)
      if (options.enableTimestamps) {
        args.push('-nt'); // No timestamps for cleaner output
      }
      
      // Threads (legacy format)
      const threads = Math.min(require('os').cpus().length, 8);
      args.push('-t', threads.toString());
      
      // Processors (legacy format)
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
        
        // Handle deprecation warning gracefully
        if (stderr.includes('deprecated')) {
          console.log('ℹ️ Whisper binary shows deprecation warning (this is normal for newer versions)');
        }
        
        // Look for progress indicators
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
        
        if (code === 0 || (code === 1 && (stdout.length > 0 || stderr.includes('deprecated')))) {
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
          
          // Handle Windows-specific errors
          if (process.platform === 'win32') {
            if (code === 3221225501 || code === -1073741795) {
              errorMessage = 'Whisper binary crashed due to missing dependencies. Please install Visual C++ Redistributable or check binary compatibility.';
            } else if (code === 3221225781 || code === -1073741515) {
              errorMessage = 'Missing Visual C++ runtime libraries. Please install vc_redist.x64.exe from the application folder.';
            }
          }
          
          // Handle other common errors
          if (code === 1 && stderr.includes('deprecated')) {
            // Try to extract useful output even with deprecation warning
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
            errorMessage = 'Whisper binary shows deprecation warning. The binary may be outdated.';
          } else if (code === 1) {
            errorMessage = 'Whisper failed - likely due to invalid input file, unsupported format, or missing model';
          } else if (code === 2) {
            errorMessage = 'Whisper failed - model file not found or corrupted';
          } else if (code === 126) {
            errorMessage = 'Whisper binary not executable - permission denied';
          } else if (code === 127) {
            errorMessage = 'Whisper binary not found or not in PATH';
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
      
      // Increased timeout for larger files
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

  // ENHANCED: Better output parsing with multiple fallback strategies
  parseWhisperOutput(stdout, stderr, args) {
    console.log('🔍 Parsing whisper output...');
    
    // Strategy 1: Try to read from expected output file
    const outputFileIndex = args.findIndex(arg => arg === '--output-file' || arg === '-of');
    if (outputFileIndex !== -1 && outputFileIndex + 1 < args.length) {
      const outputFilePrefix = args[outputFileIndex + 1];
      const outputFile = outputFilePrefix.endsWith('.txt') ? outputFilePrefix : `${outputFilePrefix}.txt`;
      
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
    
    // Strategy 2: Try to find JSON output in stdout
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed JSON output from stdout');
        return {
          text: result.text || '',
          segments: result.segments || [],
          language: result.language,
          confidence: result.confidence,
          duration: result.duration
        };
      }
    } catch (error) {
      console.warn('Failed to parse JSON output, trying text parsing');
    }
    
    // Strategy 3: Extract text from stdout/stderr
    const allOutput = stdout + '\n' + stderr;
    const lines = allOutput.split('\n').filter(line => line.trim());
    
    // Filter out whisper metadata, warnings, and progress indicators
    const textLines = lines.filter(line => {
      const l = line.toLowerCase().trim();
      return !l.includes('whisper.cpp') && 
             !l.includes('loading model') &&
             !l.includes('deprecated') &&
             !l.includes('warning') &&
             !l.includes('system_info') &&
             !l.includes('sampling') &&
             !l.includes('compute_type') &&
             !l.includes('processing') &&
             !l.includes('file size') &&
             !l.includes('ms') &&
             !l.startsWith('[') && 
             !l.startsWith('usage:') &&
             !l.startsWith('options:') &&
             !l.includes('=') &&
             line.trim().length > 3; // Ignore very short lines
    });
    
    // Strategy 4: Look for lines that look like transcription text
    const transcriptionLines = textLines.filter(line => {
      // Look for lines that contain actual words (not just numbers or symbols)
      const wordCount = line.split(/\s+/).filter(word => /[a-zA-Z]{2,}/.test(word)).length;
      return wordCount >= 2; // At least 2 real words
    });
    
    let text = '';
    if (transcriptionLines.length > 0) {
      text = transcriptionLines.join(' ').trim();
    } else if (textLines.length > 0) {
      // Fallback to any text lines
      text = textLines.join(' ').trim();
    }
    
    // Clean up common whisper artifacts
    text = text
      .replace(/\[\d+:\d+:\d+\.\d+ --> \d+:\d+:\d+\.\d+\]/g, '') // Remove timestamp markers
      .replace(/\[BLANK_AUDIO\]/g, '') // Remove blank audio markers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (!text || text.length < 3) {
      console.error('❌ No valid transcription text found');
      console.log('📋 Debug info:');
      console.log('  stdout lines:', stdout.split('\n').length);
      console.log('  stderr lines:', stderr.split('\n').length);
      console.log('  filtered lines:', textLines.length);
      console.log('  transcription lines:', transcriptionLines.length);
      console.log('  sample output:', allOutput.substring(0, 500));
      
      throw new Error('No transcription text found in whisper output. The audio file may be empty, corrupted, or in an unsupported format.');
    }
    
    console.log(`✅ Extracted transcription text (${text.length} characters)`);
    
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