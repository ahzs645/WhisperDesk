// models-config.js
// Whisper model definitions and configurations

const WHISPER_MODELS = [
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    provider: 'OpenAI',
    size: '39 MB',
    sizeBytes: 39000000,
    languages: ['en'],
    description: 'Fastest model, English only, good for real-time transcription',
    accuracy: 'Basic',
    speed: 'Very Fast',
    requirements: {
      ram: '1 GB',
      disk: '50 MB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    checksum: '65147644a518d12f04e32d6f83b26e78e39ff953a90edea0b0f4b7c8b8e0e5de',
    version: '1.0.0',
    type: 'whisper',
    expectedFilename: 'ggml-tiny.bin'
  },
  {
    id: 'whisper-base',
    name: 'Whisper Base',
    provider: 'OpenAI',
    size: '142 MB',
    sizeBytes: 142000000,
    languages: ['multilingual'],
    description: 'Good balance of speed and accuracy, supports multiple languages',
    accuracy: 'Good',
    speed: 'Fast',
    requirements: {
      ram: '2 GB',
      disk: '200 MB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    checksum: 'ed3a0b6b1c0edf879ad9b11b1af5a0e6ab5db9205f891f668f8b0e6c6326e34e',
    version: '1.0.0',
    type: 'whisper',
    expectedFilename: 'ggml-base.bin'
  },
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    provider: 'OpenAI',
    size: '461 MB',
    sizeBytes: 461000000,
    languages: ['multilingual'],
    description: 'Better accuracy than base, still reasonably fast',
    accuracy: 'Very Good',
    speed: 'Medium',
    requirements: {
      ram: '4 GB',
      disk: '500 MB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    checksum: '9ecf779972d90ba49c06d968637d720dd632c55bbf19a9b982f6b20a0e4b1b8e',
    version: '1.0.0',
    type: 'whisper',
    expectedFilename: 'ggml-small.bin'
  },
  {
    id: 'whisper-medium',
    name: 'Whisper Medium',
    provider: 'OpenAI',
    size: '1.42 GB',
    sizeBytes: 1420000000,
    languages: ['multilingual'],
    description: 'High accuracy, good for professional transcription',
    accuracy: 'Excellent',
    speed: 'Medium-Slow',
    requirements: {
      ram: '6 GB',
      disk: '1.5 GB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    checksum: '345ae4da62f9b3d59415adc60127b97c714f32e89e936602e85993674d08dcb1',
    version: '1.0.0',
    type: 'whisper',
    expectedFilename: 'ggml-medium.bin'
  },
  {
    id: 'whisper-large-v2',
    name: 'Whisper Large v2',
    provider: 'OpenAI',
    size: '2.87 GB',
    sizeBytes: 2870000000,
    languages: ['multilingual'],
    description: 'Best accuracy, slower processing, ideal for high-quality transcription',
    accuracy: 'Outstanding',
    speed: 'Slow',
    requirements: {
      ram: '8 GB',
      disk: '3 GB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin',
    checksum: '81f7c96c852ee8fc832187b0132e569d6c3065a3252ed18e56effd0b6a73e524',
    version: '2.0.0',
    type: 'whisper',
    expectedFilename: 'ggml-large-v2.bin'
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large v3',
    provider: 'OpenAI',
    size: '2.87 GB',
    sizeBytes: 2870000000,
    languages: ['multilingual'],
    description: 'Latest and most accurate model, best for professional use',
    accuracy: 'Outstanding',
    speed: 'Slow',
    requirements: {
      ram: '8 GB',
      disk: '3 GB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    checksum: 'e4b87e7e0bf463eb8e6956e646f1e277e901512310def2c24bf0e11bd3c28e9a',
    version: '3.0.0',
    type: 'whisper',
    expectedFilename: 'ggml-large-v3.bin'
  }
];

// Model name mapping for whisper.cpp compatibility
const MODEL_NAME_MAPPING = {
  'whisper-tiny.bin': 'ggml-tiny.bin',
  'whisper-base.bin': 'ggml-base.bin',
  'whisper-small.bin': 'ggml-small.bin',
  'whisper-medium.bin': 'ggml-medium.bin',
  'whisper-large.bin': 'ggml-large-v3.bin',
  'whisper-large-v2.bin': 'ggml-large-v2.bin',
  'whisper-large-v3.bin': 'ggml-large-v3.bin',
  
  // Handle different variations
  'tiny.bin': 'ggml-tiny.bin',
  'base.bin': 'ggml-base.bin',
  'small.bin': 'ggml-small.bin',
  'medium.bin': 'ggml-medium.bin',
  'large.bin': 'ggml-large-v3.bin',
  'large-v2.bin': 'ggml-large-v2.bin',
  'large-v3.bin': 'ggml-large-v3.bin'
};

// Configuration constants
const CONFIG = {
  MAX_CONCURRENT_DOWNLOADS: 2,
  DOWNLOAD_TIMEOUT: 30000,
  PROGRESS_EMIT_INTERVAL: 1000, // ms
  PROGRESS_EMIT_SIZE_THRESHOLD: 1024 * 1024, // 1MB
};

module.exports = {
  WHISPER_MODELS,
  MODEL_NAME_MAPPING,
  CONFIG
};