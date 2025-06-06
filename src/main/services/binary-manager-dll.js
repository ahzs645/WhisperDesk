// src/main/services/binary-manager-dll.js - Updated for official DLL-based approach
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { execAsync } = require('../utils/exec-utils');
const { spawn } = require('child_process');

class BinaryManagerDLL {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.binariesDir = this.getBinariesDirectory();
    this.dependencyCheckCache = new Map();
    
    // Define required files for each platform
    this.requiredFiles = this.getRequiredFiles();
  }

  getBinariesDirectory() {
    // Always check project root first (for development and building)
    const projectBinaries = path.join(process.cwd(), 'binaries');
    
    // In development or when running from project directory
    if (process.env.NODE_ENV === 'development' || require('fs').existsSync(projectBinaries)) {
      return projectBinaries;
    } else {
      // Production mode - binaries in app resources
      try {
        return path.join(process.resourcesPath, 'binaries');
      } catch (error) {
        // Fallback to project root
        return projectBinaries;
      }
    }
  }

  /**
   * Get required files based on platform
   */
  getRequiredFiles() {
    if (this.platform === 'win32') {
      return {
        // Windows DLL-based files (official method)
        dlls: [
          'whisper.dll',
          'ggml.dll', 
          'ggml-base.dll',
          'ggml-cpu.dll',
          'SDL2.dll'
        ],
        executable: 'main.exe',
        all: [
          'whisper.dll',
          'ggml.dll', 
          'ggml-base.dll',
          'ggml-cpu.dll',
          'SDL2.dll',
          'main.exe'
        ]
      };
    } else {
      // macOS/Linux - use single binary (working approach)
      return {
        dlls: [],
        executable: 'whisper-cli',
        all: ['whisper-cli']
      };
    }
  }

  /**
   * Get the path to the whisper executable
   */
  getWhisperBinaryPath() {
    return path.join(this.binariesDir, this.requiredFiles.executable);
  }

  /**
   * Check if all required whisper binaries exist and are accessible
   */
  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      // Check main executable
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Main executable found: ${binaryPath}`);
      
      // Check all required files
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
      
      if (missingFiles.length > 0) {
        console.error(`❌ Missing required files: ${missingFiles.join(', ')}`);
        return false;
      }
      
      // For Windows, verify DLL dependencies
      if (this.platform === 'win32') {
        const dependencyCheck = await this.checkWindowsDLLs();
        if (!dependencyCheck.success) {
          console.warn(`⚠️ DLL dependency issues: ${dependencyCheck.error}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Binary verification failed: ${error.message}`);
      console.error(`💡 To fix this, run: npm run build:whisper`);
      return false;
    }
  }

  /**
   * Check Windows DLL dependencies
   */
  async checkWindowsDLLs() {
    if (this.platform !== 'win32') {
      return { success: true, method: 'not-windows' };
    }

    try {
      const mainExePath = this.getWhisperBinaryPath();
      
      // Use dependency walker or dumpbin if available
      let dependencyCheckResult = null;
      
      try {
        // Try using dumpbin (comes with Visual Studio)
        const { stdout } = await execAsync(`dumpbin /dependents "${mainExePath}"`, { timeout: 5000 });
        
        // Parse dependencies to ensure our DLLs are found
        const lines = stdout.split('\n');
        const dependencies = lines.filter(line => 
          line.trim().toLowerCase().includes('.dll')
        );
        
        // Check if our DLLs are properly referenced
        const ourDlls = this.requiredFiles.dlls;
        const missingDependencies = ourDlls.filter(dll => {
          const dllPath = path.join(this.binariesDir, dll);
          return !require('fs').existsSync(dllPath);
        });
        
        if (missingDependencies.length > 0) {
          return {
            success: false,
            error: `Missing DLL files: ${missingDependencies.join(', ')}`,
            missingDlls: missingDependencies
          };
        }
        
        dependencyCheckResult = {
          success: true,
          method: 'dumpbin-check',
          dependencies: dependencies.map(d => d.trim()).filter(d => d.length > 0)
        };
        
      } catch (dumpbinError) {
        console.warn('Dumpbin not available, using basic file check');
        dependencyCheckResult = {
          success: true,
          method: 'basic-file-check',
          note: 'Could not verify dependencies with dumpbin'
        };
      }
      
      return dependencyCheckResult;
      
    } catch (error) {
      return { 
        success: false, 
        error: `Windows DLL check failed: ${error.message}` 
      };
    }
  }

  /**
   * Test binary functionality
   */
  async testBinary(binaryPath) {
    try {
      // For Windows, we need to ensure all DLLs are in PATH or same directory
      const options = {
        timeout: 10000,
        cwd: this.binariesDir  // Run from binaries directory so DLLs are found
      };
      
      // Test with --help flag
      const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`, options);
      
      const output = stdout + stderr;
      
      // Check for whisper-related keywords
      if (output.includes('whisper') || 
          output.includes('transcribe') ||
          output.includes('--model') ||
          output.includes('usage')) {
        
        return {
          success: true,
          error: null,
          output: output.substring(0, 200) // First 200 chars for logging
        };
      } else {
        return {
          success: false,
          error: 'Binary test produced unexpected output',
          output: output.substring(0, 200)
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test binary with detailed result information
   */
  async testBinaryWithResult() {
    try {
      const binaryPath = this.getWhisperBinaryPath();
      
      // Check if binary exists
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      
      // Test with --help to determine argument format
      const testResult = await this.testBinary(binaryPath);
      
      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error,
          argumentFormat: 'unknown'
        };
      }
      
      const output = testResult.output;
      
      // Determine argument format based on help output
      let argumentFormat = 'whisper-main';
      if (output.includes('--output-file') || output.includes('-of')) {
        argumentFormat = 'whisper-cli';
      } else if (output.includes('-o ') && !output.includes('--output-file')) {
        argumentFormat = 'legacy';
      }
      
      // Check for specific features
      const features = {
        hasOutputFile: output.includes('--output-file'),
        hasOutputDir: output.includes('--output-dir'),
        hasDiarize: output.includes('--diarize'),
        hasProgress: output.includes('--print-progress'),
        hasNoFallback: output.includes('--no-fallback')
      };
      
      return {
        success: true,
        argumentFormat,
        features,
        version: this.extractVersionFromHelp(output),
        buildType: this.platform === 'win32' ? 'dll-based' : 'static'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        argumentFormat: 'unknown'
      };
    }
  }

  /**
   * Extract version information from help output
   */
  extractVersionFromHelp(helpOutput) {
    const versionMatch = helpOutput.match(/version[:\s]+([0-9.]+)/i);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Get binary status with helpful guidance
   */
  async getStatus() {
    const status = {
      platform: this.platform,
      arch: this.arch,
      binariesDir: this.binariesDir,
      whisperBinaryPath: this.getWhisperBinaryPath(),
      buildType: this.platform === 'win32' ? 'dll-based' : 'static',
      requiredFiles: this.requiredFiles.all,
      fileStatus: {},
      binaryExists: false,
      binaryExecutable: false,
      testResult: null,
      dependencyCheck: null,
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
      
      // Check main executable
      const binaryPath = this.getWhisperBinaryPath();
      try {
        const stats = await fs.stat(binaryPath);
        status.binaryExists = true;
        status.binarySize = Math.round(stats.size / 1024);

        try {
          await fs.access(binaryPath, fs.constants.X_OK);
          status.binaryExecutable = true;
        } catch {
          status.binaryExecutable = false;
          status.recommendation = 'Binary found but not executable. Run: chmod +x ' + binaryPath;
        }
      } catch {
        status.binaryExists = false;
        status.recommendation = 'Binary not found. Build it with: npm run build:whisper';
      }

      // Check dependencies if binary is executable
      if (status.binaryExecutable) {
        if (this.platform === 'win32') {
          status.dependencyCheck = await this.checkWindowsDLLs();
        } else {
          status.dependencyCheck = { success: true, method: 'not-needed' };
        }
        
        if (!status.dependencyCheck.success) {
          status.recommendation = 'Binary has dependency issues. Rebuild with: npm run build:whisper';
        }
      }

      // Test binary functionality if it passes dependency checks
      if (status.dependencyCheck?.success) {
        status.testResult = await this.testBinary(binaryPath);
        
        if (!status.testResult.success) {
          status.recommendation = 'Binary exists but fails tests. Rebuild with: npm run build:whisper';
        }
      }

      // If everything is good
      if (status.binaryExists && status.binaryExecutable && 
          status.dependencyCheck?.success && status.testResult?.success) {
        status.recommendation = `Binary is ready to use! (${status.buildType})`;
      }

    } catch (error) {
      status.recommendation = `Status check failed: ${error.message}`;
    }

    return status;
  }

  /**
   * Initialize with status reporting
   */
  async initialize() {
    console.log('🔧 Initializing DLL-Compatible BinaryManager...');
    console.log(`📍 Platform: ${this.platform} (${this.arch})`);
    console.log(`📁 Binaries directory: ${this.binariesDir}`);
    console.log(`🔧 Build type: ${this.platform === 'win32' ? 'DLL-based (official)' : 'Static'}`);

    try {
      // Ensure binaries directory exists
      await fs.access(this.binariesDir);
      console.log('✅ Binaries directory exists');
    } catch (error) {
      console.warn(`📁 Creating binaries directory: ${this.binariesDir}`);
      await fs.mkdir(this.binariesDir, { recursive: true });
    }

    // Check for whisper binary
    const binaryReady = await this.ensureWhisperBinary();
    
    if (binaryReady) {
      console.log('✅ DLL-Compatible BinaryManager initialized with working binaries');
      const status = await this.getStatus();
      console.log(`📊 Build type: ${status.buildType}`);
      console.log(`📋 Required files: ${status.requiredFiles.length}`);
      return true;
    } else {
      console.warn('⚠️ BinaryManager initialized but binaries are not available');
      console.warn('💡 To fix this, run: npm run build:whisper');
      return false;
    }
  }

  /**
   * Get helpful error messages for the UI
   */
  getHelpfulErrorMessage() {
    const binaryPath = this.getWhisperBinaryPath();
    
    const buildInstructions = this.platform === 'win32' 
      ? 'Run "npm run build:whisper" to build using official DLL method'
      : 'Run "npm run build:whisper" to build the static binary';
    
    return {
      title: 'Whisper Binaries Not Available',
      message: `The whisper binaries were not found at: ${this.binariesDir}`,
      solutions: [
        buildInstructions,
        'Check that your development tools are installed',
        'Verify that the build completed successfully',
        'Restart the application after building'
      ],
      technicalInfo: {
        platform: this.platform,
        architecture: this.arch,
        buildType: this.platform === 'win32' ? 'dll-based' : 'static',
        expectedFiles: this.requiredFiles.all,
        binariesDirectory: this.binariesDir
      }
    };
  }
}

module.exports = BinaryManagerDLL;