// src/renderer/whisperdesk-ui/src/components/screen-recorder/PlatformRecorderBridge.js
/**
 * Updated renderer bridge for simplified platform-aware recording
 * macOS: Pure ScreenCaptureKit (no browser recording needed)
 * Windows/Linux: Browser + CPAL + FFmpeg (hybrid approach)
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
    
    // Platform detection
    this.platform = this.detectPlatform();
    this.isNativeMacOS = this.platform === 'darwin';
  }

  /**
   * Detect current platform
   */
  detectPlatform() {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) return 'darwin';
    if (platform.includes('win')) return 'win32';
    return 'linux';
  }

  /**
   * Initialize the bridge with platform-specific setup
   */
  async initialize() {
    try {
      // ✅ PREVENT DUPLICATE LISTENERS: Cleanup any existing listeners first
      this.cleanup();
      
      // Get platform info from main process
      const status = await window.electronAPI.screenRecorder.getStatus();
      this.recordingMethod = status.method;
      
      console.log('🌉 Platform recorder bridge initialized:', {
        method: this.recordingMethod,
        platform: this.platform,
        isNativeMacOS: this.isNativeMacOS
      });
      
      // Set up event listeners for all recording events
      this.setupRecordingEventListeners();
      
      // ✅ UPDATED: Only import browser recorder for hybrid/fallback methods
      if (this.requiresBrowserRecording()) {
        const ScreenRecorderHandler = (await import('./ScreenRecorderHandler.js')).default;
        this.browserRecorder = new ScreenRecorderHandler();
        this.setupBrowserEvents();
        console.log('🌐 Browser recorder initialized for hybrid/fallback method');
      } else {
        console.log('🍎 Native recording - no browser recorder needed');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize platform recorder bridge:', error);
      throw error;
    }
  }

  /**
   * ✅ UPDATED: Check if this method requires browser recording
   */
  requiresBrowserRecording() {
    if (!this.recordingMethod) return false;
    
    // Methods that need browser recording
    const browserMethods = [
      'browser-fallback',
      'windows-hybrid',
      'linux-hybrid',
      'browser-cpal-windows',
      'browser-cpal-linux'
    ];
    
    return browserMethods.some(method => this.recordingMethod.includes(method));
  }

  /**
   * ✅ UPDATED: Check if this is pure native recording
   */
  isNativeRecording() {
    if (!this.recordingMethod) return false;
    
    // Methods that are purely native (no browser coordination)
    const nativeMethods = [
      'screencapturekit-native',
      'aperture-screencapturekit',
      'macos-native'
    ];
    
    return nativeMethods.some(method => this.recordingMethod.includes(method));
  }

  /**
   * ✅ UPDATED: Check if this is a hybrid method (browser + native components)
   */
  isHybridRecording() {
    if (!this.recordingMethod) return false;
    
    const hybridMethods = [
      'windows-hybrid',
      'linux-hybrid',
      'browser-cpal'
    ];
    
    return hybridMethods.some(method => this.recordingMethod.includes(method));
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
            platform: this.platform,
            isNative: this.isNativeRecording(),
            isHybrid: this.isHybridRecording()
          });
        }
      });
      this.eventCleanups.push(cleanup1);
    }

    // Recording progress event
    if (window.electronAPI.screenRecorder.onRecordingProgress) {
      const cleanup4 = window.electronAPI.screenRecorder.onRecordingProgress((data) => {
        if (this.onProgress) {
          // Convert to seconds consistently
          const durationSeconds = Math.floor(data.duration / 1000);
          this.onProgress({
            duration: durationSeconds * 1000, // Send as milliseconds to match other systems
            isRecording: this.isRecording,
            isPaused: data.isPaused || false
          });
        }
      });
      this.eventCleanups.push(cleanup4);
    }

    // Recording completed event  
    if (window.electronAPI.screenRecorder.onRecordingCompleted) {
      const cleanup2 = window.electronAPI.screenRecorder.onRecordingCompleted(async (data) => {
        console.log('🏁 Main process recording completed:', data);
        this.isRecording = false;
        this.stopProgressTracking();
        
        // ✅ SIMPLIFIED: For native methods, just use the path directly
        // For hybrid methods, the backend handles merging
        const finalPath = data.outputPath;
        
        if (this.onStopped) {
          this.onStopped({
            ...data,
            outputPath: finalPath,
            method: this.recordingMethod,
            platform: this.platform,
            isNative: this.isNativeRecording(),
            isHybrid: this.isHybridRecording()
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

    console.log('✅ Recording event listeners set up');
  }

  /**
   * ✅ SIMPLIFIED: Progress tracking with better timing
   */
  startProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }

    // Only start fallback progress if we don't get main process events
    let lastProgressTime = Date.now();
    
    this.progressInterval = setInterval(() => {
      if (this.isRecording && this.startTime && this.onProgress) {
        const duration = Date.now() - this.startTime; // Milliseconds
        const seconds = Math.floor(duration / 1000);
        
        // Only emit if we haven't received a main process progress event recently
        const timeSinceLastProgress = Date.now() - lastProgressTime;
        if (timeSinceLastProgress > 2000) {
          this.onProgress({
            duration,
            isRecording: this.isRecording,
            isPaused: false
          });
        }
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
   * ✅ UPDATED: Set up browser recorder events (only for hybrid methods)
   */
  setupBrowserEvents() {
    if (!this.browserRecorder) return;

    this.browserRecorder.onStarted = (data) => {
      console.log('🌐 Browser recording started:', data);
      // For hybrid methods, don't emit started here - wait for main process
    };

    this.browserRecorder.onStopped = async (data) => {
      console.log('🌐 Browser recording stopped:', data);
      
      // For hybrid methods, notify main process about browser completion
      if (this.isHybridRecording()) {
        try {
          await window.electronAPI.screenRecorder.notifyBrowserCompleted?.(data.outputPath);
          console.log('✅ Notified main process of browser completion');
        } catch (error) {
          console.warn('⚠️ Failed to notify main process:', error);
        }
      } else {
        // For pure browser fallback, emit stopped directly
        if (this.onStopped) this.onStopped(data);
      }
    };

    this.browserRecorder.onError = (error) => {
      console.error('❌ Browser recording error:', error);
      if (this.onError) this.onError(error);
    };
  }

  /**
   * ✅ UPDATED: Start recording with platform-specific coordination
   */
  async startRecording(options) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      console.log(`🎬 Starting platform recording (${this.recordingMethod})...`);
      console.log(`🎯 Platform: ${this.platform}, Native: ${this.isNativeRecording()}, Hybrid: ${this.isHybridRecording()}`);
      
      // Start main process recording first
      const mainResult = await window.electronAPI.screenRecorder.startRecording(options);
      
      if (!mainResult.success) {
        throw new Error(mainResult.error);
      }
      
      // ✅ UPDATED: Only start browser recording for hybrid/fallback methods
      if (this.browserRecorder && this.requiresBrowserRecording()) {
        console.log('🌐 Starting browser recording for hybrid/fallback method...');
        await this.browserRecorder.startRecording({
          ...options,
          outputPath: mainResult.outputPath
        });
      } else {
        console.log('🍎 Native recording - no browser coordination needed');
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
   * ✅ UPDATED: Stop recording with platform-specific coordination
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { success: true, message: 'No recording in progress' };
    }

    try {
      console.log(`🛑 Stopping platform recording (${this.recordingMethod})...`);
      
      // Stop progress tracking immediately
      this.stopProgressTracking();
      
      let browserResult = null;
      
      // ✅ UPDATED: Only stop browser recording for hybrid/fallback methods
      if (this.browserRecorder && this.requiresBrowserRecording() && this.browserRecorder.isRecording) {
        console.log('🌐 Stopping browser recording for hybrid/fallback method...');
        browserResult = await this.browserRecorder.stopRecording();
      } else {
        console.log('🍎 Native recording - no browser coordination needed');
      }
      
      // Stop main process recording
      const mainResult = await window.electronAPI.screenRecorder.stopRecording();
      
      // Reset state
      this.isRecording = false;
      this.startTime = null;
      
      console.log('✅ Platform recording stopped successfully');
      
      // Return the most relevant result
      return browserResult && browserResult.success ? browserResult : mainResult;
      
    } catch (error) {
      console.error('❌ Failed to stop platform recording:', error);
      this.isRecording = false;
      this.startTime = null;
      this.stopProgressTracking();
      throw error;
    }
  }

  /**
   * ✅ UPDATED: Get platform recording status with enhanced info
   */
  async getStatus() {
    try {
      const mainStatus = await window.electronAPI.screenRecorder.getStatus();
      
      return {
        ...mainStatus,
        recordingMethod: this.recordingMethod,
        platform: this.platform,
        isNative: this.isNativeRecording(),
        isHybrid: this.isHybridRecording(),
        requiresBrowser: this.requiresBrowserRecording(),
        browserRecording: this.browserRecorder?.isRecording || false,
        bridgeActive: true,
        architecture: this.getArchitectureInfo()
      };
    } catch (error) {
      console.warn('⚠️ Failed to get platform status:', error);
      return {
        isRecording: this.isRecording,
        recordingMethod: this.recordingMethod,
        platform: this.platform,
        error: error.message
      };
    }
  }

  /**
   * ✅ NEW: Get architecture information
   */
  getArchitectureInfo() {
    const method = this.recordingMethod;
    
    if (this.isNativeRecording()) {
      return {
        type: 'native',
        description: 'Pure ScreenCaptureKit - single stream output',
        components: ['ScreenCaptureKit'],
        merging: false,
        quality: 'highest'
      };
    } else if (this.isHybridRecording()) {
      return {
        type: 'hybrid',
        description: 'Browser screen + CPAL microphone + FFmpeg merging',
        components: ['Browser MediaRecorder', 'CPAL', 'FFmpeg'],
        merging: true,
        quality: 'high'
      };
    } else if (method?.includes('fallback')) {
      return {
        type: 'fallback',
        description: 'Pure browser recording (limited system audio)',
        components: ['Browser MediaRecorder'],
        merging: false,
        quality: 'medium'
      };
    }
    
    return {
      type: 'unknown',
      description: 'Unknown recording method',
      components: [],
      merging: false,
      quality: 'unknown'
    };
  }

  /**
   * ✅ UPDATED: Test system with new architecture awareness
   */
  async testApertureSystem() {
    const results = [];
    
    try {
      results.push('🧪 Testing Updated Screen Recording Architecture...');
      results.push(`🎯 Platform: ${this.platform}`);
      results.push(`🎯 Recording Method: ${this.recordingMethod}`);
      
      // Test 1: Check recording method type
      const status = await this.getStatus();
      const archInfo = this.getArchitectureInfo();
      
      results.push(`📋 Architecture: ${archInfo.type.toUpperCase()}`);
      results.push(`📝 Description: ${archInfo.description}`);
      results.push(`🔧 Components: ${archInfo.components.join(', ')}`);
      results.push(`🔄 Stream Merging: ${archInfo.merging ? 'Yes' : 'No'}`);
      results.push(`⭐ Quality Level: ${archInfo.quality}`);
      
      if (this.isNativeRecording()) {
        results.push('✅ Native recording method detected (ScreenCaptureKit)');
        results.push('🚫 No browser recording coordination needed');
        results.push('🚫 No FFmpeg merging needed');
        results.push('🚫 No CPAL dependency for microphone');
        results.push('🎯 Single stream: screen + system audio + microphone');
      } else if (this.isHybridRecording()) {
        results.push('🌐 Hybrid recording method detected');
        results.push('✅ Browser handles screen + system audio');
        results.push('✅ CPAL provides high-quality microphone');
        results.push('✅ FFmpeg merges streams');
        results.push('🎯 Dual stream: browser + CPAL → FFmpeg merge');
      } else if (this.requiresBrowserRecording()) {
        results.push('🌐 Browser fallback method detected');
        results.push('⚠️ Limited system audio capabilities');
        results.push('✅ Cross-platform compatibility');
      } else {
        results.push('❓ Unknown recording method type');
      }
      
      // Test 2: Check backend capabilities
      if (status.capabilities) {
        results.push(`🎯 System Audio: ${status.capabilities.systemAudio ? '✅' : '❌'} (${status.capabilities.systemAudioMethod || 'unknown'})`);
        results.push(`🎤 Microphone: ${status.capabilities.microphone ? '✅' : '❌'} (${status.capabilities.microphoneMethod || 'unknown'})`);
        results.push(`🔄 Merger: ${status.capabilities.merger || 'none'}`);
        results.push(`⭐ Quality: ${status.capabilities.quality || 'unknown'}`);
        results.push(`⚡ Performance: ${status.capabilities.performance || 'unknown'}`);
      }
      
      // Test 3: Platform-specific features
      if (this.isNativeMacOS) {
        results.push('🍎 macOS Specific Tests:');
        
        // Check permissions
        try {
          const permissions = await window.electronAPI.screenRecorder.checkPermissions();
          results.push(`  🔐 Screen Recording: ${permissions.screen || 'unknown'}`);
          results.push(`  🎤 Microphone: ${permissions.microphone || 'unknown'}`);
          
          if (permissions.screen !== 'granted') {
            results.push('  ⚠️ Screen recording permission required!');
            results.push('  💡 Grant in: System Preferences > Security & Privacy > Privacy > Screen Recording');
          }
        } catch (error) {
          results.push(`  ❌ Permission check failed: ${error.message}`);
        }
        
        // Check ScreenCaptureKit availability
        if (this.isNativeRecording()) {
          results.push('  ✅ ScreenCaptureKit method active');
          results.push('  ✅ Single stream output (no merging)');
          results.push('  ✅ Native system audio + microphone support');
          results.push('  🚫 No CPAL dependency');
          results.push('  🚫 No FFmpeg dependency');
        }
      } else {
        results.push(`💻 ${this.platform === 'win32' ? 'Windows' : 'Linux'} Specific Tests:`);
        
        if (this.isHybridRecording()) {
          results.push('  🌐 Browser MediaRecorder for screen capture');
          results.push('  🎤 CPAL for enhanced microphone quality');
          results.push('  🔄 FFmpeg for stream merging');
          results.push('  ✅ High-quality dual-stream recording');
        } else {
          results.push('  🌐 Browser MediaRecorder fallback');
          results.push('  ⚠️ Limited system audio capabilities');
        }
      }
      
      // Test 4: Check available screens
      try {
        const screensResult = await window.electronAPI.screenRecorder.getAvailableScreens(true);
        if (screensResult.success) {
          results.push(`🖥️ Available screens: ${screensResult.screens?.length || 0}`);
          screensResult.screens?.slice(0, 3).forEach((screen, index) => {
            results.push(`  ${index + 1}. ${screen.name} (${screen.id})`);
          });
          if (screensResult.screens?.length > 3) {
            results.push(`  ... and ${screensResult.screens.length - 3} more`);
          }
        } else {
          results.push('❌ Failed to get screens');
        }
      } catch (error) {
        results.push(`❌ Screen enumeration error: ${error.message}`);
      }
      
      // Test 5: Architecture summary
      results.push('📋 Architecture Summary:');
      results.push(`  Method: ${this.recordingMethod}`);
      results.push(`  Type: ${archInfo.type}`);
      results.push(`  Browser Recorder: ${this.browserRecorder ? '✅ Loaded' : '❌ Not needed'}`);
      results.push(`  Native Recording: ${this.isNativeRecording() ? '✅ Yes' : '❌ No'}`);
      results.push(`  Hybrid Recording: ${this.isHybridRecording() ? '✅ Yes' : '❌ No'}`);
      results.push(`  Platform: ${this.platform}`);
      
      results.push('🎉 System test completed!');
      
    } catch (error) {
      results.push(`❌ System test failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * ✅ UPDATED: Cleanup with better error handling
   */
  cleanup() {
    console.log('🧹 Cleaning up platform recorder bridge...');
    
    // Stop progress tracking
    this.stopProgressTracking();
    
    // Clean up event listeners
    this.eventCleanups.forEach(cleanup => {
      try {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      } catch (error) {
        console.warn('⚠️ Error during event cleanup:', error);
      }
    });
    this.eventCleanups = [];
    
    // Clean up browser recorder
    if (this.browserRecorder && typeof this.browserRecorder.cleanup === 'function') {
      try {
        this.browserRecorder.cleanup();
      } catch (error) {
        console.warn('⚠️ Error during browser recorder cleanup:', error);
      }
    }
    
    // Reset state
    this.isRecording = false;
    this.startTime = null;
    this.recordingMethod = null;
    
    console.log('✅ Platform recorder bridge cleaned up');
  }
}

export default PlatformRecorderBridge;