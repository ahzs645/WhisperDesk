// src/main/services/diarization-service.js - Enhanced diarization integration
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class DiarizationService {
  constructor() {
    this.binaryPath = this.findDiarizationBinary();
    this.modelsPath = this.findModelsPath();
    this.available = this.checkAvailability();
  }

  findDiarizationBinary() {
    const executableName = process.platform === 'win32' ? 'diarize-cli.exe' : 'diarize-cli';
    
    // Try multiple locations
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'binaries', executableName),
      path.join(process.resourcesPath, 'binaries', executableName),
      path.join(app.getAppPath(), 'binaries', executableName)
    ];
    
    for (const binaryPath of possiblePaths) {
      if (fs.existsSync(binaryPath)) {
        console.log(`🎭 Found diarization binary: ${binaryPath}`);
        return binaryPath;
      }
    }
    
    console.warn('⚠️ Diarization binary not found');
    return null;
  }

  findModelsPath() {
    const possiblePaths = [
      path.join(__dirname, '..', '..', '..', 'models'),
      path.join(process.resourcesPath, 'models'),
      path.join(app.getAppPath(), 'models')
    ];
    
    for (const modelsPath of possiblePaths) {
      const segmentationModel = path.join(modelsPath, 'segmentation-3.0.onnx');
      const embeddingModel = path.join(modelsPath, 'embedding-1.0.onnx');
      
      if (fs.existsSync(segmentationModel) && fs.existsSync(embeddingModel)) {
        console.log(`🧠 Found diarization models: ${modelsPath}`);
        return modelsPath;
      }
    }
    
    console.warn('⚠️ Diarization models not found');
    return null;
  }

  checkAvailability() {
    const available = this.binaryPath && this.modelsPath && fs.existsSync(this.binaryPath);
    console.log(`🎭 Diarization available: ${available}`);
    return available;
  }

  isAvailable() {
    return this.available;
  }

  async performDiarization(audioPath, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('Diarization system not available. Multi-speaker detection disabled.');
    }

    const {
      threshold = 0.01,
      maxSpeakers = 10,
      outputPath = null,
      verbose = false
    } = options;

    const args = [
      '--audio', audioPath,
      '--segment-model', path.join(this.modelsPath, 'segmentation-3.0.onnx'),
      '--embedding-model', path.join(this.modelsPath, 'embedding-1.0.onnx'),
      '--threshold', threshold.toString(),
      '--max-speakers', maxSpeakers.toString()
    ];

    if (verbose) {
      args.push('--verbose');
    }

    if (outputPath) {
      args.push('--output', outputPath);
    }

    return new Promise((resolve, reject) => {
      const process = spawn(this.binaryPath, args, {
        env: {
          ...process.env,
          // Set library paths for finding ONNX Runtime
          LD_LIBRARY_PATH: path.dirname(this.binaryPath),
          DYLD_LIBRARY_PATH: path.dirname(this.binaryPath),
          DYLD_FALLBACK_LIBRARY_PATH: path.dirname(this.binaryPath)
        }
      });
      
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
        if (verbose) {
          console.log('Diarization:', data.toString());
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            console.log(`🎭 Diarization complete: ${result.segments?.length || 0} segments, ${result.total_speakers || 0} speakers`);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse diarization output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Diarization failed (exit code ${code}): ${error}`));
        }
      });

      process.on('error', (err) => {
        reject(new Error(`Failed to start diarization process: ${err.message}`));
      });
    });
  }

  getStatus() {
    return {
      available: this.available,
      binaryPath: this.binaryPath,
      modelsPath: this.modelsPath,
      models: this.modelsPath ? {
        segmentation: fs.existsSync(path.join(this.modelsPath, 'segmentation-3.0.onnx')),
        embedding: fs.existsSync(path.join(this.modelsPath, 'embedding-1.0.onnx'))
      } : null
    };
  }
}

module.exports = { DiarizationService };