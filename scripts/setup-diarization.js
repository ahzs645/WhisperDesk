#!/usr/bin/env node
// scripts/setup-diarization.js - Integrate diarization submodule

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIARIZATION_DIR = path.join(__dirname, '..', 'deps', 'diarization');
const WHISPERDESK_BINARIES = path.join(__dirname, '..', 'binaries');
const WHISPERDESK_MODELS = path.join(__dirname, '..', 'models');

class DiarizationIntegrator {
  constructor() {
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  }

  log(message, isError = false) {
    if (isError) {
      console.error(`❌ ${message}`);
    } else {
      console.log(`🎭 ${message}`);
    }
  }

  async checkSubmodule() {
    this.log('Checking diarization submodule...');
    
    if (!fs.existsSync(DIARIZATION_DIR)) {
      throw new Error('Diarization submodule not found. Run: git submodule update --init --recursive');
    }
    
    const packageJsonPath = path.join(DIARIZATION_DIR, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('Diarization submodule appears incomplete. Try: git submodule update --force --recursive');
    }
    
    this.log('✅ Diarization submodule found');
  }

  async installDependencies() {
    this.log('Installing diarization dependencies...');
    
    try {
      execSync('npm install', {
        cwd: DIARIZATION_DIR,
        stdio: this.verbose ? 'inherit' : 'pipe',
        timeout: 120000 // 2 minutes
      });
      this.log('✅ Dependencies installed');
    } catch (error) {
      throw new Error(`Failed to install diarization dependencies: ${error.message}`);
    }
  }

  async buildDiarization() {
    this.log('Building diarization system...');
    
    try {
      execSync('npm run build', {
        cwd: DIARIZATION_DIR,
        stdio: this.verbose ? 'inherit' : 'pipe',
        timeout: 600000 // 10 minutes
      });
      this.log('✅ Diarization system built');
    } catch (error) {
      console.warn('⚠️ Diarization build failed - multi-speaker detection will be disabled');
      console.warn(`Error: ${error.message}`);
      return false; // Don't fail the entire build
    }
    
    return true;
  }

  async copyArtifacts() {
    this.log('Copying diarization artifacts...');
    
    // Ensure target directories exist
    if (!fs.existsSync(WHISPERDESK_BINARIES)) {
      fs.mkdirSync(WHISPERDESK_BINARIES, { recursive: true });
    }
    if (!fs.existsSync(WHISPERDESK_MODELS)) {
      fs.mkdirSync(WHISPERDESK_MODELS, { recursive: true });
    }
    
    // Copy binaries
    const diarizationBinaries = path.join(DIARIZATION_DIR, 'binaries');
    if (fs.existsSync(diarizationBinaries)) {
      const files = fs.readdirSync(diarizationBinaries);
      for (const file of files) {
        if (file.startsWith('diarize-cli') || file.includes('onnxruntime')) {
          const src = path.join(diarizationBinaries, file);
          const dest = path.join(WHISPERDESK_BINARIES, file);
          
          try {
            fs.copyFileSync(src, dest);
            
            // Make executable on Unix-like systems
            if (process.platform !== 'win32' && file.startsWith('diarize-cli')) {
              fs.chmodSync(dest, 0o755);
            }
            
            this.log(`📦 Copied: ${file}`);
          } catch (error) {
            console.warn(`⚠️ Failed to copy ${file}: ${error.message}`);
          }
        }
      }
    }
    
    // Copy models
    const diarizationModels = path.join(DIARIZATION_DIR, 'models');
    if (fs.existsSync(diarizationModels)) {
      const files = fs.readdirSync(diarizationModels);
      for (const file of files) {
        if (file.endsWith('.onnx')) {
          const src = path.join(diarizationModels, file);
          const dest = path.join(WHISPERDESK_MODELS, file);
          
          try {
            fs.copyFileSync(src, dest);
            this.log(`🧠 Copied model: ${file}`);
          } catch (error) {
            console.warn(`⚠️ Failed to copy model ${file}: ${error.message}`);
          }
        }
      }
    }
    
    this.log('✅ Artifacts copied');
  }

  async verifyIntegration() {
    this.log('Verifying diarization integration...');
    
    const executableName = process.platform === 'win32' ? 'diarize-cli.exe' : 'diarize-cli';
    const executablePath = path.join(WHISPERDESK_BINARIES, executableName);
    
    if (!fs.existsSync(executablePath)) {
      this.log('⚠️ Diarization executable not found - multi-speaker mode will be disabled');
      return false;
    }
    
    try {
      // Test the executable
      execSync(`"${executablePath}" --version`, {
        stdio: 'pipe',
        timeout: 5000
      });
      
      this.log('✅ Diarization system verified and ready');
      return true;
    } catch (error) {
      this.log('⚠️ Diarization executable test failed - multi-speaker mode may not work properly');
      return false;
    }
  }

  async integrate() {
    try {
      await this.checkSubmodule();
      await this.installDependencies();
      const buildSuccess = await this.buildDiarization();
      
      if (buildSuccess) {
        await this.copyArtifacts();
        await this.verifyIntegration();
      }
      
      this.log('🎉 Diarization integration complete!');
      return true;
    } catch (error) {
      this.log(error.message, true);
      throw error;
    }
  }
}

// Run integration if called directly
if (require.main === module) {
  const integrator = new DiarizationIntegrator();
  integrator.integrate().catch(error => {
    console.error('❌ Diarization integration failed:', error.message);
    process.exit(1);
  });
}

module.exports = { DiarizationIntegrator };