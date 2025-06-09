// src/main/services/screen-recorder.js - Node.js Service for Screen Recording
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
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
  }

  async initialize() {
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      console.log('✅ Screen recorder service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize screen recorder:', error);
      throw error;
    }
  }

  async startRecording(options = {}) {
    if (this.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    try {
      const {
        screenId = '1',
        audioInputId = '0',
        includeMicrophone = true,
        includeSystemAudio = false,
        videoQuality = 'medium',
        audioQuality = 'medium',
        recordingDirectory
      } = options;

      // Generate output filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputDir = recordingDirectory || this.tempDir;
      this.outputPath = path.join(outputDir, `recording-${timestamp}.mp4`);

      // Build FFmpeg command
      const ffmpegArgs = this.buildFFmpegArgs(options);
      
      console.log('🎬 Starting recording with FFmpeg:', ffmpegArgs.join(' '));

      // Start FFmpeg process
      this.recordingProcess = spawn('ffmpeg', ffmpegArgs);
      this.hasActiveProcess = true;
      this.isRecording = true;
      this.recordingValidated = false;
      this.startTime = Date.now();
      this.duration = 0;
      this.lastError = null;

      // Start duration timer
      this.startDurationTimer();

      // Set up process handlers
      this.setupProcessHandlers();

      // Emit started event
      this.emit('started', {
        outputPath: this.outputPath,
        options
      });

      // Validate recording after a delay
      setTimeout(() => this.validateRecording(), 3000);

      return { success: true, outputPath: this.outputPath };

    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.cleanup();
      this.lastError = error.message;
      return { success: false, error: error.message };
    }
  }

  buildFFmpegArgs(options) {
    const {
      screenId = '1',
      audioInputId = '0',
      includeMicrophone = true,
      includeSystemAudio = false,
      videoQuality = 'medium'
    } = options;

    const args = ['-y']; // Overwrite output file

    if (process.platform === 'darwin') {
      // macOS using avfoundation
      if (includeMicrophone) {
        args.push('-f', 'avfoundation', '-i', `${screenId}:${audioInputId}`);
      } else {
        args.push('-f', 'avfoundation', '-i', `${screenId}:`);
      }
    } else if (process.platform === 'win32') {
      // Windows using gdigrab and dshow
      args.push('-f', 'gdigrab', '-i', 'desktop');
      if (includeMicrophone) {
        args.push('-f', 'dshow', '-i', `audio="Default Audio Device"`);
      }
    } else {
      // Linux using x11grab and alsa
      args.push('-f', 'x11grab', '-i', ':0.0');
      if (includeMicrophone) {
        args.push('-f', 'alsa', '-i', 'default');
      }
    }

    // Video encoding settings
    args.push('-c:v', 'libx264');
    args.push('-preset', 'fast');
    args.push('-crf', '23');

    // Audio encoding settings
    if (includeMicrophone) {
      args.push('-c:a', 'aac');
      args.push('-b:a', '128k');
    }

    // Frame rate
    args.push('-r', '30');

    // Output file
    args.push(this.outputPath);

    return args;
  }

  setupProcessHandlers() {
    if (!this.recordingProcess) return;

    this.recordingProcess.stdout.on('data', (data) => {
      console.log('📹 FFmpeg stdout:', data.toString());
    });

    this.recordingProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('📹 FFmpeg stderr:', output);
      
      // Parse for errors
      if (output.includes('Error') || output.includes('failed')) {
        console.error('❌ FFmpeg error detected:', output);
      }
    });

    this.recordingProcess.on('close', (code) => {
      console.log(`📹 FFmpeg process closed with code: ${code}`);
      this.hasActiveProcess = false;
      
      if (this.isRecording) {
        if (code === 0) {
          this.emit('completed', {
            outputPath: this.outputPath,
            duration: this.duration,
            audioPath: this.outputPath // For transcription
          });
        } else {
          this.lastError = `FFmpeg process exited with code ${code}`;
          this.emit('error', {
            error: this.lastError,
            code
          });
        }
        this.cleanup();
      }
    });

    this.recordingProcess.on('error', (error) => {
      console.error('❌ FFmpeg process error:', error);
      this.lastError = error.message;
      this.emit('error', {
        error: error.message
      });
      this.cleanup();
    });
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

  async validateRecording() {
    try {
      if (this.outputPath && await this.fileExists(this.outputPath)) {
        const stats = await fs.stat(this.outputPath);
        if (stats.size > 1024) { // File is growing
          this.recordingValidated = true;
          this.emit('validated');
          console.log('✅ Recording validated');
        }
      }
    } catch (error) {
      console.warn('⚠️ Recording validation failed:', error);
    }
  }

  async fileExists(filepath) {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress', wasAlreadyStopped: true };
    }

    try {
      console.log('⏹️ Stopping recording...');
      
      if (this.recordingProcess) {
        // Send SIGTERM for graceful shutdown
        this.recordingProcess.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (this.recordingProcess && !this.recordingProcess.killed) {
            this.recordingProcess.kill('SIGKILL');
          }
        }, 5000);
      }

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
      return { success: true };
    } catch (error) {
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
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAvailableScreens() {
    // Return mock data - in a real implementation, you'd detect actual screens
    return [
      { id: '1', name: 'Display 1 (Primary)' },
      { id: '2', name: 'Display 2' }
    ];
  }

  async getRecordings() {
    try {
      const files = await fs.readdir(this.tempDir);
      const recordings = files
        .filter(file => file.endsWith('.mp4'))
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
        screens: ['1', '2'],
        audio: ['0', '1'],
        deviceNames: {
          screens: {
            '1': 'Display 1 (Primary)',
            '2': 'Display 2'
          },
          audio: {
            '0': 'Default Audio Input',
            '1': 'Secondary Audio Input'
          }
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
    
    if (this.recordingProcess && !this.recordingProcess.killed) {
      try {
        this.recordingProcess.kill('SIGKILL');
      } catch (error) {
        console.warn('Failed to kill recording process:', error);
      }
    }
    this.recordingProcess = null;
  }
}

module.exports = ScreenRecorder;