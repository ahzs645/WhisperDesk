// src/main/managers/service-manager.js
const EventEmitter = require('events');
const { createScreenRecorderSystem, createPlatformAwareScreenRecorderSystem } = require('../screen-recorder');

class ServiceManager extends EventEmitter {
  constructor() {
    super();
    this.services = {};
    this.mainWindow = null;
    this.screenRecorderSystem = null;
  }

  async initialize() {
    console.log('🔧 Initializing services...');
    
    try {
      // Initialize services in order of dependency
      await this.initializeModelManager();
      await this.initializeTranscriptionService();
      await this.initializeSettingsService();
      await this.initializeExportService();
      await this.initializeEnhancedDeviceManager();
      await this.initializePlatformAwareScreenRecorder();
      await this.initializeSpeakerRecognitionService();
      
      console.log('✅ Services initialization completed');
      return true;
    } catch (error) {
      console.error('❌ Service initialization had errors:', error);
      console.warn('⚠️ Some services may not be available, but app will continue...');
      return false;
    }
  }

  async initializeModelManager() {
    try {
      console.log('🔧 Initializing Model Manager...');
      const ModelManager = require('../services/model-manager');
      this.services.modelManager = new ModelManager();
      await this.services.modelManager.initialize();
      console.log('✅ Model Manager initialized');
    } catch (error) {
      console.error('❌ Model Manager failed:', error);
      this.services.modelManager = this.createFallbackModelManager();
    }
  }

  async initializeTranscriptionService() {
    try {
      console.log('🔧 Initializing Transcription Service...');
      const TranscriptionService = require('../services/transcription-service-native');
      this.services.transcriptionService = new TranscriptionService(this.services.modelManager);
      await this.services.transcriptionService.initialize();
      console.log('✅ Transcription Service initialized');
    } catch (error) {
      console.error('❌ Transcription Service failed:', error);
      this.services.transcriptionService = this.createFallbackTranscriptionService();
    }
  }

  async initializeSettingsService() {
    try {
      console.log('🔧 Initializing Settings Service...');
      const SettingsService = require('../services/settings-service');
      this.services.settingsService = new SettingsService();
      await this.services.settingsService.initialize();
      console.log('✅ Settings Service initialized');
    } catch (error) {
      console.error('❌ Settings Service failed:', error);
      this.services.settingsService = this.createFallbackSettingsService();
    }
  }

  async initializeExportService() {
    try {
      console.log('🔧 Initializing Export Service...');
      const ExportService = require('../services/export-service');
      this.services.exportService = new ExportService();
      await this.services.exportService.initialize();
      console.log('✅ Export Service initialized');
    } catch (error) {
      console.error('❌ Export Service failed:', error);
      this.services.exportService = this.createFallbackExportService();
    }
  }

  async initializeSpeakerRecognitionService() {
    try {
      console.log('🔧 Initializing Speaker Recognition Service...');
      const SpeakerRecognitionService = require('../services/speaker-recognition-service');
      this.services.speakerRecognitionService = new SpeakerRecognitionService();
      await this.services.speakerRecognitionService.initialize();
      console.log('✅ Speaker Recognition Service initialized');
    } catch (error) {
      console.error('❌ Speaker Recognition Service failed:', error);
      this.services.speakerRecognitionService = null;
    }
  }

  async initializeEnhancedDeviceManager() {
    try {
      console.log('🔧 Initializing Enhanced Device Manager...');
      const DeviceManager = require('../services/device-manager');
      this.services.deviceManager = new DeviceManager();
      await this.services.deviceManager.initialize();
      console.log('✅ Enhanced Device Manager initialized successfully');
    } catch (error) {
      console.error('❌ Enhanced Device Manager failed to initialize:', error);
      console.warn('⚠️ Device manager will use fallback mode');
    }
  }

