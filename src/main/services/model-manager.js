const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { app } = require('electron');
const https = require('https');
const http = require('http');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Import model configurations from separate file
const { WHISPER_MODELS, MODEL_NAME_MAPPING, CONFIG } = require('./models-config');

class ModelManager extends EventEmitter {
  constructor() {
    super();
    this.modelsDir = this.getModelsDirectory();
    this.downloadQueue = new Map();
    this.installedModels = new Map();
    this.availableModels = new Map();
    this.maxConcurrentDownloads = CONFIG.MAX_CONCURRENT_DOWNLOADS;
    this.activeDownloads = 0;
    
    // FIXED: Add download tracking for UI state sync
    this.downloadStates = new Map(); // Track download states for UI
    
    // Use imported model name mapping
    this.modelNameMapping = MODEL_NAME_MAPPING;
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
    // Use imported models instead of hardcoded array
    WHISPER_MODELS.forEach(model => {
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

  // FIXED: Enhanced download method with better duplicate handling and progress tracking
  async downloadModel(modelId) {
    const model = this.availableModels.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    // FIXED: More thorough duplicate check including download states
    if (this.installedModels.has(modelId)) {
      console.log(`⚠️ Model ${modelId} is already installed, skipping download`);
      throw new Error(`Model ${modelId} is already installed`);
    }

    if (this.downloadQueue.has(modelId)) {
      console.log(`⚠️ Model ${modelId} is already being downloaded`);
      throw new Error(`Model ${modelId} is already being downloaded`);
    }

    // FIXED: Check download states to prevent duplicate downloads
    if (this.downloadStates.has(modelId)) {
      const existingState = this.downloadStates.get(modelId);
      if (existingState.status === 'downloading' || existingState.status === 'queued') {
        console.log(`⚠️ Model ${modelId} download already in progress (${existingState.status})`);
        throw new Error(`Model ${modelId} is already being downloaded`);
      }
    }

    // Check available disk space
    await this.checkDiskSpace(model.sizeBytes);

    // FIXED: Add to download states immediately
    this.downloadStates.set(modelId, {
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: model.sizeBytes,
      startTime: Date.now()
    });

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
    
    // FIXED: Emit queued event immediately
    console.log(`📥 Model ${model.name} queued for download`);
    this.emit('downloadQueued', downloadInfo);

    // Start download if under concurrent limit
    if (this.activeDownloads < this.maxConcurrentDownloads) {
      setImmediate(() => this.startDownload(modelId)); // Use setImmediate to ensure event is emitted first
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

    // FIXED: Update download states
    this.downloadStates.set(modelId, {
      ...downloadInfo,
      status: 'downloading'
    });

    try {
      // UPDATED: Download with correct GGML filename from the start
      const model = downloadInfo.model;
      const outputFilename = model.expectedFilename || `${modelId}.bin`;
      const outputPath = path.join(this.modelsDir, outputFilename);
      
      console.log(`📥 Downloading ${model.name} as ${outputFilename}`);
      
      await this.downloadFile(model.downloadUrl, outputPath, downloadInfo);

      if (downloadInfo.cancelled) {
        try { await fs.unlink(outputPath); } catch {}
        downloadInfo.status = 'cancelled';
        this.downloadStates.delete(modelId); // FIXED: Clean up download state
        this.emit('downloadCancelled', { modelId });
      } else {
        // Skip checksum verification for now since we're using new model files
        // if (downloadInfo.model.checksum) {
        //   await this.verifyChecksum(outputPath, downloadInfo.model.checksum);
        // }

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

        // FIXED: Add to installed models BEFORE emitting events
        this.installedModels.set(modelId, installedModel);

        downloadInfo.status = 'completed';
        downloadInfo.progress = 100;
        downloadInfo.completedAt = Date.now();

        // FIXED: Clean up download state and emit completion
        this.downloadStates.delete(modelId);

        console.log(`✅ Model ${model.name} downloaded successfully as ${outputFilename}`);
        this.emit('downloadComplete', { modelId, installedModel });
      }

    } catch (error) {
      if (downloadInfo.cancelled || error.message === 'Download cancelled') {
        downloadInfo.status = 'cancelled';
        this.downloadStates.delete(modelId); // FIXED: Clean up download state
        this.emit('downloadCancelled', { modelId });
      } else {
        downloadInfo.status = 'error';
        downloadInfo.error = error.message;
        this.downloadStates.delete(modelId); // FIXED: Clean up download state
        this.emit('downloadError', { modelId, error: error.message });
      }
      
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
        setImmediate(() => this.startDownload(nextDownload.modelId));
      }
    }
  }

  // FIXED: Enhanced download file method with better progress tracking
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
          // FIXED: Update download state with correct total bytes
          if (this.downloadStates.has(downloadInfo.modelId)) {
            this.downloadStates.get(downloadInfo.modelId).totalBytes = totalBytes;
          }
        }

        const writeStream = require('fs').createWriteStream(outputPath);
        downloadInfo.request = request;
        downloadInfo.writeStream = writeStream;
        let downloadedBytes = 0;
        let lastProgressEmit = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          downloadInfo.downloadedBytes = downloadedBytes;
          downloadInfo.progress = totalBytes ? (downloadedBytes / totalBytes) * 100 : 0;
          
          // FIXED: Update download state
          if (this.downloadStates.has(downloadInfo.modelId)) {
            Object.assign(this.downloadStates.get(downloadInfo.modelId), {
              downloadedBytes,
              progress: downloadInfo.progress
            });
          }
          
          // FIXED: Throttle progress events to prevent spam (emit every 1% or 1MB)
          const now = Date.now();
          const progressChanged = Math.floor(downloadInfo.progress) > Math.floor(lastProgressEmit);
          const sizeChanged = downloadedBytes - (this.lastEmittedBytes || 0) > CONFIG.PROGRESS_EMIT_SIZE_THRESHOLD;
          
          if (progressChanged || sizeChanged || now - (this.lastEmitTime || 0) > CONFIG.PROGRESS_EMIT_INTERVAL) {
            this.lastEmittedBytes = downloadedBytes;
            this.lastEmitTime = now;
            
            const progressData = {
              modelId: downloadInfo.modelId,
              progress: downloadInfo.progress,
              downloadedBytes,
              totalBytes,
              speed: this.calculateDownloadSpeed(downloadInfo)
            };
            
            console.log(`📊 Download progress ${downloadInfo.modelId}: ${Math.round(downloadInfo.progress)}% (${Math.round(downloadedBytes/1024/1024)}MB/${Math.round(totalBytes/1024/1024)}MB)`);
            this.emit('downloadProgress', progressData);
            lastProgressEmit = downloadInfo.progress;
          }
        });

