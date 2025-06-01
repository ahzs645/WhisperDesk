const Store = require('electron-store');
const path = require('path');
const os = require('os');

class SettingsService {
  constructor() {
    this.store = new Store({
      name: 'settings',
      defaults: {
        // General settings
        theme: 'system', // 'light', 'dark', 'system'
        language: 'en',
        autoUpdate: true,
        
        // Audio settings
        audioDevice: 'default',
        audioQuality: 'high',
        noiseReduction: true,
        autoGainControl: true,
        
        // Transcription settings
        defaultProvider: 'whisper',
        defaultModel: 'base',
        language: 'auto',
        enableTimestamps: true,
        enableSpeakerDiarization: true,
        maxSpeakers: 10,
        
        // Deepgram settings
        deepgramApiKey: '',
        deepgramModel: 'nova-2',
        deepgramLanguage: 'en',
        
        // Export settings
        defaultExportFormat: 'txt',
        includeTimestamps: false,
        includeSpeakerLabels: true,
        exportPath: path.join(os.homedir(), 'Documents', 'WhisperDesk'),
        
        // UI settings
        showWaveform: true,
        showTimeline: true,
        autoScroll: true,
        fontSize: 'medium',
        
        // Advanced settings
        maxConcurrentDownloads: 2,
        modelCacheSize: '5GB',
        logLevel: 'info',
        enableTelemetry: false,
        
        // Keyboard shortcuts
        shortcuts: {
          startRecording: 'F1',
          stopRecording: 'F2',
          playPause: 'Space',
          export: 'Ctrl+E',
          newTranscription: 'Ctrl+N'
        }
      }
    });
  }

  async initialize() {
    // Ensure export directory exists
    const exportPath = this.get('exportPath');
    const fs = require('fs').promises;
    try {
      await fs.mkdir(exportPath, { recursive: true });
    } catch (error) {
      console.warn('Could not create export directory:', error.message);
    }
    
    console.log('Settings service initialized');
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
    
    // Emit change event
    if (this.changeCallback) {
      this.changeCallback(key, value);
    }
  }

  getAll() {
    return this.store.store;
  }

  reset() {
    this.store.clear();
  }

  resetToDefaults() {
    this.store.store = this.store.defaults;
  }

  // Get settings for specific categories
  getAudioSettings() {
    return {
      audioDevice: this.get('audioDevice'),
      audioQuality: this.get('audioQuality'),
      noiseReduction: this.get('noiseReduction'),
      autoGainControl: this.get('autoGainControl')
    };
  }

  getTranscriptionSettings() {
    return {
      defaultProvider: this.get('defaultProvider'),
      defaultModel: this.get('defaultModel'),
      language: this.get('language'),
      enableTimestamps: this.get('enableTimestamps'),
      enableSpeakerDiarization: this.get('enableSpeakerDiarization'),
      maxSpeakers: this.get('maxSpeakers')
    };
  }

  getDeepgramSettings() {
    return {
      apiKey: this.get('deepgramApiKey'),
      model: this.get('deepgramModel'),
      language: this.get('deepgramLanguage')
    };
  }

  getExportSettings() {
    return {
      defaultFormat: this.get('defaultExportFormat'),
      includeTimestamps: this.get('includeTimestamps'),
      includeSpeakerLabels: this.get('includeSpeakerLabels'),
      exportPath: this.get('exportPath')
    };
  }

  getUISettings() {
    return {
      theme: this.get('theme'),
      showWaveform: this.get('showWaveform'),
      showTimeline: this.get('showTimeline'),
      autoScroll: this.get('autoScroll'),
      fontSize: this.get('fontSize')
    };
  }

  getShortcuts() {
    return this.get('shortcuts');
  }

  // Validate settings
  validateSettings(settings) {
    const errors = [];

    // Validate theme
    if (settings.theme && !['light', 'dark', 'system'].includes(settings.theme)) {
      errors.push('Invalid theme value');
    }

    // Validate audio quality
    if (settings.audioQuality && !['low', 'medium', 'high'].includes(settings.audioQuality)) {
      errors.push('Invalid audio quality value');
    }

    // Validate export format
    if (settings.defaultExportFormat && !['txt', 'srt', 'vtt', 'json'].includes(settings.defaultExportFormat)) {
      errors.push('Invalid export format');
    }

    // Validate max speakers
    if (settings.maxSpeakers && (settings.maxSpeakers < 1 || settings.maxSpeakers > 50)) {
      errors.push('Max speakers must be between 1 and 50');
    }

    return errors;
  }

  // Import/Export settings
  exportSettings() {
    return JSON.stringify(this.getAll(), null, 2);
  }

  importSettings(settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      const errors = this.validateSettings(settings);
      
      if (errors.length > 0) {
        throw new Error(`Invalid settings: ${errors.join(', ')}`);
      }

      // Apply settings
      Object.keys(settings).forEach(key => {
        this.set(key, settings[key]);
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Register change callback
  onChange(callback) {
    this.changeCallback = callback;
  }

  // Get platform-specific settings
  getPlatformDefaults() {
    const platform = process.platform;
    const defaults = {};

    if (platform === 'darwin') {
      defaults.shortcuts = {
        startRecording: 'F1',
        stopRecording: 'F2',
        playPause: 'Space',
        export: 'Cmd+E',
        newTranscription: 'Cmd+N'
      };
    } else {
      defaults.shortcuts = {
        startRecording: 'F1',
        stopRecording: 'F2',
        playPause: 'Space',
        export: 'Ctrl+E',
        newTranscription: 'Ctrl+N'
      };
    }

    return defaults;
  }
}

module.exports = SettingsService;

