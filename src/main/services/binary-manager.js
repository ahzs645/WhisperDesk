// Updated binary-manager.js to fix the whisper binary issues

const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

class BinaryManager {
  constructor() {
    this.binariesDir = this.getBinariesDirectory();
    this.platform = os.platform();
    this.arch = os.arch();
    this.platformKey = `${this.platform}-${this.arch}`;
  }

  getBinariesDirectory() {
    // First try project directory
    const projectBinariesDir = path.join(__dirname, '../../../binaries');
    if (require('fs').existsSync(projectBinariesDir)) {
      return projectBinariesDir;
    }
    
    // Fallback to user data directory
    try {
      return path.join(app.getPath('userData'), 'binaries');
    } catch (error) {
      // Fallback for when app is not ready
      const userDataPath = path.join(os.homedir(), '.whisperdesk-enhanced', 'binaries');
      return userDataPath;
    }
  }

  async initialize() {
    try {
      await fs.mkdir(this.binariesDir, { recursive: true });
      await this.ensureWhisperBinary();
      console.log('Binary manager initialized');
    } catch (error) {
      console.error('Error initializing binary manager:', error);
      throw error;
    }
  }

  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      await fs.access(binaryPath);
      
      // Check if it's executable
      if (this.platform !== 'win32') {
        const stats = await fs.stat(binaryPath);
        if (!(stats.mode & 0o111)) {
          await fs.chmod(binaryPath, 0o755);
        }
      }
      
      // Test the binary
      await this.testBinary();
      console.log('Whisper binary found and ready');
    } catch (error) {
      console.log('Whisper binary not available. Native whisper.cpp functionality will be unavailable.');
      console.log('Note: Run the build script to compile whisper.cpp for your platform.');
      console.log('Falling back to other providers if available.');
      // Don't throw error, just log the issue
    }
  }

  getWhisperBinaryPath() {
    const binaryNames = {
      'win32-x64': 'whisper.exe',
      'win32-ia32': 'whisper.exe',
      'darwin-x64': 'whisper',
      'darwin-arm64': 'whisper',
      'linux-x64': 'whisper',
      'linux-arm64': 'whisper',
      'linux-arm': 'whisper'
    };

    const binaryName = binaryNames[this.platformKey] || 'whisper';
    return path.join(this.binariesDir, binaryName);
  }

  async testBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    return new Promise((resolve, reject) => {
      // Use --help instead of --version as it's more reliable
      const process = spawn(binaryPath, ['--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        // Both exit code 0 and 1 can be OK for --help
        // Check if we got any whisper-related output
        const output = stdout + stderr;
        if (output.toLowerCase().includes('whisper') || 
            output.toLowerCase().includes('usage') || 
            code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Binary test failed: ${stderr || 'No output'}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to execute binary: ${error.message}`));
      });
      
      // Set timeout
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Binary test timeout'));
      }, 10000);
    });
  }

  getBinaryVersion() {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getWhisperBinaryPath();
      const process = spawn(binaryPath, ['--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        // Extract version info from help output
        const lines = output.split('\n');
        const versionLine = lines.find(line => 
          line.toLowerCase().includes('whisper') || 
          line.toLowerCase().includes('version')
        );
        
        if (versionLine) {
          resolve(versionLine.trim());
        } else {
          resolve('whisper.cpp (version unknown)');
        }
      });

      process.on('error', reject);
    });
  }

  // Additional helper methods...
  async downloadWhisperBinary() {
    throw new Error('Pre-built binaries not available. Please build from source using the build script.');
  }

  getDownloadInfo() {
    return null; // No pre-built binaries available
  }
}

module.exports = BinaryManager;