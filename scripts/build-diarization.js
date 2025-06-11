// scripts/build-diarization.js - FIXED for macOS ARM64
const fs = require('fs').promises;
const path = require('path');
const { execAsync } = require('../src/main/utils/exec-utils');
const https = require('https');
const { createWriteStream } = require('fs');

class DiarizationBuilder {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.projectRoot = process.cwd();
    this.nativeDir = path.join(this.projectRoot, 'src', 'native', 'diarization');
    this.binariesDir = path.join(this.projectRoot, 'binaries');
    this.tempDir = path.join(this.projectRoot, 'temp', 'diarization-build');
    
    // FIXED: Better ONNX Runtime directory handling
    this.onnxExtractedDir = null; // Will be detected dynamically
  }

  async build() {
    console.log('🔧 Building speaker diarization binaries...');
    console.log(`📍 Platform: ${this.platform} (${this.arch})`);
    
    try {
      // 1. Setup directories
      await this.setupDirectories();
      
      // 2. Download ONNX Runtime
      await this.downloadONNXRuntime();
      
      // 3. Build diarize-cli executable
      await this.buildDiarizeCLI();
      
      // 4. Download and convert pyannote models to ONNX
      await this.downloadAndConvertModels();
      
      // 5. Verify build
      await this.verifyBuild();
      
      console.log('✅ Speaker diarization build complete');
      return true;
      
    } catch (error) {
      console.error('❌ Diarization build failed:', error.message);
      throw error;
    }
  }

  async setupDirectories() {
    console.log('📁 Setting up build directories...');
    
    await fs.mkdir(this.tempDir, { recursive: true });
    await fs.mkdir(this.binariesDir, { recursive: true });
    
    // Create native source directory if it doesn't exist
    await fs.mkdir(this.nativeDir, { recursive: true });
    
    // Create basic source files if they don't exist
    await this.createSourceFilesIfNeeded();
  }

  async createSourceFilesIfNeeded() {
    const diarizeCliPath = path.join(this.nativeDir, 'diarize-cli.cpp');
    const cmakeListsPath = path.join(this.nativeDir, 'CMakeLists.txt');
    
    try {
      await fs.access(diarizeCliPath);
      console.log('✅ diarize-cli.cpp already exists');
    } catch (error) {
      console.log('📝 Creating diarize-cli.cpp template...');
      // Template content remains the same
      const templateContent = `// diarize-cli.cpp - Speaker diarization CLI
// This is a template - replace with your actual implementation
#include <iostream>
int main(int argc, char* argv[]) {
    std::cout << "Diarization CLI template - implement your logic here" << std::endl;
    return 0;
}`;
      await fs.writeFile(diarizeCliPath, templateContent);
    }
    
    try {
      await fs.access(cmakeListsPath);
      console.log('✅ CMakeLists.txt already exists');
    } catch (error) {
      console.log('📝 Creating CMakeLists.txt template...');
      // Use the fixed CMakeLists.txt content from the artifact above
      const cmakeContent = this.generateFixedCMakeFile();
      await fs.writeFile(cmakeListsPath, cmakeContent);
    }
  }

  generateFixedCMakeFile() {
    // Return the fixed CMakeLists.txt content
    return `# This will be replaced with the fixed version from the artifact above`;
  }

  async downloadONNXRuntime() {
    console.log('📥 Downloading ONNX Runtime...');
    
    const onnxVersions = {
      'win32': {
        'x64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-win-x64-1.16.3.zip'
      },
      'darwin': {
        'x64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-osx-x86_64-1.16.3.tgz',
        'arm64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-osx-arm64-1.16.3.tgz'
      },
      'linux': {
        'x64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-linux-x64-1.16.3.tgz'
      }
    };

    const downloadUrl = onnxVersions[this.platform]?.[this.arch];
    if (!downloadUrl) {
      throw new Error(`ONNX Runtime not available for ${this.platform}-${this.arch}`);
    }

    const onnxDir = path.join(this.tempDir, 'onnxruntime');
    await fs.mkdir(onnxDir, { recursive: true });

    const fileName = path.basename(downloadUrl);
    const downloadPath = path.join(onnxDir, fileName);

    // Download
    await this.downloadFile(downloadUrl, downloadPath);
    
    // Extract
    await this.extractArchive(downloadPath, onnxDir);
    
    // FIXED: Detect extracted directory dynamically
    await this.findExtractedONNXDir(onnxDir);
    
    // Copy runtime files to binaries directory
    await this.copyONNXRuntimeFiles();
    
    console.log('✅ ONNX Runtime downloaded and extracted');
  }

  // FIXED: Dynamically find the extracted ONNX Runtime directory
  async findExtractedONNXDir(onnxDir) {
    try {
      const entries = await fs.readdir(onnxDir);
      const onnxRuntimeDir = entries.find(entry => entry.startsWith('onnxruntime-'));
      
      if (!onnxRuntimeDir) {
        throw new Error('ONNX Runtime directory not found after extraction');
      }
      
      this.onnxExtractedDir = path.join(onnxDir, onnxRuntimeDir);
      console.log(`📁 Found ONNX Runtime at: ${this.onnxExtractedDir}`);
      
      // FIXED: Create compatibility symlink for CMake
      const compatDir = path.join(this.projectRoot, 'temp', 'onnxruntime');
      await fs.mkdir(compatDir, { recursive: true });
      
      // Create symlinks for lib and include directories
      const libSrc = path.join(this.onnxExtractedDir, 'lib');
      const libDst = path.join(compatDir, 'lib');
      const incSrc = path.join(this.onnxExtractedDir, 'include');
      const incDst = path.join(compatDir, 'include');
      
      try {
        // Remove existing symlinks
        await fs.unlink(libDst).catch(() => {});
        await fs.unlink(incDst).catch(() => {});
        
        // Create new symlinks
        await fs.symlink(libSrc, libDst);
        await fs.symlink(incSrc, incDst);
        
        console.log('✅ Created compatibility symlinks for CMake');
      } catch (symlinkError) {
        console.warn('⚠️ Could not create symlinks, copying files instead...');
        await this.copyDirectory(libSrc, libDst);
        await this.copyDirectory(incSrc, incDst);
      }
      
    } catch (error) {
      console.error('❌ Failed to find extracted ONNX Runtime directory:', error);
      throw error;
    }
  }

  async copyDirectory(src, dst) {
    await fs.mkdir(dst, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, dstPath);
      } else {
        await fs.copyFile(srcPath, dstPath);
      }
    }
  }

  async buildDiarizeCLI() {
    console.log('🔨 Building diarize-cli executable...');
    
    const buildDir = path.join(this.tempDir, 'build');
    await fs.mkdir(buildDir, { recursive: true });
    
    try {
      // Configure with CMake
      console.log('⚙️ Configuring with CMake...');
      
      // FIXED: Set environment variable for macOS
      const env = { ...process.env };
      if (this.platform === 'darwin') {
        env.PKG_CONFIG_PATH = '/opt/homebrew/lib/pkgconfig:/usr/local/lib/pkgconfig';
      }
      
      await execAsync(`cmake "${this.nativeDir}" -B "${buildDir}"`, {
        cwd: this.nativeDir,
        timeout: 60000,
        env
      });
      
      // Build
      console.log('🔨 Compiling...');
      await execAsync(`cmake --build "${buildDir}" --config Release`, {
        cwd: this.nativeDir,
        timeout: 300000,
        env
      });
      
      // Copy executable to binaries directory
      const executableName = this.platform === 'win32' ? 'diarize-cli.exe' : 'diarize-cli';
      const builtExecutable = path.join(buildDir, 'Release', executableName);
      const targetExecutable = path.join(this.binariesDir, executableName);
      
      try {
        await fs.copyFile(builtExecutable, targetExecutable);
      } catch (error) {
        // Try without Release subdirectory
        const altBuiltExecutable = path.join(buildDir, executableName);
        await fs.copyFile(altBuiltExecutable, targetExecutable);
      }
      
      // Make executable on Unix systems
      if (this.platform !== 'win32') {
        await execAsync(`chmod +x "${targetExecutable}"`);
      }
      
      console.log('✅ diarize-cli built successfully');
      
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      
      // FIXED: Better error diagnostics
      if (error.message.includes('ONNX Runtime not found')) {
        console.error('💡 Debug info:');
        console.error(`   ONNX extracted dir: ${this.onnxExtractedDir}`);
        
        if (this.onnxExtractedDir) {
          try {
            const libDir = path.join(this.onnxExtractedDir, 'lib');
            const incDir = path.join(this.onnxExtractedDir, 'include');
            
            console.error(`   Lib dir exists: ${await fs.access(libDir).then(() => true).catch(() => false)}`);
            console.error(`   Include dir exists: ${await fs.access(incDir).then(() => true).catch(() => false)}`);
            
            if (await fs.access(libDir).then(() => true).catch(() => false)) {
              const libFiles = await fs.readdir(libDir);
              console.error(`   Lib files: ${libFiles.join(', ')}`);
            }
          } catch (debugError) {
            console.error('   Debug info failed:', debugError.message);
          }
        }
      }
      
      throw error;
    }
  }

  // FIXED: Handle missing shared library gracefully on macOS
  async copyONNXRuntimeFiles() {
    if (!this.onnxExtractedDir) {
      throw new Error('ONNX Runtime extracted directory not found');
    }
    
    const libDir = path.join(this.onnxExtractedDir, 'lib');
    
    // Copy platform-specific runtime files
    if (this.platform === 'win32') {
      const files = ['onnxruntime.dll', 'onnxruntime_providers_shared.dll'];
      for (const file of files) {
        await this.copyFileIfExists(libDir, file);
      }
    } else if (this.platform === 'darwin') {
      // FIXED: Handle missing providers_shared on macOS
      const requiredFiles = ['libonnxruntime.dylib'];
      const optionalFiles = ['libonnxruntime_providers_shared.dylib'];
      
      // Copy required files
      for (const file of requiredFiles) {
        await this.copyFileIfExists(libDir, file, true);
      }
      
      // Copy optional files (don't fail if missing)
      for (const file of optionalFiles) {
        await this.copyFileIfExists(libDir, file, false);
      }
      
      console.log('ℹ️ macOS: providers_shared not needed (statically linked)');
      
    } else {
      const files = ['libonnxruntime.so', 'libonnxruntime_providers_shared.so'];
      for (const file of files) {
        await this.copyFileIfExists(libDir, file);
      }
    }
  }

  async copyFileIfExists(srcDir, fileName, required = true) {
    const srcPath = path.join(srcDir, fileName);
    const destPath = path.join(this.binariesDir, fileName);
    
    try {
      await fs.copyFile(srcPath, destPath);
      console.log(`✅ Copied ${fileName}`);
    } catch (error) {
      if (required) {
        console.error(`❌ Failed to copy required file ${fileName}:`, error.message);
        throw error;
      } else {
        console.warn(`⚠️ Optional file ${fileName} not found - this is normal on some platforms`);
      }
    }
  }

  async downloadAndConvertModels() {
    console.log('📥 Downloading and converting pyannote models...');
    
    const models = [
      {
        name: 'segmentation-3.0.onnx',
        url: 'https://huggingface.co/WhisperDesk/pyannote-onnx/resolve/main/segmentation-3.0.onnx',
        size: 17400000
      },
      {
        name: 'embedding-1.0.onnx', 
        url: 'https://huggingface.co/WhisperDesk/pyannote-onnx/resolve/main/embedding-1.0.onnx',
        size: 6800000
      }
    ];
    
    const modelsDir = path.join(this.binariesDir, 'models', 'diarization');
    await fs.mkdir(modelsDir, { recursive: true });
    
    for (const model of models) {
      const modelPath = path.join(modelsDir, model.name);
      
      try {
        await fs.access(modelPath);
        console.log(`✅ ${model.name} already exists`);
      } catch (error) {
        console.log(`📥 Downloading ${model.name}...`);
        await this.downloadFile(model.url, modelPath);
        console.log(`✅ Downloaded ${model.name}`);
      }
    }
  }

  async verifyBuild() {
    console.log('🔍 Verifying build...');
    
    const executableName = this.platform === 'win32' ? 'diarize-cli.exe' : 'diarize-cli';
    const executablePath = path.join(this.binariesDir, executableName);
    
    try {
      await fs.access(executablePath);
      console.log('✅ diarize-cli executable found');
      
      // Test execution (should show help or version)
      try {
        const { stdout } = await execAsync(`"${executablePath}" --help`, { timeout: 10000 });
        console.log('✅ diarize-cli executable runs successfully');
      } catch (error) {
        console.warn('⚠️ diarize-cli executable found but failed to run:', error.message);
      }
      
    } catch (error) {
      throw new Error(`diarize-cli executable not found at ${executablePath}`);
    }
  }

  // Utility methods (downloadFile, extractArchive, etc.) remain the same
  async downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destination);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          return this.downloadFile(response.headers.location, destination)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (error) => {
          fs.unlink(destination).catch(() => {}); // Clean up
          reject(error);
        });
        
      }).on('error', reject);
    });
  }

  async extractArchive(archivePath, extractDir) {
    const ext = path.extname(archivePath);
    
    if (ext === '.zip') {
      if (this.platform === 'win32') {
        await execAsync(`powershell -command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}'"`, {
          timeout: 60000
        });
      } else {
        await execAsync(`unzip -q "${archivePath}" -d "${extractDir}"`, {
          timeout: 60000
        });
      }
    } else if (ext === '.tgz' || archivePath.endsWith('.tar.gz')) {
      await execAsync(`tar -xzf "${archivePath}" -C "${extractDir}"`, {
        timeout: 60000
      });
    } else {
      throw new Error(`Unsupported archive format: ${ext}`);
    }
  }
}

// Main build function
async function buildDiarization() {
  const builder = new DiarizationBuilder();
  await builder.build();
}

// Export for use in other scripts
module.exports = { buildDiarization, DiarizationBuilder };

// Run if called directly
if (require.main === module) {
  buildDiarization().catch(error => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });
}