// managers/model-manager.js - ONNX model download and verification
const path = require('path');
const { BuildUtils } = require('../utils/build-utils');

class ModelManager {
  constructor(config) {
    this.config = config;
    this.models = config.getRequiredModels(); // Use models from config instead of hardcoded
  }

  async downloadAndVerifyModels() {
    console.log('📥 Downloading and verifying ONNX models...');
    
    // Create models directory
    await BuildUtils.ensureDirectories(this.config.modelsDir);
    
    // Download and verify each model
    for (const model of this.models) {
      const modelPath = path.join(this.config.modelsDir, model.name);
      
      // Download if not exists or too small
      const exists = await BuildUtils.checkFileSize(modelPath, model.minSize);
      if (!exists) {
        console.log(`📥 Downloading ${model.description || model.name}...`);
        await this.downloadModelWithFallback(model, modelPath);
      } else {
        console.log(`✅ ${model.name} already exists`);
      }
      
      // Verify model
      const verified = await this.verifyModel(modelPath, model.minSize);
      if (!verified) {
        throw new Error(`Failed to verify ${model.name}`);
      }
    }
    
    console.log('✅ All models downloaded and verified');
  }

  async downloadModelWithFallback(model, modelPath) {
    const urls = Array.isArray(model.urls) ? model.urls : [model.url];
    let lastError = null;
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`📥 Attempting download from URL ${i + 1}/${urls.length}: ${url}`);
      
      try {
        await BuildUtils.downloadFile(url, modelPath);
        console.log(`✅ Successfully downloaded ${model.name}`);
        return; // Success, exit the loop
      } catch (error) {
        console.warn(`⚠️ Failed to download from ${url}: ${error.message}`);
        lastError = error;
        
        // Clean up partial download
        try {
          const fs = require('fs').promises;
          await fs.unlink(modelPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        // If this was the last URL, throw the error
        if (i === urls.length - 1) {
          throw new Error(`Failed to download ${model.name} from any URL. Last error: ${lastError.message}`);
        }
      }
    }
  }

  async verifyModelsExist() {
    const results = {
      available: 0,
      missing: [],
      allPresent: true
    };
    
    for (const model of this.models) {
      const modelPath = path.join(this.config.modelsDir, model.name);
      const exists = await BuildUtils.checkFileSize(modelPath, model.minSize);
      
      if (exists) {
        results.available++;
      } else {
        results.missing.push(model.name);
        results.allPresent = false;
      }
    }
    
    return results;
  }

  async verifyModel(modelPath, minSize = 0) {
    try {
      const fs = require('fs').promises;
      const stats = await fs.stat(modelPath);
      
      if (stats.size < minSize) {
        console.error(`❌ Model file too small: ${modelPath} (${stats.size} bytes, minimum ${minSize})`);
        return false;
      }
      
      console.log(`✅ Model verified: ${path.basename(modelPath)} (${Math.round(stats.size / (1024 * 1024))} MB)`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to verify model: ${error.message}`);
      return false;
    }
  }
}

module.exports = {
  ModelManager
};