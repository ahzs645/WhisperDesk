// src/renderer/whisperdesk-ui/src/utils/AppInitializer.js
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initializing = false;
    this.services = {};
    this.eventCleanups = {};
  }

  async initialize(updateAppState, setInitializationProgress) {
    if (this.initialized || this.initializing) {
      console.log('🔒 App already initialized/initializing, skipping...');
      return this.services;
    }

    this.initializing = true;
    console.log('🚀 Starting centralized app initialization...');

    try {
      setInitializationProgress({ step: 'Checking Electron API...', progress: 10 });
      
      // Check if Electron API is available
      const isElectron = typeof window !== 'undefined' && window.electronAPI;
      this.services.isElectron = isElectron;
      
      if (!isElectron) {
        console.warn('⚠️ Electron API not available - running in web mode');
        setInitializationProgress({ step: 'Web mode ready', progress: 100 });
        this.initialized = true;
        return this.services;
      }

      // Step 1: Initialize basic services
      setInitializationProgress({ step: 'Initializing core services...', progress: 20 });
      await this.initializeElectronAPIs();

      // Step 2: Initialize models and providers
      setInitializationProgress({ step: 'Loading models and providers...', progress: 40 });
      await this.initializeModelsAndProviders(updateAppState);

      // Step 3: Initialize screen recorder
      setInitializationProgress({ step: 'Setting up screen recorder...', progress: 60 });
      await this.initializeScreenRecorder(updateAppState);

      // Step 4: Initialize settings
      setInitializationProgress({ step: 'Loading settings...', progress: 80 });
      await this.initializeSettings(updateAppState);

      // Step 5: Set up global event handlers
      setInitializationProgress({ step: 'Setting up event handlers...', progress: 90 });
      this.setupGlobalEventHandlers(updateAppState);

      setInitializationProgress({ step: 'Ready!', progress: 100 });
      
      this.initialized = true;
      this.initializing = false;
      
      console.log('✅ Centralized app initialization complete');
      console.log('📊 Available services:', Object.keys(this.services));
      
      return this.services;

    } catch (error) {
      console.error('❌ App initialization failed:', error);
      this.initializing = false;
      setInitializationProgress({ 
        step: `Error: ${error.message}`, 
        progress: 0, 
        error: true 
      });
      throw error;
    }
  }

  async initializeElectronAPIs() {
    console.log('🔧 Initializing Electron APIs...');
    
    // Store API references for easy access
    this.services.electronAPI = window.electronAPI;
    this.services.platform = await window.electronAPI.window?.getPlatform?.() || 'unknown';
    
    // Test basic connectivity
    if (window.electronAPI.debug?.test) {
      try {
        await window.electronAPI.debug.test();
        console.log('✅ Electron IPC communication verified');
      } catch (error) {
        console.warn('⚠️ Electron IPC test failed:', error);
      }
    }
  }

  async initializeModelsAndProviders(updateAppState) {
    console.log('🔧 Initializing models and providers...');
    
    try {
      // Get available transcription providers
      const providers = await window.electronAPI.transcription.getProviders();
      this.services.providers = providers;
      console.log('📋 Available providers:', providers.length);

      // Get installed models
      const models = await window.electronAPI.model.getInstalled();
      this.services.models = models;
      console.log('📦 Installed models:', models.length);

      // Set defaults
      const defaultProvider = providers.find(p => p.name === 'Native Whisper')?.id || 
                             providers.find(p => p.isAvailable)?.id || 
                             'whisper-native';
      
      const defaultModel = models.find(m => m.id === 'whisper-tiny')?.id || 
                          models[0]?.id || 
                          'whisper-tiny';

      updateAppState({
        selectedProvider: defaultProvider,
        selectedModel: defaultModel
      });

      console.log(`✅ Set defaults - Provider: ${defaultProvider}, Model: ${defaultModel}`);

    } catch (error) {
      console.error('❌ Failed to initialize models/providers:', error);
      throw new Error(`Models/Providers init failed: ${error.message}`);
    }
  }

  async initializeScreenRecorder(updateAppState) {
    console.log('🔧 Initializing screen recorder...');
    
    try {
      // Get initial status
      const status = await window.electronAPI.screenRecorder.getStatus();
      console.log('📊 Screen recorder status:', status);
      
      // Format available devices
      const devices = this.formatDevices(status.availableDevices || {});
      this.services.availableDevices = devices;
      
      // Set default selections
      const defaultScreen = devices.screens[0]?.id || '';
      const defaultAudio = devices.audio[0]?.id || '';
      
      this.services.selectedScreen = defaultScreen;
      this.services.selectedAudioInput = defaultAudio;
      
      // Update app state
      updateAppState({
        isRecording: status.isRecording || false,
        recordingValidated: status.recordingValidated || false,
        recordingDuration: status.duration ? Math.floor(status.duration / 1000) : 0,
        isPaused: status.isPaused || false,
        recordingSettings: {
          includeMicrophone: true,
          includeSystemAudio: true,
          autoTranscribe: true,
          recordingDirectory: ''
        }
      });

      console.log(`✅ Screen recorder initialized - Screen: ${defaultScreen}, Audio: ${defaultAudio}`);

    } catch (error) {
      console.error('❌ Failed to initialize screen recorder:', error);
      throw new Error(`Screen recorder init failed: ${error.message}`);
    }
  }

  async initializeSettings(updateAppState) {
    console.log('🔧 Loading settings...');
    
    try {
      // Load all settings
      const allSettings = await window.electronAPI.settings.getAll();
      this.services.settings = allSettings;
      
      // Apply theme setting
      if (allSettings.theme) {
        updateAppState({ theme: allSettings.theme });
      }

      // Apply recording settings
      const recordingSettings = {
        includeMicrophone: allSettings.includeMicrophone !== undefined ? allSettings.includeMicrophone : true,
        includeSystemAudio: allSettings.includeSystemAudio !== undefined ? allSettings.includeSystemAudio : true,
        autoTranscribe: allSettings.autoTranscribeRecordings !== undefined ? allSettings.autoTranscribeRecordings : true,
        recordingDirectory: allSettings.recordingDirectory || '',
        recordingQuality: allSettings.recordingQuality || 'medium'
      };

      // Apply transcription settings
      const transcriptionSettings = {
        defaultProvider: allSettings.defaultProvider || 'whisper-native',
        defaultModel: allSettings.defaultModel || 'whisper-tiny',
        autoDetectLanguage: allSettings.autoDetectLanguage !== undefined ? allSettings.autoDetectLanguage : true,
        enableTimestamps: allSettings.enableTimestamps !== undefined ? allSettings.enableTimestamps : true,
        enableSpeakerDiarization: allSettings.enableSpeakerDiarization !== undefined ? allSettings.enableSpeakerDiarization : true
      };

      // Apply UI settings
      const uiSettings = {
        theme: allSettings.theme || 'system',
        showWaveform: allSettings.showWaveform !== undefined ? allSettings.showWaveform : true,
        showTimeline: allSettings.showTimeline !== undefined ? allSettings.showTimeline : true,
        autoScroll: allSettings.autoScroll !== undefined ? allSettings.autoScroll : true,
        fontSize: allSettings.fontSize || 'medium'
      };

      // Update app state with all settings
      updateAppState({
        recordingSettings,
        transcriptionSettings,
        uiSettings
      });
      
      console.log('✅ Settings loaded:', Object.keys(allSettings).length, 'settings');

    } catch (error) {
      console.warn('⚠️ Failed to load settings (non-critical):', error);
      // Don't throw - settings failure shouldn't prevent app startup
    }
  }

  setupGlobalEventHandlers(updateAppState) {
    console.log('🔧 Setting up global event handlers...');
    
    // Clean up any existing handlers first
    this.cleanupEventHandlers();

    // Transcription events
    this.setupTranscriptionEventHandlers(updateAppState);
    
    // Model events
    this.setupModelEventHandlers();
    
    // Screen recorder events
    this.setupScreenRecorderEventHandlers(updateAppState);
    
    console.log('✅ Global event handlers set up');
  }

  setupTranscriptionEventHandlers(updateAppState) {
    const api = window.electronAPI.transcription;
    
    if (api.onProgress) {
      this.eventCleanups.transcriptionProgress = api.onProgress((data) => {
        updateAppState({
          progress: data.progress || 0,
          progressMessage: data.message || data.stage || 'Processing...'
        });
      });
    }

    if (api.onComplete) {
      this.eventCleanups.transcriptionComplete = api.onComplete((data) => {
        if (data.result) {
          updateAppState({
            transcription: data.result.text || '',
            lastTranscriptionResult: data.result,
            isTranscribing: false,
            progress: 100,
            progressMessage: 'Complete!'
          });
        }
      });
    }

    if (api.onError) {
      this.eventCleanups.transcriptionError = api.onError((data) => {
        updateAppState({
          isTranscribing: false,
          progress: 0,
          progressMessage: 'Error occurred'
        });
      });
    }

    if (api.onStart) {
      this.eventCleanups.transcriptionStart = api.onStart((data) => {
        updateAppState({ 
          activeTranscriptionId: data.transcriptionId, 
          isTranscribing: true 
        });
      });
    }

    if (api.onCancelled) {
      this.eventCleanups.transcriptionCancelled = api.onCancelled(() => {
        updateAppState({ 
          isTranscribing: false, 
          progress: 0, 
          progressMessage: 'Cancelled', 
          activeTranscriptionId: null 
        });
      });
    }
  }

  setupModelEventHandlers() {
    const api = window.electronAPI.model;
    
    if (api.onDownloadComplete) {
      this.eventCleanups.modelDownloadComplete = api.onDownloadComplete(async () => {
        // Refresh models list
        const models = await window.electronAPI.model.getInstalled();
        this.services.models = models;
      });
    }

    if (api.onModelDeleted) {
      this.eventCleanups.modelDeleted = api.onModelDeleted(async () => {
        // Refresh models list
        const models = await window.electronAPI.model.getInstalled();
        this.services.models = models;
      });
    }
  }

  setupScreenRecorderEventHandlers(updateAppState) {
    const api = window.electronAPI.screenRecorder;
    
    if (api.onRecordingStarted) {
      this.eventCleanups.recordingStarted = api.onRecordingStarted((data) => {
        updateAppState({
          isRecording: true,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false
        });
      });
    }

    if (api.onRecordingValidated) {
      this.eventCleanups.recordingValidated = api.onRecordingValidated(() => {
        updateAppState({
          recordingValidated: true
        });
      });
    }

    if (api.onRecordingCompleted) {
      this.eventCleanups.recordingCompleted = api.onRecordingCompleted((data) => {
        updateAppState({
          isRecording: false,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false
        });
      });
    }

    if (api.onRecordingError) {
      this.eventCleanups.recordingError = api.onRecordingError((data) => {
        updateAppState({
          isRecording: false,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false
        });
      });
    }

    if (api.onRecordingProgress) {
      this.eventCleanups.recordingProgress = api.onRecordingProgress((data) => {
        if (data.duration) {
          const seconds = Math.floor(data.duration / 1000);
          updateAppState({ recordingDuration: seconds });
        }
      });
    }
  }

  formatDevices(devices) {
    return {
      screens: devices.screens?.map(deviceId => ({
        id: deviceId,
        name: devices.deviceNames?.screens?.[deviceId] || `Screen ${parseInt(deviceId) + 1}`,
        type: 'screen'
      })) || [],
      
      audio: devices.audio?.map(deviceId => ({
        id: deviceId,
        name: devices.deviceNames?.audio?.[deviceId] || `Audio Input ${parseInt(deviceId) + 1}`,
        type: 'input'
      })) || []
    };
  }

  cleanupEventHandlers() {
    console.log('🧹 Cleaning up event handlers...');
    Object.values(this.eventCleanups).forEach(cleanup => {
      if (typeof cleanup === 'function') {
        try {
          cleanup();
        } catch (error) {
          console.warn('Warning: Failed to cleanup event handler:', error);
        }
      }
    });
    this.eventCleanups = {};
  }

  cleanup() {
    console.log('🧹 AppInitializer cleanup');
    this.cleanupEventHandlers();
    this.initialized = false;
    this.initializing = false;
    this.services = {};
  }

  // Getters for easy access
  getService(name) {
    return this.services[name];
  }

  isReady() {
    return this.initialized;
  }
}

// Create singleton instance
export const appInitializer = new AppInitializer();