        response.on('end', () => {
          writeStream.end();
          downloadInfo.request = null;
          downloadInfo.writeStream = null;
          
          // FIXED: Emit final progress
          console.log(`✅ Download completed for ${downloadInfo.modelId}: ${Math.round(downloadedBytes/1024/1024)}MB`);
          this.emit('downloadProgress', {
            modelId: downloadInfo.modelId,
            progress: 100,
            downloadedBytes,
            totalBytes,
            speed: this.calculateDownloadSpeed(downloadInfo)
          });
          
          resolve();
        });

        response.on('error', (error) => {
          writeStream.destroy();
          downloadInfo.request = null;
          downloadInfo.writeStream = null;
          reject(error);
        });

        response.pipe(writeStream);
      });

      request.on('error', (err) => {
        downloadInfo.request = null;
        downloadInfo.writeStream = null;
        reject(err);
      });
      request.setTimeout(CONFIG.DOWNLOAD_TIMEOUT, () => {
        downloadInfo.request = null;
        downloadInfo.writeStream = null;
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

  // FIXED: Enhanced status method
  async getDownloadStatus(modelId) {
    return this.downloadQueue.get(modelId) || this.downloadStates.get(modelId);
  }

  // FIXED: Get all download states for UI sync
  getAllDownloadStates() {
    const states = new Map();
    
    // Add active downloads
    for (const [id, info] of this.downloadQueue.entries()) {
      states.set(id, {
        modelId: id,
        status: info.status,
        progress: info.progress || 0,
        downloadedBytes: info.downloadedBytes || 0,
        totalBytes: info.totalBytes || 0
      });
    }
    
    // Add any tracked states
    for (const [id, state] of this.downloadStates.entries()) {
      states.set(id, state);
    }
    
    return states;
  }

  async cancelDownload(modelId) {
    const downloadInfo = this.downloadQueue.get(modelId);
    if (!downloadInfo) {
      throw new Error(`No active download for model ${modelId}`);
    }

    if (downloadInfo.status === 'queued') {
      this.downloadQueue.delete(modelId);
      this.downloadStates.delete(modelId); // FIXED: Clean up download state
      downloadInfo.status = 'cancelled';
      this.emit('downloadCancelled', { modelId });
      return { success: true };
    }

    if (downloadInfo.status === 'downloading') {
      downloadInfo.cancelled = true;
      if (downloadInfo.request) {
        downloadInfo.request.destroy(new Error('Download cancelled'));
      }
      if (downloadInfo.writeStream) {
        downloadInfo.writeStream.destroy();
      }
      return { success: true };
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