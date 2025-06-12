// managers/onnx-runtime-manager.js - ONNX Runtime download and setup
const fs = require('fs').promises;
const path = require('path');
const { BuildUtils } = require('../utils/build-utils');

class ONNXRuntimeManager {
  constructor(config) {
    this.config = config;
    this.platform = config.platform;
    this.arch = config.arch;
    this.onnxExtractedDir = null;
  }

  async setupONNXRuntime() {
    console.log('📥 Setting up ONNX Runtime...');
    
    // Create temp directory for ONNX Runtime
    const onnxDir = path.join(this.config.tempDir, 'onnxruntime');
    await BuildUtils.ensureDirectories(onnxDir);
    
    // Download ONNX Runtime
    const archivePath = await this.downloadONNXRuntime(onnxDir);
    
    // Extract ONNX Runtime
    await BuildUtils.extractArchive(archivePath, onnxDir);
    
    // Find extracted directory
    const extractedDir = await BuildUtils.findExtractedDir(onnxDir);
    
    // Copy ONNX Runtime files to native directory
    await this.copyONNXRuntimeFiles(extractedDir);
    
    console.log('✅ ONNX Runtime setup complete');
  }

  async downloadONNXRuntime(onnxDir) {
    const platform = this.config.platform;
    const arch = this.config.arch;
    const version = '1.16.3'; // Latest stable version
    
    let downloadUrl;
    if (platform === 'win32') {
      downloadUrl = `https://github.com/microsoft/onnxruntime/releases/download/v${version}/onnxruntime-win-${arch}-${version}.zip`;
    } else if (platform === 'darwin') {
      downloadUrl = `https://github.com/microsoft/onnxruntime/releases/download/v${version}/onnxruntime-osx-${arch}-${version}.tgz`;
    } else {
      downloadUrl = `https://github.com/microsoft/onnxruntime/releases/download/v${version}/onnxruntime-linux-${arch}-${version}.tgz`;
    }
    
    const archivePath = path.join(onnxDir, path.basename(downloadUrl));
    await BuildUtils.downloadFile(downloadUrl, archivePath);
    return archivePath;
  }

  async copyONNXRuntimeFiles(extractedDir) {
    const nativeDir = this.config.nativeDir;
    const binariesDir = this.config.binariesDir;
    const platform = this.config.platform;
    
    // First, let's see what library files actually exist
    const libDir = path.join(extractedDir, 'lib');
    const libFiles = await fs.readdir(libDir);
    console.log('📋 Available library files:', libFiles.join(', '));
    
    // Copy library files to both native and binaries directories
    if (platform === 'win32') {
      // Windows handling
      const dllFiles = libFiles.filter(f => f.endsWith('.dll'));
      for (const dll of dllFiles) {
        await BuildUtils.copyFileWithInfo(
          path.join(libDir, dll),
          path.join(nativeDir, dll)
        );
        await BuildUtils.copyFileWithInfo(
          path.join(libDir, dll),
          path.join(binariesDir, dll)
        );
      }
    } else if (platform === 'darwin') {
      // macOS handling - copy all dylib files and create symlinks
      const dylibFiles = libFiles.filter(f => f.endsWith('.dylib'));
      
      for (const dylib of dylibFiles) {
        // Copy to native directory
        await BuildUtils.copyFileWithInfo(
          path.join(libDir, dylib),
          path.join(nativeDir, dylib)
        );
        
        // Copy to binaries directory (so the executable can find it)
        await BuildUtils.copyFileWithInfo(
          path.join(libDir, dylib),
          path.join(binariesDir, dylib)
        );
        
        // Create standard symlink if this is a versioned library
        if (dylib.includes('libonnxruntime') && dylib !== 'libonnxruntime.dylib') {
          const standardName = 'libonnxruntime.dylib';
          await BuildUtils.createSymlink(
            dylib, 
            path.join(nativeDir, standardName),
            `${standardName} -> ${dylib}`
          );
          await BuildUtils.createSymlink(
            dylib, 
            path.join(binariesDir, standardName),
            `${standardName} -> ${dylib}`
          );
        }
      }
    } else {
      // Linux handling
      const soFiles = libFiles.filter(f => f.endsWith('.so') || f.includes('.so.'));
      
      for (const so of soFiles) {
        await BuildUtils.copyFileWithInfo(
          path.join(libDir, so),
          path.join(nativeDir, so)
        );
        await BuildUtils.copyFileWithInfo(
          path.join(libDir, so),
          path.join(binariesDir, so)
        );
        
        // Create standard symlink if this is a versioned library
        if (so.includes('libonnxruntime') && so !== 'libonnxruntime.so') {
          const standardName = 'libonnxruntime.so';
          await BuildUtils.createSymlink(
            so, 
            path.join(nativeDir, standardName),
            `${standardName} -> ${so}`
          );
          await BuildUtils.createSymlink(
            so, 
            path.join(binariesDir, standardName),
            `${standardName} -> ${so}`
          );
        }
      }
    }
    
    // Copy ALL header files from include directory
    const includeDir = path.join(nativeDir, 'include');
    await BuildUtils.ensureDirectories(includeDir);
    
    const sourceIncludeDir = path.join(extractedDir, 'include');
    
    try {
      // Get all header files from the source include directory
      const allFiles = await fs.readdir(sourceIncludeDir);
      const headerFiles = allFiles.filter(file => 
        file.endsWith('.h') || file.endsWith('.hpp')
      );
      
      console.log(`📋 Found ${headerFiles.length} header files to copy`);
      
      // Copy all header files
      for (const file of headerFiles) {
        await BuildUtils.copyFileWithInfo(
          path.join(sourceIncludeDir, file),
          path.join(includeDir, file)
        );
      }
      
      // Verify critical files are present
      const criticalFiles = [
        'onnxruntime_c_api.h',
        'onnxruntime_cxx_api.h', 
        'onnxruntime_cxx_inline.h',
        'onnxruntime_float16.h'
      ];
      
      for (const file of criticalFiles) {
        const filePath = path.join(includeDir, file);
        try {
          await fs.access(filePath);
          console.log(`✅ Critical header verified: ${file}`);
        } catch (error) {
          console.warn(`⚠️ Critical header missing: ${file}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to copy header files:', error);
      throw error;
    }
  }

  getONNXExtractedDir() {
    return this.onnxExtractedDir;
  }
}

module.exports = { ONNXRuntimeManager };