// src/main/services/providers/native-whisper-provider.js - FIXED BINARY DETECTION
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
    this.binaryVersion = null;
    this.argumentStyle = 'unknown'; // Will be detected through actual testing
  }

  async initialize() {
    try {
      console.log('Initializing Native Whisper Provider...');
      
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // FIXED: More accurate binary format detection
      await this.detectBinaryFormatAccurate();
      
      this.available = await this.checkAvailability();
      
      if (this.available) {
        console.log('✅ Native Whisper provider available');
        console.log(`🔧 Binary format: ${this.argumentStyle}`);
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

  // COMPLETELY REWRITTEN: Accurate format detection through actual argument testing
  async detectBinaryFormatAccurate() {
    try {
      const binaryPath = this.binaryManager.getWhisperBinaryPath();
      console.log(`🔍 Accurately detecting binary format for: ${binaryPath}`);
      
      // Test specific arguments to determine actual support
      const newFormatSupported = await this.testSpecificArguments(['--help', '--model']);
      const legacyFormatSupported = await this.testSpecificArguments(['-h', '-m']);
      
      console.log(`🧪 New format test result: ${newFormatSupported}`);
      console.log(`🧪 Legacy format test result: ${legacyFormatSupported}`);
      
      // Test actual transcription arguments to be sure
      if (newFormatSupported) {
        const newArgsWork = await this.testActualArguments('new');
        if (newArgsWork) {
          this.argumentStyle = 'new';
          console.log('✅ Confirmed NEW argument format through actual testing');
          return;
        } else {
          console.log('⚠️ New format help exists but actual arguments fail');
        }
      }
      
      if (legacyFormatSupported) {
        const legacyArgsWork = await this.testActualArguments('legacy');
        if (legacyArgsWork) {
          this.argumentStyle = 'legacy';
          console.log('✅ Confirmed LEGACY argument format through actual testing');
          return;
        }
      }
      
      // Fallback: determine from binary name and path
      const binaryName = path.basename(binaryPath).toLowerCase();
      if (binaryName.includes('whisper-cli') || binaryName.includes('whisper-cpp')) {
        this.argumentStyle = 'new';
        console.log('🔧 Fallback: Assuming NEW format based on binary name');
      } else {
        this.argumentStyle = 'legacy';
        console.log('🔧 Fallback: Assuming LEGACY format based on binary name');
      }
      
    } catch (error) {
      console.warn('⚠️ Could not detect binary format, defaulting to legacy:', error.message);
      this.argumentStyle = 'legacy';
    }
  }

  // Test specific arguments without requiring a model or file
  async testSpecificArguments(args) {
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
          timeout: 5000
        });
        
        let stdout = '';
        let stderr = '';
        
        testProcess.stdout.on('data', (data) => stdout += data.toString());
        testProcess.stderr.on('data', (data) => stderr += data.toString());
        
        testProcess.on('close', (code) => {
          const output = stdout + stderr;
          
          // Success if exit code is 0 OR we get help output (even with code 1)
          const success = code === 0 || output.length > 50;
          
          console.log(`📊 Args ${args.join(' ')}: exit=${code}, output_len=${output.length}, success=${success}`);
          resolve(success);
        });
        
        testProcess.on('error', (error) => {
          console.log(`📊 Args ${args.join(' ')}: error=${error.message}`);
          resolve(false);
        });
        
        setTimeout(() => {
          testProcess.kill('SIGTERM');
          resolve(false);
        }, 5000);
        
      } catch (error) {
        resolve(false);
      }
    });
  }

  // Test actual transcription arguments with dummy values
  async testActualArguments(format) {
    return new Promise((resolve) => {
      try {
        const binaryPath = this.binaryManager.getWhisperBinaryPath();
        const env = { ...process.env };
        const binaryDir = path.dirname(binaryPath);
        
        if (process.platform === 'win32') {
          env.PATH = `${binaryDir};${env.PATH}`;
        }
        
        let args = [];
        
        if (format === 'new') {
          // Test new format with dummy model path (should fail gracefully if format is supported)
          args = ['--model', '/dummy/path', '--file', '/dummy/file'];
        } else {
          // Test legacy format with dummy model path
          args = ['-m', '/dummy/path', '-f', '/dummy/file'];
        }
        
        const testProcess = spawn(binaryPath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: binaryDir,
          env: env,
          timeout: 3000
        });
        
        let stderr = '';
        testProcess.stderr.on('data', (data) => stderr += data.toString());
        
        testProcess.on('close', (code) => {
          // If format is supported, we should get specific errors about missing files
          // rather than "unknown argument" errors
          const formatSupported = !stderr.includes('unknown argument') && 
                                 !stderr.includes('invalid option') &&
                                 !stderr.includes('unrecognized option');
          
          console.log(`📊 Testing ${format} args: exit=${code}, format_supported=${formatSupported}`);
          if (stderr.length > 0) {
            console.log(`📊 Error output: ${stderr.substring(0, 100)}...`);
          }
          
          resolve(formatSupported);
        });
        
        testProcess.on('error', (error) => {
          resolve(false);
        });
        
        setTimeout(() => {
          testProcess.kill('SIGTERM');
          resolve(false);
        }, 3000);
        
      } catch (error) {
        resolve(false);
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

  // REWRITTEN: Universal argument builder based on ACCURATE detection
  async buildWhisperArgs(filePath, modelPath, options) {
    console.log(`🔧 Building arguments for CONFIRMED format: ${this.argumentStyle}`);
    
    // Ensure we have detected the format
    if (this.argumentStyle === 'unknown') {
      await this.detectBinaryFormatAccurate();
    }
    
    let args = [];
    
    if (this.argumentStyle === 'new') {
      // NEW format (true whisper-cli / whisper-cpp)
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
        args.push('-nt'); // No timestamps to reduce clutter
      }
      
      const threads = Math.min(require('os').cpus().length, 8);
      args.push('-t', threads.toString());
      
      args.push('-p', '1'); // Single processor
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
        
        if (stderr.includes('deprecated')) {
          console.log('ℹ️ Whisper binary shows deprecation warning (this is normal)');
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
        
        // Handle different exit codes more gracefully
        if (code === 0 || (code === 1 && stdout.length > 0)) {
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
          
          // Windows-specific error handling
          if (process.platform === 'win32') {
            if (code === 3221225501 || code === -1073741795) {
              errorMessage = 'Binary crashed (access violation). The whisper.exe may be corrupted or incompatible with your system. Try downloading a fresh copy of WhisperDesk.';
            } else if (code === 3221225781 || code === -1073741515) {
              errorMessage = 'Missing Visual C++ runtime. Install vc_redist.x64.exe from the application folder.';
            }
          }
          
          // Handle argument errors
          if (stderr.includes('unknown argument') || stderr.includes('invalid option')) {
            errorMessage = `Argument format error: ${stderr.trim()}. The binary may use a different argument format than detected.`;
          } else if (code === 1 && stderr.includes('deprecated')) {
            // Try to parse output despite deprecation warning
            try {
              const result = this.parseWhisperOutput(stdout, stderr, args);
              if (result.text && result.text.trim().length > 0) {
                console.log('✅ Transcription succeeded despite deprecation warning');
                result.processingTime = processingTime;
                resolve(result);
                return;
              }
            } catch (parseError) {
              // Fall through to error
            }
            errorMessage = 'Binary shows deprecation warning and failed to produce output.';
          } else if (code === 1) {
            errorMessage = 'Transcription failed - check input file format and model availability';
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

  // Enhanced output parsing
  parseWhisperOutput(stdout, stderr, args) {
    console.log('🔍 Parsing whisper output...');
    
    // Strategy 1: Look for output files based on input filename
    try {
      const fileIndex = args.findIndex(arg => arg === '--file' || arg === '-f');
      if (fileIndex !== -1 && fileIndex + 1 < args.length) {
        const inputFile = args[fileIndex + 1];
        const baseName = path.basename(inputFile, path.extname(inputFile));
        
        // Check common output locations
        const possibleOutputFiles = [
          path.join(process.cwd(), `${baseName}.txt`),
          path.join(this.tempDir, `${baseName}.txt`),
          `${baseName}.txt`
        ];
        
        for (const outputFile of possibleOutputFiles) {
          try {
            const fs = require('fs');
            if (fs.existsSync(outputFile)) {
              const text = fs.readFileSync(outputFile, 'utf8').trim();
              if (text.length > 0) {
                console.log(`✅ Read transcription from output file: ${outputFile}`);
                
                // Clean up
                try {
                  fs.unlinkSync(outputFile);
                } catch (e) {}
                
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
      }
    } catch (error) {
      console.warn('Could not check output files:', error.message);
    }
    
    // Strategy 2: Parse from stdout/stderr
    const allOutput = stdout + '\n' + stderr;
    const lines = allOutput.split('\n').filter(line => line.trim());
    
    // Filter out metadata and system messages
    const textLines = lines.filter(line => {
      const l = line.toLowerCase().trim();
      return !l.includes('whisper.cpp') && 
             !l.includes('loading model') &&
             !l.includes('deprecated') &&
             !l.includes('warning') &&
             !l.includes('system_info') &&
             !l.includes('sampling') &&
             !l.includes('[') &&
             !l.includes('usage:') &&
             !l.includes('options:') &&
             line.trim().length > 5;
    });
    
    let text = textLines.join(' ').trim();
    
    // Clean common artifacts
    text = text
      .replace(/\[\d+:\d+:\d+\.\d+ --> \d+:\d+:\d+\.\d+\]/g, '')
      .replace(/\[BLANK_AUDIO\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!text || text.length < 3) {
      console.error('❌ No transcription text found');
      console.log('📋 Raw stdout:', stdout.substring(0, 200));
      console.log('📋 Raw stderr:', stderr.substring(0, 200));
      
      throw new Error('No transcription text found. The audio may be empty, corrupted, or the binary failed to process it.');
    }
    
    console.log(`✅ Extracted transcription text (${text.length} characters)`);
    
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