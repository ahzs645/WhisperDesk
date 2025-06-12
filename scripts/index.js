// index.js - Main module exports for enhanced diarization build system
const { buildEnhancedDiarization, EnhancedDiarizationBuilder } = require('./enhanced-diarization-builder');
const { BuildConfig } = require('./config/diarization-config');
const { BuildUtils } = require('./utils/build-utils');
const { PrerequisitesChecker } = require('./checkers/prerequisites-checker');
const { TemplateGenerator } = require('./generators/template-generator');
const { ONNXRuntimeManager } = require('./managers/onnx-runtime-manager');
const { ModelManager } = require('./managers/model-manager');
const { CLIBuilder } = require('./builders/cli-builder');

// Main exports
module.exports = {
  // Primary builder
  buildEnhancedDiarization,
  EnhancedDiarizationBuilder,
  
  // Configuration
  BuildConfig,
  
  // Utilities
  BuildUtils,
  
  // Checkers
  PrerequisitesChecker,
  
  // Generators
  TemplateGenerator,
  
  // Managers
  ONNXRuntimeManager,
  ModelManager,
  
  // Builders
  CLIBuilder,
  
  // Convenience functions
  async quickBuild() {
    return await buildEnhancedDiarization();
  },
  
  async buildWithOptions(options = {}) {
    const builder = new EnhancedDiarizationBuilder();
    
    if (options.clean) {
      await builder.cleanBuild();
    }
    
    if (options.modelsOnly) {
      return await builder.modelsOnly();
    }
    
    if (options.rebuildOnly) {
      return await builder.rebuildOnly();
    }
    
    return await builder.build();
  },
  
  async getStatus() {
    const builder = new EnhancedDiarizationBuilder();
    return builder.getBuildStatus();
  },
  
  async checkPrerequisites() {
    const config = new BuildConfig();
    const checker = new PrerequisitesChecker(config);
    
    try {
      await checker.checkAll();
      return { success: true, message: 'All prerequisites met' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
};

// Export individual classes for advanced usage
module.exports.classes = {
  BuildConfig,
  BuildUtils,
  PrerequisitesChecker,
  TemplateGenerator,
  ONNXRuntimeManager,
  ModelManager,
  CLIBuilder,
  EnhancedDiarizationBuilder
};