import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { Store } from '@tauri-apps/plugin-store';
import { appDataDir, join } from '@tauri-apps/api/path';

/**
 * VibeBridge - A bridge to interface WhisperDesk UI with Vibe's backend
 * This allows using the Vibe recorder backend directly while keeping WhisperDesk's UI
 * The Vibe path can be updated dynamically without changing WhisperDesk code
 */
class VibeBridge {
  constructor() {
    this.listeners = new Map();
    this.store = new Store('vibe-config.json');
    this.vibeBasePath = '/Users/ahzs645/Github/WhisperDesk/vibe-main';
    this.isInitialized = false;
    this.modelContext = null;
    this.recordingState = {
      isRecording: false,
      devices: [],
      currentDevice: null
    };
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load Vibe configuration
      const config = await this.store.get('vibeConfig');
      if (config?.basePath) {
        this.vibeBasePath = config.basePath;
      }
      
      // Initialize model context
      await this.loadDefaultModel();
      
      this.isInitialized = true;
      console.log('✅ VibeBridge initialized with Vibe path:', this.vibeBasePath);
    } catch (error) {
      console.error('Failed to initialize VibeBridge:', error);
      throw error;
    }
  }

  async setVibePath(path) {
    this.vibeBasePath = path;
    await this.store.set('vibeConfig', { basePath: path });
    console.log('Updated Vibe base path to:', path);
  }

  /**
   * Map WhisperDesk commands to Vibe's command structure
   * Vibe uses a different command naming convention
   */
  mapToVibeCommand(whisperDeskCommand) {
    const commandMap = {
      // Core transcription commands
      'transcribe-audio': 'transcribe',
      'transcribe_audio': 'transcribe',
      
      // Model management
      'load-model': 'load_model',
      'load_whisper_model': 'load_model',
      'download-model': 'download_model',
      'get-models': 'glob_files',
      'get_available_models': 'glob_files',
      
      // Audio recording
      'start-recording': 'start_record',
      'stop-recording': 'stop_record',
      'get-audio-devices': 'get_audio_devices',
      'start_record': 'start_record',
      
      // File operations
      'export-transcript': 'export_transcript',
      'save-transcript': 'save_transcript',
      
      // System info
      'get-cuda-version': 'get_cuda_version',
      'get-rocm-version': 'get_rocm_version',
      'is-avx2-enabled': 'is_avx2_enabled',
      'check-vulkan': 'check_vulkan',
      
      // Paths
      'get-models-folder': 'get_models_folder',
      'get-save-path': 'get_save_path',
      'get-ffmpeg-path': 'get_ffmpeg_path',
      
      // Network
      'is-online': 'is_online',
      
      // YouTube download (if needed)
      'download-audio': 'ytdlp_download_audio'
    };

    return commandMap[whisperDeskCommand] || whisperDeskCommand;
  }

  /**
   * Transform WhisperDesk arguments to Vibe's expected format
   */
  transformArgs(command, args) {
    const vibeCommand = this.mapToVibeCommand(command);
    
    switch (vibeCommand) {
      case 'transcribe':
        // Vibe expects: { path, options: TranscribeOptions }
        if (typeof args[0] === 'string') {
          return {
            path: args[0],
            options: args[1] || {
              lang: null,
              verbose: false,
              n_threads: 4,
              translate: false,
              word_timestamps: true,
              max_sentence_len: 1000
            }
          };
        }
        return args[0];
        
      case 'load_model':
        // Vibe expects: { model_path, gpu_device?, use_gpu? }
        if (typeof args[0] === 'string') {
          return {
            model_path: args[0],
            gpu_device: args[1]?.gpu_device,
            use_gpu: args[1]?.use_gpu !== false
          };
        }
        return args[0];
        
      case 'start_record':
        // Vibe expects: device information
        return {
          device: args[0] || 'default',
          sample_rate: args[1]?.sampleRate || 16000
        };
        
      case 'glob_files':
        // For getting models, use glob pattern
        return {
          pattern: '*.bin',
          path: args[0] || await this.getModelsPath()
        };
        
      case 'download_model':
        // Vibe expects: { url, name }
        return {
          url: args[0]?.url || args[0],
          name: args[0]?.name || 'model.bin'
        };
        
      default:
        // Pass through for other commands
        if (args.length === 0) return undefined;
        if (args.length === 1) return args[0];
        return { args };
    }
  }

  /**
   * Transform Vibe responses back to WhisperDesk format
   */
  transformResponse(command, response) {
    const vibeCommand = this.mapToVibeCommand(command);
    
    switch (vibeCommand) {
      case 'transcribe':
        // Transform Vibe's transcript format to WhisperDesk's format
        if (response?.segments) {
          return {
            text: response.text || response.segments.map(s => s.text).join(' '),
            segments: response.segments.map(seg => ({
              start: seg.start || seg.t0,
              end: seg.end || seg.t1,
              text: seg.text,
              speaker: seg.speaker || null,
              confidence: seg.confidence
            })),
            language: response.language,
            duration: response.duration || 
                     response.segments[response.segments.length - 1]?.end || 0
          };
        }
        return response;
        
      case 'glob_files':
        // Transform file list to model list for WhisperDesk
        if (Array.isArray(response)) {
          return response.map(path => {
            const name = path.split('/').pop();
            const sizeMap = {
              'tiny': '39 MB',
              'base': '74 MB',
              'small': '244 MB',
              'medium': '769 MB',
              'large': '1550 MB'
            };
            const modelType = Object.keys(sizeMap).find(t => name.includes(t)) || 'custom';
            return {
              id: name.replace('.bin', ''),
              name: name,
              path: path,
              size: sizeMap[modelType] || 'Unknown',
              language: name.includes('.en') ? 'English' : 'Multilingual',
              type: modelType
            };
          });
        }
        return response;
        
      default:
        return response;
    }
  }

  /**
   * Main invoke method that bridges WhisperDesk to Vibe
   */
  async invoke(channel, ...args) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      console.log(`🔄 VibeBridge: ${channel} -> Vibe command`);
      
      const vibeCommand = this.mapToVibeCommand(channel);
      const transformedArgs = this.transformArgs(channel, args);
      
      console.log(`📤 Calling Vibe: ${vibeCommand}`, transformedArgs);
      
      let response;
      if (transformedArgs === undefined) {
        response = await invoke(vibeCommand);
      } else {
        response = await invoke(vibeCommand, transformedArgs);
      }
      
      const transformed = this.transformResponse(channel, response);
      console.log(`📥 Response from Vibe:`, transformed);
      
      return transformed;
    } catch (error) {
      console.error(`❌ VibeBridge error for ${channel}:`, error);
      
      // Provide fallback for critical operations
      if (channel === 'get-audio-devices' || channel === 'get_audio_devices') {
        return [{
          name: 'Default Microphone',
          id: 'default',
          isDefault: true
        }];
      }
      
      throw error;
    }
  }

  /**
   * Event listening bridge
   */
  on(channel, callback) {
    // Map WhisperDesk events to Vibe events
    const eventMap = {
      'transcribe-progress': 'transcribe_progress',
      'recording-status': 'recording_status',
      'model-download-progress': 'download_progress'
    };
    
    const vibeEvent = eventMap[channel] || channel;
    
    const unlisten = listen(vibeEvent, (event) => {
      // Transform event payload if needed
      const payload = this.transformEventPayload(channel, event.payload);
      callback(event, payload);
    });
    
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel).push(unlisten);
    
    return unlisten;
  }

  transformEventPayload(channel, payload) {
    // Transform Vibe event payloads to WhisperDesk format if needed
    switch (channel) {
      case 'transcribe-progress':
        return {
          progress: payload.progress || payload,
          status: payload.status || 'processing'
        };
      default:
        return payload;
    }
  }

  removeListener(channel) {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.forEach(unlisten => unlisten.then(fn => fn()));
      this.listeners.delete(channel);
    }
  }

  async send(channel, ...args) {
    return this.invoke(channel, ...args);
  }

  // Helper methods
  async getModelsPath() {
    try {
      const modelsPath = await invoke('get_models_folder');
      return modelsPath;
    } catch {
      const appData = await appDataDir();
      return await join(appData, 'models');
    }
  }

  async loadDefaultModel() {
    try {
      // Try to load a default model if available
      const models = await this.invoke('get_available_models');
      if (models && models.length > 0) {
        const defaultModel = models.find(m => m.type === 'base') || models[0];
        if (defaultModel?.path) {
          await this.invoke('load-model', defaultModel.path);
          this.modelContext = defaultModel;
          console.log('📦 Loaded default model:', defaultModel.name);
        }
      }
    } catch (error) {
      console.warn('Could not load default model:', error);
    }
  }

  // Audio recording helpers
  async startRecording(device = 'default', options = {}) {
    try {
      const result = await this.invoke('start-recording', device, options);
      this.recordingState.isRecording = true;
      this.recordingState.currentDevice = device;
      
      // Emit recording started event
      await emit('recording-started', { device });
      
      return result;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    try {
      const audioPath = await this.invoke('stop-recording');
      this.recordingState.isRecording = false;
      
      // Emit recording stopped event
      await emit('recording-stopped', { path: audioPath });
      
      // Auto-transcribe if model is loaded
      if (this.modelContext) {
        console.log('🎯 Auto-transcribing recorded audio...');
        const transcript = await this.invoke('transcribe-audio', audioPath);
        await emit('transcription-complete', transcript);
        return { audioPath, transcript };
      }
      
      return { audioPath };
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  getRecordingState() {
    return this.recordingState;
  }

  // Settings bridge
  async getSettings(key) {
    try {
      return await this.store.get(key);
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  }

  async saveSettings(key, value) {
    try {
      await this.store.set(key, value);
      return true;
    } catch (error) {
      console.error('Error saving setting:', error);
      return false;
    }
  }
}

// Create singleton instance
const vibeBridge = new VibeBridge();

// Auto-initialize on import
(async () => {
  try {
    await vibeBridge.initialize();
  } catch (error) {
    console.warn('VibeBridge initialization deferred:', error);
  }
})();

export default vibeBridge;