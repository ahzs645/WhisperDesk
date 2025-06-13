#!/usr/bin/env node
// scripts/check-diarization.js - Check diarization availability

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkDiarizationAvailability() {
  const binariesDir = path.join(__dirname, '..', 'binaries');
  const modelsDir = path.join(__dirname, '..', 'models');
  
  const executableName = process.platform === 'win32' ? 'diarize-cli.exe' : 'diarize-cli';
  const executablePath = path.join(binariesDir, executableName);
  
  const status = {
    available: false,
    executable: false,
    models: {
      segmentation: false,
      embedding: false
    },
    message: ''
  };
  
  // Check executable
  if (fs.existsSync(executablePath)) {
    try {
      // Test if executable runs
      execSync(`"${executablePath}" --version`, {
        stdio: 'pipe',
        timeout: 3000
      });
      status.executable = true;
    } catch (error) {
      status.executable = false;
    }
  }
  
  // Check models
  const segmentationModel = path.join(modelsDir, 'segmentation-3.0.onnx');
  const embeddingModel = path.join(modelsDir, 'embedding-1.0.onnx');
  
  status.models.segmentation = fs.existsSync(segmentationModel);
  status.models.embedding = fs.existsSync(embeddingModel);
  
  // Determine overall availability
  status.available = status.executable && status.models.segmentation && status.models.embedding;
  
  if (status.available) {
    status.message = 'Multi-speaker diarization is available and ready';
  } else if (!status.executable) {
    status.message = 'Diarization executable not found - run npm run setup:diarization';
  } else if (!status.models.segmentation || !status.models.embedding) {
    status.message = 'Diarization models missing - run npm run setup:diarization';
  } else {
    status.message = 'Diarization system not properly configured';
  }
  
  return status;
}

// Export for programmatic use
module.exports = { checkDiarizationAvailability };

// CLI usage
if (require.main === module) {
  const status = checkDiarizationAvailability();
  
  console.log('🎭 Diarization Status Check');
  console.log('==========================');
  console.log(`Overall Available: ${status.available ? '✅ Yes' : '❌ No'}`);
  console.log(`Executable: ${status.executable ? '✅ Found' : '❌ Missing'}`);
  console.log(`Segmentation Model: ${status.models.segmentation ? '✅ Found' : '❌ Missing'}`);
  console.log(`Embedding Model: ${status.models.embedding ? '✅ Found' : '❌ Missing'}`);
  console.log(`Status: ${status.message}`);
  
  process.exit(status.available ? 0 : 1);
}