  async initializePlatformAwareScreenRecorder() {
    try {
      console.log('🔧 Initializing CapRecorder-Based Screen Recorder...');
      
      // Use CapRecorder system
      console.log('🔧 Creating CapRecorder screen recorder system...');
      this.screenRecorderSystem = await createPlatformAwareScreenRecorderSystem();
      console.log('✅ CapRecorder screen recorder system created successfully');
      
      this.services.screenRecorder = this.screenRecorderSystem.service;
      console.log('✅ CapRecorder screen recorder service assigned');
      
      // Log platform information
      const platformInfo = this.screenRecorderSystem.platformInfo;
      console.log('🎯 Recording Architecture:', {
        platform: platformInfo.platform,
        method: platformInfo.selectedMethod,
        features: platformInfo.supportedFeatures
      });
      
      // Verify handlers were created
      if (this.screenRecorderSystem.handlers) {
        console.log('✅ CapRecorder screen recorder handlers created');
        console.log('🔍 Handlers registered count:', this.screenRecorderSystem.handlers.registeredHandlers?.size || 0);
      } else {
        console.warn('⚠️ CapRecorder screen recorder handlers not created');
      }
      
      // Log CapRecorder features
      console.log('🎯 CapRecorder Features:');
      console.log('  � High-performance screen recording');
      console.log('  �️ Support for screen and window capture');
      console.log('  � System audio recording');
      console.log('  🎯 Cross-platform (macOS, Windows, Linux)');
      console.log('  ⚡ Native Rust performance');
      console.log('  🚀 Async/await API');
      console.log('  ⏸️ Pause/resume functionality');
      
      console.log('✅ CapRecorder-Based Screen Recorder initialized');
    } catch (error) {
      console.error('❌ Failed to initialize CapRecorder-Based Screen Recorder:', error);
      console.error('❌ Error details:', error.stack);
      
      // Don't throw - let the app continue with fallback handlers
      console.warn('⚠️ Screen recorder will use fallback mode');
      this.screenRecorderSystem = null;
      this.services.screenRecorder = null;
    }
  }

  setupEventForwarding(mainWindow) {
    this.mainWindow = mainWindow;
    
    if (this.services.modelManager) {
      this.setupModelManagerEventForwarding();
    }
    
    if (this.services.transcriptionService) {
      this.setupTranscriptionEvents();
    }
    
    if (this.services.screenRecorder) {
      this.setupEnhancedScreenRecorderEvents(); // Updated for v7
    }
    
    if (this.services.speakerRecognitionService) {
      this.setupSpeakerRecognitionEvents();
    }
  }

  setupModelManagerEventForwarding() {
    if (!this.services.modelManager || !this.mainWindow) {
      console.warn('⚠️ Model manager or main window not available for event forwarding');
      return;
    }

    console.log('🔧 Setting up model manager event forwarding...');
    
    // Download progress events
    this.services.modelManager.on('downloadProgress', (data) => {
      const progress = Math.round(data.progress);
      if (progress % 5 === 0 || data.progress >= 100) {
        console.log(`📊 [MAIN] Download progress ${data.modelId}: ${progress}%`);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('model:downloadProgress', { ...data, progress });
        }
      }
    });

    // Other model events
    const modelEvents = [
      'downloadQueued',
      'downloadComplete', 
      'downloadError',
      'downloadCancelled',
      'modelDeleted'
    ];

