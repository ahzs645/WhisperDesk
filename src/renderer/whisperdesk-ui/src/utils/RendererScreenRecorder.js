// src/renderer/whisperdesk-ui/src/utils/RendererScreenRecorder.js
// Real screen recording implementation using Web APIs

export class RendererScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stream = null;
    this.isRecording = false;
    this.startTime = null;
    this.outputPath = null;
    this.availableAudioDevices = [];
    this.availableScreens = [];
  }

  async initialize() {
    try {
      console.log('🔧 Initializing renderer screen recorder...');
      
      // Check if APIs are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen capture not supported in this browser');
      }

      // Enumerate audio devices
      await this.enumerateAudioDevices();
      
      // Update main process with audio devices
      if (window.electronAPI?.screenRecorder?.updateAudioDevices) {
        await window.electronAPI.screenRecorder.updateAudioDevices(this.availableAudioDevices);
      }

      console.log('✅ Renderer screen recorder initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize renderer screen recorder:', error);
      throw error;
    }
  }

  async enumerateAudioDevices() {
    try {
      console.log('🎤 Enumerating audio devices...');
      
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
          // Stop the stream immediately, we just needed permission
          stream.getTracks().forEach(track => track.stop());
        })
        .catch(error => {
          console.warn('⚠️ Audio permission denied:', error);
        });

      // Now enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.availableAudioDevices = [
        // Add default device
        { 
          id: 'default', 
          name: 'Default Audio Input', 
          type: 'audioinput',
          groupId: 'default' 
        },
        
        // Add system audio option
        { 
          id: 'system', 
          name: 'System Audio (if supported)', 
          type: 'audiooutput',
          groupId: 'system' 
        },
        
        // Add real audio input devices
        ...devices
          .filter(device => device.kind === 'audioinput' && device.deviceId !== 'default')
          .map(device => ({
            id: device.deviceId,
            name: device.label || `Audio Input ${device.deviceId.slice(0, 8)}`,
            type: 'audioinput',
            groupId: device.groupId
          }))
      ];

      console.log(`✅ Found ${this.availableAudioDevices.length} audio devices`);
      console.log('🎤 Audio devices:', this.availableAudioDevices);

    } catch (error) {
      console.error('❌ Failed to enumerate audio devices:', error);
      
      // Fallback devices
      this.availableAudioDevices = [
        { id: 'default', name: 'Default Audio Input', type: 'audioinput' },
        { id: 'system', name: 'System Audio', type: 'audiooutput' }
      ];
    }
  }

  async startRecording(options = {}) {
    try {
      console.log('🎬 Starting screen recording in renderer...', options);

      if (this.isRecording) {
        throw new Error('Already recording');
      }

      const {
        screenId,
        audioInputId,
        includeMicrophone = true,
        includeSystemAudio = false,
        videoQuality = 'medium',
        audioQuality = 'medium'
      } = options;

      // Request screen recording permission and get stream
      const constraints = this.buildMediaConstraints({
        includeMicrophone,
        includeSystemAudio,
        audioInputId,
        videoQuality
      });

      console.log('📱 Requesting display media with constraints:', constraints);

      // Get display media
      this.stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Add microphone audio if requested
      if (includeMicrophone && audioInputId && audioInputId !== 'none') {
        await this.addMicrophoneAudio(audioInputId);
      }

      // Set up MediaRecorder
      this.setupMediaRecorder();

      // Start recording
      this.mediaRecorder.start(1000); // Capture in 1-second chunks
      this.isRecording = true;
      this.startTime = Date.now();
      this.recordedChunks = [];

      console.log('✅ Screen recording started successfully');

      // Notify main process that recording is validated
      if (window.electronAPI?.screenRecorder?.validateRecording) {
        await window.electronAPI.screenRecorder.validateRecording();
      }

      // Set up stream end detection
      this.stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('📱 Screen sharing ended by user');
        this.stopRecording();
      });

      return { success: true, stream: this.stream };

    } catch (error) {
      console.error('❌ Failed to start recording in renderer:', error);
      
      // Notify main process of error
      if (window.electronAPI?.screenRecorder?.handleError) {
        await window.electronAPI.screenRecorder.handleError({
          error: error.message,
          type: 'renderer_error',
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  }

  buildMediaConstraints({ includeMicrophone, includeSystemAudio, audioInputId, videoQuality }) {
    const constraints = {
      video: this.getVideoConstraints(videoQuality),
      audio: false // We'll handle audio separately
    };

    // Handle audio constraints
    if (includeMicrophone || includeSystemAudio) {
      if (includeSystemAudio) {
        // Request system audio
        constraints.audio = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false
        };
      } else {
        // Just request basic audio (will be replaced with microphone)
        constraints.audio = true;
      }
    }

    return constraints;
  }

  getVideoConstraints(quality) {
    const qualitySettings = {
      low: { width: 1280, height: 720, frameRate: 15 },
      medium: { width: 1920, height: 1080, frameRate: 30 },
      high: { width: 2560, height: 1440, frameRate: 30 },
      ultra: { width: 3840, height: 2160, frameRate: 30 }
    };

    const settings = qualitySettings[quality] || qualitySettings.medium;
    
    return {
      width: { ideal: settings.width },
      height: { ideal: settings.height },
      frameRate: { ideal: settings.frameRate },
      cursor: 'always',
      displaySurface: 'monitor'
    };
  }

  async addMicrophoneAudio(audioInputId) {
    try {
      console.log('🎤 Adding microphone audio:', audioInputId);

      const audioConstraints = {
        audio: {
          deviceId: audioInputId === 'default' ? undefined : { exact: audioInputId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      };

      const microphoneStream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      
      // Combine audio tracks
      const audioTracks = [
        ...this.stream.getAudioTracks(),
        ...microphoneStream.getAudioTracks()
      ];

      // Create new stream with combined audio
      if (audioTracks.length > 0) {
        // If we have multiple audio tracks, we need to mix them
        // For now, we'll use the microphone track as primary
        const combinedStream = new MediaStream([
          ...this.stream.getVideoTracks(),
          microphoneStream.getAudioTracks()[0]
        ]);
        
        this.stream = combinedStream;
      }

    } catch (error) {
      console.warn('⚠️ Failed to add microphone audio:', error);
    }
  }

  setupMediaRecorder() {
    // Determine the best codec
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];

    let selectedMimeType = '';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    console.log('🎥 Using codec:', selectedMimeType);

    const options = {
      mimeType: selectedMimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      audioBitsPerSecond: 128000   // 128 kbps
    };

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      console.log('🏁 MediaRecorder stopped');
      await this.saveRecording();
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('❌ MediaRecorder error:', event.error);
      
      // Notify main process
      if (window.electronAPI?.screenRecorder?.handleError) {
        window.electronAPI.screenRecorder.handleError({
          error: event.error.message,
          type: 'mediarecorder_error'
        });
      }
    };
  }

  async stopRecording() {
    try {
      console.log('⏹️ Stopping screen recording in renderer...');

      if (!this.isRecording || !this.mediaRecorder) {
        console.warn('⚠️ No recording in progress');
        return { success: true };
      }

      this.isRecording = false;

      // Stop the MediaRecorder
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stop all tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop();
        });
      }

      console.log('✅ Screen recording stopped successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to stop recording in renderer:', error);
      throw error;
    }
  }

  async saveRecording() {
    try {
      console.log('💾 Saving recording...');

      if (this.recordedChunks.length === 0) {
        throw new Error('No recorded data to save');
      }

      // Create blob from chunks
      const blob = new Blob(this.recordedChunks, { 
        type: this.mediaRecorder.mimeType 
      });

      // Create file URL
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const filename = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      
      // For Electron, we can save to a specific location
      if (window.electronAPI?.file?.showSaveDialog) {
        const result = await window.electronAPI.file.showSaveDialog({
          defaultPath: filename,
          filters: [
            { name: 'WebM Videos', extensions: ['webm'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          // Convert blob to buffer and save
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Save file (this would need to be implemented in main process)
          // For now, trigger download
          this.downloadBlob(blob, filename);
        }
      } else {
        // Fallback: trigger download
        this.downloadBlob(blob, filename);
      }

      console.log('✅ Recording saved successfully');

    } catch (error) {
      console.error('❌ Failed to save recording:', error);
      throw error;
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      return { success: true };
    }
    return { success: false, error: 'Cannot pause - not recording' };
  }

  async resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      return { success: true };
    }
    return { success: false, error: 'Cannot resume - not paused' };
  }

  cleanup() {
    console.log('🧹 Cleaning up renderer screen recorder');
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }
    
    this.recordedChunks = [];
    this.isRecording = false;
  }

  // Get current state
  getState() {
    return {
      isRecording: this.isRecording,
      isPaused: this.mediaRecorder?.state === 'paused',
      duration: this.startTime ? Date.now() - this.startTime : 0,
      hasActiveStream: !!this.stream,
      availableAudioDevices: this.availableAudioDevices
    };
  }
}

// Export singleton instance
export const rendererScreenRecorder = new RendererScreenRecorder();