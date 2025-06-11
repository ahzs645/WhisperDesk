// src/main/services/diarization-binary-manager.js
class DiarizationBinaryManager {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.binariesDir = this.getBinariesDirectory();
    
    // Required ONNX Runtime files per platform
    this.requiredFiles = this.getRequiredFiles();
  }

  getRequiredFiles() {
    if (this.platform === 'win32') {
      return {
        // Windows ONNX Runtime files
        dlls: [
          'onnxruntime.dll',
          'onnxruntime_providers_shared.dll'
        ],
        executable: 'diarize-cli.exe',
        all: [
          'onnxruntime.dll',
          'onnxruntime_providers_shared.dll', 
          'diarize-cli.exe'
        ]
      };
    } else if (this.platform === 'darwin') {
      return {
        dlls: [
          'libonnxruntime.dylib',
          'libonnxruntime_providers_shared.dylib'
        ],
        executable: 'diarize-cli',
        all: [
          'libonnxruntime.dylib',
          'libonnxruntime_providers_shared.dylib',
          'diarize-cli'
        ]
      };
    } else {
      return {
        dlls: [
          'libonnxruntime.so',
          'libonnxruntime_providers_shared.so'
        ],
        executable: 'diarize-cli',
        all: [
          'libonnxruntime.so',
          'libonnxruntime_providers_shared.so',
          'diarize-cli'
        ]
      };
    }
  }

  async ensureDiarizationBinary() {
    const binaryPath = this.getDiarizationBinaryPath();
    
    try {
      // Check main executable
      await fs.access(binaryPath, fs.constants.F_OK | fs.constants.X_OK);
      
      // Check all required ONNX Runtime files
      const missingFiles = [];
      for (const fileName of this.requiredFiles.all) {
        const filePath = path.join(this.binariesDir, fileName);
        try {
          await fs.access(filePath, fs.constants.F_OK);
        } catch (error) {
          missingFiles.push(fileName);
        }
      }
      
      if (missingFiles.length > 0) {
        console.error(`❌ Missing required diarization files: ${missingFiles.join(', ')}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Diarization binary verification failed: ${error.message}`);
      return false;
    }
  }

  getDiarizationBinaryPath() {
    return path.join(this.binariesDir, this.requiredFiles.executable);
  }

  getBinariesDirectory() {
    // Reuse existing whisper binaries directory structure
    const projectBinaries = path.join(process.cwd(), 'binaries');
    
    if (process.env.NODE_ENV === 'development' || require('fs').existsSync(projectBinaries)) {
      return projectBinaries;
    } else {
      try {
        return path.join(process.resourcesPath, 'binaries');
      } catch (error) {
        return projectBinaries;
      }
    }
  }
}