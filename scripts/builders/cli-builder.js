// builders/cli-builder.js - C++ CLI compilation manager
const fs = require('fs').promises;
const path = require('path');
const { execAsync } = require('../utils/exec-utils');
const { BuildUtils } = require('../utils/build-utils');

class CLIBuilder {
  constructor(config, onnxManager) {
    this.config = config;
    this.onnxManager = onnxManager;
    this.platform = config.platform;
  }

  async buildDiarizeCLI() {
    console.log('🔨 Building diarize-cli executable...');
    
    // Create build directory
    const buildDir = path.join(this.config.tempDir, 'build');
    await BuildUtils.ensureDirectories(buildDir);
    
    // Configure with CMake
    await this.configureCMake(buildDir);
    
    // Build the executable
    await this.buildExecutable(buildDir);
    
    // Copy to binaries directory
    await this.copyExecutable();
    
    console.log('✅ diarize-cli build complete');
  }

  async configureCMake(buildDir) {
    console.log('📝 Configuring CMake...');
    
    const cmakeArgs = [
      '-DCMAKE_BUILD_TYPE=Release',
      `-DCMAKE_INSTALL_PREFIX=${this.config.binariesDir}`,
      `-DONNXRUNTIME_ROOT=${this.config.nativeDir}`,
      this.config.sourceDir
    ];
    
    try {
      await execAsync(`cmake ${cmakeArgs.join(' ')}`, {
        cwd: buildDir,
        timeout: 60000 // 1 minute
      });
      console.log('✅ CMake configuration successful');
    } catch (error) {
      console.error('❌ CMake configuration failed:', error.message);
      throw error;
    }
  }

  async buildExecutable(buildDir) {
    console.log('🔨 Building executable...');
    
    try {
      await execAsync('cmake --build . --config Release', {
        cwd: buildDir,
        timeout: 300000 // 5 minutes
      });
      console.log('✅ Build successful');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      throw error;
    }
  }

  async copyExecutable() {
    const platform = this.config.platform;
    const executableName = this.config.getExecutableName();
    
    // Try multiple possible locations for the executable
    const possiblePaths = [
      // Unix Makefiles (macOS/Linux)
      path.join(this.config.tempDir, 'build', executableName),
      // Visual Studio (Windows)
      path.join(this.config.tempDir, 'build', 'Release', executableName),
      path.join(this.config.tempDir, 'build', 'Debug', executableName),
      // Alternative locations
      path.join(this.config.tempDir, 'build', 'bin', executableName),
      path.join(this.config.tempDir, 'build', 'src', executableName)
    ];
    
    let sourcePath = null;
    
    // Find the actual executable location
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        sourcePath = possiblePath;
        console.log(`📍 Found executable at: ${sourcePath}`);
        break;
      } catch (error) {
        // Continue searching
      }
    }
    
    if (!sourcePath) {
      // List the build directory contents for debugging
      const buildDir = path.join(this.config.tempDir, 'build');
      try {
        const contents = await fs.readdir(buildDir, { withFileTypes: true });
        console.log('📋 Build directory contents:');
        for (const item of contents) {
          const type = item.isDirectory() ? '📁' : '📄';
          console.log(`  ${type} ${item.name}`);
          
          // If it's a directory, also list its contents
          if (item.isDirectory()) {
            try {
              const subContents = await fs.readdir(path.join(buildDir, item.name));
              console.log(`    Contents: ${subContents.join(', ')}`);
            } catch (err) {
              // Ignore errors reading subdirectories
            }
          }
        }
      } catch (error) {
        console.error('❌ Could not read build directory:', error.message);
      }
      
      throw new Error(`Executable ${executableName} not found in any expected location. Check build output above.`);
    }
    
    const destPath = path.join(this.config.binariesDir, executableName);
    
    await BuildUtils.copyFileWithInfo(sourcePath, destPath);
    
    // Make executable on Unix-like systems
    if (platform !== 'win32') {
      await execAsync(`chmod +x "${destPath}"`);
    }
    
    console.log(`✅ Executable copied to: ${destPath}`);
  }

  async verifyExecutable() {
    const executablePath = path.join(
      this.config.binariesDir,
      this.config.getExecutableName()
    );
    
    try {
      // Check if file exists and is executable
      await BuildUtils.checkFileSize(executablePath, 100 * 1024); // At least 100KB
      
      // Try running with --help
      const { stdout } = await execAsync(`"${executablePath}" --help`, {
        timeout: 5000
      });
      
      // Case-insensitive check for usage patterns
      const output = stdout.toLowerCase();
      const hasUsage = output.includes('usage:') || output.includes('options:');
      const hasDiarization = output.includes('diarization') || output.includes('speaker');
      
      // Additional validation - should contain expected CLI patterns
      const hasRequiredPatterns = output.includes('audio') && output.includes('model');
      
      return hasUsage && (hasDiarization || hasRequiredPatterns);
      
    } catch (error) {
      console.error('❌ Executable verification failed:', error.message);
      return false;
    }
  }

  async cleanBuildDir() {
    const buildDir = path.join(this.config.tempDir, 'build');
    
    try {
      await fs.rmdir(buildDir, { recursive: true });
      console.log('🧹 Cleaned build directory');
    } catch (error) {
      console.warn('⚠️ Failed to clean build directory:', error.message);
    }
  }
}

module.exports = { CLIBuilder };