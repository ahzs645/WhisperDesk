// src/main/services/screen-recorder.js - COMPLETELY REWRITTEN for proper Electron integration
const { EventEmitter } = require('events');
const { desktopCapturer, systemPreferences } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class ScreenRecorder extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.isPaused = false;
    this.recordingProcess = null;
    this.recordingValidated = false;
    this.startTime = null;
    this.duration = 0;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-recordings');
    this.outputPath = null;
    this.durationTimer = null;
    this.hasActiveProcess = false;
    this.lastError = null;
    this.availableScreens = [];
    this.availableAudioDevices = [];
  }

  async initialize() {
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Check permissions on macOS
      if (process.platform === 'darwin') {
        await this.checkMacOSPermissions();
      }
      
      // Get initial device list
      await this.refreshDevices();
      
      console.log('✅ Enhanced Screen recorder service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize screen recorder:', error);
      this.lastError = error.message;
      throw error;
    }
  }

  async checkMacOSPermissions() {
    try {
      const screenAccess = systemPreferences.getMediaAccessStatus('screen');
      console.log('📱 macOS Screen Recording Permission:', screenAccess);
      
      if (screenAccess !== 'granted') {
        console.warn('⚠️ Screen recording permission not granted on macOS');
        this.lastError = `Screen recording permission ${screenAccess}. Please grant permission in System Preferences → Privacy & Security → Screen Recording`;
      }
      
      return screenAccess === 'granted';
    } catch (error) {
      console.error('❌ Failed to check macOS permissions:', error);
      return false;
    }
  }

  async refreshDevices() {
    try {
      console.log('🔄 Refreshing available devices...');
      
      // Get available screens and windows using desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }, // Don't need thumbnails for performance
        fetchWindowIcons: false
      });
      
      // Separate screens from windows
      const screens = sources.filter(source => source.id.startsWith('screen:'));
      const windows = sources.filter(source => source.id.startsWith('window:'));
      
      this.availableScreens = screens.map((screen, index) => ({
        id: screen.id,
        name: screen.name || `Screen ${index + 1}`,
        type: 'screen',
        displayId: screen.display_id
      }));
      
      // Add windows as capturable sources
      const windowSources = windows.slice(0, 10).map((window, index) => ({ // Limit to 10 windows for performance
        id: window.id,
        name: window.name || `Window ${index + 1}`,
        type: 'window',
        appIcon: window.appIcon
      }));
      
      // Combine screens and windows
      this.availableScreens = [...this.availableScreens, ...windowSources];
      
      // Note: Audio device enumeration happens in renderer process
      // We'll provide a method to request audio devices from renderer
      
      console.log(`✅ Found ${screens.length} screens and ${windows.length} windows`);
      console.log('📱 Available screens:', this.availableScreens);
      
      return {
        screens: this.availableScreens,
        audio: [] // Will be populated by renderer process
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
      this.lastError = error.message;
      throw error;
    }
  }

  async getAvailableScreens() {
    try {
      await this.refreshDevices();
      return this.availableScreens.map(screen => ({
        id: screen.id,
        name: screen.name,
        type: screen.type
      }));
    } catch (error) {
      console.error('❌ Failed to get available screens:', error);
      return [];
    }
  }

  // This method will be called by renderer process to start recording
  // The actual recording happens in renderer using MediaRecorder API
  async startRecording(options = {}) {
    if (this.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    try {
      const {
        screenId,
        audioInputId,
        includeMicrophone = true,
        includeSystemAudio = false,
        videoQuality = 'medium',
        audioQuality = 'medium',
        recordingDirectory
      } = options;

      // Validate screen source exists
      if (!screenId) {
        throw new Error('No screen source specified');
      }

      const screenSource = this.availableScreens.find(screen => screen.id === screenId);
      if (!screenSource) {
        throw new Error(`Screen source ${screenId} not found. Available sources: ${this.availableScreens.map(s => s.id).join(', ')}`);
      }

      // Generate output filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = recordingDirectory || this.tempDir;
      this.outputPath = path.join(outputDir, `recording-${timestamp}.webm`);

      // Set recording state
      this.isRecording = true;
      this.recordingValidated = false;
      this.startTime = Date.now();
      this.duration = 0;
      this.lastError = null;
      this.hasActiveProcess = true;

      // Start duration timer
      this.startDurationTimer();

      // Emit started event with source information
      this.emit('started', {
        outputPath: this.outputPath,
        screenSource: screenSource,
        options
      });

      // The actual recording will be handled by the renderer process
      // This just manages the state and provides the configuration

      console.log(`✅ Recording session started for ${screenSource.name}`);
      return { 
        success: true, 
        outputPath: this.outputPath,
        screenSource: screenSource
      };

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.cleanup();
      this.lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress', wasAlreadyStopped: true };
    }

    try {
      console.log('⏹️ Stopping recording...');
      
      this.isRecording = false;
      this.hasActiveProcess = false;
      this.stopDurationTimer();
      
      // Emit completion event
      this.emit('completed', {
        outputPath: this.outputPath,
        duration: this.duration,
        audioPath: this.outputPath // For transcription
      });

      console.log(`✅ Recording stopped successfully. Duration: ${this.duration}ms`);
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      this.lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  async pauseRecording() {
    if (!this.isRecording || this.isPaused) {
      return { success: false, error: 'Cannot pause - not recording or already paused' };
    }

    try {
      this.isPaused = true;
      this.emit('paused');
      console.log('⏸️ Recording paused');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      return { success: false, error: error.message };
    }
  }

  async resumeRecording() {
    if (!this.isRecording || !this.isPaused) {
      return { success: false, error: 'Cannot resume - not recording or not paused' };
    }

    try {
      this.isPaused = false;
      this.emit('resumed');
      console.log('▶️ Recording resumed');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      return { success: false, error: error.message };
    }
  }

  startDurationTimer() {
    if (this.durationTimer) return;
    
    this.durationTimer = setInterval(() => {
      if (this.isRecording && !this.isPaused) {
        this.duration = Date.now() - this.startTime;
        this.emit('progress', { duration: this.duration });
      }
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  // Mark recording as validated (called by renderer when recording actually starts)
  validateRecording() {
    if (this.isRecording && !this.recordingValidated) {
      this.recordingValidated = true;
      this.emit('validated');
      console.log('✅ Recording validated');
    }
  }

  // Handle recording error (called by renderer if recording fails)
  handleRecordingError(error) {
    console.error('❌ Recording error from renderer:', error);
    this.lastError = error.message || error;
    this.cleanup();
    this.emit('error', {
      error: this.lastError,
      timestamp: new Date().toISOString(),
      platform: process.platform
    });
  }

  async getRecordings() {
    try {
      const files = await fs.readdir(this.tempDir);
      const recordings = files
        .filter(file => file.endsWith('.webm') || file.endsWith('.mp4'))
        .map(file => ({
          name: file,
          path: path.join(this.tempDir, file),
          createdAt: new Date().toISOString()
        }));
      return recordings;
    } catch (error) {
      console.error('Failed to get recordings:', error);
      return [];
    }
  }

  async deleteRecording(filePath) {
    try {
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      recordingValidated: this.recordingValidated,
      duration: this.duration,
      hasActiveProcess: this.hasActiveProcess,
      lastError: this.lastError,
      availableDevices: {
        screens: this.availableScreens.map(s => s.id),
        audio: [], // Will be populated by renderer
        deviceNames: {
          screens: Object.fromEntries(this.availableScreens.map(s => [s.id, s.name])),
          audio: {} // Will be populated by renderer
        }
      }
    };
  }

  forceCleanup() {
    console.log('🧹 Force cleanup requested');
    this.cleanup();
    return { success: true, message: 'Cleanup completed' };
  }

  cleanup() {
    console.log('🧹 Cleaning up screen recorder');
    this.isRecording = false;
    this.isPaused = false;
    this.recordingValidated = false;
    this.hasActiveProcess = false;
    this.stopDurationTimer();
    this.recordingProcess = null;
  }
}

module.exports = ScreenRecorder;