// src/renderer/whisperdesk-ui/src/components/screen-recorder/PlatformRecorderBridge.js
/**
 * Fixed renderer bridge for platform-aware recording
 * Coordinates between browser recording and main process
 * ✅ NO DIRECT NODE.JS MODULE USAGE - uses IPC bridge only
 */

class PlatformRecorderBridge {
  constructor() {
    this.isRecording = false;
    this.recordingMethod = null;
    this.browserRecorder = null;
    this.onStarted = null;
    this.onStopped = null;
    this.onError = null;
    this.onProgress = null;
    this.progressInterval = null;
    this.startTime = null;
    this.eventCleanups = [];
  }

  /**
   * Initialize the bridge
   */
  async initialize() {
    try {
      // Get platform info from main process
      const status = await window.electronAPI.screenRecorder.getStatus();
      this.recordingMethod = status.method;
      
      console.log('🌉 Platform recorder bridge initialized:', this.recordingMethod);
      
      // Set up event listeners for all recording events
      this.setupRecordingEventListeners();
      
      // Import the appropriate browser recorder based on platform
      if (this.recordingMethod?.includes('browser') || this.recordingMethod?.includes('fallback')) {
        const ScreenRecorderHandler = (await import('./ScreenRecorderHandler.js')).default;
        this.browserRecorder = new ScreenRecorderHandler();
        this.setupBrowserEvents();
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize platform recorder bridge:', error);
      throw error;
    }
  }

  /**
   * Set up recording event listeners from main process
   */
  setupRecordingEventListeners() {
    if (!window.electronAPI?.screenRecorder) return;

    // Recording started event
    if (window.electronAPI.screenRecorder.onRecordingStarted) {
      const cleanup1 = window.electronAPI.screenRecorder.onRecordingStarted((data) => {
        console.log('🎬 Main process recording started:', data);
        this.isRecording = true;
        this.startTime = Date.now();
        this.startProgressTracking();
        
        if (this.onStarted) {
          this.onStarted({
            ...data,
            method: this.recordingMethod,
            platform: 'main-process'
          });
        }
      });
      this.eventCleanups.push(cleanup1);
    }

    // Recording completed event
    if (window.electronAPI.screenRecorder.onRecordingCompleted) {
      const cleanup2 = window.electronAPI.screenRecorder.onRecordingCompleted(async (data) => {
        console.log('🏁 Main process recording completed:', data);
        this.isRecording = false;
        this.stopProgressTracking();
        
        // ✅ FIXED: Handle file completion using IPC bridge
        const finalPath = await this.handleFileCompletionViaIPC(data);
        
        if (this.onStopped) {
          this.onStopped({
            ...data,
            outputPath: finalPath,
            method: this.recordingMethod,
            platform: 'main-process'
          });
        }
      });
      this.eventCleanups.push(cleanup2);
    }

    // Recording error event
    if (window.electronAPI.screenRecorder.onRecordingError) {
      const cleanup3 = window.electronAPI.screenRecorder.onRecordingError((data) => {
        console.error('❌ Main process recording error:', data);
        this.isRecording = false;
        this.stopProgressTracking();
        
        if (this.onError) {
          this.onError(new Error(data.error || 'Recording failed'));
        }
      });
      this.eventCleanups.push(cleanup3);
    }

    // Recording progress event (if available)
    if (window.electronAPI.screenRecorder.onRecordingProgress) {
      const cleanup4 = window.electronAPI.screenRecorder.onRecordingProgress((data) => {
        if (this.onProgress) {
          this.onProgress({
            duration: data.duration,
            isRecording: this.isRecording,
            isPaused: data.isPaused || false
          });
        }
      });
      this.eventCleanups.push(cleanup4);
    }

    console.log('✅ Recording event listeners set up');
  }

  /**
   * ✅ FIXED: Handle file completion using IPC bridge only
   */
  async handleFileCompletionViaIPC(data) {
    try {
      const tempPath = data.outputPath;
      
      if (!tempPath) {
        console.warn('⚠️ No output path provided');
        return tempPath;
      }

      // ✅ Use IPC bridge instead of direct fs access
      if (window.electronAPI?.file?.exists) {
        const exists = await window.electronAPI.file.exists(tempPath);
        if (!exists) {
          console.warn('⚠️ Recording file not found at temp location:', tempPath);
          return tempPath;
        }
      }

      // File handling is done by main process, just return the path
      console.log('📁 Recording completed at:', tempPath);
      return tempPath;

    } catch (error) {
      console.error('❌ Error handling file completion via IPC:', error);
      return data.outputPath;
    }
  }

  /**
   * Start progress tracking (fallback if main process doesn't send progress events)
   */
  startProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    this.progressInterval = setInterval(() => {
      if (this.isRecording && this.startTime && this.onProgress) {
        const duration = Date.now() - this.startTime;
        this.onProgress({
          duration,
          isRecording: this.isRecording,
          isPaused: false
        });
      }
    }, 1000);
  }

  /**
   * Stop progress tracking
   */
  stopProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Set up browser recorder events
   */
  setupBrowserEvents() {
    if (!this.browserRecorder) return;

    this.browserRecorder.onStarted = (data) => {
      console.log('🌐 Browser recording started:', data);
      if (this.onStarted) this.onStarted(data);
    };

    this.browserRecorder.onStopped = async (data) => {
      console.log('🌐 Browser recording stopped:', data);
      
      // For hybrid methods, notify main process
      if (this.recordingMethod?.includes('hybrid')) {
        try {
          await window.electronAPI.screenRecorder.notifyBrowserCompleted?.(data.outputPath);
        } catch (error) {
          console.warn('⚠️ Failed to notify main process:', error);
        }
      }
      
      if (this.onStopped) this.onStopped(data);
    };

    this.browserRecorder.onError = (error) => {
      console.error('❌ Browser recording error:', error);
      if (this.onError) this.onError(error);
    };
  }

