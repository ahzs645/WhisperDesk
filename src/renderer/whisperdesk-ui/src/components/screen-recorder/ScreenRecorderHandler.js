/**
 * @fileoverview Handles the actual screen recording in the renderer process
 * This includes MediaRecorder management and file saving
 */

class ScreenRecorderHandler {
  constructor() {
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.expectedOutputPath = null;
    
    // Callbacks
    this.onStarted = null;
    this.onStopped = null;
    this.onError = null;
    this.onProgress = null;
    this.onPaused = null;
    this.onResumed = null;
    
    // Debug available APIs (without calling problematic methods)
    this.debugElectronAPI();
  }

  /**
   * Debug available Electron APIs
   */
  debugElectronAPI() {
    console.log('🔍 Debugging available Electron APIs...');
    
    if (window.electronAPI) {
      console.log('✅ window.electronAPI is available');
      
      if (window.electronAPI.file) {
        console.log('✅ window.electronAPI.file is available');
        console.log('📋 Available file methods:', Object.keys(window.electronAPI.file));
        
        // Test specific methods availability (not calling them)
        if (window.electronAPI.file.saveRecordingFile) {
          console.log('✅ saveRecordingFile method is available');
        }
        if (window.electronAPI.file.getDefaultRecordingsDirectory) {
          console.log('✅ getDefaultRecordingsDirectory method is available');
        }
        if (window.electronAPI.file.showSaveDialog) {
          console.log('✅ showSaveDialog method is available');
        }
      } else {
        console.log('❌ window.electronAPI.file is NOT available');
      }
      
      // Check other APIs
      console.log('📋 Available electronAPI methods:', Object.keys(window.electronAPI));
    } else {
      console.log('❌ window.electronAPI is NOT available');
    }
  }

  /**
   * Start recording with the given options
   * @param {Object} options - Recording options
   */
  async startRecording(options) {
    try {
      if (this.isRecording) {
        throw new Error('Already recording');
      }

      // Get the media stream
      this.mediaStream = await this.getMediaStream(options);
      this.expectedOutputPath = options.outputPath;
      
      // Set up MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: mimeType,
        videoBitsPerSecond: this.getVideoBitrate(options.videoQuality),
        audioBitsPerSecond: this.getAudioBitrate(options.audioQuality)
      });

      // Reset chunks
      this.recordedChunks = [];

      // Set up event handlers
      this.setupMediaRecorderEvents();

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      this.startTime = Date.now();
      
      // Start progress tracking
      this.startProgressTracking();

      console.log('🎬 MediaRecorder started with:', {
        mimeType,
        videoBitsPerSecond: this.getVideoBitrate(options.videoQuality),
        audioBitsPerSecond: this.getAudioBitrate(options.audioQuality)
      });

      if (this.onStarted) {
        this.onStarted({
          outputPath: this.expectedOutputPath,
          mimeType: mimeType
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder) {
        return { success: true, message: 'No recording in progress' };
      }

      return new Promise((resolve, reject) => {
        // Set up one-time stop handler
        const handleStop = async () => {
          try {
            console.log('🛑 MediaRecorder stopped, processing chunks...');
            
            // Save the recording
            const actualPath = await this.saveRecording();
            
            // Clean up
            this.cleanup();
            
            if (this.onStopped) {
              this.onStopped({
                outputPath: actualPath,
                duration: Date.now() - this.startTime
              });
            }

            resolve({
              success: true,
              outputPath: actualPath,
              duration: Date.now() - this.startTime
            });
          } catch (error) {
            console.error('Failed to save recording:', error);
            this.cleanup();
            if (this.onError) {
              this.onError(error);
            }
            reject(error);
          }
        };

        // Add event listener
        this.mediaRecorder.addEventListener('stop', handleStop, { once: true });

        // Stop recording
        this.mediaRecorder.stop();
        this.isRecording = false;
      });
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.cleanup();
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Pause the current recording
   */
  pauseRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder || this.isPaused) {
        return { success: false, error: 'Cannot pause' };
      }

      this.mediaRecorder.pause();
      this.isPaused = true;

      if (this.onPaused) {
        this.onPaused();
      }

      console.log('⏸️ Recording paused');
      return { success: true };
    } catch (error) {
      console.error('Failed to pause recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume the paused recording
   */
  resumeRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder || !this.isPaused) {
        return { success: false, error: 'Cannot resume' };
      }

      this.mediaRecorder.resume();
      this.isPaused = false;

      if (this.onResumed) {
        this.onResumed();
      }

      console.log('▶️ Recording resumed');
      return { success: true };
    } catch (error) {
      console.error('Failed to resume recording:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get media stream for recording
   * @param {Object} options - Recording options
   */
  async getMediaStream(options) {
    const constraints = {
      audio: false, // We'll handle audio separately if needed
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: options.screenId,
          ...this.getVideoConstraints(options.videoQuality)
        }
      }
    };

    // Add audio if required
    if (options.includeMicrophone || options.includeSystemAudio) {
      // For now, we'll handle audio separately
      // This is a limitation of the current setup
      console.log('Audio recording requested but handled separately');
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    console.log('📹 Got media stream:', {
      video: stream.getVideoTracks().length,
      audio: stream.getAudioTracks().length
    });

    return stream;
  }

  /**
   * Set up MediaRecorder event handlers
   */
  setupMediaRecorderEvents() {
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        console.log(`📊 Chunk received: ${event.data.size} bytes, total chunks: ${this.recordedChunks.length}`);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      if (this.onError) {
        this.onError(event.error);
      }
    };

    this.mediaRecorder.onstart = () => {
      console.log('📹 MediaRecorder onstart event');
    };

    this.mediaRecorder.onpause = () => {
      console.log('⏸️ MediaRecorder onpause event');
    };

    this.mediaRecorder.onresume = () => {
      console.log('▶️ MediaRecorder onresume event');
    };
  }