    modelEvents.forEach(eventName => {
      this.services.modelManager.on(eventName, (data) => {
        console.log(`📊 [MAIN] Model event ${eventName}:`, data.modelId || data);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(`model:${eventName}`, data);
        }
      });
    });

    console.log('✅ Model manager event forwarding set up successfully');
  }

  setupTranscriptionEvents() {
    if (!this.services.transcriptionService || !this.mainWindow) return;

    try {
      const transcriptionEvents = ['progress', 'complete', 'error', 'start', 'cancelled'];
      
      transcriptionEvents.forEach(eventName => {
        this.services.transcriptionService.on(eventName, (data) => {
          this.mainWindow?.webContents.send(`transcription:${eventName}`, data);
        });
      });

      console.log('✅ Transcription events set up');
    } catch (error) {
      console.error('❌ Failed to set up transcription events:', error);
    }
  }

  setupEnhancedScreenRecorderEvents() {
    if (!this.services.screenRecorder || !this.mainWindow) return;
    
    try {
      console.log('🔧 Setting up CapRecorder events...');
      
      // Setup event forwarding through the handlers
      if (this.screenRecorderSystem?.handlers) {
        this.screenRecorderSystem.handlers.setupEventForwarding(this.mainWindow);
        console.log('✅ CapRecorder event forwarding set up through handlers');
      } else {
        console.warn('⚠️ CapRecorder handlers not available for event forwarding');
      }
      
      // Additional compatibility events for existing UI
      const screenRecorderEvents = {
        'recordingStarted': 'screenRecorder:started',
        'recordingStopped': 'screenRecorder:completed', 
        'recordingPaused': 'screenRecorder:paused',
        'recordingResumed': 'screenRecorder:resumed',
        'recordingCanceled': 'screenRecorder:error'
      };

      Object.entries(screenRecorderEvents).forEach(([eventName, channelName]) => {
        this.services.screenRecorder.on(eventName, (data) => {
          console.log(`📹 CapRecorder ${eventName} event:`, data);
          
          // Transform CapRecorder events to match existing UI expectations
          let transformedData = data;
          
          if (eventName === 'recordingStopped') {
            transformedData = {
              ...data,
              success: true,
              filePath: data.outputPath,
              duration: 'unknown' // CapRecorder doesn't provide duration in event
            };
          } else if (eventName === 'recordingCanceled') {
            transformedData = {
              ...data,
              error: 'Recording was canceled',
              timestamp: new Date().toISOString(),
              platform: process.platform,
              method: 'caprecorder'
            };
          }
          
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channelName, transformedData);
          }
        });
      });

      console.log('✅ CapRecorder events set up');
    } catch (error) {
      console.error('❌ Failed to set up CapRecorder events:', error);
    }
  }

  setupSpeakerRecognitionEvents() {
    if (!this.services.speakerRecognitionService || !this.mainWindow) {
      console.warn('⚠️ Speaker recognition service or main window not available for event forwarding');
      return;
    }

    console.log('🔧 Setting up speaker recognition event forwarding...');
    
    try {
      // Listen for speaker label updates and broadcast to all windows
      this.services.speakerRecognitionService.on('speakerLabelUpdated', ({ speakerId, label }) => {
        console.log(`🗣️ [MAIN] Speaker label updated: ${speakerId} -> ${label}`);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('speaker-label-updated', { speakerId, label });
        }
      });

      // Listen for speaker creation events
      this.services.speakerRecognitionService.on('speakerCreated', ({ speakerId, profile }) => {
        console.log(`🗣️ [MAIN] Speaker created: ${speakerId}`);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('speaker-created', { speakerId, profile });
        }
      });

      console.log('✅ Speaker recognition event forwarding set up successfully');
    } catch (error) {
      console.error('❌ Failed to set up speaker recognition events:', error);
    }
  }

  // Fallback service creators (unchanged)
  createFallbackModelManager() {
    return {
      getAvailableModels: () => Promise.resolve([]),
      getInstalledModels: () => Promise.resolve([]),
      downloadModel: () => Promise.resolve({ success: false }),
      deleteModel: () => Promise.resolve({ success: false }),
      getModelInfo: () => Promise.resolve(null),
      isModelInstalled: () => false,
      getDownloadStatus: () => null,
      getAllDownloadStates: () => new Map(),
      on: () => {},
      initialize: () => Promise.resolve()
    };
  }

  createFallbackTranscriptionService() {
    return {
      getProviders: () => [{ id: 'mock', name: 'Mock Provider', isAvailable: false }],
      processFile: () => Promise.reject(new Error('Transcription service not available')),
      on: () => {},
      initialize: () => Promise.resolve()
    };
  }

  createFallbackAudioService() {
    return {
      getDevices: () => Promise.resolve([]),
      startRecording: () => Promise.resolve({ success: false }),
      stopRecording: () => Promise.resolve({ success: false }),
      getWaveform: () => Promise.resolve(null),
      initialize: () => Promise.resolve()
    };
  }

  createFallbackSettingsService() {
    const fallbackSettings = { theme: 'system' };
    return {
      get: (key) => fallbackSettings[key] || null,
      set: (key, value) => { fallbackSettings[key] = value; return true; },
      getAll: () => fallbackSettings,
      getTranscriptionSettings: () => ({}),
      initialize: () => Promise.resolve()
    };
  }

  createFallbackExportService() {
    return {
      exportText: () => Promise.resolve({ success: true }),
      exportSubtitle: () => Promise.resolve({ success: true }),
      copyToClipboard: (text) => {
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        return Promise.resolve(true);
      },
      initialize: () => Promise.resolve()
    };
  }

  getServices() {
    return this.services;
  }

  getService(serviceName) {
    return this.services[serviceName];
  }

  getScreenRecorderHandlers() {
    console.log('🔍 Getting screen recorder handlers...');
    console.log('🔍 Screen recorder system exists:', !!this.screenRecorderSystem);
    console.log('🔍 Handlers exist:', !!this.screenRecorderSystem?.handlers);
    return this.screenRecorderSystem?.handlers;
  }

  async cleanup() {
    console.log('🔧 Cleaning up services...');
    
    // Cleanup CapRecorder screen recorder system first
    if (this.screenRecorderSystem) {
      try {
        if (this.screenRecorderSystem.cleanup) {
          await this.screenRecorderSystem.cleanup();
        } else if (this.screenRecorderSystem.handlers) {
          this.screenRecorderSystem.handlers.cleanup();
        }
        console.log('✅ CapRecorder screen recorder system cleaned up');
      } catch (error) {
        console.error('❌ Failed to cleanup CapRecorder screen recorder system:', error);
      }
      this.screenRecorderSystem = null;
    }
    
    // Cleanup services that have cleanup methods
    for (const [name, service] of Object.entries(this.services)) {
      try {
        if (service && typeof service.cleanup === 'function') {
          await service.cleanup();
          console.log(`✅ ${name} cleaned up`);
        }
      } catch (error) {
        console.error(`❌ Failed to cleanup ${name}:`, error);
      }
    }
    
    this.services = {};
    console.log('✅ Service cleanup complete');
  }
}

module.exports = ServiceManager;