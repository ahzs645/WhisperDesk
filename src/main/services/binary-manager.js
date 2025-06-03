// src/main/services/binary-manager.js - CROSS-PLATFORM FIX
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { execAsync } = require('../utils/exec-utils');

class BinaryManager {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.binariesDir = this.getBinariesDirectory();
  }

  getBinariesDirectory() {
    if (process.env.NODE_ENV === 'development') {
      // Development mode - binaries in project root
      return path.join(process.cwd(), 'binaries');
    } else {
      // Production mode - binaries in app resources
      return path.join(process.resourcesPath, 'binaries');
    }
  }

  /**
   * Get the path to the whisper binary
   * Now consistently uses whisper-cli naming
   */
  getWhisperBinaryPath() {
    let binaryName;
    
    if (this.platform === 'win32') {
      binaryName = 'whisper-cli.exe';
    } else {
      binaryName = 'whisper-cli';
    }
    
    return path.join(this.binariesDir, binaryName);
  }

  /**
   * Check if whisper binary exists and is executable
   */
  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      console.log(`✅ Whisper binary found: ${binaryPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Whisper binary not found or not executable: ${binaryPath}`);
      console.error(`Error: ${error.message}`);
      return false;
    }
  }

  /**
   * Test the whisper binary functionality
   */
  async testBinaryWithResult() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      console.log(`🔍 Testing whisper binary: ${binaryPath}`);
      
      // Test with --help flag (safer than --version which might not exist)
      const { stdout, stderr } = await execAsync(`"${binaryPath}" --help`, {
        timeout: 10000 // 10 second timeout
      });
      
      const output = stdout + stderr;
      
      // Check for whisper-related keywords in output
      if (output.includes('whisper') || 
          output.includes('usage') || 
          output.includes('transcribe') ||
          output.includes('--model') ||
          output.includes('--file')) {
        
        console.log('✅ Whisper binary test successful');
        
        // Detect argument format for compatibility
        const argFormat = this.detectArgumentFormat(output);
        console.log(`📋 Detected argument format: ${argFormat}`);
        
        return {
          success: true,
          argumentFormat: argFormat,
          output: output.slice(0, 500) // First 500 chars for logging
        };
      } else {
        console.error('❌ Whisper binary test failed - unexpected output');
        console.error(`Output preview: ${output.slice(0, 200)}`);
        return {
          success: false,
          error: 'Unexpected output from binary',
          output
        };
      }
      
    } catch (error) {
      console.error(`❌ Whisper binary test failed: ${error.message}`);
      
      // Special handling for common Windows errors
      if (this.platform === 'win32' && error.message.includes('3221225501')) {
        return {
          success: false,
          error: 'Access violation - likely missing Visual C++ runtime',
          suggestion: 'Please install Visual C++ Redistributable (vc_redist.x64.exe)'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detect argument format from help output
   */
  detectArgumentFormat(helpOutput) {
    // Check for new whisper-cli argument format
    if (helpOutput.includes('--file') && 
        helpOutput.includes('--model') && 
        helpOutput.includes('--output-dir')) {
      return 'whisper-cli';
    }
    
    // Check for legacy argument format
    if (helpOutput.includes('-f ') && 
        helpOutput.includes('-m ') && 
        helpOutput.includes('-o ')) {
      return 'legacy';
    }
    
    // Default assumption
    return 'whisper-cli';
  }

  /**
   * Check Windows DLL dependencies
   */
  async checkWindowsDependencies() {
    if (this.platform !== 'win32') {
      return { success: true, message: 'Not Windows platform' };
    }

    const requiredDlls = [
      'ggml.dll',
      'ggml-cpu.dll', 
      'whisper.dll'
    ];

    const optionalDlls = [
      'ggml-base.dll',
      'msvcp140.dll',
      'vcruntime140.dll'
    ];

    const results = {
      required: [],
      optional: [],
      missing: [],
      vcRuntime: false
    };

    // Check required DLLs
    for (const dll of requiredDlls) {
      const dllPath = path.join(this.binariesDir, dll);
      try {
        await fs.access(dllPath);
        const stats = await fs.stat(dllPath);
        results.required.push({
          name: dll,
          size: Math.round(stats.size / 1024),
          found: true
        });
      } catch {
        results.missing.push(dll);
      }
    }

    // Check optional DLLs
    for (const dll of optionalDlls) {
      const dllPath = path.join(this.binariesDir, dll);
      try {
        await fs.access(dllPath);
        const stats = await fs.stat(dllPath);
        results.optional.push({
          name: dll,
          size: Math.round(stats.size / 1024),
          found: true
        });
        
        // Track VC++ runtime
        if (dll.includes('msvcp140') || dll.includes('vcruntime140')) {
          results.vcRuntime = true;
        }
      } catch {
        // Optional DLLs missing is not an error
      }
    }

    console.log(`📋 Required DLLs found: ${results.required.length}/${requiredDlls.length}`);
    console.log(`📋 Optional DLLs found: ${results.optional.length}`);
    
    if (results.missing.length > 0) {
      console.warn(`⚠️ Missing required DLLs: ${results.missing.join(', ')}`);
    }

    return {
      success: results.missing.length === 0,
      results,
      vcRuntimeAvailable: results.vcRuntime
    };
  }

  /**
   * Get comprehensive binary status
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
      windowsDependencies: null
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

    } catch {
      status.binaryExists = false;
    }

    // Test binary functionality if it exists and is executable
    if (status.binaryExists && status.binaryExecutable) {
      status.testResult = await this.testBinaryWithResult();
    }

    // Check Windows dependencies
    if (this.platform === 'win32') {
      status.windowsDependencies = await this.checkWindowsDependencies();
    }

    return status;
  }

  /**
   * Initialize the binary manager
   */
  async initialize() {
    console.log('🔧 Initializing BinaryManager...');
    console.log(`📍 Platform: ${this.platform} (${this.arch})`);
    console.log(`📁 Binaries directory: ${this.binariesDir}`);
    console.log(`🔍 Looking for: ${path.basename(this.getWhisperBinaryPath())}`);

    try {
      // Ensure binaries directory exists
      await fs.access(this.binariesDir);
      console.log('✅ Binaries directory exists');
    } catch (error) {
      console.error('❌ Binaries directory not found:', this.binariesDir);
      throw new Error(`Binaries directory not found: ${this.binariesDir}`);
    }

    // Check for whisper binary
    const binaryExists = await this.ensureWhisperBinary();
    if (!binaryExists) {
      throw new Error('Whisper binary not found or not executable');
    }

    // Test binary functionality
    const testResult = await this.testBinaryWithResult();
    if (!testResult.success) {
      console.warn('⚠️ Whisper binary test failed:', testResult.error);
      if (testResult.suggestion) {
        console.warn('💡 Suggestion:', testResult.suggestion);
      }
      // Don't throw here - let the app handle the failed test gracefully
    }

    // Check Windows-specific dependencies
    if (this.platform === 'win32') {
      const depsCheck = await this.checkWindowsDependencies();
      if (!depsCheck.success) {
        console.warn('⚠️ Some Windows dependencies are missing');
      }
    }

    console.log('✅ BinaryManager initialized successfully');
    return true;
  }
}

module.exports = BinaryManager;