  /**
   * Start recording with platform coordination
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      console.log(`🎬 Starting platform recording (${this.recordingMethod})...`);
      
      // Start main process recording
      const mainResult = await window.electronAPI.screenRecorder.startRecording(options);
      
      if (!mainResult.success) {
        throw new Error(mainResult.error);
      }
      
      // For browser-based methods, also start browser recording
      if (this.browserRecorder && (
        this.recordingMethod?.includes('browser') || 
        this.recordingMethod?.includes('hybrid') ||
        this.recordingMethod?.includes('fallback')
      )) {
        await this.browserRecorder.startRecording({
          ...options,
          outputPath: mainResult.outputPath
        });
      }
      
      console.log('✅ Platform recording started successfully');
      
      return mainResult;
    } catch (error) {
      console.error('❌ Failed to start platform recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording with platform coordination
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress' };
    }

    try {
      console.log(`🛑 Stopping platform recording (${this.recordingMethod})...`);
      
      let browserResult = null;
      
      // Stop browser recording first (if applicable)
      if (this.browserRecorder && this.browserRecorder.isRecording) {
        browserResult = await this.browserRecorder.stopRecording();
      }
      
      // Stop main process recording
      const mainResult = await window.electronAPI.screenRecorder.stopRecording();
      
      console.log('✅ Platform recording stopped successfully');
      
      // Return the most relevant result
      return browserResult && browserResult.success ? browserResult : mainResult;
      
    } catch (error) {
      console.error('❌ Failed to stop platform recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Get platform recording status
   */
  async getStatus() {
    try {
      const mainStatus = await window.electronAPI.screenRecorder.getStatus();
      
      return {
        ...mainStatus,
        recordingMethod: this.recordingMethod,
        browserRecording: this.browserRecorder?.isRecording || false,
        bridgeActive: true
      };
    } catch (error) {
      console.warn('⚠️ Failed to get platform status:', error);
      return {
        isRecording: this.isRecording,
        recordingMethod: this.recordingMethod,
        error: error.message
      };
    }
  }

  /**
   * Test Aperture v7 system specifically
   */
  async testApertureSystem() {
    const results = [];
    
    try {
      results.push('🧪 Testing Aperture v7 Screen Recording System...');
      
      // Test 1: Check if Aperture method is active
      const status = await this.getStatus();
      if (status.recordingMethod?.includes('aperture')) {
        results.push(`✅ Aperture method active: ${status.recordingMethod}`);
      } else {
        results.push(`❌ Aperture method not active: ${status.recordingMethod}`);
      }
      
      // Test 2: Check backend capabilities
      if (status.capabilities) {
        results.push(`🎯 System Audio: ${status.capabilities.systemAudio ? '✅' : '❌'} (${status.capabilities.systemAudioMethod})`);
        results.push(`🎤 Microphone: ${status.capabilities.microphone ? '✅' : '❌'} (${status.capabilities.microphoneMethod})`);
        results.push(`🔄 Merger: ${status.capabilities.merger || 'none'}`);
        results.push(`⭐ Quality: ${status.capabilities.quality || 'unknown'}`);
        results.push(`⚡ Performance: ${status.capabilities.performance || 'unknown'}`);
      }
      
      // Test 3: Check available screens via Aperture
      try {
        const screensResult = await window.electronAPI.screenRecorder.getAvailableScreens(true);
        if (screensResult.success) {
          results.push(`🖥️ Aperture screens available: ${screensResult.screens?.length || 0}`);
          screensResult.screens?.forEach((screen, index) => {
            results.push(`  ${index + 1}. ${screen.name} (${screen.id})`);
          });
        } else {
          results.push('❌ Failed to get Aperture screens');
        }
      } catch (error) {
        results.push(`❌ Screen enumeration error: ${error.message}`);
      }
      
      // Test 4: Check permissions (macOS specific)
      try {
        const permissions = await window.electronAPI.screenRecorder.checkPermissions();
        results.push(`🔐 Screen permission: ${permissions.screen || 'unknown'}`);
        results.push(`🎤 Microphone permission: ${permissions.microphone || 'unknown'}`);
      } catch (error) {
        results.push(`❌ Permission check error: ${error.message}`);
      }
      
      // Test 5: Test file system access via IPC
      try {
        if (window.electronAPI?.file?.getDefaultRecordingsDirectory) {
          const defaultDir = await window.electronAPI.file.getDefaultRecordingsDirectory();
          results.push(`📁 Default recordings directory: ${defaultDir}`);
        }
      } catch (error) {
        results.push(`❌ File system test error: ${error.message}`);
      }
      
      // Test 6: Backend component status
      if (status.components) {
        results.push('🔧 Backend Components:');
        Object.entries(status.components).forEach(([component, active]) => {
          results.push(`  ${component}: ${active ? '✅ Active' : '❌ Inactive'}`);
        });
      }
      
      results.push('🎉 Aperture v7 system test completed!');
      
    } catch (error) {
      results.push(`❌ Aperture test failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    console.log('🧹 Cleaning up platform recorder bridge...');
    
    this.stopProgressTracking();
    
    // Clean up event listeners
    this.eventCleanups.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('⚠️ Error cleaning up event listener:', error);
      }
    });
    this.eventCleanups = [];
    
    if (this.browserRecorder) {
      this.browserRecorder.cleanup();
      this.browserRecorder = null;
    }
    
    this.isRecording = false;
    this.recordingMethod = null;
  }
}

export default PlatformRecorderBridge;