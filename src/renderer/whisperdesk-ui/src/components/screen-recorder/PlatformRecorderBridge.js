// ============================================================================

// src/renderer/whisperdesk-ui/src/components/screen-recorder/PlatformRecorderBridge.js
/**
 * Renderer bridge for platform-aware recording
 * Coordinates between browser recording and main process
 */

class PlatformRecorderBridge {
    constructor() {
      this.isRecording = false;
      this.recordingMethod = null;
      this.browserRecorder = null;
      this.onStarted = null;
      this.onStopped = null;
      this.onError = null;
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
        
        this.isRecording = true;
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
        
        this.isRecording = false;
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
     * Cleanup resources
     */
    cleanup() {
      console.log('🧹 Cleaning up platform recorder bridge...');
      
      if (this.browserRecorder) {
        this.browserRecorder.cleanup();
        this.browserRecorder = null;
      }
      
      this.isRecording = false;
      this.recordingMethod = null;
    }
  }
  
  export default PlatformRecorderBridge;