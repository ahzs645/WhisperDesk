// src/main/services/binary-manager.js - PRODUCTION VERSION (No runtime compilation)
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { execAsync } = require('../utils/exec-utils');
const { spawn } = require('child_process');

class BinaryManager {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.binariesDir = this.getBinariesDirectory();
    this.dependencyCheckCache = new Map();
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
   * Get the path to the whisper binary
   */
  getWhisperBinaryPath() {
    const binaryName = this.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    return path.join(this.binariesDir, binaryName);
  }

  /**
   * Check if whisper binary exists and is executable (NO AUTO-FIXING)
   */
  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Whisper binary found: ${binaryPath}`);
      
      // Check dependencies on macOS/Linux (but don't auto-fix)
      if (this.platform !== 'win32') {
        const dependencyCheck = await this.checkDependencies(binaryPath);
        if (!dependencyCheck.success) {
          console.warn(`⚠️ Dependency issues detected: ${dependencyCheck.error}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Whisper binary not found or not executable: ${binaryPath}`);
      console.error(`💡 To fix this, run: npm run build:whisper`);
      return false;
    }
  }

  /**
   * Check binary dependencies (READ-ONLY, no auto-fixing)
   */
  async checkDependencies(binaryPath) {
    const cacheKey = `${binaryPath}-${await this.getFileHash(binaryPath)}`;
    
    if (this.dependencyCheckCache.has(cacheKey)) {
      return this.dependencyCheckCache.get(cacheKey);
    }

    try {
      if (this.platform === 'darwin') {
        return await this.checkMacOSDependencies(binaryPath);
      } else if (this.platform === 'linux') {
        return await this.checkLinuxDependencies(binaryPath);
      }
      
      return { success: true, method: 'not-needed' };
    } catch (error) {
      const result = { success: false, error: error.message };
      this.dependencyCheckCache.set(cacheKey, result);
      return result;
    }
  }

  /**
   * Check macOS binary dependencies using otool (READ-ONLY)
   */
  async checkMacOSDependencies(binaryPath) {
    try {
      const { stdout } = await execAsync(`otool -L "${binaryPath}"`, { timeout: 5000 });
      
      // Look for problematic rpath dependencies
      const lines = stdout.split('\n');
      const problemDeps = lines.filter(line => 
        line.includes('@rpath/libwhisper') || 
        line.includes('@rpath/libggml') ||
        line.includes('/private/tmp/whisper-build/') ||
        line.includes('/tmp/whisper-build/')
      );

      if (problemDeps.length > 0) {
        console.log(`🔍 Found problematic dependencies:`, problemDeps);
        return { 
          success: false, 
          error: 'Dynamic linking with missing libraries. Rebuild with: npm run build:whisper',
          problematicDeps: problemDeps,
          linkingType: 'dynamic'
        };
      }

      return { 
        success: true, 
        method: 'dependencies-ok',
        linkingType: 'static'
      };

    } catch (error) {
      return { success: false, error: `Dependency check failed: ${error.message}` };
    }
  }

  /**
   * Check Linux binary dependencies using ldd (READ-ONLY)
   */
  async checkLinuxDependencies(binaryPath) {
    try {
      const { stdout } = await execAsync(`ldd "${binaryPath}"`, { timeout: 5000 });
      
      // Look for "not found" dependencies
      const missingDeps = stdout.split('\n').filter(line => 
        line.includes('not found') || line.includes('=> not found')
      );

      if (missingDeps.length > 0) {
        return { 
          success: false, 
          error: 'Missing shared libraries. Rebuild with: npm run build:whisper',
          missingDeps: missingDeps
        };
      }

      return { success: true, method: 'all-dependencies-found' };

    } catch (error) {
      // If ldd fails, binary might be statically linked (which is good)
      if (error.message.includes('not a dynamic executable')) {
        return { success: true, method: 'static-linking' };
      }
      
      return { success: false, error: `Dependency check failed: ${error.message}` };
    }
  }

  /**
   * Test binary functionality (READ-ONLY)
   */
  async testBinary(binaryPath) {
    try {
      // Make sure it's executable
      await fs.chmod(binaryPath, 0o755);
      
      // Test with --help flag
      const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`, {
        timeout: 10000
      });
      
      const output = stdout + stderr;
      
      // Check for whisper-related keywords
      if (output.includes('whisper') || 
          output.includes('transcribe') ||
          output.includes('--model') ||
          output.includes('usage')) {
        
        return {
          success: true,
          error: null
        };
      } else {
        return {
          success: false,
          error: 'Binary test produced unexpected output'
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
      const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`, {
        timeout: 10000
      });
      
      const output = stdout + stderr;
      
      // Determine argument format based on help output
      let argumentFormat = 'whisper-cli';
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
        version: this.extractVersionFromHelp(output)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        argumentFormat: 'whisper-cli' // Default fallback
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
   * Get file hash for caching
   */
  async getFileHash(filePath) {
    try {
      const crypto = require('crypto');
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 16);
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get binary status with helpful guidance (NO AUTO-FIXING)
   */
  async getStatus() {
    const status = {
      platform: this.platform,
      arch: this.arch,
      binariesDir: this.binariesDir,
      whisperBinaryPath: this.getWhisperBinaryPath(),
      binaryExists: false,
      binaryExecutable: false,
      binarySize: 0,
      testResult: null,
      dependencyCheck: null,
      recommendation: null
    };

    try {
      // Check if binary exists
      const binaryPath = this.getWhisperBinaryPath();
      const stats = await fs.stat(binaryPath);
      status.binaryExists = true;
      status.binarySize = Math.round(stats.size / 1024); // Size in KB

      // Check if executable
      try {
        await fs.access(binaryPath, fs.constants.X_OK);
        status.binaryExecutable = true;
      } catch {
        status.binaryExecutable = false;
        status.recommendation = 'Binary found but not executable. Run: chmod +x ' + binaryPath;
      }

      // Check dependencies
      if (status.binaryExecutable) {
        status.dependencyCheck = await this.checkDependencies(binaryPath);
        
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
        status.recommendation = 'Binary is ready to use!';
      }

    } catch (error) {
      // Binary doesn't exist
      status.binaryExists = false;
      status.recommendation = 'Binary not found. Build it with: npm run build:whisper';
    }

    return status;
  }

  /**
   * Initialize with status reporting (NO AUTO-FIXING)
   */
  async initialize() {
    console.log('🔧 Initializing Production BinaryManager...');
    console.log(`📍 Platform: ${this.platform} (${this.arch})`);
    console.log(`📁 Binaries directory: ${this.binariesDir}`);

    try {
      // Ensure binaries directory exists
      await fs.access(this.binariesDir);
      console.log('✅ Binaries directory exists');
    } catch (error) {
      console.warn(`📁 Creating binaries directory: ${this.binariesDir}`);
      await fs.mkdir(this.binariesDir, { recursive: true });
    }

    // Check for whisper binary (NO AUTO-FIXING)
    const binaryReady = await this.ensureWhisperBinary();
    
    if (binaryReady) {
      console.log('✅ Production BinaryManager initialized with working binary');
      return true;
    } else {
      console.warn('⚠️ BinaryManager initialized but binary is not available');
      console.warn('💡 To fix this, run: npm run build:whisper');
      return false; // Return false but don't crash
    }
  }

  /**
   * Get helpful error messages for the UI
   */
  getHelpfulErrorMessage() {
    const binaryPath = this.getWhisperBinaryPath();
    
    return {
      title: 'Whisper Binary Not Available',
      message: `The whisper.cpp binary was not found at: ${binaryPath}`,
      solutions: [
        'Run "npm run build:whisper" to build the binary',
        'Check that your development tools are installed (Xcode Command Line Tools on macOS)',
        'Verify that the build completed successfully',
        'Restart the application after building'
      ],
      technicalInfo: {
        platform: this.platform,
        architecture: this.arch,
        expectedPath: binaryPath,
        binariesDirectory: this.binariesDir
      }
    };
  }
}

module.exports = BinaryManager;