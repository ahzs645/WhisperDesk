const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const process = require('process');

class WhisperProvider extends EventEmitter {
  constructor(modelManager) {
    super();
    this.isInitialized = false;
    this.modelManager = modelManager;
    this.availableModels = [
      'tiny', 'tiny.en', 'base', 'base.en', 'small', 'small.en', 
      'medium', 'medium.en', 'large-v1', 'large-v2', 'large-v3'
    ];
    this.modelPath = path.join(os.homedir(), '.whisperdesk', 'models');
  }

  getName() {
    return 'Whisper';
  }

  getDescription() {
    return 'OpenAI\'s Whisper model for high-quality speech recognition';
  }

  getCapabilities() {
    return {
      realtime: false,
      fileTranscription: true,
      speakerDiarization: false,
      languageDetection: true,
      wordTimestamps: true
    };
  }

  isAvailable() {
    return this.isInitialized;
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Create models directory
      await fs.mkdir(this.modelPath, { recursive: true });
      
      // Check if Python is available (we'll need it for transcription)
      await this.checkPython();
      
      this.isInitialized = true;
      console.log('Whisper provider initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Whisper provider:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async checkPython() {
    return new Promise((resolve, reject) => {
      // Check if Python is available
      const pythonCheck = spawn('python3', ['--version']);
      
      pythonCheck.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Python3 not found. Please install Python 3.8 or later'));
        }
      });
      
      pythonCheck.on('error', () => {
        reject(new Error('Python3 not found. Please install Python 3.8 or later'));
      });
    });
  }

  async transcribeFile(filePath, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Whisper provider not initialized');
    }

    const {
      model = 'base',
      language = 'auto',
      task = 'transcribe',
      outputFormat = 'json',
      enableTimestamps = true,
      enableWordTimestamps = true,
      temperature = 0.0,
      bestOf = 5,
      beamSize = 5
    } = options;

    try {
      // Validate model
      if (!this.availableModels.includes(model)) {
        throw new Error(`Invalid model: ${model}. Available models: ${this.availableModels.join(', ')}`);
      }

      // Create output directory
      const outputDir = path.join(os.tmpdir(), 'whisperdesk-transcription');
      await fs.mkdir(outputDir, { recursive: true });

      // Prepare Whisper command arguments
      const args = [
        filePath,
        '--model', model,
        '--output_dir', outputDir,
        '--output_format', outputFormat,
        '--temperature', temperature.toString(),
        '--best_of', bestOf.toString(),
        '--beam_size', beamSize.toString()
      ];

      // Add word timestamps if enabled
      if (enableWordTimestamps) {
        args.push('--word_timestamps', 'True');
      }

      if (language !== 'auto') {
        args.push('--language', language);
      }

      if (task === 'translate') {
        args.push('--task', 'translate');
      }

      return new Promise((resolve, reject) => {
        const whisperProcess = spawn('whisper', args, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        whisperProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        whisperProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          
          // Emit progress events based on stderr output
          if (stderr.includes('Loading model')) {
            this.emit('progress', { stage: 'loading_model', progress: 10 });
          } else if (stderr.includes('Transcribing')) {
            this.emit('progress', { stage: 'transcribing', progress: 50 });
          }
        });

        whisperProcess.on('close', async (code) => {
          if (code === 0) {
            try {
              // Read the output file
              const outputFile = path.join(outputDir, path.basename(filePath, path.extname(filePath)) + '.json');
              const output = JSON.parse(await fs.readFile(outputFile, 'utf8'));
              
              // Clean up
              await fs.rm(outputDir, { recursive: true, force: true });
              
              resolve(output);
            } catch (error) {
              reject(new Error(`Failed to read transcription output: ${error.message}`));
            }
          } else {
            reject(new Error(`Transcription failed: ${stderr}`));
          }
        });

        whisperProcess.on('error', (error) => {
          reject(new Error(`Failed to start transcription process: ${error.message}`));
        });
      });
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  async transcribeRealtime(audioStream, options = {}) {
    // Real-time transcription would require a more complex implementation
    // This is a placeholder for future real-time functionality
    throw new Error('Real-time transcription not yet implemented for Whisper provider');
  }

  async getAvailableModels() {
    return this.availableModels.map(modelName => ({
      id: `whisper-${modelName}`,
      name: `Whisper ${modelName.charAt(0).toUpperCase() + modelName.slice(1)}`,
      provider: 'whisper',
      type: 'local',
      size: this.getModelSize(modelName),
      languages: modelName.includes('.en') ? ['English'] : ['Multilingual'],
      accuracy: this.getModelAccuracy(modelName),
      speed: this.getModelSpeed(modelName),
      description: this.getModelDescription(modelName)
    }));
  }

  getModelSize(modelName) {
    const sizes = {
      'tiny': '39 MB',
      'tiny.en': '39 MB',
      'base': '142 MB',
      'base.en': '142 MB',
      'small': '461 MB',
      'small.en': '461 MB',
      'medium': '1.42 GB',
      'medium.en': '1.42 GB',
      'large-v1': '2.87 GB',
      'large-v2': '2.87 GB',
      'large-v3': '2.87 GB'
    };
    return sizes[modelName] || 'Unknown';
  }

  getModelAccuracy(modelName) {
    if (modelName.includes('tiny')) return 'Basic';
    if (modelName.includes('base')) return 'Good';
    if (modelName.includes('small')) return 'Better';
    if (modelName.includes('medium')) return 'High';
    if (modelName.includes('large')) return 'Excellent';
    return 'Unknown';
  }

  getModelSpeed(modelName) {
    if (modelName.includes('tiny')) return 'Very Fast';
    if (modelName.includes('base')) return 'Fast';
    if (modelName.includes('small')) return 'Medium';
    if (modelName.includes('medium')) return 'Slow';
    if (modelName.includes('large')) return 'Very Slow';
    return 'Unknown';
  }

  getModelDescription(modelName) {
    const descriptions = {
      'tiny': 'Fastest model, English only, basic accuracy',
      'tiny.en': 'Fastest model, English only, basic accuracy',
      'base': 'Good balance of speed and accuracy, multilingual',
      'base.en': 'Good balance of speed and accuracy, English only',
      'small': 'Better accuracy, still reasonably fast, multilingual',
      'small.en': 'Better accuracy, still reasonably fast, English only',
      'medium': 'High accuracy, slower processing, multilingual',
      'medium.en': 'High accuracy, slower processing, English only',
      'large-v1': 'Excellent accuracy, slow processing, multilingual',
      'large-v2': 'Excellent accuracy, slow processing, multilingual (improved)',
      'large-v3': 'Best accuracy, slow processing, multilingual (latest)'
    };
    return descriptions[modelName] || 'Whisper transcription model';
  }

  async isModelAvailable(modelName) {
    try {
      // Check if model is already downloaded by trying to load it
      return new Promise((resolve) => {
        const checkProcess = spawn('python3', [
          '-c',
          `
import whisper
try:
    whisper.load_model("${modelName}")
    print("available")
except:
    print("not_available")
          `
        ]);

        let output = '';
        checkProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        checkProcess.on('close', () => {
          resolve(output.trim() === 'available');
        });

        checkProcess.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      return false;
    }
  }

  async downloadModel(modelName) {
    if (!this.availableModels.includes(modelName)) {
      throw new Error(`Invalid model: ${modelName}`);
    }

    // Get the model info from the model manager
    const modelId = `whisper-${modelName}`;
    const modelInfo = await this.modelManager.getModelInfo(modelId);
    
    if (!modelInfo) {
      throw new Error(`Model info not found for ${modelName}`);
    }

    // Set up event listeners for download progress
    this.modelManager.on('download-progress', (data) => {
      if (data.modelId === modelId) {
        this.emit('download-progress', {
          model: modelName,
          progress: data.progress,
          downloadedBytes: data.downloadedBytes,
          totalBytes: data.totalBytes,
          speed: data.speed
        });
      }
    });

    this.modelManager.on('download-complete', (data) => {
      if (data.modelId === modelId) {
        this.emit('download-complete', { model: modelName });
      }
    });

    this.modelManager.on('download-error', (data) => {
      if (data.modelId === modelId) {
        this.emit('download-error', { model: modelName, error: data.error });
      }
    });

    // Use the model manager's download method
    await this.modelManager.downloadModel(modelId);
  }

  async cleanup() {
    // Cleanup any temporary files or processes
    console.log('Whisper provider cleanup complete');
  }

  async processFile(filePath, options = {}) {
    const {
      transcriptionId,
      model = 'base',
      language = 'auto',
      task = 'transcribe',
      outputFormat = 'json',
      enableTimestamps = true,
      enableWordTimestamps = true,
      temperature = 0.0,
      bestOf = 5,
      beamSize = 5
    } = options;

    if (!this.isInitialized) {
      throw new Error('Whisper provider not initialized');
    }

    try {
      // Extract base model name (remove 'whisper-' prefix if present)
      const baseModelName = model.replace('whisper-', '');

      // Validate model
      if (!this.availableModels.includes(baseModelName)) {
        throw new Error(`Invalid model: ${model}. Available models: ${this.availableModels.map(m => `whisper-${m}`).join(', ')}`);
      }

      // Ensure filePath is a string
      if (typeof filePath !== 'string') {
        throw new Error('Invalid file path: must be a string');
      }

      // Check if model is available and download if needed
      const isAvailable = await this.isModelAvailable(baseModelName);
      if (!isAvailable) {
        this.emit('progress', { transcriptionId, stage: 'downloading_model', progress: 0 });
        try {
          await this.downloadModel(baseModelName);
        } catch (error) {
          // If the error is about the model being already installed, we can continue
          if (!error.message.includes('already installed')) {
            throw error;
          }
        }
      }

      // Create output directory
      const outputDir = path.join(process.cwd(), 'transcriptions');
      await fs.mkdir(outputDir, { recursive: true });

      // Prepare Whisper command arguments
      const args = [
        filePath,
        '--model', baseModelName,
        '--output_dir', outputDir,
        '--output_format', outputFormat,
        '--temperature', temperature.toString(),
        '--best_of', bestOf.toString(),
        '--beam_size', beamSize.toString(),
        '--verbose', 'True'  // Add verbose output for better progress tracking
      ];

      // Add word timestamps if enabled
      if (enableWordTimestamps) {
        args.push('--word_timestamps', 'True');
      }

      if (language !== 'auto') {
        args.push('--language', language);
      }

      if (task === 'translate') {
        args.push('--task', 'translate');
      }

      return new Promise((resolve, reject) => {
        console.log('Starting Whisper process with args:', args);
        
        const whisperProcess = spawn('whisper', args, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';
        let progress = 0;

        whisperProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        whisperProcess.stderr.on('data', (data) => {
          stderr += data.toString();
          console.log('Whisper stderr:', stderr);
          
          // Emit progress events based on stderr output
          if (stderr.includes('Loading model')) {
            progress = 10;
            this.emit('progress', { transcriptionId, stage: 'loading_model', progress });
          } else if (stderr.includes('Transcribing')) {
            progress = 50;
            this.emit('progress', { transcriptionId, stage: 'transcribing', progress });
          } else if (stderr.includes('Processing audio')) {
            progress = 75;
            this.emit('progress', { transcriptionId, stage: 'processing', progress });
          }
        });

        whisperProcess.on('close', async (code) => {
          console.log('Whisper process exited with code:', code);
          
          if (code === 0) {
            try {
              // Get the base filename without extension
              const baseFileName = path.basename(filePath, path.extname(filePath));
              
              // Read the output file based on format
              let output;
              if (outputFormat === 'json') {
                const outputFile = path.join(outputDir, `${baseFileName}.json`);
                output = JSON.parse(await fs.readFile(outputFile, 'utf8'));
              } else {
                const outputFile = path.join(outputDir, `${baseFileName}.${outputFormat}`);
                const text = await fs.readFile(outputFile, 'utf8');
                output = { text };
              }
              
              // Emit completion event
              this.emit('complete', { 
                transcriptionId, 
                result: {
                  text: output.text,
                  segments: output.segments || [],
                  language: output.language || 'unknown'
                }
              });
              
              // Clean up
              await fs.rm(outputDir, { recursive: true, force: true });
              
              resolve(output);
            } catch (error) {
              console.error('Error reading transcription output:', error);
              this.emit('error', { transcriptionId, error: error.message });
              reject(new Error(`Failed to read transcription output: ${error.message}`));
            }
          } else {
            console.error('Transcription failed:', stderr);
            this.emit('error', { transcriptionId, error: stderr });
            reject(new Error(`Transcription failed: ${stderr}`));
          }
        });

        whisperProcess.on('error', (error) => {
          console.error('Failed to start transcription process:', error);
          this.emit('error', { transcriptionId, error: error.message });
          reject(new Error(`Failed to start transcription process: ${error.message}`));
        });
      });
    } catch (error) {
      console.error('Transcription error:', error);
      this.emit('error', { transcriptionId, error: error.message });
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }

  async startTranscription(options = {}) {
    if (!this.isInitialized) {
      throw new Error('Whisper provider not initialized');
    }

    const {
      model = 'base',
      language = 'auto',
      task = 'transcribe',
      outputFormat = 'json',
      enableTimestamps = true,
      enableWordTimestamps = true,
      temperature = 0.0,
      bestOf = 5,
      beamSize = 5
    } = options;

    try {
      // Validate model
      if (!this.availableModels.includes(model)) {
        throw new Error(`Invalid model: ${model}. Available models: ${this.availableModels.join(', ')}`);
      }

      // For now, we'll just return success since real-time transcription is not implemented
      return {
        success: true,
        message: 'Real-time transcription is not supported by Whisper provider'
      };
    } catch (error) {
      throw new Error(`Failed to start transcription: ${error.message}`);
    }
  }

  async stopTranscription(transcriptionId) {
    // For now, we'll just return success since real-time transcription is not implemented
    return {
      success: true,
      message: 'Real-time transcription is not supported by Whisper provider'
    };
  }
}

module.exports = WhisperProvider;

