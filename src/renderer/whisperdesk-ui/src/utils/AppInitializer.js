// src/renderer/whisperdesk-ui/src/utils/AppInitializer.js - FIXED
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initializing = false;
    this.services = {};
    this.eventCleanups = {};
    
    // 🔴 NEW: Centralized state management
    this.centralState = {
      // Device state
      availableDevices: { screens: [], audio: [] },
      selectedScreen: '',
      selectedAudioInput: '',
      devicesInitialized: false,
      loadingDevices: false,
      
      // Recording state
      isRecording: false,
      recordingValidated: false,
      recordingDuration: 0,
      isPaused: false,
      
      // API status
      screenRecorderApiStatus: 'checking',
      screenRecorderError: null,
      
      // Settings
      recordingSettings: {
        includeMicrophone: true,
        includeSystemAudio: true,
        autoTranscribe: true,
        recordingDirectory: ''
      }
    };
    
    this.stateUpdateCallback = null;
  }

  // 🔴 NEW: Method to register state update callback
  setStateUpdateCallback(callback) {
    this.stateUpdateCallback = callback;
  }

  // 🔴 NEW: Centralized state update method
  updateCentralState(updates) {
    this.centralState = { ...this.centralState, ...updates };
    if (this.stateUpdateCallback) {
      this.stateUpdateCallback(updates);
    }
  }

  async initialize(updateAppState, setInitializationProgress) {
    if (this.initialized || this.initializing) {
      console.log('🔒 App already initialized/initializing, skipping...');
      return this.services;
    }

    this.initializing = true;
    console.log('🚀 Starting CENTRALIZED app initialization...');

    try {
      // 🔴 NEW: Set the state update callback
      this.setStateUpdateCallback(updateAppState);

      setInitializationProgress({ step: 'Checking Electron API...', progress: 10 });
      
      // Check if Electron API is available
      const isElectron = typeof window !== 'undefined' && window.electronAPI;
      this.services.isElectron = isElectron;
      
      if (!isElectron) {
        console.warn('⚠️ Electron API not available - running in web mode');
        this.updateCentralState({ 
          screenRecorderApiStatus: 'unavailable',
          screenRecorderError: 'Electron API not available'
        });
        setInitializationProgress({ step: 'Web mode ready', progress: 100 });
        this.initialized = true;
        return this.services;
      }

      // Step 1: Initialize and check APIs
      setInitializationProgress({ step: 'Checking API availability...', progress: 20 });
      await this.checkAPIAvailability();

      // Step 2: Initialize models and providers
      setInitializationProgress({ step: 'Loading models and providers...', progress: 30 });
      await this.initializeModelsAndProviders();

      // Step 3: Initialize screen recorder and devices
      setInitializationProgress({ step: 'Setting up screen recorder...', progress: 50 });
      await this.initializeScreenRecorderAndDevices();

      // Step 4: Initialize settings
      setInitializationProgress({ step: 'Loading settings...', progress: 70 });
      await this.initializeSettings();

      // Step 5: Set up centralized event handlers (ONLY HERE)
      setInitializationProgress({ step: 'Setting up event handlers...', progress: 90 });
      this.setupCentralizedEventHandlers();

      setInitializationProgress({ step: 'Ready!', progress: 100 });
      
      this.initialized = true;
      this.initializing = false;
      
      console.log('✅ CENTRALIZED app initialization complete');
      console.log('📊 Available services:', Object.keys(this.services));
      console.log('📊 Central state:', this.centralState);
      
      return this.services;

    } catch (error) {
      console.error('❌ App initialization failed:', error);
      this.initializing = false;
      this.updateCentralState({ 
        screenRecorderApiStatus: 'unavailable',
        screenRecorderError: error.message
      });
      setInitializationProgress({ 
        step: `Error: ${error.message}`, 
        progress: 0, 
        error: true 
      });
      throw error;
    }
  }

  // 🔴 NEW: Comprehensive API availability check
  async checkAPIAvailability() {
    console.log('🔧 Checking API availability...');
    
    try {
      // Store API references
      this.services.electronAPI = window.electronAPI;
      this.services.platform = await window.electronAPI.window?.getPlatform?.() || 'unknown';
      
      // Test Screen Recorder API specifically
      if (!window.electronAPI.screenRecorder) {
        throw new Error('Screen Recorder API not available');
      }

      // Test basic IPC
      if (window.electronAPI.debug?.test) {
        await window.electronAPI.debug.test();
        console.log('✅ Basic IPC communication verified');
      }

      // Test Screen Recorder status call
      const status = await window.electronAPI.screenRecorder.getStatus();
      console.log('✅ Screen Recorder API verified:', status);
      
      this.updateCentralState({ 
        screenRecorderApiStatus: 'available',
        screenRecorderError: null
      });

    } catch (error) {
      console.error('❌ API availability check failed:', error);
      this.updateCentralState({ 
        screenRecorderApiStatus: 'unavailable',
        screenRecorderError: error.message
      });
      throw error;
    }
  }

  async initializeModelsAndProviders() {
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

      // Update via central state
      this.updateCentralState({
        selectedProvider: defaultProvider,
        selectedModel: defaultModel
      });

      console.log(`✅ Set defaults - Provider: ${defaultProvider}, Model: ${defaultModel}`);

    } catch (error) {
      console.error('❌ Failed to initialize models/providers:', error);
      // Don't throw - this is non-critical for basic functionality
    }
  }

  // 🔴 FIXED: Combined screen recorder and device initialization
  async initializeScreenRecorderAndDevices() {
    console.log('🔧 Initializing screen recorder and devices...');
    
    try {
      // Get initial status and devices
      const status = await window.electronAPI.screenRecorder.getStatus();
      console.log('📊 Screen recorder status:', status);
      
      // Format and set available devices
      const devices = this.formatDevices(status.availableDevices || {});
      
      // Set default selections
      const defaultScreen = devices.screens[0]?.id || '';
      const defaultAudio = devices.audio[0]?.id || '';
      
      // Update central state with all device and recording info
      this.updateCentralState({
        // Device state
        availableDevices: devices,
        selectedScreen: defaultScreen,
        selectedAudioInput: defaultAudio,
        devicesInitialized: true,
        loadingDevices: false,
        
        // Recording state from backend
        isRecording: status.isRecording || false,
        recordingValidated: status.recordingValidated || false,
        recordingDuration: status.duration ? Math.floor(status.duration / 1000) : 0,
        isPaused: status.isPaused || false
      });

      // Store device management functions in services
      this.services.deviceManager = {
        refreshDevices: () => this.refreshDevices(),
        updateDeviceSelections: (screen, audio) => this.updateDeviceSelections(screen, audio),
        validateDevices: () => this.validateDeviceSelections()
      };

      console.log(`✅ Screen recorder and devices initialized`);
      console.log(`📱 Devices: ${devices.screens.length} screens, ${devices.audio.length} audio`);
      console.log(`🎯 Defaults: Screen ${defaultScreen}, Audio ${defaultAudio}`);

    } catch (error) {
      console.error('❌ Failed to initialize screen recorder/devices:', error);
      this.updateCentralState({ 
        screenRecorderApiStatus: 'unavailable',
        screenRecorderError: error.message,
        devicesInitialized: false
      });
      throw new Error(`Screen recorder init failed: ${error.message}`);
    }
  }

  // 🔴 NEW: Centralized device management methods
  async refreshDevices() {
    try {
      this.updateCentralState({ loadingDevices: true });
      
      const status = await window.electronAPI.screenRecorder.getStatus();
      const devices = this.formatDevices(status.availableDevices || {});
      
      // Validate current selections
      const { selectedScreen, selectedAudioInput } = this.centralState;
      let newScreen = selectedScreen;
      let newAudio = selectedAudioInput;
      
      // Check if current selections are still valid
      if (selectedScreen && !devices.screens.find(s => s.id === selectedScreen)) {
        newScreen = devices.screens[0]?.id || '';
        console.warn(`⚠️ Selected screen ${selectedScreen} no longer available, switching to ${newScreen}`);
      }
      
      if (selectedAudioInput && !devices.audio.find(a => a.id === selectedAudioInput)) {
        newAudio = devices.audio[0]?.id || '';
        console.warn(`⚠️ Selected audio ${selectedAudioInput} no longer available, switching to ${newAudio}`);
      }
      
      this.updateCentralState({
        availableDevices: devices,
        selectedScreen: newScreen,
        selectedAudioInput: newAudio,
        loadingDevices: false
      });
      
      return { success: true, devices };
      
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
      this.updateCentralState({ loadingDevices: false });
      throw error;
    }
  }

  updateDeviceSelections(screen, audio) {
    this.updateCentralState({
      selectedScreen: screen,
      selectedAudioInput: audio
    });
  }

  async validateDeviceSelections() {
    const { selectedScreen, selectedAudioInput, availableDevices } = this.centralState;
    
    const screenValid = selectedScreen && availableDevices.screens.find(s => s.id === selectedScreen);
    const audioValid = !selectedAudioInput || availableDevices.audio.find(a => a.id === selectedAudioInput);
    
    return {
      valid: !!screenValid && audioValid,
      issues: [
        ...(screenValid ? [] : [`Screen device '${selectedScreen}' not available`]),
        ...(audioValid ? [] : [`Audio device '${selectedAudioInput}' not available`])
      ]
    };
  }

  async initializeSettings() {
    console.log('🔧 Loading settings...');
    
    try {
      const allSettings = await window.electronAPI.settings.getAll();
      this.services.settings = allSettings;
      
      // Apply recording settings to central state
      const recordingSettings = {
        includeMicrophone: allSettings.includeMicrophone !== undefined ? allSettings.includeMicrophone : true,
        includeSystemAudio: allSettings.includeSystemAudio !== undefined ? allSettings.includeSystemAudio : true,
        autoTranscribe: allSettings.autoTranscribeRecordings !== undefined ? allSettings.autoTranscribeRecordings : true,
        recordingDirectory: allSettings.recordingDirectory || '',
        recordingQuality: allSettings.recordingQuality || 'medium'
      };

      this.updateCentralState({ recordingSettings });
      
      // Apply other settings via regular app state
      if (this.stateUpdateCallback) {
        this.stateUpdateCallback({
          theme: allSettings.theme || 'system',
          transcriptionSettings: {
            defaultProvider: allSettings.defaultProvider || 'whisper-native',
            defaultModel: allSettings.defaultModel || 'whisper-tiny',
            autoDetectLanguage: allSettings.autoDetectLanguage !== undefined ? allSettings.autoDetectLanguage : true,
            enableTimestamps: allSettings.enableTimestamps !== undefined ? allSettings.enableTimestamps : true,
            enableSpeakerDiarization: allSettings.enableSpeakerDiarization !== undefined ? allSettings.enableSpeakerDiarization : true
          },
          uiSettings: {
            showWaveform: allSettings.showWaveform !== undefined ? allSettings.showWaveform : true,
            showTimeline: allSettings.showTimeline !== undefined ? allSettings.showTimeline : true,
            autoScroll: allSettings.autoScroll !== undefined ? allSettings.autoScroll : true,
            fontSize: allSettings.fontSize || 'medium'
          }
        });
      }
      
      console.log('✅ Settings loaded and applied');

    } catch (error) {
      console.warn('⚠️ Failed to load settings (non-critical):', error);
    }
  }

  // 🔴 FIXED: Centralized event handlers (ONLY place where events are set up)
  setupCentralizedEventHandlers() {
    console.log('🔧 Setting up CENTRALIZED event handlers...');
    
    // Clean up any existing handlers first
    this.cleanupEventHandlers();

    // Screen recorder events
    this.setupScreenRecorderEvents();
    
    // Transcription events  
    this.setupTranscriptionEvents();
    
    // Model events
    this.setupModelEvents();
    
    console.log('✅ CENTRALIZED event handlers set up');
  }

  setupScreenRecorderEvents() {
    const api = window.electronAPI.screenRecorder;
    
    if (api.onRecordingStarted) {
      this.eventCleanups.recordingStarted = api.onRecordingStarted((data) => {
        console.log('📹 [CENTRAL] Recording started:', data);
        this.updateCentralState({
          isRecording: true,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false
        });
      });
    }

    if (api.onRecordingValidated) {
      this.eventCleanups.recordingValidated = api.onRecordingValidated((data) => {
        console.log('✅ [CENTRAL] Recording validated:', data);
        this.updateCentralState({
          recordingValidated: true
        });
      });
    }

    if (api.onRecordingCompleted) {
      this.eventCleanups.recordingCompleted = api.onRecordingCompleted((data) => {
        console.log('🏁 [CENTRAL] Recording completed:', data);
        this.updateCentralState({
          isRecording: false,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false
        });
        
        // Handle auto-transcription
        if (data.audioPath && this.centralState.recordingSettings.autoTranscribe) {
          this.handleAutoTranscription(data.audioPath);
        }
      });
    }

    if (api.onRecordingError) {
      this.eventCleanups.recordingError = api.onRecordingError((data) => {
        console.error('❌ [CENTRAL] Recording error:', data);
        this.updateCentralState({
          isRecording: false,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false,
          screenRecorderError: data.error
        });
      });
    }

    if (api.onRecordingProgress) {
      this.eventCleanups.recordingProgress = api.onRecordingProgress((data) => {
        if (data.duration) {
          const seconds = Math.floor(data.duration / 1000);
          this.updateCentralState({ recordingDuration: seconds });
        }
      });
    }

    if (api.onRecordingPaused) {
      this.eventCleanups.recordingPaused = api.onRecordingPaused(() => {
        console.log('⏸️ [CENTRAL] Recording paused');
        this.updateCentralState({ isPaused: true });
      });
    }

    if (api.onRecordingResumed) {
      this.eventCleanups.recordingResumed = api.onRecordingResumed(() => {
        console.log('▶️ [CENTRAL] Recording resumed');
        this.updateCentralState({ isPaused: false });
      });
    }
  }

  setupTranscriptionEvents() {
    const api = window.electronAPI.transcription;
    
    if (api.onProgress) {
      this.eventCleanups.transcriptionProgress = api.onProgress((data) => {
        if (this.stateUpdateCallback) {
          this.stateUpdateCallback({
            progress: data.progress || 0,
            progressMessage: data.message || data.stage || 'Processing...'
          });
        }
      });
    }

    if (api.onComplete) {
      this.eventCleanups.transcriptionComplete = api.onComplete((data) => {
        if (data.result && this.stateUpdateCallback) {
          this.stateUpdateCallback({
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
        if (this.stateUpdateCallback) {
          this.stateUpdateCallback({
            isTranscribing: false,
            progress: 0,
            progressMessage: 'Error occurred'
          });
        }
      });
    }

    if (api.onStart) {
      this.eventCleanups.transcriptionStart = api.onStart((data) => {
        if (this.stateUpdateCallback) {
          this.stateUpdateCallback({ 
            activeTranscriptionId: data.transcriptionId, 
            isTranscribing: true 
          });
        }
      });
    }

    if (api.onCancelled) {
      this.eventCleanups.transcriptionCancelled = api.onCancelled(() => {
        if (this.stateUpdateCallback) {
          this.stateUpdateCallback({ 
            isTranscribing: false, 
            progress: 0, 
            progressMessage: 'Cancelled', 
            activeTranscriptionId: null 
          });
        }
      });
    }
  }

  setupModelEvents() {
    const api = window.electronAPI.model;
    
    if (api.onDownloadComplete) {
      this.eventCleanups.modelDownloadComplete = api.onDownloadComplete(async () => {
        const models = await window.electronAPI.model.getInstalled();
        this.services.models = models;
      });
    }

    if (api.onModelDeleted) {
      this.eventCleanups.modelDeleted = api.onModelDeleted(async () => {
        const models = await window.electronAPI.model.getInstalled();
        this.services.models = models;
      });
    }
  }

  // 🔴 NEW: Handle auto-transcription centrally
  handleAutoTranscription(audioPath) {
    const fileInfo = {
      path: audioPath,
      name: audioPath.split('/').pop() || audioPath.split('\\').pop(),
      size: 0
    };
    
    if (this.stateUpdateCallback) {
      this.stateUpdateCallback({ selectedFile: fileInfo });
      
      // Trigger auto-transcription event
      setTimeout(() => {
        const event = new CustomEvent('autoTranscribe', { 
          detail: { file: fileInfo } 
        });
        window.dispatchEvent(event);
      }, 1000);
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
    console.log('🧹 Cleaning up CENTRALIZED event handlers...');
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
    this.centralState = {};
    this.stateUpdateCallback = null;
  }

  // 🔴 NEW: Getters for central state
  getCentralState() {
    return this.centralState;
  }

  getService(name) {
    return this.services[name];
  }

  isReady() {
    return this.initialized;
  }

  // 🔴 NEW: API access methods for components
  getScreenRecorderActions() {
    return {
      startRecording: (options) => this.startRecording(options),
      stopRecording: () => this.stopRecording(),
      pauseResume: () => this.pauseResumeRecording()
    };
  }

  async startRecording(options = {}) {
    const { selectedScreen, selectedAudioInput, recordingSettings } = this.centralState;
    
    try {
      const recordingOptions = {
        screenId: selectedScreen,
        audioInputId: selectedAudioInput,
        includeMicrophone: recordingSettings.includeMicrophone,
        includeSystemAudio: recordingSettings.includeSystemAudio,
        audioQuality: 'medium',
        videoQuality: 'medium',
        recordingDirectory: recordingSettings.recordingDirectory || undefined,
        ...options
      };

      const result = await window.electronAPI.screenRecorder.startRecording(recordingOptions);
      return result;
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    try {
      const result = await window.electronAPI.screenRecorder.stopRecording();
      return result;
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      throw error;
    }
  }

  async pauseResumeRecording() {
    const { isPaused } = this.centralState;
    
    try {
      const result = isPaused 
        ? await window.electronAPI.screenRecorder.resumeRecording()
        : await window.electronAPI.screenRecorder.pauseRecording();
      return result;
    } catch (error) {
      console.error('❌ Failed to pause/resume recording:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const appInitializer = new AppInitializer();