  /**
   * Start progress tracking
   */
  startProgressTracking() {
    this.progressInterval = setInterval(() => {
      if (this.isRecording && this.startTime && this.onProgress) {
        const duration = Date.now() - this.startTime;
        this.onProgress({
          duration,
          isRecording: this.isRecording,
          isPaused: this.isPaused
        });
      }
    }, 1000);
  }

  /**
   * Save the recording to file
   */
  async saveRecording() {
    try {
      console.log(`💾 Saving recording with ${this.recordedChunks.length} chunks`);
      
      if (this.recordedChunks.length === 0) {
        throw new Error('No recording data available');
      }

      // Create blob from chunks
      const mimeType = this.getSupportedMimeType();
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      
      console.log(`📦 Created blob: ${blob.size} bytes, type: ${blob.type}`);

      // Convert blob to buffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Generate filename if not provided
      let outputPath = this.expectedOutputPath;
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = mimeType.includes('webm') ? '.webm' : '.mp4';
        outputPath = `recording-${timestamp}${extension}`;
      }

      // FIXED: Use saveRecordingFile instead of writeFile
      if (window.electronAPI?.file?.saveRecordingFile) {
        console.log(`💾 Calling saveRecordingFile with path: ${outputPath}, dataLength: ${uint8Array.length}`);
        const result = await window.electronAPI.file.saveRecordingFile(outputPath, uint8Array);
        
        if (result && result.success) {
          console.log(`✅ Recording saved successfully to: ${result.path}`);
          return result.actualPath || result.path;
        } else {
          throw new Error(`Save failed: ${result?.error || 'Unknown error'}`);
        }
      } else if (window.electronAPI?.file?.writeFile) {
        // Fallback to writeFile if saveRecordingFile is not available
        await window.electronAPI.file.writeFile(outputPath, uint8Array);
        console.log(`✅ Recording saved to: ${outputPath}`);
        return outputPath;
      } else {
        // Last resort: trigger download
        this.downloadBlob(blob, outputPath);
        console.log(`📥 Recording downloaded as: ${outputPath}`);
        return outputPath;
      }

    } catch (error) {
      console.error('Failed to save recording:', error);
      throw error;
    }
  }

  /**
   * Download blob as file (fallback)
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Get supported MIME type
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }

  /**
   * Get video constraints based on quality
   */
  getVideoConstraints(quality) {
    const constraints = {
      low: { minWidth: 1280, maxWidth: 1280, minHeight: 720, maxHeight: 720 },
      medium: { minWidth: 1920, maxWidth: 1920, minHeight: 1080, maxHeight: 1080 },
      high: { minWidth: 2560, maxWidth: 2560, minHeight: 1440, maxHeight: 1440 },
      ultra: { minWidth: 3840, maxWidth: 3840, minHeight: 2160, maxHeight: 2160 }
    };

    return constraints[quality] || constraints.medium;
  }

  /**
   * Get video bitrate based on quality
   */
  getVideoBitrate(quality) {
    const bitrates = {
      low: 1000000,     // 1 Mbps
      medium: 3000000,  // 3 Mbps
      high: 8000000,    // 8 Mbps
      ultra: 15000000   // 15 Mbps
    };

    return bitrates[quality] || bitrates.medium;
  }

  /**
   * Get audio bitrate based on quality
   */
  getAudioBitrate(quality) {
    const bitrates = {
      low: 64000,    // 64 kbps
      medium: 128000, // 128 kbps
      high: 256000   // 256 kbps
    };

    return bitrates[quality] || bitrates.medium;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('🧹 Cleaning up screen recorder handler');

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (error) {
        console.warn('Error stopping MediaRecorder:', error);
      }
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
      });
      this.mediaStream = null;
    }

    this.recordedChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.expectedOutputPath = null;
  }
}

export default ScreenRecorderHandler;