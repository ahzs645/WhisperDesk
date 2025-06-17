// src/main/services/screen-recorder.js - FIXED: Proper file handling and event deduplication
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
    this.actualOutputPath = null; // FIXED: Track where file actually gets saved
    this.durationTimer = null;
    this.hasActiveProcess = false;
    this.lastError = null;
    this.availableScreens = [];
    this.availableAudioDevices = [];
    this.lastProgressEmit = 0; // FIXED: Prevent duplicate progress events
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
      
      console.log(`✅ Found ${screens.length} screens and ${windows.length} windows`);
      
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

  // FIXED: Generate expected output path that renderer can use
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

      // Generate output filename that renderer can use
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = recordingDirectory || this.tempDir;
      this.outputPath = path.join(outputDir, `recording-${timestamp}.webm`);
      
      // FIXED: Initialize actual output path as null until renderer confirms
      this.actualOutputPath = null;

      // Set recording state
      this.isRecording = true;
      this.recordingValidated = false;
      this.startTime = Date.now();
      this.duration = 0;
      this.lastError = null;
      this.hasActiveProcess = true;
      this.lastProgressEmit = 0; // Reset progress tracking

      // Start duration timer
      this.startDurationTimer();

      // Emit started event with source information
      this.emit('started', {
        outputPath: this.outputPath, // Expected path for renderer to use
        screenSource: screenSource,
        options
      });

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

  // FIXED: Don't emit completion until we verify the file exists
  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress', wasAlreadyStopped: true };
    }

    try {
      console.log('⏹️ Stopping recording...');
      
      this.isRecording = false;
      this.hasActiveProcess = false;
      this.stopDurationTimer();
      
      // FIXED: Don't emit completion yet - wait for renderer to confirm file path
      console.log(`✅ Recording stopped successfully. Duration: ${this.duration}ms`);
      console.log(`🔍 Waiting for file confirmation at: ${this.outputPath}`);
      
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      this.lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  // FIXED: New method for renderer to confirm actual file location
  async confirmRecordingComplete(actualFilePath) {
    try {
      // Verify the file actually exists
      await fs.access(actualFilePath);
      const stats = await fs.stat(actualFilePath);
      
      this.actualOutputPath = actualFilePath;
      
      console.log(`✅ Recording file confirmed: ${actualFilePath} (${Math.round(stats.size / 1024)}KB)`);
      
      // Now emit the completion event with verified file path
      this.emit('completed', {
        outputPath: this.actualOutputPath,
        expectedPath: this.outputPath,
        duration: this.duration,
        audioPath: this.actualOutputPath, // For transcription
        fileSize: stats.size
      });
      
      return { success: true, actualPath: this.actualOutputPath };
      
    } catch (error) {
      console.error('❌ Failed to confirm recording file:', error);
      this.lastError = `Recording file not found: ${error.message}`;
      
      this.emit('error', {
        error: this.lastError,
        expectedPath: this.outputPath,
        actualPath: actualFilePath
      });
      
      return { success: false, error: this.lastError };
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

  // FIXED: Throttle progress events to prevent duplicates
  startDurationTimer() {
    if (this.durationTimer) return;
    
    this.durationTimer = setInterval(() => {
      if (this.isRecording && !this.isPaused) {
        const newDuration = Date.now() - this.startTime;
        
        // FIXED: Only emit progress if duration changed significantly (>500ms)
        if (newDuration - this.lastProgressEmit > 500) {
          this.duration = newDuration;
          this.lastProgressEmit = newDuration;
          
          this.emit('progress', { duration: this.duration });
        }
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
      const recordings = [];
      
      for (const file of files) {
        if (file.endsWith('.webm') || file.endsWith('.mp4')) {
          try {
            const filePath = path.join(this.tempDir, file);
            const stats = await fs.stat(filePath);
            recordings.push({
              name: file,
              path: filePath,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString()
            });
          } catch (error) {
            console.warn(`Could not get stats for ${file}:`, error.message);
          }
        }
      }
      
      return recordings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      outputPath: this.outputPath,
      actualOutputPath: this.actualOutputPath, // FIXED: Include actual path info
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
    this.actualOutputPath = null; // FIXED: Reset actual path
    this.lastProgressEmit = 0;
    this.stopDurationTimer();
    this.recordingProcess = null;
  }
}

module.exports = ScreenRecorder;