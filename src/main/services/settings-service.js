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
        
        // Recording settings
        recordingDirectory: '', // Will be set to default on first use
        includeMicrophone: true,
        includeSystemAudio: false,
        autoTranscribeRecordings: true,
        videoQuality: 'medium', // 'low', 'medium', 'high', 'ultra'
        audioQuality: 'medium', // 'low', 'medium', 'high'
        recordingQuality: 'medium', // Legacy compatibility
        
        // Audio settings
        audioDevice: 'default',
        noiseReduction: true,
        autoGainControl: true,
        
        // Transcription settings
        defaultProvider: 'whisper',
        defaultModel: 'base',
        language: 'auto',
        enableTimestamps: true,
        enableSpeakerDiarization: true,
        maxSpeakers: 10,
        autoDetectLanguage: true,
        
        // Deepgram settings
        deepgramApiKey: '',
        deepgramModel: 'nova-2',
        deepgramLanguage: 'en',
        
        // Export settings
        defaultExportFormat: 'txt',
        includeTimestamps: false,
        includeTimestampsInExport: false, // More specific name
        includeSpeakerLabels: true,
        exportPath: path.join(os.homedir(), 'Documents', 'WhisperDesk'),
        exportDirectory: '', // New field for consistency
        
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
        enableAutoUpdates: true,
        
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
    // Ensure directories exist
    const exportPath = this.get('exportPath');
    const recordingDirectory = this.get('recordingDirectory');
    
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');
    
    try {
      await fs.mkdir(exportPath, { recursive: true });
    } catch (error) {
      console.warn('Could not create export directory:', error.message);
    }
    
    // Set default recording directory if not set
    if (!recordingDirectory) {
      const defaultRecordingDir = path.join(os.homedir(), 'Documents', 'WhisperDesk Recordings');
      this.set('recordingDirectory', defaultRecordingDir);
      try {
        await fs.mkdir(defaultRecordingDir, { recursive: true });
      } catch (error) {
        console.warn('Could not create default recording directory:', error.message);
      }
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

  getRecordingSettings() {
    return {
      recordingDirectory: this.get('recordingDirectory'),
      includeMicrophone: this.get('includeMicrophone'),
      includeSystemAudio: this.get('includeSystemAudio'),
      videoQuality: this.get('videoQuality'),
      audioQuality: this.get('audioQuality'),
      autoTranscribeRecordings: this.get('autoTranscribeRecordings')
    };
  }

  setRecordingSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      this.set(key, value);
    }
  }

  getExportSettings() {
    return {
      defaultFormat: this.get('defaultExportFormat'),
      includeTimestamps: this.get('includeTimestampsInExport'),
      includeSpeakerLabels: this.get('includeSpeakerLabels'),
      exportPath: this.get('exportPath'),
      exportDirectory: this.get('exportDirectory')
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

