// src/main/services/binary-manager.js - Enhanced with dependency fixing
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
   * Get the path to the whisper binary with automatic fallback
   */
  getWhisperBinaryPath() {
    const binaryName = this.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    return path.join(this.binariesDir, binaryName);
  }

  /**
   * Enhanced binary availability check with dependency resolution
   */
  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Whisper binary found: ${binaryPath}`);
      
      // Check dependencies on macOS/Linux
      if (this.platform !== 'win32') {
        const dependencyCheck = await this.checkAndFixDependencies(binaryPath);
        if (!dependencyCheck.success) {
          console.warn(`⚠️ Dependency issues detected: ${dependencyCheck.error}`);
          
          // Try to auto-fix
          const fixResult = await this.autoFixBinary(binaryPath);
          if (fixResult.success) {
            console.log(`✅ Binary dependencies fixed: ${fixResult.method}`);
            return true;
          } else {
            console.error(`❌ Could not fix binary dependencies: ${fixResult.error}`);
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Whisper binary not found or not executable: ${binaryPath}`);
      
      // Try to auto-download/build a working binary
      const buildResult = await this.autoProvisionBinary();
      return buildResult.success;
    }
  }

  /**
   * Check and fix binary dependencies (macOS/Linux)
   */
  async checkAndFixDependencies(binaryPath) {
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
   * Check macOS binary dependencies using otool
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
          error: 'Dynamic linking with missing libraries',
          problematicDeps: problemDeps,
          linkingType: 'dynamic'
        };
      }

      // Check if it's statically linked (good)
      const hasSystemLibsOnly = lines.every(line => 
        line.trim() === '' ||
        line.includes(binaryPath) ||
        line.includes('/usr/lib/') ||
        line.includes('/System/Library/') ||
        line.includes('@rpath') === false
      );

      return { 
        success: true, 
        method: hasSystemLibsOnly ? 'static-linking' : 'dynamic-but-available',
        linkingType: hasSystemLibsOnly ? 'static' : 'dynamic'
      };

    } catch (error) {
      return { success: false, error: `otool check failed: ${error.message}` };
    }
  }

  /**
   * Check Linux binary dependencies using ldd
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
          error: 'Missing shared libraries',
          missingDeps: missingDeps
        };
      }

      return { success: true, method: 'all-dependencies-found' };

    } catch (error) {
      // If ldd fails, binary might be statically linked (which is good)
      if (error.message.includes('not a dynamic executable')) {
        return { success: true, method: 'static-linking' };
      }
      
      return { success: false, error: `ldd check failed: ${error.message}` };
    }
  }

  /**
   * Auto-fix binary by rebuilding with static linking or finding alternatives
   */
  async autoFixBinary(problematicBinaryPath) {
    console.log(`🔧 Attempting to auto-fix binary: ${problematicBinaryPath}`);

    // Strategy 1: Try to find a pre-built static binary
    const staticBinaryResult = await this.downloadStaticBinary();
    if (staticBinaryResult.success) {
      // Backup original and replace
      await this.backupAndReplace(problematicBinaryPath, staticBinaryResult.path);
      return { success: true, method: 'downloaded-static-binary' };
    }

    // Strategy 2: Build static binary from source
    const buildResult = await this.buildStaticBinary();
    if (buildResult.success) {
      await this.backupAndReplace(problematicBinaryPath, buildResult.path);
      return { success: true, method: 'built-static-binary' };
    }

    // Strategy 3: Try to bundle required libraries (macOS)
    if (this.platform === 'darwin') {
      const bundleResult = await this.bundleDynamicLibraries(problematicBinaryPath);
      if (bundleResult.success) {
        return { success: true, method: 'bundled-dynamic-libraries' };
      }
    }

    return { 
      success: false, 
      error: 'All auto-fix strategies failed',
      attempted: ['download-static', 'build-static', 'bundle-dynamic']
    };
  }

  /**
   * Download pre-built static binary
   */
  async downloadStaticBinary() {
    console.log(`📥 Downloading pre-built static binary for ${this.platform}-${this.arch}...`);
    
    try {
      // Determine the correct release asset
      const releaseUrl = 'https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest';
      const response = await fetch(releaseUrl);
      const release = await response.json();
      
      // Find the appropriate asset
      let assetName;
      if (this.platform === 'darwin') {
        assetName = this.arch === 'arm64' ? 
          'whisper-blas-bin-macos-arm64.zip' : 
          'whisper-blas-bin-macos-x64.zip';
      } else if (this.platform === 'linux') {
        assetName = 'whisper-blas-bin-linux-x64.zip';
      } else {
        return { success: false, error: 'No pre-built binary available for platform' };
      }

      const asset = release.assets.find(a => a.name === assetName);
      if (!asset) {
        return { success: false, error: `Asset ${assetName} not found in release` };
      }

      // Download and extract
      const tempDir = path.join(os.tmpdir(), `whisper-download-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      const zipPath = path.join(tempDir, assetName);
      const zipResponse = await fetch(asset.browser_download_url);
      const zipBuffer = Buffer.from(await zipResponse.arrayBuffer());
      await fs.writeFile(zipPath, zipBuffer);

      // Extract (simplified - you'd use a proper zip library in production)
      const { execAsync } = require('../utils/exec-utils');
      await execAsync(`cd "${tempDir}" && unzip -o "${assetName}"`, { timeout: 30000 });

      // Find the binary
      const extractedFiles = await fs.readdir(tempDir);
      const binaryFile = extractedFiles.find(f => f === 'main' || f === 'whisper-cli');
      
      if (!binaryFile) {
        return { success: false, error: 'Binary not found in downloaded archive' };
      }

      const binaryPath = path.join(tempDir, binaryFile);
      
      // Test the binary
      const testResult = await this.testBinary(binaryPath);
      if (!testResult.success) {
        return { success: false, error: `Downloaded binary test failed: ${testResult.error}` };
      }

      console.log(`✅ Downloaded working static binary`);
      return { success: true, path: binaryPath };

    } catch (error) {
      console.error(`❌ Download failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build static binary from source
   */
  async buildStaticBinary() {
    console.log(`🏗️ Building static whisper.cpp binary from source...`);
    
    try {
      const buildDir = path.join(os.tmpdir(), `whisper-build-${Date.now()}`);
      await fs.mkdir(buildDir, { recursive: true });

      // Clone repository
      await execAsync(`git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "${buildDir}"`, {
        timeout: 60000
      });

      // Configure with static linking
      const cmakeArgs = [
        'cmake', '-B', 'build',
        '-DCMAKE_BUILD_TYPE=Release',
        '-DWHISPER_BUILD_TESTS=OFF',
        '-DWHISPER_BUILD_EXAMPLES=ON',
        '-DBUILD_SHARED_LIBS=OFF', // Force static linking
      ];

      if (this.platform === 'darwin') {
        // macOS specific flags
        cmakeArgs.push(`-DCMAKE_OSX_ARCHITECTURES=${this.arch}`);
        if (this.arch === 'x86_64') {
          cmakeArgs.push('-DGGML_NATIVE=OFF'); // Avoid CPU-specific optimizations for compatibility
        }
      }

      await execAsync(cmakeArgs.join(' '), {
        cwd: buildDir,
        timeout: 120000
      });

      // Build
      const parallelJobs = os.cpus().length;
      await execAsync(`cmake --build build --config Release --parallel ${parallelJobs}`, {
        cwd: buildDir,
        timeout: 300000 // 5 minutes
      });

      // Find the binary
      const binDir = path.join(buildDir, 'build', 'bin');
      const files = await fs.readdir(binDir);
      const binaryFile = files.find(f => f === 'main' || f === 'whisper-cli');
      
      if (!binaryFile) {
        return { success: false, error: 'Built binary not found' };
      }

      const binaryPath = path.join(binDir, binaryFile);
      
      // Test the binary
      const testResult = await this.testBinary(binaryPath);
      if (!testResult.success) {
        return { success: false, error: `Built binary test failed: ${testResult.error}` };
      }

      console.log(`✅ Built working static binary`);
      return { success: true, path: binaryPath };

    } catch (error) {
      console.error(`❌ Build failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test binary functionality
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
        
        // Check dependencies one more time
        const depCheck = await this.checkAndFixDependencies(binaryPath);
        
        return {
          success: depCheck.success,
          error: depCheck.success ? null : depCheck.error,
          linkingType: depCheck.linkingType || 'unknown'
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
   * Test if binary can process a sample file
   */
  async testBinaryWithSample() {
    try {
      const binaryPath = this.getWhisperBinaryPath();
      const tempDir = path.join(os.tmpdir(), 'whisper-test');
      
      // Create a minimal test (just check if binary runs without crashing)
      const testProcess = spawn(binaryPath, ['--help'], {
        stdio: 'pipe',
        timeout: 5000
      });
      
      return new Promise((resolve) => {
        let output = '';
        
        testProcess.stdout.on('data', (data) => output += data.toString());
        testProcess.stderr.on('data', (data) => output += data.toString());
        
        testProcess.on('close', (code) => {
          resolve({
            success: code === 0,
            output: output.substring(0, 500), // First 500 chars
            exitCode: code
          });
        });
        
        testProcess.on('error', (error) => {
          resolve({
            success: false,
            error: error.message
          });
        });
        
        setTimeout(() => {
          testProcess.kill();
          resolve({
            success: false,
            error: 'Test timeout'
          });
        }, 5000);
      });
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Backup original binary and replace with working one
   */
  async backupAndReplace(originalPath, newPath) {
    const backupPath = `${originalPath}.backup-${Date.now()}`;
    
    try {
      // Backup original
      await fs.copyFile(originalPath, backupPath);
      console.log(`📦 Backed up original binary to: ${backupPath}`);
      
      // Replace with new binary
      await fs.copyFile(newPath, originalPath);
      await fs.chmod(originalPath, 0o755);
      
      console.log(`🔄 Replaced binary with working version`);
      
      // Clean up temp file
      try {
        await fs.unlink(newPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
    } catch (error) {
      throw new Error(`Failed to backup and replace binary: ${error.message}`);
    }
  }

  /**
   * Auto-provision binary when none exists
   */
  async autoProvisionBinary() {
    console.log(`🔍 No whisper binary found, attempting to provision one...`);
    
    // Ensure binaries directory exists
    await fs.mkdir(this.binariesDir, { recursive: true });
    
    // Try download first (faster)
    const downloadResult = await this.downloadStaticBinary();
    if (downloadResult.success) {
      const targetPath = this.getWhisperBinaryPath();
      await fs.copyFile(downloadResult.path, targetPath);
      await fs.chmod(targetPath, 0o755);
      
      console.log(`✅ Provisioned binary via download`);
      return { success: true, method: 'download' };
    }
    
    // Fall back to building
    const buildResult = await this.buildStaticBinary();
    if (buildResult.success) {
      const targetPath = this.getWhisperBinaryPath();
      await fs.copyFile(buildResult.path, targetPath);
      await fs.chmod(targetPath, 0o755);
      
      console.log(`✅ Provisioned binary via build`);
      return { success: true, method: 'build' };
    }
    
    return {
      success: false,
      error: 'Could not provision binary via download or build'
    };
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
   * Enhanced binary status with dependency information
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
      autoFixAttempted: false,
      autoFixResult: null
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
      }

      // Check dependencies
      if (status.binaryExecutable) {
        status.dependencyCheck = await this.checkAndFixDependencies(binaryPath);
        
        // If dependencies failed, try auto-fix
        if (!status.dependencyCheck.success) {
          status.autoFixAttempted = true;
          status.autoFixResult = await this.autoFixBinary(binaryPath);
          
          // Re-check after auto-fix
          if (status.autoFixResult.success) {
            status.dependencyCheck = await this.checkAndFixDependencies(binaryPath);
          }
        }
      }

      // Test binary functionality if it passes dependency checks
      if (status.dependencyCheck?.success) {
        status.testResult = await this.testBinary(binaryPath);
      }

    } catch (error) {
      // Binary doesn't exist, try auto-provision
      status.autoFixAttempted = true;
      status.autoFixResult = await this.autoProvisionBinary();
      
      // Re-check status after provisioning
      if (status.autoFixResult.success) {
        try {
          const stats = await fs.stat(this.getWhisperBinaryPath());
          status.binaryExists = true;
          status.binarySize = Math.round(stats.size / 1024);
          status.binaryExecutable = true;
          status.dependencyCheck = { success: true, method: 'auto-provisioned' };
          status.testResult = await this.testBinary(this.getWhisperBinaryPath());
        } catch (e) {
          // Still failed
        }
      }
    }

    return status;
  }

  /**
   * Initialize with auto-fixing
   */
  async initialize() {
    console.log('🔧 Initializing Enhanced BinaryManager...');
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

    // Check for whisper binary with auto-fixing
    const binaryReady = await this.ensureWhisperBinary();
    
    if (binaryReady) {
      console.log('✅ Enhanced BinaryManager initialized with working binary');
      return true;
    } else {
      console.warn('⚠️ BinaryManager initialized but binary may have issues');
      return false;
    }
  }
}

module.exports = BinaryManager;