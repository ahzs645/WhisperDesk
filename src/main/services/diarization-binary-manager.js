// src/main/services/diarization-binary-manager.js - FIXED for macOS
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');
const { execAsync } = require('../utils/exec-utils');

class EnhancedDiarizationBinaryManager {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.binariesDir = this.getBinariesDirectory();
    this.modelsDir = path.join(this.binariesDir, 'models', 'diarization');
    
    // Required ONNX Runtime files per platform
    this.requiredFiles = this.getRequiredFiles();
    this.modelFiles = this.getRequiredModels();
    
    this.dependencyCheckCache = new Map();
  }

  getBinariesDirectory() {
    // Same logic as your whisper binary manager
    const projectBinaries = path.join(process.cwd(), 'binaries');
    
    if (process.env.NODE_ENV === 'development' || require('fs').existsSync(projectBinaries)) {
      return projectBinaries;
    } else {
      try {
        return path.join(process.resourcesPath, 'binaries');
      } catch (error) {
        return projectBinaries;
      }
    }
  }

  getRequiredFiles() {
    if (this.platform === 'win32') {
      return {
        dlls: [
          'onnxruntime.dll',
          'onnxruntime_providers_shared.dll'
        ],
        executable: 'diarize-cli.exe',
        all: [
          'onnxruntime.dll',
          'onnxruntime_providers_shared.dll', 
          'diarize-cli.exe'
        ]
      };
    } else if (this.platform === 'darwin') {
      // FIXED: macOS may have providers_shared statically linked
      return {
        dlls: [
          'libonnxruntime.dylib'
          // Note: libonnxruntime_providers_shared.dylib may be statically linked
        ],
        optional_dlls: [
          'libonnxruntime_providers_shared.dylib'  // Optional on macOS
        ],
        executable: 'diarize-cli',
        all: [
          'libonnxruntime.dylib',
          'diarize-cli'
        ],
        optional: [
          'libonnxruntime_providers_shared.dylib'
        ]
      };
    } else {
      return {
        dlls: [
          'libonnxruntime.so',
          'libonnxruntime_providers_shared.so'
        ],
        executable: 'diarize-cli',
        all: [
          'libonnxruntime.so',
          'libonnxruntime_providers_shared.so',
          'diarize-cli'
        ]
      };
    }
  }

  getRequiredModels() {
    return [
      {
        id: 'segmentation-3.0',
        filename: 'segmentation-3.0.onnx',
        purpose: 'speaker_segmentation',
        required: true
      },
      {
        id: 'embedding-1.0',
        filename: 'embedding-1.0.onnx',
        purpose: 'speaker_embedding',
        required: true
      }
    ];
  }

  getDiarizationBinaryPath() {
    return path.join(this.binariesDir, this.requiredFiles.executable);
  }

  getModelPath(modelId) {
    const model = this.modelFiles.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    return path.join(this.modelsDir, model.filename);
  }

  async ensureDiarizationBinary() {
    const binaryPath = this.getDiarizationBinaryPath();
    
    try {
      // Check main executable
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Diarization executable found: ${binaryPath}`);
      
      // Check all required ONNX Runtime files
      const missingFiles = [];
      for (const fileName of this.requiredFiles.all) {
        const filePath = path.join(this.binariesDir, fileName);
        try {
          await fs.access(filePath, fs.constants.F_OK);
          console.log(`✅ Found: ${fileName}`);
        } catch (error) {
          missingFiles.push(fileName);
          console.error(`❌ Missing: ${fileName}`);
        }
      }
      
      // FIXED: Check optional files (don't fail if missing on macOS)
      if (this.requiredFiles.optional) {
        for (const fileName of this.requiredFiles.optional) {
          const filePath = path.join(this.binariesDir, fileName);
          try {
            await fs.access(filePath, fs.constants.F_OK);
            console.log(`✅ Found optional: ${fileName}`);
          } catch (error) {
            console.warn(`⚠️ Missing optional: ${fileName} (may be statically linked)`);
          }
        }
      }
      
      if (missingFiles.length > 0) {
        console.error(`❌ Missing required diarization files: ${missingFiles.join(', ')}`);
        
        // FIXED: Don't fail immediately - test the binary first
        console.log('🧪 Testing binary despite missing files...');
        const testResult = await this.testDiarizationBinary();
        if (testResult.success) {
          console.log('✅ Binary works despite missing files (likely statically linked)');
          return true;
        } else {
          console.error(`❌ Binary test also failed: ${testResult.error}`);
          return false;
        }
      }
      
      // All files present - test the binary
      const testResult = await this.testDiarizationBinary();
      if (!testResult.success) {
        console.error(`❌ Diarization binary test failed: ${testResult.error}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Diarization binary verification failed: ${error.message}`);
      console.error(`💡 To fix this, run: npm run build:diarization`);
      return false;
    }
  }

  async checkRequiredModels() {
    console.log('🔍 Checking required diarization models...');
    
    try {
      await fs.mkdir(this.modelsDir, { recursive: true });
      
      const missingModels = [];
      for (const model of this.modelFiles) {
        const modelPath = path.join(this.modelsDir, model.filename);
        try {
          const stats = await fs.stat(modelPath);
          console.log(`✅ Found model: ${model.filename} (${Math.round(stats.size / 1024 / 1024)} MB)`);
        } catch (error) {
          missingModels.push(model);
          console.warn(`❌ Missing model: ${model.filename}`);
        }
      }
      
      if (missingModels.length > 0) {
        console.warn(`⚠️ Missing ${missingModels.length} diarization models`);
        console.warn('💡 Models will be downloaded automatically when needed');
        return false;
      }
      
      console.log('✅ All required diarization models found');
      return true;
    } catch (error) {
      console.error('❌ Failed to check diarization models:', error);
      return false;
    }
  }

  async testDiarizationBinary() {
    const binaryPath = this.getDiarizationBinaryPath();
    
    try {
      // Test with --help flag
      const options = {
        timeout: 10000,
        cwd: this.binariesDir  // Run from binaries directory so DLLs are found
      };
      
      const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`, options);
      
      const output = stdout + stderr;
      
      // Check for expected output
      if (output.includes('WhisperDesk Speaker Diarization CLI') || 
          output.includes('diarize-cli') ||
          output.includes('--audio') ||
          output.includes('Usage:')) {
        
        console.log('✅ Diarization binary test passed');
        return {
          success: true,
          output: output.substring(0, 200),
          binaryType: 'diarize-cli'
        };
      } else {
        return {
          success: false,
          error: 'Binary test produced unexpected output',
          output: output.substring(0, 200)
        };
      }
      
    } catch (error) {
      // FIXED: Better error messages for macOS
      let errorMessage = error.message;
      
      if (this.platform === 'darwin' && error.message.includes('dylib')) {
        if (error.message.includes('providers_shared')) {
          errorMessage = `ONNX Runtime providers_shared library issue. This may be expected on macOS if statically linked. Original error: ${error.message}`;
        } else {
          errorMessage = `ONNX Runtime library loading failed: ${error.message}`;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async performDiarization(audioPath, options = {}) {
    const {
      maxSpeakers = 10,
      threshold = 0.5,
      verbose = false,
      outputFile = null
    } = options;

    const binaryPath = this.getDiarizationBinaryPath();
    const segmentModelPath = this.getModelPath('segmentation-3.0');
    const embeddingModelPath = this.getModelPath('embedding-1.0');

    // Verify all files exist
    await this.verifyDiarizationSetup(audioPath, segmentModelPath, embeddingModelPath);

    const args = [
      '--audio', audioPath,
      '--segment-model', segmentModelPath,
      '--embedding-model', embeddingModelPath,
      '--max-speakers', maxSpeakers.toString(),
      '--threshold', threshold.toString(),
      '--output-format', 'json'
    ];

    if (verbose) {
      args.push('--verbose');
    }

    if (outputFile) {
      args.push('--output', outputFile);
    }

    console.log(`🚀 Starting diarization: ${binaryPath}`);
    console.log(`📋 Args: ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const process = spawn(binaryPath, args, {
        cwd: this.binariesDir, // Run from binaries directory for DLL loading
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // FIXED: Set library path for macOS
          ...(this.platform === 'darwin' && {
            DYLD_LIBRARY_PATH: `${this.binariesDir}:${process.env.DYLD_LIBRARY_PATH || ''}`,
            DYLD_FALLBACK_LIBRARY_PATH: this.binariesDir
          })
        }
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        
        // Parse progress if verbose
        if (verbose) {
          const progressMatch = output.match(/progress:\s*(\d+(?:\.\d+)?)%/i);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            console.log(`📊 Diarization progress: ${progress}%`);
          }
        }
      });

      process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log(`📝 diarize-cli stderr: ${output.trim()}`);
      });

      process.on('close', (code) => {
        console.log(`🏁 diarize-cli process completed with code: ${code}`);

        if (code === 0) {
          try {
            // Parse JSON output
            const result = JSON.parse(stdout);
            console.log(`✅ Diarization successful: ${result.segments?.length || 0} segments, ${result.total_speakers || 0} speakers`);
            resolve(result);
          } catch (parseError) {
            console.error('❌ Failed to parse diarization output:', parseError.message);
            reject(new Error(`Failed to parse diarization output: ${parseError.message}`));
          }
        } else {
          const errorMessage = this.buildDiarizationErrorMessage(code, stderr);
          console.error(`❌ ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      process.on('error', (error) => {
        console.error('❌ Failed to start diarize-cli process:', error.message);
        
        if (this.platform === 'win32' && error.code === 'ENOENT') {
          reject(new Error(`Failed to start diarize-cli.exe. Make sure all DLL files are present in ${this.binariesDir}`));
        } else if (this.platform === 'darwin' && error.code === 'ENOENT') {
          reject(new Error(`Failed to start diarize-cli. Make sure the binary is built and ONNX Runtime libraries are available in ${this.binariesDir}`));
        } else {
          reject(new Error(`Failed to start diarize-cli process: ${error.message}`));
        }
      });
    });
  }

  async verifyDiarizationSetup(audioPath, segmentModelPath, embeddingModelPath) {
    const filesToCheck = [
      { path: audioPath, name: 'Audio file' },
      { path: segmentModelPath, name: 'Segmentation model' },
      { path: embeddingModelPath, name: 'Embedding model' }
    ];

    for (const file of filesToCheck) {
      try {
        await fs.access(file.path, fs.constants.F_OK);
      } catch (error) {
        throw new Error(`${file.name} not found: ${file.path}`);
      }
    }
  }

  buildDiarizationErrorMessage(code, stderr) {
    if (this.platform === 'win32') {
      if (code === 3221225501 || code === -1073741515) {
        return 'ONNX Runtime DLL loading error - ensure all required DLL files are present';
      } else if (stderr.includes('onnxruntime.dll')) {
        return 'onnxruntime.dll not found or incompatible version';
      }
    } else if (this.platform === 'darwin') {
      if (stderr.includes('dylib') && stderr.includes('image not found')) {
        return 'ONNX Runtime library loading failed - ensure libonnxruntime.dylib is available or try rebuilding with static linking';
      } else if (stderr.includes('providers_shared')) {
        return 'ONNX Runtime providers library issue - this may be expected if using static linking';
      }
    }
    
    if (stderr.includes('model') && stderr.includes('not found')) {
      return 'ONNX model file not found or corrupted';
    } else if (stderr.includes('audio') && stderr.includes('format')) {
      return 'Unsupported audio format';
    } else if (stderr.includes('unknown argument') || stderr.includes('unrecognized')) {
      return 'Binary argument error - diarize-cli may be incompatible version';
    } else if (stderr.trim()) {
      return `diarize-cli error: ${stderr.trim()}`;
    } else {
      return `diarize-cli process failed with exit code ${code}`;
    }
  }

  async getStatus() {
    const status = {
      platform: this.platform,
      arch: this.arch,
      binariesDir: this.binariesDir,
      modelsDir: this.modelsDir,
      diarizeBinaryPath: this.getDiarizationBinaryPath(),
      requiredFiles: this.requiredFiles.all,
      optionalFiles: this.requiredFiles.optional || [],
      requiredModels: this.modelFiles.map(m => m.filename),
      fileStatus: {},
      modelStatus: {},
      binaryExists: false,
      binaryExecutable: false,
      modelsAvailable: false,
      testResult: null,
      recommendation: null
    };

    try {
      // Check each required file
      for (const fileName of this.requiredFiles.all) {
        const filePath = path.join(this.binariesDir, fileName);
        try {
          const stats = await fs.stat(filePath);
          status.fileStatus[fileName] = {
            exists: true,
            size: Math.round(stats.size / 1024), // Size in KB
            executable: fileName === this.requiredFiles.executable
          };
        } catch {
          status.fileStatus[fileName] = {
            exists: false,
            size: 0,
            executable: false
          };
        }
      }

      // Check optional files
      if (this.requiredFiles.optional) {
        for (const fileName of this.requiredFiles.optional) {
          const filePath = path.join(this.binariesDir, fileName);
          try {
            const stats = await fs.stat(filePath);
            status.fileStatus[fileName] = {
              exists: true,
              size: Math.round(stats.size / 1024),
              executable: false,
              optional: true
            };
          } catch {
            status.fileStatus[fileName] = {
              exists: false,
              size: 0,
              executable: false,
              optional: true
            };
          }
        }
      }

      // Check each required model
      for (const model of this.modelFiles) {
        const modelPath = path.join(this.modelsDir, model.filename);
        try {
          const stats = await fs.stat(modelPath);
          status.modelStatus[model.filename] = {
            exists: true,
            size: Math.round(stats.size / 1024 / 1024), // Size in MB
            purpose: model.purpose
          };
        } catch {
          status.modelStatus[model.filename] = {
            exists: false,
            size: 0,
            purpose: model.purpose
          };
        }
      }

      // Check main executable
      const binaryPath = this.getDiarizationBinaryPath();
      try {
        const stats = await fs.stat(binaryPath);
        status.binaryExists = true;
        status.binarySize = Math.round(stats.size / 1024);

        try {
          await fs.access(binaryPath, fs.constants.X_OK);
          status.binaryExecutable = true;
        } catch {
          status.binaryExecutable = false;
          status.recommendation = `Binary found but not executable. Run: chmod +x ${binaryPath}`;
        }
      } catch {
        status.binaryExists = false;
        status.recommendation = 'Binary not found. Build it with: npm run build:diarization';
      }

      // Check models availability
      const modelsExist = this.modelFiles.every(model => 
        status.modelStatus[model.filename]?.exists
      );
      status.modelsAvailable = modelsExist;

      if (!modelsExist) {
        const missingModels = this.modelFiles
          .filter(model => !status.modelStatus[model.filename]?.exists)
          .map(model => model.filename);
        status.recommendation = `Missing models: ${missingModels.join(', ')}. Run: npm run download:diarization-models`;
      }

      // Test binary functionality if everything looks good
      if (status.binaryExists && status.binaryExecutable) {
        status.testResult = await this.testDiarizationBinary();
        
        if (!status.testResult.success) {
          // FIXED: More specific recommendation for macOS
          if (this.platform === 'darwin' && status.testResult.error.includes('dylib')) {
            status.recommendation = 'Library loading issue on macOS. Try: npm run build:diarization with static linking';
          } else {
            status.recommendation = 'Binary exists but fails tests. Rebuild with: npm run build:diarization';
          }
        }
      }

      // Final recommendation
      if (status.binaryExists && status.binaryExecutable && 
          status.testResult?.success && status.modelsAvailable) {
        status.recommendation = 'Speaker diarization is ready to use!';
      }

    } catch (error) {
      status.recommendation = `Status check failed: ${error.message}`;
    }

    return status;
  }

  async initialize() {
    console.log('🔧 Initializing Enhanced Diarization Binary Manager...');
    console.log(`📍 Platform: ${this.platform} (${this.arch})`);
    console.log(`📁 Binaries directory: ${this.binariesDir}`);
    console.log(`📁 Models directory: ${this.modelsDir}`);

    try {
      // Ensure directories exist
      await fs.mkdir(this.binariesDir, { recursive: true });
      await fs.mkdir(this.modelsDir, { recursive: true });

      // Check binary availability
      const binaryReady = await this.ensureDiarizationBinary();
      const modelsReady = await this.checkRequiredModels();
      
      if (binaryReady && modelsReady) {
        console.log('✅ Enhanced Diarization Binary Manager initialized with working binaries and models');
        return true;
      } else if (binaryReady && !modelsReady) {
        console.warn('⚠️ Diarization binary available but models are missing');
        console.warn('💡 Models will be downloaded automatically when needed');
        return true; // Still usable, models can be downloaded later
      } else {
        console.warn('⚠️ Diarization Binary Manager initialized but binaries are not available');
        console.warn('💡 To fix this, run: npm run build:diarization');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Diarization Binary Manager:', error);
      return false;
    }
  }

  getHelpfulErrorMessage() {
    const binaryPath = this.getDiarizationBinaryPath();
    
    return {
      title: 'Speaker Diarization Not Available',
      message: `The diarization binaries were not found at: ${this.binariesDir}`,
      solutions: [
        'Run "npm run build:diarization" to build the diarization CLI',
        'Run "npm run download:diarization-models" to download required models',
        this.platform === 'darwin' 
          ? 'On macOS, ensure ONNX Runtime is available or build with static linking'
          : 'Check that ONNX Runtime dependencies are installed',
        'Restart the application after building'
      ],
      technicalInfo: {
        platform: this.platform,
        architecture: this.arch,
        executableName: this.requiredFiles.executable,
        expectedFiles: this.requiredFiles.all,
        optionalFiles: this.requiredFiles.optional || [],
        expectedModels: this.modelFiles.map(m => m.filename),
        binariesDirectory: this.binariesDir,
        modelsDirectory: this.modelsDir
      }
    };
  }
}

module.exports = EnhancedDiarizationBinaryManager;