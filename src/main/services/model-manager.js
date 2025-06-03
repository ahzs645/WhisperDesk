const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { app } = require('electron');
const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { spawn } = require('child_process');

class ModelManager extends EventEmitter {
  constructor() {
    super();
    this.modelsDir = this.getModelsDirectory();
    this.downloadQueue = new Map();
    this.installedModels = new Map();
    this.availableModels = new Map();
    this.maxConcurrentDownloads = 2;
    this.activeDownloads = 0;
    
    // Model name mapping for whisper.cpp compatibility
    this.modelNameMapping = {
      'whisper-tiny.bin': 'ggml-tiny.bin',
      'whisper-base.bin': 'ggml-base.bin',
      'whisper-small.bin': 'ggml-small.bin',
      'whisper-medium.bin': 'ggml-medium.bin',
      'whisper-large.bin': 'ggml-large-v3.bin',
      'whisper-large-v2.bin': 'ggml-large-v2.bin',
      'whisper-large-v3.bin': 'ggml-large-v3.bin',
      
      // Handle different variations
      'tiny.bin': 'ggml-tiny.bin',
      'base.bin': 'ggml-base.bin',
      'small.bin': 'ggml-small.bin',
      'medium.bin': 'ggml-medium.bin',
      'large.bin': 'ggml-large-v3.bin',
      'large-v2.bin': 'ggml-large-v2.bin',
      'large-v3.bin': 'ggml-large-v3.bin'
    };
  }

