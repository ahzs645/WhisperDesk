import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { Store } from '@tauri-apps/plugin-store';

// Store instance for settings
const store = new Store('settings.json');

// Bridge to convert Electron IPC to Tauri commands
class TauriBridge {
  constructor() {
    this.listeners = new Map();
    this.store = store;
  }

  // Replace electron.ipcRenderer.invoke
  async invoke(channel, ...args) {
    try {
      // Map Electron IPC channels to Tauri commands
      const commandMap = {
        'transcribe-audio': 'transcribe_audio',
        'start-recording': 'start_recording',
        'stop-recording': 'stop_recording',
        'get-audio-devices': 'get_audio_devices',
        'get-models': 'get_models',
        'download-model': 'download_model',
        'get-settings': 'get_settings',
        'save-settings': 'save_settings',
        'export-transcript': 'export_transcript',
        'get-app-version': 'get_app_version',
        'open-file-dialog': 'open_file_dialog',
        'save-file-dialog': 'save_file_dialog',
        'read-file': 'read_file',
        'write-file': 'write_file',
        'get-screens': 'get_screens',
        'start-screen-recording': 'start_screen_recording',
        'stop-screen-recording': 'stop_screen_recording',
        'get-recording-status': 'get_recording_status',
        'process-diarization': 'process_diarization',
        'analyze-sentiment': 'analyze_sentiment',
        'extract-topics': 'extract_topics',
        'load-model': 'load_whisper_model',
        'get-available-models': 'get_available_models',
        'start-record': 'start_record',
      };

      const tauriCommand = commandMap[channel] || channel;
      
      // Handle different argument patterns for Tauri commands
      console.log(`🔍 TauriBridge invoking ${tauriCommand} with args:`, args);
      
      if (args.length === 0) {
        return await invoke(tauriCommand);
      } else if (tauriCommand === 'transcribe_audio') {
        // transcribe_audio always needs special handling regardless of arg count
        const path = args[0];
        const options = args[1] || null;
        console.log(`🎵 Transcribe audio - path: ${path}, options:`, options);
        return await invoke(tauriCommand, { path, options });
      } else if (args.length === 1) {
        // Single argument - pass directly for most commands (except special cases)
        if (tauriCommand === 'start_screen_recording') {
          // Handle single argument as options object for screen recording
          const options = args[0];
          return await invoke(tauriCommand, { 
            screen_id: options.screenId || options.screen_id || 'primary', 
            include_audio: options.includeAudio || options.include_audio || false 
          });
        } else {
          return await invoke(tauriCommand, args[0]);
        }
      } else {
        // For multiple arguments, create an object with appropriate keys
        if (tauriCommand === 'start_screen_recording') {
          return await invoke(tauriCommand, { 
            screen_id: args[0], 
            include_audio: args[1] 
          });
        } else {
          // Default: put all args in an array
          return await invoke(tauriCommand, { args: args });
        }
      }
    } catch (error) {
      console.error(`Error invoking ${channel}:`, error);
      throw error;
    }
  }

  // Replace electron.ipcRenderer.on
  on(channel, callback) {
    const unlisten = listen(channel, (event) => {
      callback(event, event.payload);
    });
    
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel).push(unlisten);
    
    return unlisten;
  }

  // Replace electron.ipcRenderer.removeListener
  removeListener(channel) {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.forEach(unlisten => unlisten.then(fn => fn()));
      this.listeners.delete(channel);
    }
  }

  // Replace electron.ipcRenderer.send
  async send(channel, ...args) {
    return this.invoke(channel, ...args);
  }

  // File operations
  async openFileDialog(options = {}) {
    return await open({
      multiple: options.multiple || false,
      filters: options.filters || [],
      directory: options.directory || false,
    });
  }

  async saveFileDialog(options = {}) {
    return await save({
      filters: options.filters || [],
      defaultPath: options.defaultPath,
    });
  }

  async readFile(path) {
    return await readFile(path);
  }

  async writeFile(path, content) {
    return await writeFile(path, content);
  }

  // Settings operations
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
      await this.store.save();
    } catch (error) {
      console.error('Error saving setting:', error);
    }
  }

  async getAllSettings() {
    try {
      // Get all entries from the store
      const entries = await this.store.entries();
      // Convert entries array to object for compatibility
      const settings = {};
      if (Array.isArray(entries)) {
        entries.forEach(([key, value]) => {
          settings[key] = value;
        });
      }
      return settings;
    } catch (error) {
      console.error('Error getting all settings:', error);
      return {};
    }
  }
}

// Create singleton instance
const tauriBridge = new TauriBridge();

// Create comprehensive API structure for compatibility
const createElectronAPICompatibility = () => ({
  // Core IPC methods
  invoke: tauriBridge.invoke.bind(tauriBridge),
  on: tauriBridge.on.bind(tauriBridge),
  send: tauriBridge.send.bind(tauriBridge),
  removeListener: tauriBridge.removeListener.bind(tauriBridge),

  // Settings API
  settings: {
    get: (key) => tauriBridge.getSettings(key),
    getAll: () => tauriBridge.getAllSettings(),
    set: (key, value) => tauriBridge.saveSettings(key, value),
  },

  // Screen Recorder API
  screenRecorder: {
    // Mock screen recorder API for now
    isAvailable: () => true,
    getScreens: () => tauriBridge.invoke('get_screens'),
    startRecording: (options) => tauriBridge.invoke('start_screen_recording', options),
    stopRecording: () => tauriBridge.invoke('stop_screen_recording'),
    getStatus: () => tauriBridge.invoke('get_recording_status'),
  },

  // Model API
  model: {
    // Mock download progress - will need proper implementation
    onDownloadProgress: (callback) => {
      console.log('Model download progress listener added (mock)');
      // Return a cleanup function
      return () => console.log('Model download progress listener removed (mock)');
    },
    load: (modelPath, gpuDevice, useGpu) => tauriBridge.invoke('load-model', modelPath, gpuDevice, useGpu),
    getAvailable: () => tauriBridge.invoke('get-available-models'),
  },

  // Window API  
  window: {
    getPlatform: async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        return await platform();
      } catch (error) {
        console.error('Failed to get platform:', error);
        return 'unknown';
      }
    },
    setTheme: (theme) => {
      console.log('Theme set to:', theme);
      // Could implement theme persistence here if needed
    }
  },

  // File operations
  dialog: {
    showOpenDialog: (options) => tauriBridge.openFileDialog(options),
    showSaveDialog: (options) => tauriBridge.saveFileDialog(options),
  },

  // Application info
  app: {
    getVersion: () => tauriBridge.invoke('get_app_version'),
    getName: () => 'WhisperDesk',
  },
});

// Export as window.electronAPI replacement for Tauri
if (typeof window !== 'undefined') {
  const electronAPI = createElectronAPICompatibility();
  window.electronAPI = electronAPI;
  window.tauriBridge = tauriBridge;
}

export default tauriBridge;
export { tauriBridge };