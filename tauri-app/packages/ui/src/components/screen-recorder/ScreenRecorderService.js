import { rendererScreenRecorder } from '../../utils/RendererScreenRecorder';

export class ScreenRecorderService {
  constructor() {
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
    this.eventCleanups = [];
    this.isInitialized = false;
  }

  async initialize(updateStateCallback, addToEventLogCallback) {
    if (this.isInitialized) return;

    this.updateStateCallback = updateStateCallback;
    this.addToEventLogCallback = addToEventLogCallback;

    try {
      // Initialize renderer screen recorder for device enumeration
      await rendererScreenRecorder.initialize();

      // Initialize backend connection
      await this.initializeBackend();

      // Set up event listeners
      this.setupEventListeners();

      // Load initial state
      await this.loadInitialState();

      this.isInitialized = true;
      console.log('✅ Screen recorder service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize screen recorder service:', error);
      throw error;
    }
  }

  async initializeBackend() {
    if (!window.electronAPI?.screenRecorder) {
      throw new Error('Screen recorder API not available');
    }

    // Test backend connection
    const status = await window.electronAPI.screenRecorder.getStatus();
    if (status.error) {
      console.warn('⚠️ Backend has issues:', status.error);
    }
  }

  setupEventListeners() {
    const api = window.electronAPI.screenRecorder;
    if (!api) return;

    // Recording events
    const events = [
      {
        name: 'onRecordingStarted',
        handler: (data) => {
          console.log('📹 Recording started:', data);
          this.updateState({
            isRecording: true,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false,
            localError: null
          });
          this.addToEventLog('Recording started');
        }
      },
      {
        name: 'onRecordingValidated',
        handler: (data) => {
          console.log('✅ Recording validated:', data);
          this.updateState({ recordingValidated: true });
          this.addToEventLog('Recording validated');
        }
      },
      {
        name: 'onRecordingCompleted',
        handler: (data) => {
          console.log('🏁 Recording completed:', data);
          this.updateState({
            isRecording: false,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false
          });
          this.addToEventLog(`Recording completed: ${data.outputPath || 'Unknown path'}`);
        }
      },
      {
        name: 'onRecordingError',
        handler: (data) => {
          console.error('❌ Recording error:', data);
          this.updateState({
            isRecording: false,
            recordingValidated: false,
            recordingDuration: 0,
            isPaused: false,
            localError: data.error
          });
          this.addToEventLog(`Recording error: ${data.error}`);
        }
      },
      {
        name: 'onRecordingProgress',
        handler: (data) => {
          const duration = Math.floor(data.duration / 1000);
          this.updateState({ recordingDuration: duration });
        }
      },
      {
        name: 'onRecordingPaused',
        handler: (data) => {
          console.log('⏸️ Recording paused:', data);
          this.updateState({ isPaused: true });
          this.addToEventLog('Recording paused');
        }
      },
      {
        name: 'onRecordingResumed',
        handler: (data) => {
          console.log('▶️ Recording resumed:', data);
          this.updateState({ isPaused: false });
          this.addToEventLog('Recording resumed');
        }
      }
    ];

    // Set up event listeners
    events.forEach(({ name, handler }) => {
      if (api[name]) {
        const cleanup = api[name](handler);
        if (cleanup) {
          this.eventCleanups.push(cleanup);
        }
      }
    });
  }

  async loadInitialState() {
    try {
      // Get backend status
      const status = await window.electronAPI.screenRecorder.getStatus();
      
      // Get available devices
      const devices = status.availableDevices || { screens: [], audio: [] };
      
      // Set defaults
      const defaultScreen = devices.screens[0]?.id || '';
      const defaultAudio = devices.audio[0]?.id || '';

      this.updateState({
        availableDevices: devices,
        selectedScreen: defaultScreen,
        selectedAudioInput: defaultAudio,
        devicesInitialized: true,
        isRecording: status.isRecording || false,
        recordingValidated: status.recordingValidated || false,
        recordingDuration: status.duration ? Math.floor(status.duration / 1000) : 0,
        isPaused: status.isPaused || false
      });

      console.log(`📱 Loaded ${devices.screens.length} screens and ${devices.audio.length} audio devices`);
    } catch (error) {
      console.error('❌ Failed to load initial state:', error);
      throw error;
    }
  }

  async startRecording(options = {}) {
    if (!window.electronAPI?.screenRecorder) {
      throw new Error('Screen recorder API not available');
    }

    const result = await window.electronAPI.screenRecorder.startRecording(options);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to start recording');
    }

    return result;
  }

  async stopRecording() {
    if (!window.electronAPI?.screenRecorder) {
      throw new Error('Screen recorder API not available');
    }

    const result = await window.electronAPI.screenRecorder.stopRecording();
    
    if (!result.success && !result.wasAlreadyStopped) {
      throw new Error(result.error || 'Failed to stop recording');
    }

    return result;
  }

  async pauseRecording() {
    if (!window.electronAPI?.screenRecorder) {
      throw new Error('Screen recorder API not available');
    }

    const result = await window.electronAPI.screenRecorder.pauseRecording();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to pause recording');
    }

    return result;
  }

  async resumeRecording() {
    if (!window.electronAPI?.screenRecorder) {
      throw new Error('Screen recorder API not available');
    }

    const result = await window.electronAPI.screenRecorder.resumeRecording();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to resume recording');
    }

    return result;
  }

  async refreshDevices() {
    try {
      // Refresh renderer devices
      await rendererScreenRecorder.enumerateAudioDevices();
      
      // Get updated status from backend
      const status = await window.electronAPI.screenRecorder.getStatus();
      const devices = status.availableDevices || { screens: [], audio: [] };

      this.updateState({
        availableDevices: devices,
        devicesInitialized: true
      });

      console.log('🔄 Devices refreshed');
      return devices;
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
      throw error;
    }
  }

  async getStatus() {
    if (!window.electronAPI?.screenRecorder) {
      return { error: 'API not available' };
    }

    return await window.electronAPI.screenRecorder.getStatus();
  }

  updateState(updates) {
    if (this.updateStateCallback) {
      this.updateStateCallback(updates);
    }
  }

  addToEventLog(event) {
    if (this.addToEventLogCallback) {
      this.addToEventLogCallback(event);
    } else {
      console.log(`[ScreenRecorderService] ${event}`);
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up screen recorder service');
    
    // Clean up event listeners
    this.eventCleanups.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('⚠️ Error during event cleanup:', error);
      }
    });
    this.eventCleanups = [];

    // Clean up renderer screen recorder
    if (rendererScreenRecorder) {
      rendererScreenRecorder.cleanup();
    }

    this.isInitialized = false;
    this.updateStateCallback = null;
    this.addToEventLogCallback = null;
  }
} 