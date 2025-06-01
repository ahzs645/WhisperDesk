const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

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

      // Prepare Whisper command
      const args = [
        '-c',
        `
import whisper
import json
import sys
import os

try:
    # Load model
    print("Loading Whisper model: ${model}", file=sys.stderr)
    model = whisper.load_model("${model}")
    
    # Transcribe audio
    print("Transcribing audio file...", file=sys.stderr)
    result = model.transcribe(
        "${filePath}",
        language=${language === 'auto' ? 'None' : `"${language}"`},
        task="${task}",
        temperature=${temperature},
        best_of=${bestOf},
        beam_size=${beamSize},
        word_timestamps=${enableWordTimestamps ? 'True' : 'False'}
    )
    
    # Format output
    output = {
        "text": result["text"],
        "language": result["language"],
        "segments": []
    }
    
    for segment in result["segments"]:
        segment_data = {
            "id": segment["id"],
            "start": segment["start"],
            "end": segment["end"],
            "text": segment["text"],
            "confidence": segment.get("avg_logprob", 0.0),
            "no_speech_prob": segment.get("no_speech_prob", 0.0)
        }
        
        if "words" in segment and segment["words"]:
            segment_data["words"] = [
                {
                    "word": word["word"],
                    "start": word["start"],
                    "end": word["end"],
                    "confidence": word.get("probability", 0.0)
                }
                for word in segment["words"]
            ]
        
        output["segments"].append(segment_data)
    
    # Add metadata
    output["metadata"] = {
        "provider": "whisper",
        "model": "${model}",
        "language": result["language"],
        "duration": max([s["end"] for s in result["segments"]] + [0]),
        "task": "${task}",
        "created_at": "$(new Date().toISOString())"
    }
    
    print(json.dumps(output, ensure_ascii=False, indent=2))
    
except Exception as e:
    error_output = {
        "error": str(e),
        "type": type(e).__name__
    }
    print(json.dumps(error_output), file=sys.stderr)
    sys.exit(1)
        `
      ];

      return new Promise((resolve, reject) => {
        const whisperProcess = spawn('python3', args, {
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
          if (stderr.includes('Loading Whisper model')) {
            this.emit('progress', { stage: 'loading_model', progress: 10 });
          } else if (stderr.includes('Transcribing audio')) {
            this.emit('progress', { stage: 'transcribing', progress: 50 });
          }
        });

        whisperProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              this.emit('progress', { stage: 'complete', progress: 100 });
              resolve(result);
            } catch (parseError) {
              reject(new Error(`Failed to parse Whisper output: ${parseError.message}`));
            }
          } else {
            try {
              const errorInfo = JSON.parse(stderr);
              reject(new Error(`Whisper transcription failed: ${errorInfo.error}`));
            } catch {
              reject(new Error(`Whisper transcription failed with code ${code}: ${stderr}`));
            }
          }
        });

        whisperProcess.on('error', (error) => {
          reject(new Error(`Failed to start Whisper process: ${error.message}`));
        });

        // Emit start event
        this.emit('progress', { stage: 'starting', progress: 0 });
      });

    } catch (error) {
      console.error('Whisper transcription error:', error);
      throw error;
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
}

module.exports = WhisperProvider;

