/**
 * @fileoverview Core screen recorder engine - handles the main recording logic
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('../types');

/**
 * Core screen recording engine
 * Handles the fundamental recording operations and state management
 */
class ScreenRecorderEngine extends EventEmitter {
  constructor() {
    super();
    
    // Recording state
    this.state = RECORDING_STATES.IDLE;
    this.isRecording = false;
    this.isPaused = false;
    this.recordingValidated = false;
    this.hasActiveProcess = false;
    
    // Timing
    this.startTime = null;
    this.duration = 0;
    this.durationTimer = null;
    this.lastProgressEmit = 0;
    
    // File paths
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-recordings');
    this.outputPath = null;
    this.actualOutputPath = null;
    
    // Error handling
    this.lastError = null;
    
    // Current recording options
    this.currentOptions = null;
    this.currentScreenSource = null;
  }

  /**
   * Initialize the recording engine
   */
  async initialize() {
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      console.log('✅ Screen recorder engine initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize screen recorder engine:', error);
      this.lastError = error.message;
      throw error;
    }
  }

  /**
   * Start a new recording session
   * @param {import('../types').RecordingOptions} options - Recording options
   * @param {import('../types').ScreenSource} screenSource - Screen source to record
   * @returns {Promise<import('../types').RecordingResult>}
   */
  async startRecording(options, screenSource) {
    if (this.isRecording) {
      return { 
        success: false, 
        error: 'Already recording',
        type: ERROR_TYPES.START_ERROR
      };
    }

    try {
      this.setState(RECORDING_STATES.STARTING);
      
      // Store current recording context
      this.currentOptions = options;
      this.currentScreenSource = screenSource;
      
      // Generate output path
      this.outputPath = this.generateOutputPath(options);
      this.actualOutputPath = null;
      
      // Initialize recording state
      this.isRecording = true;
      this.recordingValidated = false;
      this.startTime = Date.now();
      this.duration = 0;
      this.lastError = null;
      this.hasActiveProcess = true;
      this.lastProgressEmit = 0;
      
      // Start duration tracking
      this.startDurationTimer();
      
      // Update state
      this.setState(RECORDING_STATES.RECORDING);
      
      // Emit started event
      this.emit(RECORDING_EVENTS.STARTED, {
        outputPath: this.outputPath,
        screenSource: screenSource,
        options: options,
        timestamp: new Date().toISOString()
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
      
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.START_ERROR
      };
    }
  }

  /**
   * Stop the current recording
   * @returns {Promise<import('../types').RecordingResult>}
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { 
        success: true, 
        message: 'No recording in progress', 
        wasAlreadyStopped: true 
      };
    }

    try {
      this.setState(RECORDING_STATES.STOPPING);
      
      // Stop duration timer
      this.stopDurationTimer();
      
      // Update state
      this.isRecording = false;
      this.hasActiveProcess = false;
      
      console.log('🛑 Recording session stopped');
      
      // Note: We don't emit 'completed' here until file is confirmed
      // This will be done via confirmRecordingComplete()
      
      return { 
        success: true, 
        outputPath: this.outputPath,
        duration: this.duration
      };

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      this.cleanup();
      
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.STOP_ERROR
      };
    }
  }

  /**
   * Confirm recording completion with actual file path
   * @param {string} actualFilePath - The actual path where the file was saved
   * @returns {Promise<import('../types').RecordingResult>}
   */
  async confirmRecordingComplete(actualFilePath) {
    try {
      this.actualOutputPath = actualFilePath;
      
      // Verify file exists
      const fileExists = await this.verifyRecordingFile(actualFilePath);
      
      if (fileExists) {
        this.setState(RECORDING_STATES.COMPLETED);
        
        // Emit completion event
        this.emit(RECORDING_EVENTS.COMPLETED, {
          outputPath: this.outputPath,
          actualOutputPath: actualFilePath,
          duration: this.duration,
          screenSource: this.currentScreenSource,
          timestamp: new Date().toISOString()
        });
        
        console.log('✅ Recording completed and confirmed:', actualFilePath);
        
        // Clean up state but keep file info
        this.cleanupState();
        
        return { 
          success: true, 
          outputPath: actualFilePath,
          duration: this.duration
        };
      } else {
        throw new Error(`Recording file not found: ${actualFilePath}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to confirm recording completion:', error);
      this.handleRecordingError(error);
      
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.FILE_ERROR
      };
    }
  }

  /**
   * Pause the current recording
   * @returns {import('../types').RecordingResult}
   */
  pauseRecording() {
    if (!this.isRecording || this.isPaused) {
      return { 
        success: false, 
        error: 'Cannot pause - not recording or already paused',
        type: ERROR_TYPES.PAUSE_ERROR
      };
    }

    try {
      this.isPaused = true;
      this.setState(RECORDING_STATES.PAUSED);
      
      this.emit(RECORDING_EVENTS.PAUSED, {
        duration: this.duration,
        timestamp: new Date().toISOString()
      });
      
      console.log('⏸️ Recording paused');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.PAUSE_ERROR
      };
    }
  }

  /**
   * Resume the paused recording
   * @returns {import('../types').RecordingResult}
   */
  resumeRecording() {
    if (!this.isRecording || !this.isPaused) {
      return { 
        success: false, 
        error: 'Cannot resume - not recording or not paused',
        type: ERROR_TYPES.RESUME_ERROR
      };
    }

    try {
      this.isPaused = false;
      this.setState(RECORDING_STATES.RECORDING);
      
      this.emit(RECORDING_EVENTS.RESUMED, {
        duration: this.duration,
        timestamp: new Date().toISOString()
      });
      
      console.log('▶️ Recording resumed');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      return { 
        success: false, 
        error: error.message,
        type: ERROR_TYPES.RESUME_ERROR
      };
    }
  }

  /**
   * Validate that recording has actually started
   */
  validateRecording() {
    if (this.isRecording && !this.recordingValidated) {
      this.recordingValidated = true;
      
      this.emit(RECORDING_EVENTS.VALIDATED, {
        outputPath: this.outputPath,
        duration: this.duration,
        timestamp: new Date().toISOString()
      });
      
      console.log('✅ Recording validated');
    }
  }

  /**
   * Handle recording error
   * @param {Error|string} error - Error that occurred
   */
  handleRecordingError(error) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    console.error('❌ Recording error:', errorMessage);
    
    this.lastError = errorMessage;
    this.setState(RECORDING_STATES.ERROR);
    this.cleanup();
    
    this.emit(RECORDING_EVENTS.ERROR, {
      error: errorMessage,
      timestamp: new Date().toISOString(),
      platform: process.platform,
      state: this.state,
      duration: this.duration
    });
  }

  /**
   * Get current recording status
   * @returns {import('../types').RecordingStatus}
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
      duration: this.duration,
      outputPath: this.outputPath,
      actualOutputPath: this.actualOutputPath,
      recordingValidated: this.recordingValidated,
      hasActiveProcess: this.hasActiveProcess,
      error: this.lastError,
      state: this.state,
      currentScreenSource: this.currentScreenSource
    };
  }

  /**
   * Generate output file path
   * @param {import('../types').RecordingOptions} options - Recording options
   * @returns {string} Generated file path
   */
  generateOutputPath(options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options.filename || `recording-${timestamp}.webm`;
    const outputDir = options.recordingDirectory || this.tempDir;
    
    return path.join(outputDir, filename);
  }

  /**
   * Verify that recording file exists and is valid
   * @param {string} filePath - Path to verify
   * @returns {Promise<boolean>}
   */
  async verifyRecordingFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile() && stats.size > 0;
    } catch (error) {
      console.warn('⚠️ Recording file verification failed:', error.message);
      return false;
    }
  }

  /**
   * Start duration timer
   */
  startDurationTimer() {
    this.durationTimer = setInterval(() => {
      if (this.isRecording && !this.isPaused && this.startTime) {
        this.duration = Date.now() - this.startTime;
        
        // Emit progress event (throttled to every 1000ms)
        const now = Date.now();
        if (now - this.lastProgressEmit >= 1000) {
          this.emit(RECORDING_EVENTS.PROGRESS, {
            duration: this.duration,
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            timestamp: new Date().toISOString()
          });
          this.lastProgressEmit = now;
        }
      }
    }, 100);
  }

  /**
   * Stop duration timer
   */
  stopDurationTimer() {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
  }

  /**
   * Set recording state
   * @param {string} newState - New state to set
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    
    console.log(`🔄 Recording state: ${oldState} → ${newState}`);
  }

  /**
   * Clean up recording state
   */
  cleanupState() {
    this.isRecording = false;
    this.isPaused = false;
    this.recordingValidated = false;
    this.hasActiveProcess = false;
    this.startTime = null;
    this.currentOptions = null;
    this.currentScreenSource = null;
    this.setState(RECORDING_STATES.IDLE);
  }

  /**
   * Force cleanup of all resources
   */
  cleanup() {
    console.log('🧹 Cleaning up screen recorder engine');
    
    this.stopDurationTimer();
    this.cleanupState();
    this.lastError = null;
    this.outputPath = null;
    this.actualOutputPath = null;
  }

  /**
   * Destroy the engine and clean up all resources
   */
  destroy() {
    console.log('🗑️ Destroying screen recorder engine');
    
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = ScreenRecorderEngine; 