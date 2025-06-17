/**
 * @fileoverview Crash-safe screen recording handler - completely avoids Error 263
 * Only uses proven safe methods for macOS system audio capture
 */

class ScreenRecorderHandler {
  constructor() {
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.audioStream = null; // Microphone stream only
    this.combinedStream = null;
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
    
    console.log('🛡️ Initializing CRASH-SAFE screen recorder handler');
    this.debugSafeCapabilities();
  }

  /**
   * Debug only safe capabilities (no crash-prone calls)
   */
  debugSafeCapabilities() {
    console.log('🔍 Debugging SAFE capabilities only...');
    
    console.log('🖥️ Platform info:', {
      platform: navigator.platform,
      isMac: navigator.platform.includes('Mac'),
      electronUserAgent: navigator.userAgent.includes('Electron')
    });

    // Check safe API support
    if (navigator.mediaDevices) {
      console.log('✅ MediaDevices API supported');
      console.log('✅ getUserMedia supported:', !!navigator.mediaDevices.getUserMedia);
      console.log('✅ getDisplayMedia supported:', !!navigator.mediaDevices.getDisplayMedia);
    }

    // Check safe MediaRecorder codecs
    const safeCodecs = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus', 
      'video/webm'
    ];
    
    console.log('🎵 Safe codec support:');
    safeCodecs.forEach(codec => {
      console.log(`  ${MediaRecorder.isTypeSupported(codec) ? '✅' : '❌'} ${codec}`);
    });
  }

  /**
   * Start recording with crash-safe approach
   */
  async startRecording(options) {
    try {
      if (this.isRecording) {
        throw new Error('Already recording');
      }

      console.log('🛡️ Starting CRASH-SAFE recording:', options);

      // Use only safe stream capture methods
      await this.setupSafeMediaStreams(options);
      this.expectedOutputPath = options.outputPath;
      
      // Set up MediaRecorder with safe settings
      const mimeType = this.getSafeMimeType();
      this.mediaRecorder = new MediaRecorder(this.combinedStream, {
        mimeType: mimeType,
        videoBitsPerSecond: this.getVideoBitrate(options.videoQuality),
        audioBitsPerSecond: this.getAudioBitrate(options.audioQuality)
      });

      this.recordedChunks = [];
      this.setupMediaRecorderEvents();

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.startTime = Date.now();
      this.startProgressTracking();

      const audioTracks = this.combinedStream.getAudioTracks().length;
      const hasSystemAudio = audioTracks > (this.audioStream?.getAudioTracks().length || 0);

      console.log('🛡️ Safe recording started:', {
        mimeType,
        videoTracks: this.combinedStream.getVideoTracks().length,
        audioTracks,
        hasSystemAudio,
        hasMicrophone: this.audioStream?.getAudioTracks().length > 0
      });

      if (this.onStarted) {
        this.onStarted({
          outputPath: this.expectedOutputPath,
          mimeType,
          hasSystemAudio,
          hasMicrophone: this.audioStream?.getAudioTracks().length > 0
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Safe recording start failed:', error);
      this.cleanup();
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Set up media streams using only safe methods
   */
  async setupSafeMediaStreams(options) {
    console.log('🛡️ Setting up SAFE media streams:', {
      screenId: options.screenId,
      includeMicrophone: options.includeMicrophone,
      includeSystemAudio: options.includeSystemAudio
    });

    // Step 1: Get screen stream (with or without system audio)
    if (options.includeSystemAudio) {
      console.log('🔊 Attempting SAFE system audio capture...');
      this.mediaStream = await this.getSafeScreenWithAudioStream(options);
    } else {
      console.log('📹 Getting video-only stream...');
      this.mediaStream = await this.getSafeVideoStream(options);
    }

    // Step 2: Get microphone if requested
    if (options.includeMicrophone && options.audioInputId) {
      console.log('🎤 Getting safe microphone stream...');
      this.audioStream = await this.getSafeMicrophoneStream(options.audioInputId);
    }

    // Step 3: Combine streams
    this.combinedStream = this.combineStreams();

    const result = {
      video: this.mediaStream.getVideoTracks().length,
      screenAudio: this.mediaStream.getAudioTracks().length,
      microphoneAudio: this.audioStream?.getAudioTracks().length || 0,
      totalAudio: this.combinedStream.getAudioTracks().length,
      total: this.combinedStream.getTracks().length
    };

    console.log('✅ Safe media streams setup complete:', result);

    // Warn about missing audio
    if (options.includeSystemAudio && result.screenAudio === 0) {
      console.warn('⚠️ System audio requested but not captured - this is common on macOS');
    }
  }

  /**
   * Get screen stream with audio using only the safest method
   */
  async getSafeScreenWithAudioStream(options) {
    console.log('🔊 Trying SAFE getDisplayMedia with video+audio...');
    
    try {
      // This is the ONLY safe way to get system audio on macOS
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          ...this.getVideoConstraints(options.videoQuality),
          cursor: 'always'
        },
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 48000,
          channelCount: 2
        }
      });

      console.log('✅ Safe getDisplayMedia result:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        audioSettings: stream.getAudioTracks()[0]?.getSettings()
      });

      if (stream.getAudioTracks().length > 0) {
        console.log('🎉 System audio captured safely!');
      } else {
        console.log('📹 Video captured, no system audio available');
      }

      return stream;

    } catch (error) {
      console.log('❌ Safe getDisplayMedia failed:', error.message);
      
      // Provide helpful error messages
      if (error.name === 'NotAllowedError') {
        console.log('💡 Permission denied - user cancelled or no permission');
      } else if (error.name === 'NotSupportedError' || error.message.includes('Not supported')) {
        console.log('💡 System audio not supported in this environment');
      } else if (error.message.includes('video must be requested')) {
        console.log('💡 Audio-only capture not allowed, need video+audio');
      }
      
      // Fallback to video-only
      console.log('↩️ Falling back to video-only capture...');
      return await this.getSafeVideoStream(options);
    }
  }

  /**
   * Get safe video-only stream (guaranteed to work)
   */
  async getSafeVideoStream(options) {
    console.log('📹 Getting safe video-only stream...');
    
    const constraints = {
      audio: false, // Never request audio here to avoid crashes
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: options.screenId,
          ...this.getVideoConstraints(options.videoQuality)
        }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    console.log('✅ Safe video stream:', {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    return stream;
  }

  /**
   * Get safe microphone stream
   */
  async getSafeMicrophoneStream(audioDeviceId) {
    try {
      const constraints = {
        video: false,
        audio: {
          deviceId: audioDeviceId === 'default' ? undefined : { exact: audioDeviceId },
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 2
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Safe microphone stream:', {
        audioTracks: stream.getAudioTracks().length,
        settings: stream.getAudioTracks()[0]?.getSettings()
      });

      return stream;
    } catch (error) {
      console.error('❌ Microphone capture failed:', error);
      return null;
    }
  }

  /**
   * Combine streams safely
   */
  combineStreams() {
    const combinedStream = new MediaStream();
    
    // Add video tracks
    if (this.mediaStream) {
      this.mediaStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log('➕ Added video track:', track.label);
      });
      
      // Add system audio tracks from display stream
      this.mediaStream.getAudioTracks().forEach(track => {
        Object.defineProperty(track, 'label', { 
          value: `System Audio: ${track.label}`, 
          writable: false 
        });
        combinedStream.addTrack(track);
        console.log('➕ Added system audio track:', track.label);
      });
    }
    
    // Add microphone tracks
    if (this.audioStream) {
      this.audioStream.getAudioTracks().forEach(track => {
        Object.defineProperty(track, 'label', { 
          value: `Microphone: ${track.label}`, 
          writable: false 
        });
        combinedStream.addTrack(track);
        console.log('➕ Added microphone track:', track.label);
      });
    }
    
    console.log('🔗 Safe combined stream:', {
      videoTracks: combinedStream.getVideoTracks().length,
      audioTracks: combinedStream.getAudioTracks().length,
      totalTracks: combinedStream.getTracks().length
    });
    
    return combinedStream;
  }

  /**
   * Safe system audio testing (no crash-prone methods)
   */
  async testSafeSystemAudio() {
    console.log('🧪 Testing SAFE system audio methods only...');
    
    const safeMethods = [
      {
        name: 'getDisplayMedia with video+audio (SAFE)',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
        }
      },
      {
        name: 'getDisplayMedia with detailed constraints (SAFE)',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 48000
            }
          });
        }
      }
    ];

    const results = [];
    
    for (const method of safeMethods) {
      try {
        console.log(`🧪 Testing: ${method.name}`);
        const stream = await method.test();
        
        const result = {
          name: method.name,
          success: true,
          audioTracks: stream.getAudioTracks().length,
          videoTracks: stream.getVideoTracks().length
        };
        
        console.log(`✅ ${method.name} SUCCESS:`, result);
        
        // Test MediaRecorder compatibility
        if (stream.getAudioTracks().length > 0) {
          try {
            new MediaRecorder(stream);
            console.log(`✅ ${method.name} is MediaRecorder compatible`);
          } catch (recorderError) {
            console.log(`❌ ${method.name} NOT MediaRecorder compatible`);
          }
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        results.push(result);
        
      } catch (error) {
        console.log(`❌ ${method.name} FAILED:`, error.message);
        results.push({
          name: method.name,
          success: false,
          error: error.message
        });
      }
    }

    const working = results.filter(r => r.success && r.audioTracks > 0);
    console.log(`🎉 Safe test complete: ${working.length}/${results.length} methods can capture system audio`);
    
    return results;
  }

  // Standard methods (stop, pause, resume, etc.)
  async stopRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder) {
        return { success: true, message: 'No recording in progress' };
      }

      return new Promise((resolve, reject) => {
        const handleStop = async () => {
          try {
            console.log('🛑 Safe recording stop...');
            const actualPath = await this.saveRecording();
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

        this.mediaRecorder.addEventListener('stop', handleStop, { once: true });
        this.mediaRecorder.stop();
        this.isRecording = false;
      });
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.cleanup();
      throw error;
    }
  }

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

  setupMediaRecorderEvents() {
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        console.log(`📊 Chunk: ${event.data.size} bytes, total: ${this.recordedChunks.length}`);
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error);
      if (this.onError) {
        this.onError(event.error);
      }
    };

    this.mediaRecorder.onstart = () => {
      console.log('📹 MediaRecorder started');
    };

    this.mediaRecorder.onpause = () => {
      console.log('⏸️ MediaRecorder paused');
    };

    this.mediaRecorder.onresume = () => {
      console.log('▶️ MediaRecorder resumed');
    };
  }

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

  stopDurationTimer() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  async saveRecording() {
    try {
      console.log(`💾 Saving ${this.recordedChunks.length} chunks...`);
      
      if (this.recordedChunks.length === 0) {
        throw new Error('No recording data available');
      }

      const mimeType = this.getSafeMimeType();
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      
      console.log(`📦 Created blob: ${blob.size} bytes, type: ${blob.type}`);

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      let outputPath = this.expectedOutputPath;
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        outputPath = `recording-${timestamp}.webm`;
      }

      if (window.electronAPI?.file?.saveRecordingFile) {
        const result = await window.electronAPI.file.saveRecordingFile(outputPath, uint8Array);
        
        if (result && result.success) {
          console.log(`✅ Recording saved: ${result.path}`);
          return result.actualPath || result.path;
        } else {
          throw new Error(`Save failed: ${result?.error || 'Unknown error'}`);
        }
      } else {
        // Fallback to download
        this.downloadBlob(blob, outputPath);
        return outputPath;
      }
    } catch (error) {
      console.error('Failed to save recording:', error);
      throw error;
    }
  }

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

  getSafeMimeType() {
    const safeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];

    for (const type of safeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log('✅ Using safe MIME type:', type);
        return type;
      }
    }

    console.log('⚠️ Using fallback MIME type: video/webm');
    return 'video/webm';
  }

  getVideoConstraints(quality) {
    const constraints = {
      low: { minWidth: 1280, maxWidth: 1280, minHeight: 720, maxHeight: 720 },
      medium: { minWidth: 1920, maxWidth: 1920, minHeight: 1080, maxHeight: 1080 },
      high: { minWidth: 2560, maxWidth: 2560, minHeight: 1440, maxHeight: 1440 }
    };

    return constraints[quality] || constraints.medium;
  }

  getVideoBitrate(quality) {
    const bitrates = {
      low: 1000000,
      medium: 3000000,
      high: 8000000
    };

    return bitrates[quality] || bitrates.medium;
  }

  getAudioBitrate(quality) {
    const bitrates = {
      low: 64000,
      medium: 128000,
      high: 256000
    };

    return bitrates[quality] || bitrates.medium;
  }

  cleanup() {
    console.log('🧹 Safe cleanup...');

    this.stopDurationTimer();

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

    [this.combinedStream, this.mediaStream, this.audioStream].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });

    this.combinedStream = null;
    this.mediaStream = null;
    this.audioStream = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.expectedOutputPath = null;
  }
}

export default ScreenRecorderHandler;