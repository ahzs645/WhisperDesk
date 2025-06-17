/**
 * @fileoverview Enhanced screen recording handler with comprehensive macOS system audio support
 * Includes multiple fallback methods and detailed debugging
 */

class ScreenRecorderHandler {
  constructor() {
    this.mediaRecorder = null;
    this.mediaStream = null;
    this.audioStream = null; // Microphone stream
    this.systemAudioStream = null; // System audio stream
    this.combinedStream = null; // Combined stream
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
    
    // Debug system capabilities
    this.debugSystemCapabilities();
  }

  /**
   * Debug system capabilities for audio capture
   */
  async debugSystemCapabilities() {
    console.log('🔍 Debugging system audio capabilities...');
    
    // Check browser/platform info
    console.log('🖥️ Platform info:', {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language
    });

    // Check MediaDevices API support
    if (navigator.mediaDevices) {
      console.log('✅ MediaDevices API is supported');
      
      if (navigator.mediaDevices.getDisplayMedia) {
        console.log('✅ getDisplayMedia is supported');
      } else {
        console.log('❌ getDisplayMedia is NOT supported');
      }
      
      if (navigator.mediaDevices.getUserMedia) {
        console.log('✅ getUserMedia is supported');
      } else {
        console.log('❌ getUserMedia is NOT supported');
      }
    } else {
      console.log('❌ MediaDevices API is NOT supported');
    }

    // Check MediaRecorder support for audio codecs
    const audioCodecs = [
      'audio/webm;codecs=opus',
      'audio/webm;codecs=vorbis',
      'audio/mp4;codecs=aac',
      'audio/ogg;codecs=opus'
    ];

    console.log('🎵 Audio codec support:');
    audioCodecs.forEach(codec => {
      const supported = MediaRecorder.isTypeSupported(codec);
      console.log(`  ${supported ? '✅' : '❌'} ${codec}`);
    });
  }

  /**
   * Start recording with enhanced audio capture
   */
  async startRecording(options) {
    try {
      if (this.isRecording) {
        throw new Error('Already recording');
      }

      console.log('🎬 Starting ENHANCED recording with options:', options);

      // Enhanced media stream setup
      await this.setupEnhancedMediaStreams(options);
      this.expectedOutputPath = options.outputPath;
      
      // Set up MediaRecorder
      const mimeType = this.getSupportedMimeType();
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

      console.log('🎬 Enhanced MediaRecorder started:', {
        mimeType,
        videoTracks: this.combinedStream.getVideoTracks().length,
        audioTracks: this.combinedStream.getAudioTracks().length,
        audioBitsPerSecond: this.getAudioBitrate(options.audioQuality)
      });

      if (this.onStarted) {
        this.onStarted({
          outputPath: this.expectedOutputPath,
          mimeType: mimeType,
          hasSystemAudio: this.systemAudioStream?.getAudioTracks().length > 0,
          hasMicrophoneAudio: this.audioStream?.getAudioTracks().length > 0
        });
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to start enhanced recording:', error);
      this.cleanup();
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Enhanced media stream setup with comprehensive fallbacks
   */
  async setupEnhancedMediaStreams(options) {
    console.log('🔧 Setting up ENHANCED media streams:', {
      screenId: options.screenId,
      includeMicrophone: options.includeMicrophone,
      includeSystemAudio: options.includeSystemAudio,
      audioInputId: options.audioInputId
    });

    // Step 1: Get video stream
    this.mediaStream = await this.getVideoStream(options);

    // Step 2: Get system audio if requested
    if (options.includeSystemAudio) {
      console.log('🔊 Attempting comprehensive system audio capture...');
      this.systemAudioStream = await this.getSystemAudioStreamEnhanced(options);
      
      if (!this.systemAudioStream || this.systemAudioStream.getAudioTracks().length === 0) {
        console.log('⚠️ System audio capture failed - trying integrated approach...');
        // Try to get video + audio together
        this.mediaStream = await this.getVideoWithSystemAudioStream(options);
      }
    }

    // Step 3: Get microphone audio if requested
    if (options.includeMicrophone && options.audioInputId) {
      console.log('🎤 Getting microphone stream...');
      this.audioStream = await this.getMicrophoneStream(options.audioInputId);
    }

    // Step 4: Combine all streams
    this.combinedStream = this.combineStreams();

    const result = {
      video: this.mediaStream.getVideoTracks().length,
      systemAudio: this.systemAudioStream?.getAudioTracks().length || 0,
      microphoneAudio: this.audioStream?.getAudioTracks().length || 0,
      totalAudio: this.combinedStream.getAudioTracks().length,
      total: this.combinedStream.getTracks().length
    };

    console.log('✅ Enhanced media streams setup complete:', result);

    // Warning if no audio captured when requested
    if (options.includeSystemAudio && result.systemAudio === 0) {
      console.warn('⚠️ System audio was requested but could not be captured!');
    }
    if (options.includeMicrophone && result.microphoneAudio === 0) {
      console.warn('⚠️ Microphone audio was requested but could not be captured!');
    }
  }

  /**
   * Get video stream only
   */
  async getVideoStream(options) {
    console.log('📹 Getting video stream for screen:', options.screenId);
    
    const constraints = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: options.screenId,
          ...this.getVideoConstraints(options.videoQuality)
        }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('📹 Video stream obtained:', {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });

    return stream;
  }

  /**
   * Enhanced system audio capture with multiple methods
   */
  async getSystemAudioStreamEnhanced(options) {
    const methods = [
      {
        name: 'getDisplayMedia with audio only',
        attempt: async () => {
          console.log('🔊 Trying getDisplayMedia audio-only...');
          return await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 48000,
              channelCount: 2
            }
          });
        }
      },
      {
        name: 'getDisplayMedia with video+audio then extract audio',
        attempt: async () => {
          console.log('🔊 Trying getDisplayMedia video+audio...');
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 48000,
              channelCount: 2
            }
          });
          
