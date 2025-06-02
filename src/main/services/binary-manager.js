// src/main/services/binary-manager.js - UPDATED for packaged apps
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class BinaryManager {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.platformKey = `${this.platform}-${this.arch}`;
    this.isPackaged = app.isPackaged;
    
    // Determine binaries directory based on whether app is packaged
    this.binariesDir = this.getBinariesDirectory();
    
    console.log('Binary Manager Configuration:');
    console.log(`  Platform: ${this.platform}`);
    console.log(`  Architecture: ${this.arch}`);
    console.log(`  Is Packaged: ${this.isPackaged}`);
    console.log(`  Binaries Directory: ${this.binariesDir}`);
  }

  getBinariesDirectory() {
    if (this.isPackaged) {
      // In packaged app, resources are in different locations based on platform
      if (this.platform === 'darwin') {
        // macOS: /Applications/WhisperDesk.app/Contents/Resources/binaries
        return path.join(process.resourcesPath, 'binaries');
      } else if (this.platform === 'win32') {
        // Windows: C:\Users\...\AppData\Local\WhisperDesk\resources\binaries
        return path.join(process.resourcesPath, 'binaries');
      } else {
        // Linux: /opt/WhisperDesk/resources/binaries or similar
        return path.join(process.resourcesPath, 'binaries');
      }
    } else {
      // In development, use project directory
      const projectRoot = path.join(__dirname, '../../../');
      return path.join(projectRoot, 'binaries');
    }
  }

  async initialize() {
    try {
      console.log('Initializing Binary Manager...');
      console.log(`Looking for binaries in: ${this.binariesDir}`);
      
      // Check if binaries directory exists
      try {
        await fs.access(this.binariesDir);
        console.log('✅ Binaries directory exists');
      } catch (error) {
        console.warn('⚠️ Binaries directory not found:', this.binariesDir);
        
        if (!this.isPackaged) {
          // In development, try to create the directory
          await fs.mkdir(this.binariesDir, { recursive: true });
          console.log('📁 Created binaries directory');
        }
      }
      
      await this.ensureWhisperBinary();
      console.log('✅ Binary manager initialized');
    } catch (error) {
      console.error('❌ Error initializing binary manager:', error);
      throw error;
    }
  }

  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    console.log(`Checking for whisper binary at: ${binaryPath}`);
    
    try {
      await fs.access(binaryPath);
      
      // Check if it's executable
      if (this.platform !== 'win32') {
        const stats = await fs.stat(binaryPath);
        if (!(stats.mode & 0o111)) {
          console.log('Making binary executable...');
          await fs.chmod(binaryPath, 0o755);
        }
      }
      
      // Test the binary
      await this.testBinary();
      console.log('✅ Whisper binary found and working');
      
    } catch (error) {
      if (this.isPackaged) {
        // In packaged app, binary should be included - this is an error
        console.error('❌ Whisper binary not found in packaged app:', binaryPath);
        throw new Error(`Whisper binary not found in packaged app. Expected at: ${binaryPath}`);
      } else {
        // In development, give helpful instructions
        console.log('⚠️ Whisper binary not available in development mode');
        console.log('💡 To build the whisper binary:');
        console.log('   npm run build:whisper');
        console.log('   OR');
        console.log('   chmod +x scripts/build-whisper.sh && ./scripts/build-whisper.sh');
        console.log('');
        console.log('📋 Note: The app will work in web mode without the binary');
        
        // Don't throw error in development - allow graceful degradation
      }
    }
  }

  getWhisperBinaryPath() {
    const binaryNames = {
      'win32-x64': 'whisper.exe',
      'win32-ia32': 'whisper.exe',
      'win32-arm64': 'whisper.exe',
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
      console.log(`Testing binary: ${binaryPath}`);
      
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
        const output = stdout + stderr;
        
        // Check if we got whisper-related output (success indicators)
        if (output.toLowerCase().includes('whisper') || 
            output.toLowerCase().includes('usage') || 
            output.toLowerCase().includes('transcribe') ||
            code === 0) {
          console.log('✅ Binary test passed');
          resolve(true);
        } else {
          console.error('❌ Binary test failed');
          console.error('Exit code:', code);
          console.error('Output:', output);
          reject(new Error(`Binary test failed. Exit code: ${code}`));
        }
      });

      process.on('error', (error) => {
        console.error('❌ Failed to execute binary:', error.message);
        reject(new Error(`Failed to execute binary: ${error.message}`));
      });
      
      // Set timeout
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Binary test timeout'));
      }, 15000); // Increased timeout to 15 seconds
    });
  }

  async getBinaryInfo() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      const stats = await fs.stat(binaryPath);
      
      return {
        path: binaryPath,
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        executable: this.platform === 'win32' ? true : !!(stats.mode & 0o111)
      };
    } catch (error) {
      return {
        path: binaryPath,
        exists: false,
        error: error.message
      };
    }
  }

  async getBinaryVersion() {
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

      process.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Version check timeout'));
      }, 10000);
    });
  }

  // Check if binary is available and working
  async isAvailable() {
    try {
      const binaryPath = this.getWhisperBinaryPath();
      await fs.access(binaryPath);
      await this.testBinary();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get system information
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: this.arch,
      platformKey: this.platformKey,
      isPackaged: this.isPackaged,
      binariesDir: this.binariesDir,
      expectedBinaryPath: this.getWhisperBinaryPath(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron
    };
  }

  // Development helper: check multiple possible binary locations
  async findBinaryInDevelopment() {
    const possiblePaths = [
      path.join(__dirname, '../../../binaries/whisper'),
      path.join(__dirname, '../../../binaries/whisper.exe'),
      path.join(process.cwd(), 'binaries/whisper'),
      path.join(process.cwd(), 'binaries/whisper.exe'),
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper'
    ];

    console.log('🔍 Searching for whisper binary in development mode...');
    
    for (const binPath of possiblePaths) {
      try {
        await fs.access(binPath);
        console.log(`✅ Found binary at: ${binPath}`);
        return binPath;
      } catch (error) {
        // Continue searching
      }
    }
    
    console.log('❌ No whisper binary found in any expected location');
    return null;
  }

  // Get comprehensive status for debugging
  async getStatus() {
    const binaryInfo = await this.getBinaryInfo();
    const systemInfo = this.getSystemInfo();
    const isAvailable = await this.isAvailable();
    
    let version = null;
    try {
      version = await this.getBinaryVersion();
    } catch (error) {
      version = `Error: ${error.message}`;
    }

    return {
      isAvailable,
      version,
      binary: binaryInfo,
      system: systemInfo,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BinaryManager;