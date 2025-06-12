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
    const platform = this.config.platform;
    
    // Copy library files
    if (platform === 'win32') {
      await BuildUtils.copyFileWithInfo(
        path.join(extractedDir, 'lib', 'onnxruntime.dll'),
        path.join(nativeDir, 'onnxruntime.dll')
      );
    } else if (platform === 'darwin') {
      await BuildUtils.copyFileWithInfo(
        path.join(extractedDir, 'lib', 'libonnxruntime.dylib'),
        path.join(nativeDir, 'libonnxruntime.dylib')
      );
    } else {
      await BuildUtils.copyFileWithInfo(
        path.join(extractedDir, 'lib', 'libonnxruntime.so'),
        path.join(nativeDir, 'libonnxruntime.so')
      );
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
      
      // Fallback: try to copy known files individually
      console.log('🔄 Attempting fallback header copy...');
      const fallbackFiles = [
        'onnxruntime_c_api.h',
        'onnxruntime_cxx_api.h',
        'onnxruntime_cxx_inline.h',
        'onnxruntime_float16.h',
        'onnxruntime_session_options_config_keys.h',
        'onnxruntime_run_options_config_keys.h'
      ];
      
      for (const file of fallbackFiles) {
        try {
          await BuildUtils.copyFileWithInfo(
            path.join(sourceIncludeDir, file),
            path.join(includeDir, file),
            false // not required, so won't throw if missing
          );
        } catch (copyError) {
          console.warn(`⚠️ Could not copy ${file}:`, copyError.message);
        }
      }
    }
  }

  async copyLibraries() {
    if (!this.onnxExtractedDir) {
      throw new Error('ONNX Runtime extracted directory not found');
    }
    
    const libDir = path.join(this.onnxExtractedDir, 'lib');
    console.log(`📁 Copying ONNX Runtime libraries from: ${libDir}`);
    
    try {
      const libFiles = await fs.readdir(libDir);
      console.log('📋 Available library files:', libFiles.join(', '));
      
      if (this.platform === 'win32') {
        await this.copyWindowsLibraries(libDir, libFiles);
      } else if (this.platform === 'darwin') {
        await this.copyMacOSLibraries(libDir, libFiles);
      } else {
        await this.copyLinuxLibraries(libDir, libFiles);
      }
      
    } catch (error) {
      console.error('❌ Failed to copy ONNX Runtime libraries:', error);
      throw error;
    }
  }

  async copyWindowsLibraries(libDir, libFiles) {
    const requiredDlls = ['onnxruntime.dll'];
    const optionalDlls = ['onnxruntime_providers_shared.dll'];
    
    for (const dll of requiredDlls) {
      await this.copyLibraryFile(libDir, dll, true);
    }
    
    for (const dll of optionalDlls) {
      await this.copyLibraryFile(libDir, dll, false);
    }
  }

  async copyMacOSLibraries(libDir, libFiles) {
    const onnxLibs = libFiles.filter(file => 
      file.includes('libonnxruntime') && file.endsWith('.dylib')
    );
    
    if (onnxLibs.length === 0) {
      throw new Error('No ONNX Runtime dylib files found');
    }

    // Copy the main library (versioned or not)
    const primaryLib = onnxLibs.find(lib => lib === 'libonnxruntime.dylib') || onnxLibs[0];
    await this.copyLibraryFile(libDir, primaryLib, true);
    
    // Create symlink with standard name if needed
    if (primaryLib !== 'libonnxruntime.dylib') {
      const linkPath = path.join(this.config.binariesDir, 'libonnxruntime.dylib');
      await BuildUtils.createSymlink(primaryLib, linkPath, 'libonnxruntime.dylib -> ' + primaryLib);
    }
    
    // Copy optional providers_shared
    const providersLib = libFiles.find(file => 
      file.includes('providers_shared') && file.endsWith('.dylib')
    );
    
    if (providersLib) {
      await this.copyLibraryFile(libDir, providersLib, false);
    } else {
      console.log('ℹ️ No providers_shared library found (may be statically linked)');
    }
  }

  async copyLinuxLibraries(libDir, libFiles) {
    // Handle versioned .so files
    const versionedOnnx = libFiles.find(file => 
      file.startsWith('libonnxruntime.so.') || file === 'libonnxruntime.so'
    );
    
    if (versionedOnnx) {
      await this.copyLibraryFile(libDir, versionedOnnx, true);
      
      // Create standard symlink if needed
      if (versionedOnnx !== 'libonnxruntime.so') {
        const linkPath = path.join(this.config.binariesDir, 'libonnxruntime.so');
        await BuildUtils.createSymlink(versionedOnnx, linkPath, 'libonnxruntime.so -> ' + versionedOnnx);
      }
    }
    
    // Copy optional providers_shared
    const optionalSos = ['libonnxruntime_providers_shared.so'];
    for (const so of optionalSos) {
      await this.copyLibraryFile(libDir, so, false);
    }
  }

  async copyLibraryFile(srcDir, fileName, required = true) {
    const srcPath = path.join(srcDir, fileName);
    const destPath = path.join(this.config.binariesDir, fileName);
    
    return await BuildUtils.copyFileWithInfo(srcPath, destPath, required);
  }

  getONNXExtractedDir() {
    return this.onnxExtractedDir;
  }
}

module.exports = { ONNXRuntimeManager };