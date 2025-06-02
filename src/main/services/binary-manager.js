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
      // Binary exists, check if it's executable
      if (this.platform !== 'win32') {
        const stats = await fs.stat(binaryPath);
        if (!(stats.mode & 0o111)) {
          await fs.chmod(binaryPath, 0o755);
        }
      }
      console.log('Whisper binary found and ready');
    } catch (error) {
      console.log('Whisper binary not found. Native whisper.cpp functionality will be unavailable.');
      console.log('Note: whisper.cpp does not provide pre-built binaries. Consider building from source.');
      console.log('Falling back to Python whisper provider if available.');
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

  async downloadWhisperBinary() {
    const downloadInfo = this.getDownloadInfo();
    if (!downloadInfo) {
      throw new Error(`No whisper.cpp binary available for platform: ${this.platformKey}`);
    }

    console.log(`Downloading whisper.cpp for ${this.platformKey}...`);
    
    try {
      const tempFile = path.join(this.binariesDir, 'whisper-temp.zip');
      await this.downloadFile(downloadInfo.url, tempFile);
      
      if (downloadInfo.isArchive) {
        await this.extractArchive(tempFile, this.binariesDir);
        await fs.unlink(tempFile);
      } else {
        const binaryPath = this.getWhisperBinaryPath();
        await fs.rename(tempFile, binaryPath);
      }

      // Make executable on Unix systems
      if (this.platform !== 'win32') {
        const binaryPath = this.getWhisperBinaryPath();
        await fs.chmod(binaryPath, 0o755);
      }

      console.log('Whisper binary downloaded and installed successfully');
    } catch (error) {
      console.error('Error downloading whisper binary:', error);
      throw error;
    }
  }

  getDownloadInfo() {
    // Use GitHub releases for whisper.cpp binaries
    const baseUrl = 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4';
    
    const downloads = {
      'win32-x64': {
        url: `${baseUrl}/whisper-bin-win32.zip`,
        isArchive: true
      },
      'darwin-x64': {
        url: `${baseUrl}/whisper-bin-x64.zip`,
        isArchive: true
      },
      'darwin-arm64': {
        url: `${baseUrl}/whisper-bin-arm64.zip`,
        isArchive: true
      },
      'linux-x64': {
        url: `${baseUrl}/whisper-bin-Linux.zip`,
        isArchive: true
      }
    };

    return downloads[this.platformKey];
  }

  async downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
      const file = require('fs').createWriteStream(outputPath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          file.close();
          this.downloadFile(response.headers.location, outputPath)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (error) => {
          file.close();
          fs.unlink(outputPath).catch(() => {});
          reject(error);
        });
      }).on('error', (error) => {
        file.close();
        fs.unlink(outputPath).catch(() => {});
        reject(error);
      });
    });
  }

  async extractArchive(archivePath, extractDir) {
    // Simple extraction for zip files
    // In a real implementation, you'd use a proper zip library
    return new Promise((resolve, reject) => {
      const process = spawn('unzip', ['-o', archivePath, '-d', extractDir]);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Extraction failed with code ${code}`));
        }
      });

      process.on('error', (error) => {
        // Fallback: try to handle manually or use different extraction method
        reject(error);
      });
    });
  }

  async testBinary() {
    const binaryPath = this.getWhisperBinaryPath();
    
    return new Promise((resolve, reject) => {
      const process = spawn(binaryPath, ['--help']);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error('Binary test failed'));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  getBinaryVersion() {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getWhisperBinaryPath();
      const process = spawn(binaryPath, ['--version']);
      
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(new Error('Failed to get version'));
        }
      });

      process.on('error', reject);
    });
  }
}

module.exports = BinaryManager;

