// utils/build-utils.js - Common utilities for build operations
const fs = require('fs').promises;
const https = require('https');
const { createWriteStream } = require('fs');
const { execAsync } = require('./exec-utils');

class BuildUtils {
  /**
   * Download a file from a URL with progress indication
   */
  static async downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destination);
      let downloadedBytes = 0;
      let totalBytes = 0;
      
      const request = https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          return BuildUtils.downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes) {
            const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\r📊 Progress: ${progress}%`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          if (totalBytes) {
            console.log(); // New line after progress
          }
          resolve();
        });
        
        file.on('error', (error) => {
          fs.unlink(destination).catch(() => {}); // Clean up
          reject(error);
        });
        
      });
      
      request.on('error', (error) => {
        file.close();
        reject(error);
      });
      
      request.setTimeout(120000, () => {
        request.destroy();
        reject(new Error('Download timeout (120s)'));
      });
    });
  }

  /**
   * Extract archive (zip or tar.gz) to directory
   */
  static async extractArchive(archivePath, extractDir) {
    const path = require('path');
    const ext = path.extname(archivePath);
    
    console.log(`📦 Extracting ${path.basename(archivePath)}...`);
    
    if (ext === '.zip') {
      if (process.platform === 'win32') {
        await execAsync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`, {
          timeout: 120000
        });
      } else {
        await execAsync(`unzip -o "${archivePath}" -d "${extractDir}"`, {
          timeout: 120000
        });
      }
    } else if (ext === '.tgz' || archivePath.endsWith('.tar.gz')) {
      await execAsync(`tar -xzf "${archivePath}" -C "${extractDir}"`, {
        timeout: 120000
      });
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }
    
    console.log('✅ Extraction complete');
  }

  /**
   * Find the extracted ONNX Runtime directory
   */
  static async findExtractedDir(onnxDir, prefix = 'onnxruntime-') {
    try {
      const entries = await fs.readdir(onnxDir);
      const runtimeDir = entries.find(entry => entry.startsWith(prefix));
      
      if (!runtimeDir) {
        console.log('📋 Directory contents:', entries);
        throw new Error(`${prefix} directory not found after extraction`);
      }
      
      const extractedPath = require('path').join(onnxDir, runtimeDir);
      console.log(`📁 Found runtime at: ${extractedPath}`);
      
      return extractedPath;
      
    } catch (error) {
      console.error(`❌ Failed to find extracted directory:`, error);
      throw error;
    }
  }

  /**
   * Check if a command exists on the system
   */
  static async checkCommand(command, friendlyName = command) {
    try {
      const { stdout } = await execAsync(`${command} --version`);
      const version = stdout.split('\n')[0];
      console.log(`✅ ${friendlyName}: ${version}`);
      return true;
    } catch (error) {
      console.warn(`❌ ${friendlyName} not found`);
      return false;
    }
  }

  /**
   * Copy a file and show size information
   */
  static async copyFileWithInfo(srcPath, destPath, required = true) {
    try {
      await fs.copyFile(srcPath, destPath);
      const stats = await fs.stat(destPath);
      const fileName = require('path').basename(destPath);
      console.log(`✅ Copied ${fileName} (${Math.round(stats.size / 1024)} KB)`);
      return true;
    } catch (error) {
      const fileName = require('path').basename(destPath);
      if (required) {
        console.error(`❌ Failed to copy required file ${fileName}:`, error.message);
        throw error;
      } else {
        console.warn(`⚠️ Optional file ${fileName} not found - this may be normal`);
        return false;
      }
    }
  }

  /**
   * Create directory structure recursively
   */
  static async ensureDirectories(...directories) {
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Ensured directory: ${dir}`);
    }
  }

  /**
   * Check if file exists and meets minimum size requirement
   */
  static async checkFileSize(filePath, minSize = 0) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size >= minSize;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a symlink with error handling
   */
  static async createSymlink(target, linkPath, description = '') {
    try {
      // Remove existing link if it exists
      try {
        await fs.unlink(linkPath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
      
      await fs.symlink(target, linkPath);
      console.log(`✅ Created symlink: ${description || `${linkPath} -> ${target}`}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to create symlink: ${error.message}`);
      return false;
    }
  }

  /**
   * Show build completion status and tips
   */
  static showCompletionStatus(config) {
    console.log('\n🎉 Build Complete!');
    console.log(`📁 Binaries: ${config.binariesDir}`);
    console.log(`🧠 Models: ${config.modelsDir}`);
    console.log('\n💡 Usage Tips:');
    console.log('1. Check logs for "🎭 Diarization available: true"');
    console.log('2. Test with: npm run dev');
    console.log('3. Models directory should contain .onnx files');
    console.log('4. Restart WhisperDesk after successful build');
  }

  /**
   * Show troubleshooting guide
   */
  static showTroubleshootingGuide() {
    console.log('\n🔧 Troubleshooting Guide:');
    console.log('1. Check the error message above for specific platform issues');
    console.log('2. Ensure all platform dependencies are installed:');
    console.log('   - macOS: brew install cmake jsoncpp');
    console.log('   - Linux: apt-get install cmake libjsoncpp-dev');
    console.log('   - Windows: Install Visual Studio with C++ tools');
    console.log('3. Clean build: rm -rf temp/diarization-build binaries/diarize-cli*');
    console.log('4. Check internet connection for model downloads');
    console.log('5. Verify disk space (need ~500MB for models and libraries)');
  }
}

module.exports = { BuildUtils };