          // Extract only audio tracks
          if (stream.getAudioTracks().length > 0) {
            const audioOnlyStream = new MediaStream();
            stream.getAudioTracks().forEach(track => {
              audioOnlyStream.addTrack(track);
            });
            
            // Stop video tracks
            stream.getVideoTracks().forEach(track => track.stop());
            
            return audioOnlyStream;
          }
          
          throw new Error('No audio tracks in combined stream');
        }
      },
      {
        name: 'getUserMedia with screen audio (macOS specific)',
        attempt: async () => {
          console.log('🔊 Trying getUserMedia screen audio...');
          // Note: This might be risky, but worth trying as last resort
          const constraints = {
            video: false,
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: options.screenId,
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false
              }
            }
          };
          return await navigator.mediaDevices.getUserMedia(constraints);
        }
      }
    ];

    for (const method of methods) {
      try {
        console.log(`🧪 Attempting: ${method.name}`);
        const stream = await method.attempt();
        
        if (stream && stream.getAudioTracks().length > 0) {
          console.log(`✅ SUCCESS: ${method.name}`, {
            audioTracks: stream.getAudioTracks().length,
            audioSettings: stream.getAudioTracks()[0]?.getSettings(),
            audioLabel: stream.getAudioTracks()[0]?.label
          });
          return stream;
        } else {
          console.log(`⚠️ ${method.name} returned stream with no audio tracks`);
        }
      } catch (error) {
        console.log(`❌ ${method.name} failed:`, error.message);
        
        // Provide specific guidance for different errors
        if (error.name === 'NotSupportedError') {
          console.log(`💡 ${method.name}: Not supported on this platform/browser`);
        } else if (error.name === 'NotAllowedError') {
          console.log(`💡 ${method.name}: Permission denied - check system preferences`);
        } else if (error.name === 'NotFoundError') {
          console.log(`💡 ${method.name}: No audio source found`);
        }
      }
    }

    console.log('❌ All system audio capture methods failed');
    return null;
  }

  /**
   * Try to get video + system audio in one stream (integrated approach)
   */
  async getVideoWithSystemAudioStream(options) {
    console.log('🔧 Trying integrated video+audio capture...');
    
    try {
      // Try getUserMedia with both video and audio for the screen
      const constraints = {
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: options.screenId,
            ...this.getVideoConstraints(options.videoQuality)
          }
        },
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: options.screenId,
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false
          }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Integrated capture successful:', {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        audioSettings: stream.getAudioTracks()[0]?.getSettings()
      });
      
      return stream;
      
    } catch (error) {
      console.log('❌ Integrated capture failed:', error.message);
      
      // If integrated approach fails, return the video-only stream we already have
      console.log('↩️ Falling back to video-only stream');
      return this.mediaStream;
    }
  }

  /**
   * Get microphone stream
   */
  async getMicrophoneStream(audioDeviceId) {
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
      
      console.log('🎤 Microphone stream obtained:', {
        audioTracks: stream.getAudioTracks().length,
        settings: stream.getAudioTracks()[0]?.getSettings(),
        label: stream.getAudioTracks()[0]?.label
      });

      return stream;
    } catch (error) {
      console.error('❌ Microphone capture failed:', error);
      return null;
    }
  }

  /**
   * Combine all streams intelligently
   */
  combineStreams() {
    const combinedStream = new MediaStream();
    
    // Add video tracks
    if (this.mediaStream) {
      this.mediaStream.getVideoTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log('➕ Added video track:', track.label);
      });
      
      // Add system audio from main stream if present
      this.mediaStream.getAudioTracks().forEach(track => {
        Object.defineProperty(track, 'label', { 
          value: `System Audio (Integrated): ${track.label}`, 
          writable: false 
        });
        combinedStream.addTrack(track);
        console.log('➕ Added integrated system audio:', track.label);
      });
    }
    
    // Add separate system audio stream if we have one
    if (this.systemAudioStream) {
      this.systemAudioStream.getAudioTracks().forEach(track => {
        Object.defineProperty(track, 'label', { 
          value: `System Audio (Separate): ${track.label}`, 
          writable: false 
        });
        combinedStream.addTrack(track);
        console.log('➕ Added separate system audio:', track.label);
      });
    }
    
    // Add microphone audio
    if (this.audioStream) {
      this.audioStream.getAudioTracks().forEach(track => {
        Object.defineProperty(track, 'label', { 
          value: `Microphone: ${track.label}`, 
          writable: false 
        });
        combinedStream.addTrack(track);
        console.log('➕ Added microphone audio:', track.label);
      });
    }
    
    const result = {
      videoTracks: combinedStream.getVideoTracks().length,
      audioTracks: combinedStream.getAudioTracks().length,
      totalTracks: combinedStream.getTracks().length,
      audioTrackLabels: combinedStream.getAudioTracks().map(t => t.label)
    };
    
    console.log('🔗 Final combined stream:', result);
    return combinedStream;
  }

  /**
   * Comprehensive system audio testing function
   */
  async testSystemAudioCapture() {
    console.log('🧪 COMPREHENSIVE System Audio Testing...');
    
    const testMethods = [
      {
        name: 'getDisplayMedia audio-only',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: true
          });
        }
      },
      {
        name: 'getDisplayMedia video+audio',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
        }
      },
      {
        name: 'getDisplayMedia with detailed audio constraints',
        test: async () => {
          return await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              sampleRate: 48000,
              channelCount: 2
            }
          });
        }
      },
      {
        name: 'getUserMedia desktop audio (RISKY)',
        test: async () => {
          return await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                autoGainControl: false,
                echoCancellation: false,
                noiseSuppression: false
              }
            }
          });
        }
      }
    ];

    const results = [];
    
    for (const method of testMethods) {
      const result = {
        name: method.name,
        success: false,
        audioTracks: 0,
        error: null,
        details: null
      };
      
      try {
        console.log(`🧪 Testing: ${method.name}`);
        const stream = await method.test();
        
        result.success = true;
        result.audioTracks = stream.getAudioTracks().length;
        result.details = {
          videoTracks: stream.getVideoTracks().length,
          audioSettings: stream.getAudioTracks()[0]?.getSettings(),
          audioLabel: stream.getAudioTracks()[0]?.label
        };
        
        console.log(`✅ ${method.name} SUCCESS:`, result.details);
        
        // Test MediaRecorder compatibility
        if (stream.getAudioTracks().length > 0) {
          try {
            const testRecorder = new MediaRecorder(stream);
            console.log(`✅ ${method.name} is MediaRecorder compatible`);
            result.mediaRecorderCompatible = true;
          } catch (recorderError) {
            console.log(`❌ ${method.name} NOT MediaRecorder compatible:`, recorderError.message);
            result.mediaRecorderCompatible = false;
          }
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        
      } catch (error) {
        result.error = error.message;
        console.log(`❌ ${method.name} FAILED:`, error.message);
      }
      
      results.push(result);
    }

    // Summary
    const workingMethods = results.filter(r => r.success && r.audioTracks > 0);
    console.log('\n🎉 SYSTEM AUDIO TEST SUMMARY:');
    console.log(`Working methods: ${workingMethods.length}/${results.length}`);
    
    if (workingMethods.length > 0) {
      console.log('✅ Working methods:');
      workingMethods.forEach(method => {
        console.log(`  • ${method.name} (${method.audioTracks} audio tracks)`);
      });
    } else {
      console.log('❌ No working methods found');
      console.log('💡 Suggestions:');
      console.log('  • Check System Preferences > Security & Privacy > Screen Recording');
      console.log('  • Ensure apps are playing audio during capture');
      console.log('  • Try different browsers (Chrome vs Safari vs Firefox)');
      console.log('  • Check if SoundFlower or similar audio routing software is needed');
    }

    return results;
  }

  // ... (rest of the methods remain the same: stopRecording, pauseRecording, etc.)
  
  async stopRecording() {
    try {
      if (!this.isRecording || !this.mediaRecorder) {
        return { success: true, message: 'No recording in progress' };
      }

      return new Promise((resolve, reject) => {
        const handleStop = async () => {
          try {
            console.log('🛑 MediaRecorder stopped, processing chunks...');
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
      if (this.onError) {
        this.onError(error);
      }
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
      console.log(`💾 Saving recording with ${this.recordedChunks.length} chunks`);
      
      if (this.recordedChunks.length === 0) {
        throw new Error('No recording data available');
      }

      const mimeType = this.getSupportedMimeType();
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      
      console.log(`📦 Created blob: ${blob.size} bytes, type: ${blob.type}`);

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      let outputPath = this.expectedOutputPath;
      if (!outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = mimeType.includes('webm') ? '.webm' : '.mp4';
        outputPath = `recording-${timestamp}${extension}`;
      }

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
        await window.electronAPI.file.writeFile(outputPath, uint8Array);
        console.log(`✅ Recording saved to: ${outputPath}`);
        return outputPath;
      } else {
        this.downloadBlob(blob, outputPath);
        console.log(`📥 Recording downloaded as: ${outputPath}`);
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
        console.log('✅ Using MIME type:', type);
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
      high: { minWidth: 2560, maxWidth: 2560, minHeight: 1440, maxHeight: 1440 },
      ultra: { minWidth: 3840, maxWidth: 3840, minHeight: 2160, maxHeight: 2160 }
    };

    return constraints[quality] || constraints.medium;
  }

  getVideoBitrate(quality) {
    const bitrates = {
      low: 1000000,
      medium: 3000000,
      high: 8000000,
      ultra: 15000000
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
    console.log('🧹 Cleaning up enhanced screen recorder handler');

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

    [this.combinedStream, this.mediaStream, this.audioStream, this.systemAudioStream].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });

    this.combinedStream = null;
    this.mediaStream = null;
    this.audioStream = null;
    this.systemAudioStream = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.isPaused = false;
    this.startTime = null;
    this.expectedOutputPath = null;
  }
}

export default ScreenRecorderHandler;