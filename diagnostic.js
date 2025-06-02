#!/usr/bin/env node

/**
 * WhisperDesk Enhanced - Comprehensive Diagnostic Script
 * This script tests all components and identifies specific issues
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class WhisperDeskDiagnostic {
  constructor() {
    this.results = {
      environment: {},
      backend: {},
      frontend: {},
      models: {},
      ipc: {},
      issues: [],
      recommendations: []
    };
  }

  async runDiagnostics() {
    console.log('🔍 WhisperDesk Enhanced - Comprehensive Diagnostics');
    console.log('================================================\n');

    try {
      await this.checkEnvironment();
      await this.checkBackendServices();
      await this.checkFrontendBuild();
      await this.checkModels();
      await this.checkIPCSetup();
      this.generateReport();
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
    }
  }

  async checkEnvironment() {
    console.log('📋 1. Environment Check');
    console.log('========================');

    // Check Node.js version
    try {
      const nodeVersion = process.version;
      this.results.environment.nodeVersion = nodeVersion;
      console.log(`✓ Node.js: ${nodeVersion}`);
      
      if (parseInt(nodeVersion.slice(1)) < 18) {
        this.addIssue('Node.js version should be 18+', 'Update Node.js');
      }
    } catch (error) {
      this.addIssue('Node.js not found', 'Install Node.js 18+');
    }

    // Check package.json
    try {
      const packagePath = path.join(process.cwd(), 'package.json');
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      this.results.environment.packageVersion = packageData.version;
      console.log(`✓ App Version: ${packageData.version}`);
    } catch (error) {
      this.addIssue('package.json not found', 'Run from project root directory');
    }

    // Check main dependencies
    try {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules');
      await fs.access(nodeModulesPath);
      console.log('✓ Main dependencies installed');
      this.results.environment.mainDepsInstalled = true;
    } catch (error) {
      this.addIssue('Main dependencies missing', 'Run: npm install');
      this.results.environment.mainDepsInstalled = false;
    }

    // Check frontend dependencies
    try {
      const frontendNodeModules = path.join(process.cwd(), 'src/renderer/whisperdesk-ui/node_modules');
      await fs.access(frontendNodeModules);
      console.log('✓ Frontend dependencies installed');
      this.results.environment.frontendDepsInstalled = true;
    } catch (error) {
      this.addIssue('Frontend dependencies missing', 'Run: cd src/renderer/whisperdesk-ui && npm install');
      this.results.environment.frontendDepsInstalled = false;
    }

    // Check Python/Whisper
    try {
      const result = await this.runCommand('python3', ['-c', 'import whisper; print("OK")']);
      if (result.includes('OK')) {
        console.log('✓ Python Whisper installed');
        this.results.environment.whisperInstalled = true;
      } else {
        throw new Error('Whisper not working');
      }
    } catch (error) {
      this.addIssue('Python Whisper not installed', 'Run: pip3 install openai-whisper');
      this.results.environment.whisperInstalled = false;
    }

    console.log('');
  }

  async checkBackendServices() {
    console.log('🔧 2. Backend Services Check');
    console.log('============================');

    // Test Model Manager
    try {
      const ModelManager = require('./src/main/services/model-manager');
      const modelManager = new ModelManager();
      await modelManager.initialize();
      
      const availableModels = await modelManager.getAvailableModels();
      const installedModels = await modelManager.getInstalledModels();
      
      this.results.backend.modelManager = {
        initialized: true,
        availableModels: availableModels.length,
        installedModels: installedModels.length
      };
      
      console.log(`✓ Model Manager: ${availableModels.length} available, ${installedModels.length} installed`);
      
      if (installedModels.length === 0) {
        this.addIssue('No models installed', 'Run: node download-tiny-model.js');
      }
    } catch (error) {
      console.log(`❌ Model Manager failed: ${error.message}`);
      this.addIssue('Model Manager initialization failed', 'Check console for errors');
      this.results.backend.modelManager = { initialized: false, error: error.message };
    }

    // Test Audio Service
    try {
      const AudioService = require('./src/main/services/audio-service');
      const audioService = new AudioService();
      await audioService.initialize();
      
      const devices = await audioService.getDevices();
      
      this.results.backend.audioService = {
        initialized: true,
        deviceCount: devices.length
      };
      
      console.log(`✓ Audio Service: ${devices.length} devices found`);
    } catch (error) {
      console.log(`❌ Audio Service failed: ${error.message}`);
      this.addIssue('Audio Service initialization failed', 'Check audio drivers');
      this.results.backend.audioService = { initialized: false, error: error.message };
    }

    // Test Transcription Service
    try {
      const TranscriptionService = require('./src/main/services/transcription-service');
      const ModelManager = require('./src/main/services/model-manager');
      
      const modelManager = new ModelManager();
      await modelManager.initialize();
      
      const transcriptionService = new TranscriptionService(modelManager);
      await transcriptionService.initialize();
      
      const providers = transcriptionService.getProviders();
      
      this.results.backend.transcriptionService = {
        initialized: true,
        providerCount: providers.length
      };
      
      console.log(`✓ Transcription Service: ${providers.length} providers available`);
    } catch (error) {
      console.log(`❌ Transcription Service failed: ${error.message}`);
      this.addIssue('Transcription Service initialization failed', 'Check dependencies');
      this.results.backend.transcriptionService = { initialized: false, error: error.message };
    }

    console.log('');
  }

  async checkFrontendBuild() {
    console.log('🎨 3. Frontend Build Check');
    console.log('==========================');

    // Check if build directory exists
    try {
      const buildPath = path.join(process.cwd(), 'src/renderer/whisperdesk-ui/dist');
      await fs.access(buildPath);
      
      // Check for index.html
      const indexPath = path.join(buildPath, 'index.html');
      await fs.access(indexPath);
      
      console.log('✓ Frontend build exists');
      this.results.frontend.buildExists = true;
    } catch (error) {
      console.log('❌ Frontend build missing');
      this.addIssue('Frontend not built', 'Run: cd src/renderer/whisperdesk-ui && npm run build');
      this.results.frontend.buildExists = false;
    }

    // Check package.json in frontend
    try {
      const frontendPackagePath = path.join(process.cwd(), 'src/renderer/whisperdesk-ui/package.json');
      const packageData = JSON.parse(await fs.readFile(frontendPackagePath, 'utf8'));
      console.log(`✓ Frontend package.json exists (React ${packageData.dependencies?.react || 'unknown'})`);
      this.results.frontend.packageExists = true;
    } catch (error) {
      this.addIssue('Frontend package.json missing', 'Frontend project structure corrupted');
      this.results.frontend.packageExists = false;
    }

    console.log('');
  }

  async checkModels() {
    console.log('📥 4. Model Status Check');
    console.log('========================');

    try {
      const ModelManager = require('./src/main/services/model-manager');
      const modelManager = new ModelManager();
      await modelManager.initialize();
      
      const availableModels = await modelManager.getAvailableModels();
      const installedModels = await modelManager.getInstalledModels();
      
      console.log('Available Models:');
      availableModels.forEach(model => {
        const installed = model.isInstalled ? '✓' : '○';
        console.log(`  ${installed} ${model.name} (${model.size})`);
      });
      
      this.results.models.available = availableModels.length;
      this.results.models.installed = installedModels.length;
      
      if (installedModels.length === 0) {
        this.addIssue('No models installed', 'Download at least one model for testing');
      }
      
    } catch (error) {
      console.log(`❌ Model check failed: ${error.message}`);
      this.addIssue('Cannot check models', 'Model Manager initialization failed');
    }

    console.log('');
  }

  async checkIPCSetup() {
    console.log('🔗 5. IPC Setup Check');
    console.log('=====================');

    // Check preload.js
    try {
      const preloadPath = path.join(process.cwd(), 'src/main/preload.js');
      const preloadContent = await fs.readFile(preloadPath, 'utf8');
      
      // Check for required IPC exposures
      const requiredAPIs = [
        'model.getAvailable',
        'model.getInstalled',
        'transcription.processFile',
        'audio.getDevices'
      ];
      
      const missingAPIs = requiredAPIs.filter(api => !preloadContent.includes(api));
      
      if (missingAPIs.length === 0) {
        console.log('✓ Preload script has all required APIs');
        this.results.ipc.preloadComplete = true;
      } else {
        console.log(`❌ Preload script missing APIs: ${missingAPIs.join(', ')}`);
        this.addIssue('Preload script incomplete', 'Add missing API exposures');
        this.results.ipc.preloadComplete = false;
      }
    } catch (error) {
      console.log(`❌ Cannot read preload.js: ${error.message}`);
      this.addIssue('Preload script missing', 'Check src/main/preload.js');
      this.results.ipc.preloadComplete = false;
    }

    // Check main.js IPC handlers
    try {
      const mainPath = path.join(process.cwd(), 'src/main/main.js');
      const mainContent = await fs.readFile(mainPath, 'utf8');
      
      const requiredHandlers = [
        'model:getAvailable',
        'model:getInstalled',
        'transcription:processFile',
        'audio:getDevices'
      ];
      
      const missingHandlers = requiredHandlers.filter(handler => !mainContent.includes(handler));
      
      if (missingHandlers.length === 0) {
        console.log('✓ Main process has all required IPC handlers');
        this.results.ipc.handlersComplete = true;
      } else {
        console.log(`❌ Main process missing handlers: ${missingHandlers.join(', ')}`);
        this.addIssue('IPC handlers incomplete', 'Add missing handlers to main.js');
        this.results.ipc.handlersComplete = false;
      }
    } catch (error) {
      console.log(`❌ Cannot read main.js: ${error.message}`);
      this.addIssue('Main process file missing', 'Check src/main/main.js');
      this.results.ipc.handlersComplete = false;
    }

    console.log('');
  }

  generateReport() {
    console.log('📊 6. Diagnostic Report');
    console.log('=======================');

    if (this.results.issues.length === 0) {
      console.log('✅ No issues found! Your WhisperDesk installation appears healthy.');
      console.log('\n🚀 Try starting the application with: npm run dev');
      return;
    }

    console.log(`❌ Found ${this.results.issues.length} issue(s):\n`);

    this.results.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.problem}`);
      console.log(`   Solution: ${issue.solution}\n`);
    });

    console.log('🔧 Quick Fix Commands:');
    console.log('======================');

    // Generate specific fix commands based on issues
    const fixes = this.generateFixCommands();
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. ${fix}`);
    });

    console.log('\n💡 Run the fix commands above, then test with:');
    console.log('   node diagnostic.js  # Run this script again');
    console.log('   npm run dev         # Start the application');
  }

  generateFixCommands() {
    const fixes = [];
    
    this.results.issues.forEach(issue => {
      if (issue.problem.includes('Main dependencies missing')) {
        fixes.push('npm install');
      }
      if (issue.problem.includes('Frontend dependencies missing')) {
        fixes.push('cd src/renderer/whisperdesk-ui && npm install');
      }
      if (issue.problem.includes('Frontend not built')) {
        fixes.push('cd src/renderer/whisperdesk-ui && npm run build');
      }
      if (issue.problem.includes('No models installed')) {
        fixes.push('node download-tiny-model.js');
      }
      if (issue.problem.includes('Python Whisper not installed')) {
        fixes.push('pip3 install openai-whisper');
      }
    });

    // Remove duplicates
    return [...new Set(fixes)];
  }

  addIssue(problem, solution) {
    this.results.issues.push({ problem, solution });
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
      });

      process.on('error', reject);
    });
  }
}

// Run diagnostics if this file is executed directly
if (require.main === module) {
  const diagnostic = new WhisperDeskDiagnostic();
  diagnostic.runDiagnostics().catch(console.error);
}

module.exports = WhisperDeskDiagnostic;