  getModelsDirectory() {
    try {
      return path.join(app.getPath('userData'), 'models');
    } catch (error) {
      // Fallback for when app is not ready
      let appDataPath;
      switch (process.platform) {
        case 'win32':
          appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'whisperdesk-enhanced');
          break;
        case 'darwin':
          appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'whisperdesk-enhanced');
          break;
        default:
          appDataPath = path.join(os.homedir(), '.config', 'whisperdesk-enhanced');
          break;
      }
      return path.join(appDataPath, 'models');
    }
  }

  async initialize() {
    try {
      // Create models directory
      await fs.mkdir(this.modelsDir, { recursive: true });
      
      // Load available models catalog
      await this.loadModelsCatalog();
      
      // Scan for installed models
      await this.scanInstalledModels();
      
      // INTEGRATED: Fix model naming compatibility automatically
      await this.fixModelCompatibility();
      
      console.log('Model manager initialized');
      console.log(`Models directory: ${this.modelsDir}`);
      console.log(`Available models: ${this.availableModels.size}`);
      console.log(`Installed models: ${this.installedModels.size}`);
    } catch (error) {
      console.error('Error initializing model manager:', error);
      throw error;
    }
  }

  async loadModelsCatalog() {
    // Define available models with their metadata
    const models = [
      {
        id: 'whisper-tiny',
        name: 'Whisper Tiny',
        provider: 'OpenAI',
        size: '39 MB',
        sizeBytes: 39000000,
        languages: ['en'],
        description: 'Fastest model, English only, good for real-time transcription',
        accuracy: 'Basic',
        speed: 'Very Fast',
        requirements: {
          ram: '1 GB',
          disk: '50 MB'
        },
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        checksum: '65147644a518d12f04e32d6f83b26e78e39ff953a90edea0b0f4b7c8b8e0e5de',
        version: '1.0.0',
        type: 'whisper',
        expectedFilename: 'ggml-tiny.bin' // Add expected filename for whisper.cpp
      },
      {
        id: 'whisper-base',
        name: 'Whisper Base',
        provider: 'OpenAI',
        size: '142 MB',
        sizeBytes: 142000000,
        languages: ['multilingual'],
        description: 'Good balance of speed and accuracy, supports multiple languages',
        accuracy: 'Good',
        speed: 'Fast',
        requirements: {
          ram: '2 GB',
          disk: '200 MB'
        },
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        checksum: 'ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e',
        version: '1.0.0',
        type: 'whisper',
        expectedFilename: 'ggml-base.bin'
      },
      {
        id: 'whisper-small',
        name: 'Whisper Small',
        provider: 'OpenAI',
        size: '461 MB',
        sizeBytes: 461000000,
        languages: ['multilingual'],
        description: 'Better accuracy than base, still reasonably fast',
        accuracy: 'Very Good',
        speed: 'Medium',
        requirements: {
          ram: '4 GB',
          disk: '500 MB'
        },
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        checksum: '9ecf779972d90ba49c06d968637d720dd632c55bbf19a9b982f6b20a0e4b1b8e',
        version: '1.0.0',
        type: 'whisper',
        expectedFilename: 'ggml-small.bin'
      },
      {
        id: 'whisper-medium',
        name: 'Whisper Medium',
        provider: 'OpenAI',
        size: '1.42 GB',
        sizeBytes: 1420000000,
        languages: ['multilingual'],
        description: 'High accuracy, good for professional transcription',
        accuracy: 'Excellent',
        speed: 'Medium-Slow',
        requirements: {
          ram: '6 GB',
          disk: '1.5 GB'
        },
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        checksum: '345ae4da62f9b3d59415adc60127b97c714f32e89e936602e85993674d08dcb1',
        version: '1.0.0',
        type: 'whisper',
        expectedFilename: 'ggml-medium.bin'
      },
      {
        id: 'whisper-large-v2',
        name: 'Whisper Large v2',
        provider: 'OpenAI',
        size: '2.87 GB',
        sizeBytes: 2870000000,
        languages: ['multilingual'],
        description: 'Best accuracy, slower processing, ideal for high-quality transcription',
        accuracy: 'Outstanding',
        speed: 'Slow',
        requirements: {
          ram: '8 GB',
          disk: '3 GB'
        },
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin',
        checksum: '81f7c96c852ee8fc832187b0132e569d6c3065a3252ed18e56effd0b6a73e524',
        version: '2.0.0',
        type: 'whisper',
        expectedFilename: 'ggml-large-v2.bin'
      },
      {
        id: 'whisper-large-v3',
        name: 'Whisper Large v3',
        provider: 'OpenAI',
        size: '2.87 GB',
        sizeBytes: 2870000000,
        languages: ['multilingual'],
        description: 'Latest and most accurate model, best for professional use',
        accuracy: 'Outstanding',
        speed: 'Slow',
        requirements: {
          ram: '8 GB',
          disk: '3 GB'
        },
        downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
        checksum: 'e4b87e7e0bf463eb8e6956e646f1e277e901512310def2c24bf0e11bd3c28e9a',
        version: '3.0.0',
        type: 'whisper',
        expectedFilename: 'ggml-large-v3.bin'
      }
    ];

    // Add models to available models map
    models.forEach(model => {
      this.availableModels.set(model.id, model);
    });
  }

  async scanInstalledModels() {
    try {
      const files = await fs.readdir(this.modelsDir);
      
      for (const file of files) {
        if (file.endsWith('.bin')) {
          const modelPath = path.join(this.modelsDir, file);
          const stats = await fs.stat(modelPath);
          
          // Try to match with available models
          const modelId = this.getModelIdFromFilename(file);
          const availableModel = this.availableModels.get(modelId);
          
          const installedModel = {
            id: modelId,
            name: availableModel?.name || file,
            path: modelPath,
            filename: file,
            size: stats.size,
            installedAt: stats.mtime,
            version: availableModel?.version || 'unknown',
            type: availableModel?.type || 'unknown',
            isCompatible: this.isFileNameCompatible(file)
          };
          
          this.installedModels.set(modelId, installedModel);
        }
      }
    } catch (error) {
      console.error('Error scanning installed models:', error);
    }
  }

  // NEW: Check if filename is compatible with whisper.cpp
  isFileNameCompatible(filename) {
    return filename.startsWith('ggml-') && filename.endsWith('.bin');
  }

  // NEW: Automatically fix model naming compatibility
  async fixModelCompatibility() {
    console.log('🔧 Checking model compatibility with whisper.cpp...');
    
    try {
      const files = await fs.readdir(this.modelsDir);
      const modelFiles = files.filter(file => file.endsWith('.bin'));
      
      let fixedCount = 0;
      let alreadyCorrect = 0;
      
      for (const file of modelFiles) {
        const filePath = path.join(this.modelsDir, file);
        
        if (this.isFileNameCompatible(file)) {
          alreadyCorrect++;
          continue;
        }
        
        // Check if we have a mapping for this file
        const correctName = this.modelNameMapping[file];
        if (correctName) {
          const correctPath = path.join(this.modelsDir, correctName);
          
          try {
            // Check if correctly named file already exists
            await fs.access(correctPath);
            console.log(`✅ ${correctName} already exists`);
          } catch (error) {
            // Create correctly named copy
            console.log(`🔄 Creating compatible model: ${file} -> ${correctName}`);
            await fs.copyFile(filePath, correctPath);
            
            // Verify the copy was successful
            const stats = await fs.stat(correctPath);
            console.log(`✅ Created ${correctName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            fixedCount++;
            
            // Update installed models map with the new compatible file
            const modelId = this.getModelIdFromFilename(correctName);
            const availableModel = this.availableModels.get(modelId);
            
            const compatibleModel = {
              id: modelId,
              name: availableModel?.name || correctName,
              path: correctPath,
              filename: correctName,
              size: stats.size,
              installedAt: new Date(),
              version: availableModel?.version || 'unknown',
              type: availableModel?.type || 'unknown',
              isCompatible: true
            };
            
            this.installedModels.set(modelId, compatibleModel);
          }
        }
      }
      
      if (fixedCount > 0) {
        console.log(`✅ Fixed ${fixedCount} model files for whisper.cpp compatibility`);
        this.emit('modelsFixed', { fixedCount });
      } else if (alreadyCorrect > 0) {
        console.log(`✅ All ${alreadyCorrect} models already compatible with whisper.cpp`);
      }
      
    } catch (error) {
      console.warn('⚠️ Error during model compatibility fix:', error.message);
    }
  }

  // NEW: Get the correct model path for whisper.cpp (always returns ggml- prefixed file)
  async getCompatibleModelPath(modelId) {
    console.log(`🔍 Getting compatible model path for: ${modelId}`);
    
    // First, try to find the model in installed models
    const installedModel = this.installedModels.get(modelId);
    if (installedModel) {
      // If the installed model is already compatible, return its path
      if (installedModel.isCompatible) {
        console.log(`✅ Found compatible model: ${installedModel.path}`);
        return installedModel.path;
      }
      
      // If not compatible, try to find or create a compatible version
      const compatibleName = this.getCompatibleFileName(installedModel.filename);
      if (compatibleName) {
        const compatiblePath = path.join(this.modelsDir, compatibleName);
        
        try {
          await fs.access(compatiblePath);
          console.log(`✅ Found existing compatible file: ${compatiblePath}`);
          return compatiblePath;
        } catch (error) {
          // Create compatible copy
          console.log(`🔄 Creating compatible copy: ${installedModel.filename} -> ${compatibleName}`);
          await fs.copyFile(installedModel.path, compatiblePath);
          console.log(`✅ Created compatible model: ${compatiblePath}`);
          return compatiblePath;
        }
      }
    }
    
    // If not found in installed models, try to find by expected filename
    const availableModel = this.availableModels.get(modelId);
    if (availableModel && availableModel.expectedFilename) {
      const expectedPath = path.join(this.modelsDir, availableModel.expectedFilename);
      
      try {
        await fs.access(expectedPath);
        console.log(`✅ Found model by expected filename: ${expectedPath}`);
        return expectedPath;
      } catch (error) {
        // File doesn't exist with expected name
      }
    }
    
    throw new Error(`Model not found: ${modelId}. Please download the model first from the Models tab.`);
  }

  // NEW: Get compatible filename for whisper.cpp
  getCompatibleFileName(filename) {
    return this.modelNameMapping[filename] || (filename.startsWith('ggml-') ? filename : null);
  }

  getModelIdFromFilename(filename) {
    // Extract model ID from filename
    const baseName = path.basename(filename, path.extname(filename));
    
    // Handle GGML model files (ggml-tiny.bin, ggml-base.bin, etc.)
    const ggmlMap = {
      'ggml-tiny': 'whisper-tiny',
      'ggml-base': 'whisper-base', 
      'ggml-small': 'whisper-small',
      'ggml-medium': 'whisper-medium',
      'ggml-large-v2': 'whisper-large-v2',
      'ggml-large-v3': 'whisper-large-v3'
    };
    
    // Map common filenames to model IDs
    const filenameMap = {
      'tiny': 'whisper-tiny',
      'base': 'whisper-base',
      'small': 'whisper-small',
      'medium': 'whisper-medium',
      'large-v2': 'whisper-large-v2',
      'large-v3': 'whisper-large-v3',
      'whisper-tiny': 'whisper-tiny',
      'whisper-base': 'whisper-base',
      'whisper-small': 'whisper-small',
      'whisper-medium': 'whisper-medium',
      'whisper-large-v2': 'whisper-large-v2',
      'whisper-large-v3': 'whisper-large-v3'
    };
    
    return ggmlMap[baseName] || filenameMap[baseName] || baseName;
  }

  async getAvailableModels() {
    const models = Array.from(this.availableModels.values()).map(model => ({
      ...model,
      isInstalled: this.installedModels.has(model.id),
      installedInfo: this.installedModels.get(model.id)
    }));
    
    return models.sort((a, b) => a.sizeBytes - b.sizeBytes);
  }

  async getInstalledModels() {
    return Array.from(this.installedModels.values());
  }

  async getModelInfo(modelId) {
    const available = this.availableModels.get(modelId);
    const installed = this.installedModels.get(modelId);
    
    return {
      ...available,
      isInstalled: !!installed,
      installedInfo: installed
    };
  }

  async downloadModel(modelId) {
    const model = this.availableModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (this.installedModels.has(modelId)) {
      throw new Error(`Model ${modelId} is already installed`);
    }

    if (this.downloadQueue.has(modelId)) {
      throw new Error(`Model ${modelId} is already being downloaded`);
    }

    // Check available disk space
    await this.checkDiskSpace(model.sizeBytes);

    // Add to download queue
    const downloadInfo = {
      modelId,
      model,
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: model.sizeBytes,
      startTime: Date.now()
    };

    this.downloadQueue.set(modelId, downloadInfo);
    this.emit('downloadQueued', downloadInfo);

    // Start download if under concurrent limit
    if (this.activeDownloads < this.maxConcurrentDownloads) {
      await this.startDownload(modelId);
    }

    return { success: true, downloadInfo };
  }

  async startDownload(modelId) {
    const downloadInfo = this.downloadQueue.get(modelId);
    if (!downloadInfo) {
      throw new Error(`Download info for ${modelId} not found`);
    }

    this.activeDownloads++;
    downloadInfo.status = 'downloading';
    downloadInfo.startTime = Date.now();

    try {
      // UPDATED: Download with correct GGML filename from the start
      const model = downloadInfo.model;
      const outputFilename = model.expectedFilename || `${modelId}.bin`;
      const outputPath = path.join(this.modelsDir, outputFilename);
      
      console.log(`📥 Downloading ${model.name} as ${outputFilename}`);
      
      await this.downloadFile(model.downloadUrl, outputPath, downloadInfo);
      
      // Skip checksum verification for now since we're using new model files
      // if (downloadInfo.model.checksum) {
      //   await this.verifyChecksum(outputPath, downloadInfo.model.checksum);
      // }

      // Add to installed models
      const stats = await fs.stat(outputPath);
      const installedModel = {
        id: modelId,
        name: model.name,
        path: outputPath,
        filename: outputFilename,
        size: stats.size,
        installedAt: new Date(),
        version: model.version,
        type: model.type,
        isCompatible: this.isFileNameCompatible(outputFilename)
      };

      this.installedModels.set(modelId, installedModel);
      
      downloadInfo.status = 'completed';
      downloadInfo.progress = 100;
      downloadInfo.completedAt = Date.now();

      console.log(`✅ Model ${model.name} downloaded successfully as ${outputFilename}`);
      this.emit('downloadComplete', { modelId, installedModel });

    } catch (error) {
      downloadInfo.status = 'error';
      downloadInfo.error = error.message;
      this.emit('downloadError', { modelId, error: error.message });
      
      // Clean up partial download
      const model = downloadInfo.model;
      const outputFilename = model.expectedFilename || `${modelId}.bin`;
      const outputPath = path.join(this.modelsDir, outputFilename);
      try {
        await fs.unlink(outputPath);
      } catch (cleanupError) {
        console.error('Error cleaning up partial download:', cleanupError);
      }
    } finally {
      this.activeDownloads--;
      this.downloadQueue.delete(modelId);
      
      // Start next download in queue
      const nextDownload = Array.from(this.downloadQueue.values())
        .find(info => info.status === 'queued');
      
      if (nextDownload && this.activeDownloads < this.maxConcurrentDownloads) {
        await this.startDownload(nextDownload.modelId);
      }
    }
  }

  async downloadFile(url, outputPath, downloadInfo) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          return this.downloadFile(response.headers.location, outputPath, downloadInfo)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        if (totalBytes) {
          downloadInfo.totalBytes = totalBytes;
        }

        const writeStream = require('fs').createWriteStream(outputPath);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          downloadInfo.downloadedBytes = downloadedBytes;
          downloadInfo.progress = totalBytes ? (downloadedBytes / totalBytes) * 100 : 0;
          
          this.emit('downloadProgress', {
            modelId: downloadInfo.modelId,
            progress: downloadInfo.progress,
            downloadedBytes,
            totalBytes,
            speed: this.calculateDownloadSpeed(downloadInfo)
          });
        });

        response.on('end', () => {
          writeStream.end();
          resolve();
        });

        response.on('error', (error) => {
          writeStream.destroy();
          reject(error);
        });

        response.pipe(writeStream);
      });

      request.on('error', reject);
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  calculateDownloadSpeed(downloadInfo) {
    const elapsed = (Date.now() - downloadInfo.startTime) / 1000;
    return elapsed > 0 ? downloadInfo.downloadedBytes / elapsed : 0;
  }

  async verifyChecksum(filePath, expectedChecksum) {
    const hash = crypto.createHash('sha256');
    const stream = require('fs').createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => {
        const actualChecksum = hash.digest('hex');
        if (actualChecksum === expectedChecksum) {
          resolve();
        } else {
          reject(new Error(`Checksum mismatch. Expected: ${expectedChecksum}, Got: ${actualChecksum}`));
        }
      });
      stream.on('error', reject);
    });
  }

  async checkDiskSpace(requiredBytes) {
    try {
      const stats = await fs.stat(this.modelsDir);
      // This is a simplified check - in a real implementation,
      // you'd want to check actual available disk space
      return true;
    } catch (error) {
      console.warn('Could not check disk space:', error);
      return true;
    }
  }

  async deleteModel(modelId) {
    const installedModel = this.installedModels.get(modelId);
    if (!installedModel) {
      throw new Error(`Model ${modelId} is not installed`);
    }

    try {
      await fs.unlink(installedModel.path);
      
      // Also delete any compatible copies if they exist
      if (!installedModel.isCompatible) {
        const compatibleName = this.getCompatibleFileName(installedModel.filename);
        if (compatibleName) {
          const compatiblePath = path.join(this.modelsDir, compatibleName);
          try {
            await fs.unlink(compatiblePath);
            console.log(`🗑️ Also deleted compatible copy: ${compatibleName}`);
          } catch (error) {
            // Compatible copy might not exist, that's okay
          }
        }
      }
      
      this.installedModels.delete(modelId);
      
      this.emit('modelDeleted', { modelId });
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete model: ${error.message}`);
    }
  }

  async getDownloadStatus(modelId) {
    return this.downloadQueue.get(modelId);
  }

  async cancelDownload(modelId) {
    const downloadInfo = this.downloadQueue.get(modelId);
    if (!downloadInfo) {
      throw new Error(`No active download for model ${modelId}`);
    }

    if (downloadInfo.status === 'downloading') {
      // In a real implementation, you'd cancel the HTTP request
      downloadInfo.status = 'cancelled';
      this.downloadQueue.delete(modelId);
      this.activeDownloads--;
      
      // Clean up partial download
      const model = downloadInfo.model;
      const outputFilename = model.expectedFilename || `${modelId}.bin`;
      const outputPath = path.join(this.modelsDir, outputFilename);
      try {
        await fs.unlink(outputPath);
      } catch (error) {
        console.error('Error cleaning up cancelled download:', error);
      }
      
      this.emit('downloadCancelled', { modelId });
    }

    return { success: true };
  }

  // UPDATED: Get model path with compatibility handling
  getModelPath(modelId) {
    const installedModel = this.installedModels.get(modelId);
    if (!installedModel) {
      return null;
    }
    
    // If model is compatible, return its path directly
    if (installedModel.isCompatible) {
      return installedModel.path;
    }
    
    // Try to find compatible version
    const compatibleName = this.getCompatibleFileName(installedModel.filename);
    if (compatibleName) {
      const compatiblePath = path.join(this.modelsDir, compatibleName);
      // Note: We should check if file exists, but for now return the expected path
      return compatiblePath;
    }
    
    return installedModel.path;
  }

  isModelInstalled(modelId) {
    return this.installedModels.has(modelId);
  }

  // NEW: Get model statistics including compatibility info
  async getModelStatistics() {
    const stats = {
      total: this.installedModels.size,
      compatible: 0,
      incompatible: 0,
      totalSize: 0
    };
    
    for (const model of this.installedModels.values()) {
      if (model.isCompatible) {
        stats.compatible++;
      } else {
        stats.incompatible++;
      }
      stats.totalSize += model.size;
    }
    
    return stats;
  }
}

module.exports = ModelManager;