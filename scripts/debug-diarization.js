#!/usr/bin/env node
// scripts/debug-diarization.js - Debug and fix diarization setup

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function debugDiarization() {
  console.log('🔍 WhisperDesk Diarization Debug Tool');
  console.log('=====================================\n');

  const projectRoot = process.cwd();
  const binariesDir = path.join(projectRoot, 'binaries');
  const modelsDir = path.join(projectRoot, 'models');
  const binaryPath = path.join(binariesDir, 'diarize-cli');

  // 1. Check binary exists
  console.log('1. 🔧 Checking binary...');
  try {
    await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
    console.log(`✅ Binary found: ${binaryPath}`);
    
    const stats = await fs.stat(binaryPath);
    console.log(`   Size: ${Math.round(stats.size / 1024)} KB`);
  } catch (error) {
    console.log(`❌ Binary not found: ${binaryPath}`);
    console.log('💡 Run: npm run build:diarization');
    return;
  }

  // 2. Check ONNX Runtime libraries
  console.log('\n2. 📚 Checking ONNX Runtime libraries...');
  const libraryNames = ['libonnxruntime.dylib', 'libonnxruntime.1.16.3.dylib'];
  
  for (const libName of libraryNames) {
    const libPath = path.join(binariesDir, libName);
    try {
      await fs.access(libPath);
      const stats = await fs.stat(libPath);
      console.log(`✅ Found: ${libName} (${Math.round(stats.size / 1024 / 1024)} MB)`);
    } catch (error) {
      console.log(`❌ Missing: ${libName}`);
    }
  }

  // 3. Check models directory and contents
  console.log('\n3. 🧠 Checking models...');
  console.log(`   Models directory: ${modelsDir}`);
  
  try {
    const modelFiles = await fs.readdir(modelsDir);
    console.log(`   Found files: ${modelFiles.join(', ')}`);
    
    const requiredModels = ['segmentation-3.0.onnx', 'embedding-1.0.onnx'];
    for (const modelName of requiredModels) {
      const modelPath = path.join(modelsDir, modelName);
      try {
        const stats = await fs.stat(modelPath);
        console.log(`✅ Model: ${modelName} (${Math.round(stats.size / 1024 / 1024)} MB)`);
      } catch (error) {
        console.log(`❌ Missing: ${modelName}`);
      }
    }
  } catch (error) {
    console.log(`❌ Models directory not found: ${modelsDir}`);
    console.log('💡 Run: npm run build:diarization');
    return;
  }

  // 4. Test binary directly
  console.log('\n4. 🧪 Testing binary directly...');
  try {
    const result = execSync(`"${binaryPath}" --help`, {
      cwd: binariesDir,
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        DYLD_LIBRARY_PATH: `${binariesDir}:${process.env.DYLD_LIBRARY_PATH || ''}`,
        DYLD_FALLBACK_LIBRARY_PATH: binariesDir
      }
    });
    
    console.log('✅ Binary executed successfully!');
    console.log('📄 Help output (first 500 chars):');
    console.log('-'.repeat(50));
    console.log(result.substring(0, 500));
    console.log('-'.repeat(50));
    
    // Check for expected patterns
    const patterns = ['diarization', 'audio', 'model', 'speaker', 'help'];
    const found = patterns.filter(p => result.toLowerCase().includes(p));
    console.log(`🔍 Found patterns: ${found.join(', ')} (${found.length}/${patterns.length})`);
    
  } catch (error) {
    console.log('❌ Binary test failed:');
    console.log(`   Error: ${error.message}`);
    console.log(`   Exit code: ${error.status}`);
    if (error.stderr) {
      console.log(`   Stderr: ${error.stderr}`);
    }
  }

  // 5. Check library dependencies (macOS only)
  if (process.platform === 'darwin') {
    console.log('\n5. 🔗 Checking library dependencies...');
    try {
      const otoolResult = execSync(`otool -L "${binaryPath}"`, { encoding: 'utf8' });
      console.log('📚 Library dependencies:');
      console.log(otoolResult);
    } catch (error) {
      console.log('⚠️ Could not check dependencies (otool failed)');
    }
  }

  // 6. Final recommendations
  console.log('\n6. 💡 Recommendations:');
  console.log('   - If binary test failed, try rebuilding: npm run build:diarization');
  console.log('   - If models are missing, the build script should download them');
  console.log('   - If libraries are missing, check the build script completed successfully');
  console.log('   - For multi-speaker detection, use threshold 0.001-0.01');
  
  console.log('\n✅ Debug complete!');
}

// Run the debug
debugDiarization().catch(error => {
  console.error('❌ Debug script failed:', error);
  process.exit(1);
});