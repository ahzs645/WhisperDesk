// enhanced-diarization-builder.js - Main orchestrator for cross-platform builds
const { BuildConfig } = require('./config/diarization-config');
const { BuildUtils } = require('./utils/build-utils');
const { PrerequisitesChecker } = require('./checkers/prerequisites-checker');
const { TemplateGenerator } = require('./generators/template-generator');
const { ONNXRuntimeManager } = require('./managers/onnx-runtime-manager');
const { ModelManager } = require('./managers/model-manager');
const { CLIBuilder } = require('./builders/cli-builder');

class EnhancedDiarizationBuilder {
  constructor() {
    this.config = new BuildConfig();
    this.prerequisitesChecker = new PrerequisitesChecker(this.config);
    this.templateGenerator = new TemplateGenerator(this.config);
    this.onnxManager = new ONNXRuntimeManager(this.config);
    this.modelManager = new ModelManager(this.config);
    this.cliBuilder = new CLIBuilder(this.config, this.onnxManager);
    
    console.log(`🔧 Enhanced Diarization Builder initialized`);
    console.log(`📍 Platform: ${this.config.platform} (${this.config.arch})`);
    console.log(`📁 Project root: ${this.config.projectRoot}`);
    console.log(`📁 Binaries dir: ${this.config.binariesDir}`);
  }

  async build() {
    console.log('🔧 Building cross-platform speaker diarization system...');
    
    try {
      // 1. Check prerequisites
      await this.checkPrerequisites();
      
      // 2. Setup directories
      await this.setupDirectories();
      
      // 3. Ensure source files exist
      await this.ensureSourceFiles();
      
      // 4. Download and setup ONNX Runtime
      await this.setupONNXRuntime();
      
      // 5. Build diarize-cli executable
      await this.buildExecutable();
      
      // 6. Download and verify ONNX models
      await this.setupModels();
      
      // 7. Verify complete build
      await this.verifyBuild();
      
      // 8. Show completion status
      this.showCompletionStatus();
      
      console.log('✅ Enhanced cross-platform speaker diarization build complete!');
      return true;
      
    } catch (error) {
      console.error('❌ Enhanced diarization build failed:', error.message);
      BuildUtils.showTroubleshootingGuide();
      throw error;
    }
  }

  async checkPrerequisites() {
    console.log('\n📋 Step 1: Checking Prerequisites');
    await this.prerequisitesChecker.checkAll();
  }

  async setupDirectories() {
    console.log('\n📁 Step 2: Setting up Directories');
    await BuildUtils.ensureDirectories(
      this.config.tempDir,
      this.config.binariesDir,
      this.config.modelsDir,
      this.config.nativeDir
    );
  }

  async ensureSourceFiles() {
    console.log('\n📝 Step 3: Ensuring Source Files');
    await this.templateGenerator.ensureSourceFiles();
  }

  async setupONNXRuntime() {
    console.log('\n📥 Step 4: Setting up ONNX Runtime');
    await this.onnxManager.setupONNXRuntime();
  }

  async buildExecutable() {
    console.log('\n🔨 Step 5: Building CLI Executable');
    await this.cliBuilder.buildDiarizeCLI();
  }

  async setupModels() {
    console.log('\n🧠 Step 6: Setting up ONNX Models');
    await this.modelManager.downloadAndVerifyModels();
  }

  async verifyBuild() {
    console.log('\n✅ Step 7: Verifying Build');
    
    // Verify executable
    const executableValid = await this.cliBuilder.verifyExecutable();
    
    // Verify models
    const modelStatus = await this.modelManager.verifyModelsExist();
    
    // Show verification results
    console.log('\n📊 Build Verification Summary:');
    console.log(`🔧 Executable: ${executableValid ? '✅ Working' : '❌ Failed'}`);
    console.log(`🧠 Models: ${modelStatus.available}/${modelStatus.available + modelStatus.missing.length} available`);
    
    if (modelStatus.missing.length > 0) {
      console.log(`⚠️ Missing models: ${modelStatus.missing.join(', ')}`);
    }
    
    return {
      executable: executableValid,
      models: modelStatus,
      overall: executableValid && modelStatus.allPresent
    };
  }

  showCompletionStatus() {
    console.log('\n🎉 Step 8: Build Complete');
    BuildUtils.showCompletionStatus(this.config);
  }

  // Utility methods for external usage
  async cleanBuild() {
    console.log('🧹 Cleaning previous build...');
    
    try {
      // Clean temp directory
      const fs = require('fs').promises;
      await fs.rmdir(this.config.tempDir, { recursive: true });
      
      // Clean old executable
      const executablePath = require('path').join(
        this.config.binariesDir, 
        this.config.getExecutableName()
      );
      
      try {
        await fs.unlink(executablePath);
      } catch (error) {
        // File may not exist
      }
      
      console.log('✅ Build cleaned');
    } catch (error) {
      console.warn('⚠️ Clean failed:', error.message);
    }
  }

  async rebuildOnly() {
    console.log('🔄 Rebuilding executable only...');
    
    try {
      await this.ensureSourceFiles();
      await this.buildExecutable();
      const verification = await this.verifyBuild();
      
      if (verification.executable) {
        console.log('✅ Rebuild successful');
      } else {
        console.log('❌ Rebuild failed verification');
      }
      
      return verification.executable;
    } catch (error) {
      console.error('❌ Rebuild failed:', error.message);
      throw error;
    }
  }

  async modelsOnly() {
    console.log('📥 Setting up models only...');
    
    try {
      await BuildUtils.ensureDirectories(this.config.modelsDir);
      await this.setupModels();
      const modelStatus = await this.modelManager.verifyModelsExist();
      
      console.log(`✅ Model setup complete: ${modelStatus.available} models available`);
      return modelStatus.allPresent;
    } catch (error) {
      console.error('❌ Model setup failed:', error.message);
      throw error;
    }
  }

  getConfig() {
    return this.config;
  }

  getBuildStatus() {
    return {
      platform: this.config.platform,
      arch: this.config.arch,
      binariesDir: this.config.binariesDir,
      modelsDir: this.config.modelsDir,
      tempDir: this.config.tempDir
    };
  }
}

// Main build function for direct usage
async function buildEnhancedDiarization() {
  const builder = new EnhancedDiarizationBuilder();
  return await builder.build();
}

// Export for use in other scripts
module.exports = { 
  buildEnhancedDiarization, 
  EnhancedDiarizationBuilder 
};

// Run if called directly
if (require.main === module) {
  buildEnhancedDiarization().catch(error => {
    console.error('❌ Enhanced build failed:', error);
    process.exit(1);
  });
}