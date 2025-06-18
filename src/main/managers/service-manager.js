// src/main/managers/service-manager.js
const EventEmitter = require('events');
const { createScreenRecorderSystem } = require('../screen-recorder');

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
      await this.initializeEnhancedScreenRecorder(); // Updated for v7
      
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

  async initializeEnhancedScreenRecorder() {
    try {
      console.log('🔧 Initializing Enhanced Screen Recorder System with Aperture v7...');
      
      // Create the complete enhanced screen recorder system
      this.screenRecorderSystem = await createScreenRecorderSystem();
      
      // Add the service to your services object
      this.services.screenRecorder = this.screenRecorderSystem.service;
      
      // Log the recording method for debugging
      const methodInfo = this.services.screenRecorder.engine?.getMethodInfo?.();
      if (methodInfo) {
        console.log('🎯 Recording method selected:', methodInfo.name);
        console.log('📊 Capabilities:', methodInfo.features.join(', '));
      }
      
      console.log('✅ Enhanced Screen Recorder System initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Screen Recorder System:', error);
      console.warn('⚠️ Screen recorder will use fallback mode');
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
      const screenRecorderEvents = {
        'started': 'screenRecorder:started',
        'completed': 'screenRecorder:completed', 
        'error': 'screenRecorder:error',
        'paused': 'screenRecorder:paused',
        'resumed': 'screenRecorder:resumed',
        'progress': 'screenRecorder:progress',
        'validated': 'screenRecorder:validated'
      };

      Object.entries(screenRecorderEvents).forEach(([eventName, channelName]) => {
        this.services.screenRecorder.on(eventName, (data) => {
          console.log(`📹 Recording ${eventName} event:`, data);
          
          // Enhance error events with additional context
          if (eventName === 'error') {
            const enhancedError = {
              ...data,
              timestamp: new Date().toISOString(),
              platform: process.platform,
              method: data.method || 'unknown',
              apiVersion: data.apiVersion || 'unknown'
            };
            
            if (data.error?.includes('Selected framerate') || data.error?.includes('Input/output error')) {
              enhancedError.suggestion = 'Try refreshing devices or check screen recording permissions';
            } else if (data.error?.includes('permission')) {
              enhancedError.suggestion = 'Please grant screen recording and microphone permissions';
            } else if (data.error?.includes('ESM') || data.error?.includes('import')) {
              enhancedError.suggestion = 'Aperture v7 compatibility issue - using browser fallback';
            }
            
            this.mainWindow?.webContents.send(channelName, enhancedError);
          } else {
            // Add method info to success events
            const enhancedData = {
              ...data,
              method: data.method || 'unknown',
              apiVersion: data.apiVersion || 'unknown'
            };
            
            this.mainWindow?.webContents.send(channelName, enhancedData);
          }
        });
      });
      
      console.log('✅ Enhanced screen recorder events set up');
    } catch (error) {
      console.error('❌ Failed to set up enhanced screen recorder events:', error);
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
    return this.screenRecorderSystem?.handlers;
  }

  async cleanup() {
    console.log('🔧 Cleaning up services...');
    
    // Cleanup enhanced screen recorder system first
    if (this.screenRecorderSystem?.handlers) {
      try {
        this.screenRecorderSystem.handlers.cleanup();
        console.log('✅ Enhanced screen recorder system cleaned up');
      } catch (error) {
        console.error('❌ Failed to cleanup enhanced screen recorder system:', error);
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