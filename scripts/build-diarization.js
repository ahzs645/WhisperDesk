// scripts/build-diarization.js - Enhanced version of your placeholder
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
      // You would put your actual diarize-cli.cpp content here
      // For now, create a placeholder that can be replaced
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
      const cmakeContent = this.generateCMakeFile();
      await fs.writeFile(cmakeListsPath, cmakeContent);
    }
  }

  generateCMakeFile() {
    return `cmake_minimum_required(VERSION 3.15)
project(diarize-cli)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find ONNX Runtime
find_library(ONNXRUNTIME_LIB onnxruntime HINTS \${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/onnxruntime/lib)
find_path(ONNXRUNTIME_INCLUDE onnxruntime_cxx_api.h HINTS \${CMAKE_CURRENT_SOURCE_DIR}/../../../temp/onnxruntime/include)

# Find other dependencies
find_package(PkgConfig REQUIRED)
pkg_check_modules(SNDFILE REQUIRED sndfile)

# Add executable
add_executable(diarize-cli 
    diarize-cli.cpp
    speaker-segmenter.cpp
    speaker-embedder.cpp
    utils.cpp
)

# Include directories
target_include_directories(diarize-cli PRIVATE 
    \${ONNXRUNTIME_INCLUDE}
    \${SNDFILE_INCLUDE_DIRS}
    include/
)

# Link libraries
target_link_libraries(diarize-cli 
    \${ONNXRUNTIME_LIB}
    \${SNDFILE_LIBRARIES}
)

# Compiler flags
target_compile_options(diarize-cli PRIVATE \${SNDFILE_CFLAGS_OTHER})

# Platform-specific settings
if(WIN32)
    # Windows-specific settings
    target_compile_definitions(diarize-cli PRIVATE _WIN32_WINNT=0x0A00)
elseif(APPLE)
    # macOS-specific settings
    target_link_libraries(diarize-cli "-framework CoreAudio" "-framework AudioToolbox")
endif()
`;
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
    
    // Copy runtime files to binaries directory
    await this.copyONNXRuntimeFiles(onnxDir);
    
    console.log('✅ ONNX Runtime downloaded and extracted');
  }

  async buildDiarizeCLI() {
    console.log('🔨 Building diarize-cli executable...');
    
    const buildDir = path.join(this.tempDir, 'build');
    await fs.mkdir(buildDir, { recursive: true });
    
    try {
      // Configure with CMake
      console.log('⚙️ Configuring with CMake...');
      await execAsync(`cmake "${this.nativeDir}" -B "${buildDir}"`, {
        cwd: this.nativeDir,
        timeout: 60000
      });
      
      // Build
      console.log('🔨 Compiling...');
      await execAsync(`cmake --build "${buildDir}" --config Release`, {
        cwd: this.nativeDir,
        timeout: 300000
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
      throw error;
    }
  }

  async downloadAndConvertModels() {
    console.log('📥 Downloading and converting pyannote models...');
    
    // For now, download pre-converted ONNX models from a CDN or your own hosting
    // In production, you'd want to convert PyTorch models to ONNX format
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

  async copyONNXRuntimeFiles(onnxDir) {
    // Find the extracted ONNX Runtime directory
    const entries = await fs.readdir(onnxDir);
    const onnxRuntimeDir = entries.find(entry => entry.startsWith('onnxruntime-'));
    
    if (!onnxRuntimeDir) {
      throw new Error('ONNX Runtime directory not found after extraction');
    }
    
    const libDir = path.join(onnxDir, onnxRuntimeDir, 'lib');
    
    // Copy platform-specific runtime files
    if (this.platform === 'win32') {
      const files = ['onnxruntime.dll', 'onnxruntime_providers_shared.dll'];
      for (const file of files) {
        const srcPath = path.join(libDir, file);
        const destPath = path.join(this.binariesDir, file);
        try {
          await fs.copyFile(srcPath, destPath);
          console.log(`✅ Copied ${file}`);
        } catch (error) {
          console.warn(`⚠️ Failed to copy ${file}:`, error.message);
        }
      }
    } else if (this.platform === 'darwin') {
      const files = ['libonnxruntime.dylib', 'libonnxruntime_providers_shared.dylib'];
      for (const file of files) {
        const srcPath = path.join(libDir, file);
        const destPath = path.join(this.binariesDir, file);
        try {
          await fs.copyFile(srcPath, destPath);
          console.log(`✅ Copied ${file}`);
        } catch (error) {
          console.warn(`⚠️ Failed to copy ${file}:`, error.message);
        }
      }
    } else {
      const files = ['libonnxruntime.so', 'libonnxruntime_providers_shared.so'];
      for (const file of files) {
        const srcPath = path.join(libDir, file);
        const destPath = path.join(this.binariesDir, file);
        try {
          await fs.copyFile(srcPath, destPath);
          console.log(`✅ Copied ${file}`);
        } catch (error) {
          console.warn(`⚠️ Failed to copy ${file}:`, error.message);
        }
      }
    }
  }

  async downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destination);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
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
      // Use built-in unzip or 7zip on Windows
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