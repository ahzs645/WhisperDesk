// src/main/services/diarization-binary-manager.js - ENHANCED for cross-platform reliability
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
    
    // FIXED: Comprehensive library requirements per platform
    this.requiredFiles = this.getRequiredFiles();
    this.modelFiles = this.getRequiredModels();
    
    this.dependencyCheckCache = new Map();
  }

  getBinariesDirectory() {
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
        executable: 'diarize-cli.exe',
        required: [
          'diarize-cli.exe',
          'onnxruntime.dll',
        ],
        optional: [
          'onnxruntime_providers_shared.dll'
        ],
        all: [
          'diarize-cli.exe',
          'onnxruntime.dll',
          'onnxruntime_providers_shared.dll'
        ]
      };
    } else if (this.platform === 'darwin') {
      return {
        executable: 'diarize-cli',
        required: [
          'diarize-cli'
        ],
        // FIXED: More flexible library detection for macOS
        optional: [
          'libonnxruntime.dylib',
          'libonnxruntime.1.16.3.dylib',
          'libonnxruntime_providers_shared.dylib'
        ],
        all: [
          'diarize-cli',
          'libonnxruntime.dylib'
        ]
      };
    } else {
      return {
        executable: 'diarize-cli',
        required: [
          'diarize-cli',
          'libonnxruntime.so'
        ],
        optional: [
          'libonnxruntime_providers_shared.so'
        ],
        all: [
          'diarize-cli',
          'libonnxruntime.so',
          'libonnxruntime_providers_shared.so'
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
        required: true,
        minSize: 5000000 // 5MB minimum
      },
      {
        id: 'embedding-1.0',
        filename: 'embedding-1.0.onnx',
        purpose: 'speaker_embedding',
        required: true,
        minSize: 15000000 // 15MB minimum
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

  // ENHANCED: Better library detection across platforms
  async findONNXRuntimeLibraries() {
    const libraries = {
      found: [],
      missing: [],
      primary: null
    };

    // Check for primary ONNX Runtime library
    const candidates = this.platform === 'darwin' 
      ? [
          'libonnxruntime.dylib',
          'libonnxruntime.1.16.3.dylib'
        ]
      : this.platform === 'win32'
      ? ['onnxruntime.dll']
      : ['libonnxruntime.so', 'libonnxruntime.so.1.16.3'];

    for (const libName of candidates) {
      const libPath = path.join(this.binariesDir, libName);
      try {
        await fs.access(libPath, fs.constants.F_OK);
        libraries.found.push(libName);
        if (!libraries.primary) {
          libraries.primary = libName;
        }
      } catch (error) {
        // Library not found
      }
    }

    // Check optional libraries
    for (const libName of this.requiredFiles.optional || []) {
      const libPath = path.join(this.binariesDir, libName);
      try {
        await fs.access(libPath, fs.constants.F_OK);
        libraries.found.push(libName);
      } catch (error) {
        libraries.missing.push(libName);
      }
    }

    return libraries;
  }

  async ensureDiarizationBinary() {
    const binaryPath = this.getDiarizationBinaryPath();
    
    try {
      console.log('🔍 Checking diarization binary setup...');
      
      // Check main executable
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Diarization executable found: ${binaryPath}`);
      
      // ENHANCED: Cross-platform library verification
      const libraries = await this.findONNXRuntimeLibraries();
      
      if (libraries.primary) {
        console.log(`✅ Found primary ONNX Runtime library: ${libraries.primary}`);
        
        if (libraries.found.length > 1) {
          console.log(`✅ Additional libraries: ${libraries.found.filter(f => f !== libraries.primary).join(', ')}`);
        }
        
        if (libraries.missing.length > 0) {
          console.log(`ℹ️ Optional libraries not found: ${libraries.missing.join(', ')} (this may be normal)`);
        }
      } else {
        console.error('❌ No ONNX Runtime library found');
        console.error('💡 Expected libraries:', this.requiredFiles.optional.join(', '));
        return false;
      }
      
      // Test the binary functionality
      const testResult = await this.testDiarizationBinary();
      if (!testResult.success) {
        console.error(`❌ Diarization binary test failed: ${testResult.error}`);
        return false;
      }
      
      console.log('✅ Diarization binary verification complete');
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
          
          // Verify model size
          if (stats.size < model.minSize) {
            console.warn(`⚠️ Model ${model.filename} is too small (${Math.round(stats.size / 1024 / 1024)}MB, expected >${Math.round(model.minSize / 1024 / 1024)}MB)`);
            missingModels.push(model);
          } else {
            console.log(`✅ Found model: ${model.filename} (${Math.round(stats.size / 1024 / 1024)} MB)`);
          }
        } catch (error) {
          missingModels.push(model);
          console.warn(`❌ Missing model: ${model.filename}`);
        }
      }
      
      if (missingModels.length > 0) {
        console.warn(`⚠️ Missing ${missingModels.length} diarization models`);
        console.warn('💡 Run: npm run build:diarization to download models');
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
      console.log('🧪 Testing diarization binary...');
      
      const options = {
        timeout: 10000,
        cwd: this.binariesDir,
        env: {
          ...process.env,
          // ENHANCED: Platform-specific environment setup
          ...(this.platform === 'darwin' && {
            DYLD_LIBRARY_PATH: `${this.binariesDir}:${process.env.DYLD_LIBRARY_PATH || ''}`,
            DYLD_FALLBACK_LIBRARY_PATH: this.binariesDir
          }),
          ...(this.platform === 'linux' && {
            LD_LIBRARY_PATH: `${this.binariesDir}:${process.env.LD_LIBRARY_PATH || ''}`
          })
        }
      };
      
      const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`, options);
      
      const output = stdout + stderr;
      
      // Check for expected output patterns
      const expectedPatterns = [
        'WhisperDesk Speaker Diarization CLI',
        'diarize-cli',
        '--audio',
        '--segment-model',
        '--embedding-model'
      ];
      
      const foundPatterns = expectedPatterns.filter(pattern => 
        output.toLowerCase().includes(pattern.toLowerCase())
      );
      
      if (foundPatterns.length >= 3) {
        console.log('✅ Diarization binary test passed');
        return {
          success: true,
          output: output.substring(0, 200),
          binaryType: 'diarize-cli',
          foundPatterns: foundPatterns.length
        };
      } else {
        return {
          success: false,
          error: `Binary test produced unexpected output (found ${foundPatterns.length}/${expectedPatterns.length} patterns)`,
          output: output.substring(0, 200)
        };
      }
      
    } catch (error) {
      console.error('❌ Binary test failed:', error.message);
      
      // ENHANCED: Platform-specific error diagnosis
      let errorMessage = error.message;
      
      if (this.platform === 'darwin' && error.message.includes('dylib')) {
        errorMessage = `macOS library loading failed: ${error.message}\n💡 Try: brew install jsoncpp || check ONNX Runtime libraries`;
      } else if (this.platform === 'win32' && error.message.includes('.dll')) {
        errorMessage = `Windows DLL loading failed: ${error.message}\n💡 Ensure all DLL files are in binaries directory`;
      } else if (this.platform === 'linux' && error.message.includes('.so')) {
        errorMessage = `Linux shared library loading failed: ${error.message}\n💡 Check LD_LIBRARY_PATH and library dependencies`;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // ENHANCED: Better diarization with aggressive multi-speaker detection
  async performDiarization(audioPath, options = {}) {
    const {
      maxSpeakers = 10,
      threshold = 0.01,  // MUCH lower default threshold
      verbose = false,  // FIXED: Set to false to get clean JSON output
      outputFile = null
    } = options;

    const binaryPath = this.getDiarizationBinaryPath();
    const segmentModelPath = this.getModelPath('segmentation-3.0');
    const embeddingModelPath = this.getModelPath('embedding-1.0');

    // Verify all files exist
    await this.verifyDiarizationSetup(audioPath, segmentModelPath, embeddingModelPath);

    // ENHANCED: More aggressive parameters for multi-speaker detection
    const args = [
      '--audio', audioPath,
      '--segment-model', segmentModelPath,
      '--embedding-model', embeddingModelPath,
      '--max-speakers', maxSpeakers.toString(),
      '--threshold', threshold.toString(),  // Very low threshold
      '--output-format', 'json'
    ];

    if (outputFile) {
      args.push('--output', outputFile);
    }

    // FIXED: Add verbose logging in our JavaScript instead
    console.log(`🚀 Starting diarization with aggressive multi-speaker detection:`);
    console.log(`   Binary: ${binaryPath}`);
    console.log(`   Audio: ${audioPath}`);
    console.log(`   Max speakers: ${maxSpeakers}`);
    console.log(`   Threshold: ${threshold} (low = more speakers detected)`);
    console.log(`   Args: ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const diarizationProcess = spawn(binaryPath, args, {
        cwd: this.binariesDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Platform-specific library paths
          ...(this.platform === 'darwin' && {
            DYLD_LIBRARY_PATH: `${this.binariesDir}:${process.env.DYLD_LIBRARY_PATH || ''}`,
            DYLD_FALLBACK_LIBRARY_PATH: this.binariesDir
          }),
          ...(this.platform === 'linux' && {
            LD_LIBRARY_PATH: `${this.binariesDir}:${process.env.LD_LIBRARY_PATH || ''}`
          })
        }
      });

      let stdout = '';
      let stderr = '';

      diarizationProcess.stdout.on('data', (data) => {
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

      diarizationProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        if (verbose) {
          console.log(`📝 diarize-cli: ${output.trim()}`);
        }
      });

      diarizationProcess.on('close', (code) => {
        console.log(`🏁 diarize-cli process completed with code: ${code}`);

        if (code === 0) {
          try {
            // ROBUST JSON EXTRACTION
            let jsonOutput = stdout.trim();
            
            // Method 1: Find the first complete JSON object
            const jsonStart = jsonOutput.indexOf('{');
            if (jsonStart === -1) {
              throw new Error('No JSON object found in output');
            }
            
            // Extract from the first { and find the matching }
            let braceCount = 0;
            let jsonEnd = -1;
            
            for (let i = jsonStart; i < jsonOutput.length; i++) {
              if (jsonOutput[i] === '{') {
                braceCount++;
              } else if (jsonOutput[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
            
            if (jsonEnd === -1) {
              throw new Error('Incomplete JSON object in output');
            }
            
            // Extract only the JSON portion
            const cleanJsonOutput = jsonOutput.substring(jsonStart, jsonEnd);
            
            console.log('🔧 Extracted clean JSON output');
            console.log('📏 JSON length:', cleanJsonOutput.length, 'characters');
            
            // Debug: Show first and last 100 chars
            console.log('🔍 JSON start:', cleanJsonOutput.substring(0, 100));
            console.log('🔍 JSON end:', cleanJsonOutput.substring(Math.max(0, cleanJsonOutput.length - 100)));
            
            const result = JSON.parse(cleanJsonOutput);
            
            // Enhanced: Validate and enhance results
            if (result.segments && Array.isArray(result.segments)) {
              console.log(`✅ Diarization successful:`);
              console.log(`   📊 ${result.segments.length} segments detected`);
              console.log(`   👥 ${result.total_speakers || result.speakers?.length || 'unknown'} speakers identified`);
              
              // Log speaker distribution for debugging
              const speakerCounts = {};
              result.segments.forEach(seg => {
                const speaker = seg.speaker_id || seg.speaker || 'unknown';
                speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
              });
              
              console.log(`   🎯 Speaker distribution:`, speakerCounts);
              
              // If only 1 speaker detected with low threshold, suggest even lower
              const speakerCount = Object.keys(speakerCounts).length;
              if (speakerCount === 1 && threshold > 0.001) {
                console.log(`   💡 Only 1 speaker detected. Try even lower threshold (0.001) for more speakers.`);
              }
              
              resolve(result);
            } else {
              reject(new Error('Invalid diarization output format - no segments found'));
            }
          } catch (parseError) {
            console.error('❌ Failed to parse diarization output:', parseError.message);
            console.error('Raw stdout length:', stdout.length);
            console.error('Raw output (first 200 chars):', stdout.substring(0, 200));
            console.error('Raw output (chars 400-600):', stdout.substring(400, 600));
            console.error('Raw output (last 200 chars):', stdout.substring(Math.max(0, stdout.length - 200)));
            
            // Try to save the raw output for debugging
            const fs = require('fs');
            const debugPath = `/tmp/diarization-debug-${Date.now()}.txt`;
            try {
              fs.writeFileSync(debugPath, stdout);
              console.error('💾 Raw output saved to:', debugPath);
            } catch (writeError) {
              console.error('Failed to save debug output:', writeError.message);
            }
            
            reject(new Error(`Failed to parse diarization output: ${parseError.message}`));
          }
        } else {
          const errorMessage = this.buildDiarizationErrorMessage(code, stderr);
          console.error(`❌ ${errorMessage}`);
          reject(new Error(errorMessage));
        }
      });

      diarizationProcess.on('error', (error) => {
        console.error('❌ Failed to start diarize-cli process:', error.message);
        reject(this.buildProcessStartError(error));
      });
    });
  }

  buildProcessStartError(error) {
    let message = `Failed to start diarize-cli process: ${error.message}`;
    
    if (this.platform === 'win32' && error.code === 'ENOENT') {
      message += `\n💡 Windows: Ensure diarize-cli.exe and all DLL files are in ${this.binariesDir}`;
    } else if (this.platform === 'darwin' && error.code === 'ENOENT') {
      message += `\n💡 macOS: Ensure diarize-cli binary is built and ONNX Runtime libraries are available`;
    } else if (this.platform === 'linux' && error.code === 'ENOENT') {
      message += `\n💡 Linux: Check binary permissions and shared library dependencies`;
    }
    
    return new Error(message);
  }

  buildDiarizationErrorMessage(code, stderr) {
    // Platform-specific error handling
    if (this.platform === 'win32') {
      if (code === 3221225501 || code === -1073741515) {
        return 'ONNX Runtime DLL loading error - ensure all required DLL files are present';
      } else if (stderr.includes('onnxruntime.dll')) {
        return 'onnxruntime.dll not found or incompatible version';
      }
    } else if (this.platform === 'darwin') {
      if (stderr.includes('dylib') && stderr.includes('image not found')) {
        return 'ONNX Runtime library loading failed - run: npm run build:diarization';
      } else if (stderr.includes('providers_shared')) {
        return 'ONNX Runtime providers library issue - this may be expected if using static linking';
      }
    }
    
    // Generic errors
    if (stderr.includes('model') && stderr.includes('not found')) {
      return 'ONNX model file not found or corrupted - run: npm run build:diarization';
    } else if (stderr.includes('audio') && stderr.includes('format')) {
      return 'Unsupported audio format';
    } else if (stderr.includes('threshold')) {
      return 'Invalid threshold value - use range 0.001 to 1.0';
    } else if (stderr.trim()) {
      return `diarize-cli error: ${stderr.trim()}`;
    } else {
      return `diarize-cli process failed with exit code ${code}`;
    }
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
        const stats = await fs.stat(file.path);
        console.log(`✅ ${file.name}: ${file.path} (${Math.round(stats.size / 1024 / 1024)}MB)`);
      } catch (error) {
        throw new Error(`${file.name} not found: ${file.path}`);
      }
    }
  }

  async getStatus() {
    const status = {
      platform: this.platform,
      arch: this.arch,
      binariesDir: this.binariesDir,
      modelsDir: this.modelsDir,
      diarizeBinaryPath: this.getDiarizationBinaryPath(),
      requiredFiles: this.requiredFiles.required,
      optionalFiles: this.requiredFiles.optional || [],
      requiredModels: this.modelFiles.map(m => m.filename),
      fileStatus: {},
      modelStatus: {},
      binaryExists: false,
      binaryExecutable: false,
      modelsAvailable: false,
      librariesFound: {},
      testResult: null,
      recommendation: null
    };

    try {
      // Check each required file
      for (const fileName of this.requiredFiles.required) {
        const filePath = path.join(this.binariesDir, fileName);
        try {
          const stats = await fs.stat(filePath);
          status.fileStatus[fileName] = {
            exists: true,
            size: Math.round(stats.size / 1024),
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

      // Check library availability
      status.librariesFound = await this.findONNXRuntimeLibraries();

      // Check models
      for (const model of this.modelFiles) {
        const modelPath = path.join(this.modelsDir, model.filename);
        try {
          const stats = await fs.stat(modelPath);
          status.modelStatus[model.filename] = {
            exists: true,
            size: Math.round(stats.size / 1024 / 1024),
            purpose: model.purpose,
            valid: stats.size >= model.minSize
          };
        } catch {
          status.modelStatus[model.filename] = {
            exists: false,
            size: 0,
            purpose: model.purpose,
            valid: false
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
        status.modelStatus[model.filename]?.exists && status.modelStatus[model.filename]?.valid
      );
      status.modelsAvailable = modelsExist;

      // Check library availability
      const librariesAvailable = status.librariesFound.primary !== null;

      if (!modelsExist) {
        const missingModels = this.modelFiles
          .filter(model => !status.modelStatus[model.filename]?.valid)
          .map(model => model.filename);
        status.recommendation = `Missing/invalid models: ${missingModels.join(', ')}. Run: npm run build:diarization`;
      } else if (!librariesAvailable) {
        status.recommendation = `Missing ONNX Runtime libraries. Run: npm run build:diarization`;
      }

      // Test binary if everything looks good
      if (status.binaryExists && status.binaryExecutable && librariesAvailable) {
        status.testResult = await this.testDiarizationBinary();
        
        if (!status.testResult.success) {
          status.recommendation = `Binary exists but fails tests: ${status.testResult.error}`;
        }
      }

      // Final recommendation
      if (status.binaryExists && status.binaryExecutable && 
          status.testResult?.success && status.modelsAvailable && librariesAvailable) {
        status.recommendation = 'Speaker diarization is ready! Use low threshold (0.001-0.01) for multi-speaker detection.';
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

      // Check binary and library availability
      const binaryReady = await this.ensureDiarizationBinary();
      const modelsReady = await this.checkRequiredModels();
      
      if (binaryReady && modelsReady) {
        console.log('✅ Enhanced Diarization Binary Manager initialized - multi-speaker detection ready!');
        console.log('💡 For best multi-speaker results, use threshold 0.001-0.01');
        return true;
      } else if (binaryReady && !modelsReady) {
        console.warn('⚠️ Diarization binary available but models are missing');
        console.warn('💡 Run: npm run build:diarization');
        return false;
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
      title: 'Multi-Speaker Diarization Not Available',
      message: `The diarization system was not found or is not working properly.`,
      solutions: [
        'Run "npm run build:diarization" to build the complete diarization system',
        'Ensure all ONNX Runtime libraries are installed for your platform',
        'Verify that the required ONNX models are downloaded',
        'Check that the binary has execute permissions (Unix systems)',
        'Restart the application after building'
      ],
      recommendations: {
        windows: 'Ensure Visual Studio C++ redistributables are installed',
        macos: 'Run: brew install jsoncpp && npm run build:diarization',
        linux: 'Install required dependencies: apt-get install libjsoncpp-dev'
      },
      technicalInfo: {
        platform: this.platform,
        architecture: this.arch,
        executableName: this.requiredFiles.executable,
        expectedFiles: this.requiredFiles.required,
        optionalFiles: this.requiredFiles.optional || [],
        expectedModels: this.modelFiles.map(m => m.filename),
        binariesDirectory: this.binariesDir,
        modelsDirectory: this.modelsDir
      },
      troubleshooting: {
        singleSpeaker: 'If only 1 speaker is detected, try threshold 0.001',
        tooManySpeakers: 'If too many speakers detected, try threshold 0.05-0.1',
        noSpeakers: 'If no speakers detected, check audio file format and models'
      }
    };
  }
}

module.exports = EnhancedDiarizationBinaryManager;