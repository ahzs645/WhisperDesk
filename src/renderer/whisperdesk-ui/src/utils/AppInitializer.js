// src/renderer/whisperdesk-ui/src/utils/AppInitializer.js - COMPLETELY FIXED
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initializing = false;
    this.services = {};
    this.eventCleanups = {};
    
    // 🔴 FIXED: Centralized state with proper structure
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
      
      // API status - FIXED: Proper status tracking
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
    
    // 🔴 FIXED: Proper state subscription system
    this.stateSubscribers = new Set();
    this.appStateCallback = null;
  }

  // 🔴 FIXED: State subscription system for hooks to listen to changes
  subscribe(callback) {
    this.stateSubscribers.add(callback);
    // Return unsubscribe function
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  // 🔴 FIXED: Notify all subscribers of state changes
  notifyStateChange(updates) {
    Object.assign(this.centralState, updates);
    
    // Notify React app state
    if (this.appStateCallback) {
      this.appStateCallback(updates);
    }
    
    // Notify hook subscribers
    this.stateSubscribers.forEach(callback => {
      try {
        callback(this.centralState, updates);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  // 🔴 FIXED: Set the main app state callback
  setAppStateCallback(callback) {
    this.appStateCallback = callback;
  }

  async initialize(updateAppState, setInitializationProgress) {
    if (this.initialized || this.initializing) {
      console.log('🔒 App already initialized/initializing, skipping...');
      return this.services;
    }

    this.initializing = true;
    console.log('🚀 Starting FIXED CENTRALIZED app initialization...');

    try {
      // Set the app state callback for React integration
      this.setAppStateCallback(updateAppState);

      setInitializationProgress({ step: 'Checking Electron API...', progress: 10 });
      
      // Step 1: Check if Electron API is available
      const isElectron = typeof window !== 'undefined' && window.electronAPI;
      this.services.isElectron = isElectron;
      
      if (!isElectron) {
        console.warn('⚠️ Electron API not available - running in web mode');
        this.notifyStateChange({ 
          screenRecorderApiStatus: 'unavailable',
          screenRecorderError: 'Electron API not available'
        });
        setInitializationProgress({ step: 'Web mode ready', progress: 100 });
        this.initialized = true;
        this.initializing = false;
        return this.services;
      }

      // Step 2: FIXED - Comprehensive API availability check
      setInitializationProgress({ step: 'Checking API availability...', progress: 20 });
      await this.checkAPIAvailability();

      // Step 3: Initialize models and providers
      setInitializationProgress({ step: 'Loading models and providers...', progress: 30 });
      await this.initializeModelsAndProviders();

      // Step 4: Initialize screen recorder and devices
      setInitializationProgress({ step: 'Setting up screen recorder...', progress: 50 });
      await this.initializeScreenRecorderAndDevices();

      // Step 5: Initialize settings
      setInitializationProgress({ step: 'Loading settings...', progress: 70 });
      await this.initializeSettings();

      // Step 6: FIXED - Set up centralized event handlers (ONLY HERE, NOWHERE ELSE)
      setInitializationProgress({ step: 'Setting up event handlers...', progress: 90 });
      this.setupCentralizedEventHandlers();

      setInitializationProgress({ step: 'Ready!', progress: 100 });
      
      this.initialized = true;
      this.initializing = false;
      
      console.log('✅ FIXED CENTRALIZED app initialization complete');
      console.log('📊 Available services:', Object.keys(this.services));
      console.log('📊 Central state:', this.centralState);
      
      return this.services;

    } catch (error) {
      console.error('❌ App initialization failed:', error);
      this.initializing = false;
      this.notifyStateChange({ 
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

  // 🔴 FIXED: Comprehensive API availability check with proper status updates
  async checkAPIAvailability() {
    console.log('🔧 Checking API availability...');
    
    try {
      // Update status to show we're checking
      this.notifyStateChange({ 
        screenRecorderApiStatus: 'checking',
        screenRecorderError: null
      });

      // Store API references
      this.services.electronAPI = window.electronAPI;
      
      // Check basic window API
      if (!window.electronAPI.window) {
        throw new Error('Window API not available');
      }

      // Get platform info
      this.services.platform = await window.electronAPI.window.getPlatform?.() || 'unknown';
      
      // CRITICAL: Test Screen Recorder API specifically
      if (!window.electronAPI.screenRecorder) {
        throw new Error('Screen Recorder API not available');
      }

      // Test basic IPC first
      if (window.electronAPI.debug?.test) {
        const testResult = await window.electronAPI.debug.test();
        console.log('✅ Basic IPC communication verified:', testResult);
      }

      // Test Screen Recorder status call - this is the main test
      console.log('🧪 Testing Screen Recorder API...');
      const status = await window.electronAPI.screenRecorder.getStatus();
      console.log('📊 Screen Recorder API test result:', status);
      
      // Check if the API returned an error status
      if (status.error) {
        console.warn('⚠️ Screen Recorder API available but has backend error:', status.error);
        this.notifyStateChange({ 
          screenRecorderApiStatus: 'available', // API is available, but backend has issues
          screenRecorderError: status.error
        });
      } else {
        console.log('✅ Screen Recorder API fully operational');
        this.notifyStateChange({ 
          screenRecorderApiStatus: 'available',
          screenRecorderError: null
        });
      }

      // Test other critical APIs
      if (!window.electronAPI.transcription) {
        console.warn('⚠️ Transcription API not available');
      }

      if (!window.electronAPI.model) {
        console.warn('⚠️ Model API not available');
      }

      console.log('✅ API availability check completed successfully');

    } catch (error) {
      console.error('❌ API availability check failed:', error);
      this.notifyStateChange({ 
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

      // Set defaults and notify through app state callback
      const defaultProvider = providers.find(p => p.name === 'Native Whisper')?.id || 
                             providers.find(p => p.isAvailable)?.id || 
                             'whisper-native';
      
      const defaultModel = models.find(m => m.id === 'whisper-tiny')?.id || 
                          models[0]?.id || 
                          'whisper-tiny';

      // Update app state for provider/model selection
      if (this.appStateCallback) {
        this.appStateCallback({
          selectedProvider: defaultProvider,
          selectedModel: defaultModel
        });
      }

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
      // Get initial status and devices from backend
      const status = await window.electronAPI.screenRecorder.getStatus();
      console.log('📊 Initial screen recorder status:', status);
      
      // Format and set available devices
      const devices = this.formatDevices(status.availableDevices || {});
      
      // Set default selections (first available device of each type)
      const defaultScreen = devices.screens[0]?.id || '';
      const defaultAudio = devices.audio[0]?.id || '';
      
      // Update central state with all device and recording info
      this.notifyStateChange({
        // Device state
        availableDevices: devices,
        selectedScreen: defaultScreen,
        selectedAudioInput: defaultAudio,
        devicesInitialized: true,
        loadingDevices: false,
        
        // Recording state from backend (sync with current backend state)
        isRecording: status.isRecording || false,
        recordingValidated: status.recordingValidated || false,
        recordingDuration: status.duration ? Math.floor(status.duration / 1000) : 0,
        isPaused: status.isPaused || false
      });

      // Store device management functions for hooks to use
      this.services.deviceManager = {
        refreshDevices: () => this.refreshDevices(),
        updateDeviceSelections: (screen, audio) => this.updateDeviceSelections(screen, audio),
        validateDevices: () => this.validateDeviceSelections(),
        getCurrentSelections: () => ({
          selectedScreen: this.centralState.selectedScreen,
          selectedAudioInput: this.centralState.selectedAudioInput,
          availableDevices: this.centralState.availableDevices
        })
      };

      console.log(`✅ Screen recorder and devices initialized successfully`);
      console.log(`📱 Devices: ${devices.screens.length} screens, ${devices.audio.length} audio inputs`);
      console.log(`🎯 Default selections: Screen '${defaultScreen}', Audio '${defaultAudio}'`);

    } catch (error) {
      console.error('❌ Failed to initialize screen recorder/devices:', error);
      this.notifyStateChange({ 
        screenRecorderApiStatus: 'unavailable',
        screenRecorderError: error.message,
        devicesInitialized: false
      });
      throw new Error(`Screen recorder initialization failed: ${error.message}`);
    }
  }

  // 🔴 FIXED: Device management methods with proper state updates
  async refreshDevices() {
    try {
      console.log('🔄 Refreshing devices...');
      this.notifyStateChange({ loadingDevices: true });
      
      const status = await window.electronAPI.screenRecorder.getStatus();
      const devices = this.formatDevices(status.availableDevices || {});
      
      // Validate current selections against new device list
      const { selectedScreen, selectedAudioInput } = this.centralState;
      let newScreen = selectedScreen;
      let newAudio = selectedAudioInput;
      let changesNeeded = false;
      
      // Check if current screen selection is still valid
      if (selectedScreen && !devices.screens.find(s => s.id === selectedScreen)) {
        newScreen = devices.screens[0]?.id || '';
        console.warn(`⚠️ Selected screen ${selectedScreen} no longer available, switching to ${newScreen}`);
        changesNeeded = true;
      }
      
      // Check if current audio selection is still valid
      if (selectedAudioInput && !devices.audio.find(a => a.id === selectedAudioInput)) {
        newAudio = devices.audio[0]?.id || '';
        console.warn(`⚠️ Selected audio ${selectedAudioInput} no longer available, switching to ${newAudio}`);
        changesNeeded = true;
      }
      
      // Update state with new devices and any corrected selections
      this.notifyStateChange({
        availableDevices: devices,
        selectedScreen: newScreen,
        selectedAudioInput: newAudio,
        loadingDevices: false
      });
      
      console.log(`✅ Devices refreshed: ${devices.screens.length} screens, ${devices.audio.length} audio inputs`);
      if (changesNeeded) {
        console.log('🔧 Device selections were automatically corrected due to changes');
      }
      
      return { success: true, devices, changesNeeded };
      
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
      this.notifyStateChange({ loadingDevices: false });
      throw error;
    }
  }

  updateDeviceSelections(screen, audio) {
    console.log(`🎯 Updating device selections: Screen '${screen}', Audio '${audio}'`);
    this.notifyStateChange({
      selectedScreen: screen,
      selectedAudioInput: audio
    });
  }

  async validateDeviceSelections() {
    const { selectedScreen, selectedAudioInput, availableDevices } = this.centralState;
    
    const screenValid = selectedScreen && availableDevices.screens.find(s => s.id === selectedScreen);
    const audioValid = !selectedAudioInput || availableDevices.audio.find(a => a.id === selectedAudioInput);
    
    const issues = [];
    if (!screenValid) issues.push(`Screen device '${selectedScreen}' not available`);
    if (!audioValid) issues.push(`Audio device '${selectedAudioInput}' not available`);
    
    return {
      valid: issues.length === 0,
      issues,
      changed: false
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

      this.notifyStateChange({ recordingSettings });
      
      // Apply other settings via app state callback
      if (this.appStateCallback) {
        this.appStateCallback({
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

  // 🔴 FIXED: ONLY place where event handlers are set up (no duplicates anywhere else)
  setupCentralizedEventHandlers() {
    console.log('🔧 Setting up CENTRALIZED event handlers (ONLY HERE)...');
    
    // Clean up any existing handlers first
    this.cleanupEventHandlers();

    // Screen recorder events - SINGLE SOURCE OF TRUTH
    this.setupScreenRecorderEvents();
    
    // Transcription events  
    this.setupTranscriptionEvents();
    
    // Model events
    this.setupModelEvents();
    
    console.log('✅ CENTRALIZED event handlers set up successfully');
  }

  setupScreenRecorderEvents() {
    const api = window.electronAPI.screenRecorder;
    
    if (api.onRecordingStarted) {
      this.eventCleanups.recordingStarted = api.onRecordingStarted((data) => {
        console.log('📹 [CENTRAL] Recording started:', data);
        this.notifyStateChange({
          isRecording: true,
          recordingValidated: false,
          recordingDuration: 0,
          isPaused: false,
          screenRecorderError: null
        });
      });
    }

    if (api.onRecordingValidated) {
      this.eventCleanups.recordingValidated = api.onRecordingValidated((data) => {
        console.log('✅ [CENTRAL] Recording validated:', data);
        this.notifyStateChange({
          recordingValidated: true
        });
      });
    }

    if (api.onRecordingCompleted) {
      this.eventCleanups.recordingCompleted = api.onRecordingCompleted((data) => {
        console.log('🏁 [CENTRAL] Recording completed:', data);
        this.notifyStateChange({
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
        this.notifyStateChange({
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
          this.notifyStateChange({ recordingDuration: seconds });
        }
      });
    }

    if (api.onRecordingPaused) {
      this.eventCleanups.recordingPaused = api.onRecordingPaused(() => {
        console.log('⏸️ [CENTRAL] Recording paused');
        this.notifyStateChange({ isPaused: true });
      });
    }

    if (api.onRecordingResumed) {
      this.eventCleanups.recordingResumed = api.onRecordingResumed(() => {
        console.log('▶️ [CENTRAL] Recording resumed');
        this.notifyStateChange({ isPaused: false });
      });
    }
  }

  setupTranscriptionEvents() {
    const api = window.electronAPI.transcription;
    
    if (api.onProgress) {
      this.eventCleanups.transcriptionProgress = api.onProgress((data) => {
        if (this.appStateCallback) {
          this.appStateCallback({
            progress: data.progress || 0,
            progressMessage: data.message || data.stage || 'Processing...'
          });
        }
      });
    }

    if (api.onComplete) {
      this.eventCleanups.transcriptionComplete = api.onComplete((data) => {
        if (data.result && this.appStateCallback) {
          this.appStateCallback({
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
        if (this.appStateCallback) {
          this.appStateCallback({
            isTranscribing: false,
            progress: 0,
            progressMessage: 'Error occurred'
          });
        }
      });
    }

    if (api.onStart) {
      this.eventCleanups.transcriptionStart = api.onStart((data) => {
        if (this.appStateCallback) {
          this.appStateCallback({ 
            activeTranscriptionId: data.transcriptionId, 
            isTranscribing: true 
          });
        }
      });
    }

    if (api.onCancelled) {
      this.eventCleanups.transcriptionCancelled = api.onCancelled(() => {
        if (this.appStateCallback) {
          this.appStateCallback({ 
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

  // Handle auto-transcription centrally
  handleAutoTranscription(audioPath) {
    const fileInfo = {
      path: audioPath,
      name: audioPath.split('/').pop() || audioPath.split('\\').pop(),
      size: 0
    };
    
    if (this.appStateCallback) {
      this.appStateCallback({ selectedFile: fileInfo });
      
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
    this.stateSubscribers.clear();
    this.appStateCallback = null;
  }

  // 🔴 FIXED: Public API for external access
  getCentralState() {
    return { ...this.centralState }; // Return copy to prevent mutation
  }

  getService(name) {
    return this.services[name];
  }

  isReady() {
    return this.initialized;
  }

  // 🔴 FIXED: Screen recorder action methods with proper error handling
  async startRecording(options = {}) {
    const { selectedScreen, selectedAudioInput, recordingSettings } = this.centralState;
    
    if (!selectedScreen) {
      throw new Error('No screen selected for recording');
    }
    
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

      console.log('🎬 [CENTRAL] Starting recording with options:', recordingOptions);
      const result = await window.electronAPI.screenRecorder.startRecording(recordingOptions);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording');
      }
      
      return result;
    } catch (error) {
      console.error('❌ [CENTRAL] Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording() {
    try {
      console.log('⏹️ [CENTRAL] Stopping recording...');
      const result = await window.electronAPI.screenRecorder.stopRecording();
      return result;
    } catch (error) {
      console.error('❌ [CENTRAL] Failed to stop recording:', error);
      throw error;
    }
  }

  async pauseResumeRecording() {
    const { isPaused } = this.centralState;
    
    try {
      console.log(`${isPaused ? '▶️' : '⏸️'} [CENTRAL] ${isPaused ? 'Resuming' : 'Pausing'} recording...`);
      const result = isPaused 
        ? await window.electronAPI.screenRecorder.resumeRecording()
        : await window.electronAPI.screenRecorder.pauseRecording();
      return result;
    } catch (error) {
      console.error('❌ [CENTRAL] Failed to pause/resume recording:', error);
      throw error;
    }
  }

  // 🔴 NEW: Public API for getting screen recorder actions
  getScreenRecorderActions() {
    return {
      startRecording: (options) => this.startRecording(options),
      stopRecording: () => this.stopRecording(),
      pauseResume: () => this.pauseResumeRecording(),
      getStatus: () => this.centralState,
      refreshDevices: () => this.refreshDevices()
    };
  }
}

// Create singleton instance
export const appInitializer = new AppInitializer();