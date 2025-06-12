// config/diarization-config.js - Build configuration and constants
const path = require('path');
const os = require('os');

const ONNX_VERSIONS = {
  'win32': {
    'x64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-win-x64-1.16.3.zip'
  },
  'darwin': {
    'x64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-osx-x64-1.16.3.tgz',
    'arm64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-osx-arm64-1.16.3.tgz'
  },
  'linux': {
    'x64': 'https://github.com/microsoft/onnxruntime/releases/download/v1.16.3/onnxruntime-linux-x64-1.16.3.tgz'
  }
};

const ONNX_MODELS = [
  {
    name: 'segmentation-3.0.onnx',
    urls: [
      'https://huggingface.co/onnx-community/pyannote-segmentation-3.0/resolve/main/onnx/model.onnx',
      'https://huggingface.co/pyannote/segmentation-3.0/resolve/main/pytorch_model.bin',
      'https://github.com/pengzhendong/pyannote-onnx/releases/download/v1.0/segmentation-3.0.onnx'
    ],
    minSize: 5000000, // 5MB minimum
    description: 'Speaker segmentation model'
  },
  {
    name: 'embedding-1.0.onnx',
    urls: [
      'https://huggingface.co/deepghs/pyannote-embedding-onnx/resolve/main/model.onnx',
      'https://huggingface.co/pyannote/embedding/resolve/main/pytorch_model.bin',
      'https://github.com/pengzhendong/pyannote-onnx/releases/download/v1.0/embedding-1.0.onnx'
    ],
    minSize: 15000000, // 15MB minimum
    description: 'Speaker embedding model'
  }
];

const PLATFORM_DEPENDENCIES = {
  darwin: {
    compiler: 'clang++',
    compilerCheck: 'clang++ --version',
    compilerInstall: 'xcode-select --install',
    packages: ['jsoncpp'],
    packageManager: 'brew'
  },
  linux: {
    compiler: 'g++',
    compilerCheck: 'g++ --version',
    compilerInstall: 'apt-get install build-essential',
    packages: ['libjsoncpp-dev'],
    packageManager: 'apt-get'
  },
  win32: {
    compiler: 'Visual Studio',
    compilerCheck: null, // Visual Studio detection is more complex
    compilerInstall: 'Install Visual Studio with C++ tools',
    packages: [],
    packageManager: null
  }
};

const REQUIRED_SOURCE_FILES = [
  'diarize-cli.cpp',
  'CMakeLists.txt',
  'include/diarize-cli.h'
];

class BuildConfig {
  constructor() {
    this.platform = process.platform;
    this.arch = process.arch;
    this.projectRoot = path.resolve(__dirname, '../..');
    
    // Directory structure
    this.tempDir = path.join(this.projectRoot, 'temp', 'diarization-build');
    this.binariesDir = path.join(this.projectRoot, 'binaries');
    this.modelsDir = path.join(this.projectRoot, 'models');
    this.nativeDir = path.join(this.projectRoot, 'native');
    this.sourceDir = path.join(this.nativeDir, 'src');
  }

  getExecutableName() {
    const baseName = 'diarize-cli';
    if (this.platform === 'win32') {
      return `${baseName}.exe`;
    }
    return baseName;
  }

  getBuildType() {
    return 'Release';
  }

  getCMakeGenerator() {
    if (this.platform === 'win32') {
      return 'Visual Studio 17 2022';
    }
    return 'Unix Makefiles';
  }

  getCMakeArch() {
    if (this.platform === 'win32') {
      return this.arch === 'x64' ? 'x64' : 'Win32';
    }
    return this.arch;
  }

  getCMakeOptions() {
    return {
      CMAKE_BUILD_TYPE: this.getBuildType(),
      CMAKE_INSTALL_PREFIX: this.binariesDir,
      ONNXRUNTIME_ROOT: this.nativeDir
    };
  }

  getEnvironment() {
    const env = { ...process.env };
    
    // Platform-specific environment setup
    if (this.platform === 'darwin') {
      env.PKG_CONFIG_PATH = '/opt/homebrew/lib/pkgconfig:/usr/local/lib/pkgconfig';
    } else if (this.platform === 'linux') {
      const libPath = path.join(this.nativeDir, 'lib');
      env.LD_LIBRARY_PATH = env.LD_LIBRARY_PATH ? 
        `${env.LD_LIBRARY_PATH}:${libPath}` : libPath;
    }
    
    return env;
  }

  getONNXDownloadUrl() {
    return ONNX_VERSIONS[this.platform]?.[this.arch];
  }

  getPlatformDependencies() {
    return PLATFORM_DEPENDENCIES[this.platform];
  }

  getRequiredModels() {
    return ONNX_MODELS;
  }

  getRequiredSourceFiles() {
    return REQUIRED_SOURCE_FILES;
  }
}

module.exports = {
  BuildConfig,
  ONNX_VERSIONS,
  ONNX_MODELS,
  PLATFORM_DEPENDENCIES,
  REQUIRED_SOURCE_FILES
};