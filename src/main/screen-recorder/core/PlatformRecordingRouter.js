// src/main/screen-recorder/core/PlatformRecordingRouter.js
/**
 * Platform-aware recording router that selects the optimal recording method
 * macOS: Aperture v7 + ScreenCaptureKit (pure native)
 * Windows/Linux: Browser MediaRecorder + CPAL microphone
 */

const { EventEmitter } = require('events');
const os = require('os');

class PlatformRecordingRouter extends EventEmitter {
  constructor() {
    super();
    this.platform = process.platform;
    this.architecture = process.arch;
    this.osVersion = this.getOSVersion();
    this.selectedMethod = null;
    this.recorder = null;
  }

  /**
   * Determine the best recording method for current platform
   */
  async selectRecordingMethod() {
    console.log(`🔍 Selecting recording method for ${this.platform} ${this.architecture}`);
    
    const methods = await this.getAvailableMethods();
    
    // Priority-based selection
    for (const method of methods) {
      try {
        if (await method.test()) {
          this.selectedMethod = method;
          console.log(`✅ Selected: ${method.name}`);
          return method;
        }
      } catch (error) {
        console.log(`❌ ${method.name} failed: ${error.message}`);
      }
    }
    
    throw new Error('No suitable recording method available');
  }

  /**
   * Get available recording methods in priority order
   */
  async getAvailableMethods() {
    const methods = [];

    // macOS: Aperture v7 + ScreenCaptureKit (highest priority)
    if (this.platform === 'darwin') {
      methods.push({
        name: 'aperture-screencapturekit',
        platform: 'darwin',
        systemAudio: 'native',
        microphone: 'cpal',
        merger: 'ffmpeg',
        priority: 1,
        test: () => this.testApertureV7(),
        create: () => this.createApertureRecorder()
      });
    }

    // Windows: Browser + CPAL + FFmpeg
    if (this.platform === 'win32') {
      methods.push({
        name: 'browser-cpal-windows',
        platform: 'win32', 
        systemAudio: 'browser',
        microphone: 'cpal',
        merger: 'ffmpeg',
        priority: 2,
        test: () => this.testBrowserCPAL(),
        create: () => this.createWindowsRecorder()
      });
    }

    // Linux: Browser + CPAL + FFmpeg  
    if (this.platform === 'linux') {
      methods.push({
        name: 'browser-cpal-linux',
        platform: 'linux',
        systemAudio: 'browser', 
        microphone: 'cpal',
        merger: 'ffmpeg',
        priority: 2,
        test: () => this.testBrowserCPAL(),
        create: () => this.createLinuxRecorder()
      });
    }

    // Fallback: Pure browser (all platforms)
    methods.push({
      name: 'browser-fallback',
      platform: 'cross-platform',
      systemAudio: 'browser-limited',
      microphone: 'browser',
      merger: 'browser',
      priority: 10,
      test: () => this.testBrowserFallback(),
      create: () => this.createBrowserRecorder()
    });

    return methods.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Test Aperture v7 + ScreenCaptureKit availability (macOS)
   */
  async testApertureV7() {
    if (this.platform !== 'darwin') return false;
    
    // Check macOS version (ScreenCaptureKit requires 13+)
    if (this.osVersion < 13) return false;
    
    try {
      // Test dynamic import of Aperture v7
      const aperture = await import('aperture');
      if (!aperture.screens) return false;
      
      // Test screens enumeration
      const screens = await aperture.screens();
      if (screens.length === 0) return false;
      
      // Test CPAL availability (optional on macOS - system has native audio)
      const cpalAvailable = await this.testCPAL().catch(() => false);
      if (cpalAvailable) {
        console.log('✅ CPAL available for enhanced microphone recording');
      } else {
        console.log('⚠️ CPAL not available, will use browser microphone fallback');
      }
      
      // Test FFmpeg availability (required for merging)
      await this.testFFmpeg();
      
      return true;
    } catch (error) {
      console.log('Aperture v7 test failed:', error.message);
      return false;
    }
  }

  /**
   * Test Browser + CPAL combination (Windows/Linux)
   */
  async testBrowserCPAL() {
    try {
      // Test browser MediaRecorder
      if (!window.MediaRecorder) return false;
      
      // Test CPAL
      await this.testCPAL();
      
      // Test FFmpeg  
      await this.testFFmpeg();
      
      return true;
    } catch (error) {
      console.log('Browser + CPAL test failed:', error.message);
      return false;
    }
  }

  /**
   * Test pure browser fallback
   */
  async testBrowserFallback() {
    return typeof window !== 'undefined' && !!window.MediaRecorder;
  }

  /**
   * Test CPAL availability
   */
  async testCPAL() {
    try {
      const CPALMicrophone = require('../services/CPALMicrophone');
      const cpal = new CPALMicrophone();
      await cpal.initialize();
      cpal.cleanup();
      return true;
    } catch (error) {
      console.log('CPAL test failed:', error.message);
      return false;
    }
  }

  /**
   * Test FFmpeg availability
   */
  async testFFmpeg() {
    try {
      const { execAsync } = require('../../utils/exec-utils');
      await execAsync('ffmpeg -version', { timeout: 5000 });
      return true;
    } catch (error) {
      console.log('FFmpeg test failed:', error.message);
      return false;
    }
  }

  /**
   * Create recorders for different platforms
   */
  createApertureRecorder() {
    const MacOSNativeRecorder = require('./MacOSNativeRecorder');
    return new MacOSNativeRecorder();
  }

  createWindowsRecorder() {
    const WindowsHybridRecorder = require('./WindowsHybridRecorder');
    return new WindowsHybridRecorder();
  }

  createLinuxRecorder() {
    const LinuxHybridRecorder = require('./LinuxHybridRecorder');
    return new LinuxHybridRecorder();
  }

  createBrowserRecorder() {
    const BrowserFallbackRecorder = require('./BrowserFallbackRecorder');
    return new BrowserFallbackRecorder();
  }

  /**
   * Get OS version
   */
  getOSVersion() {
    if (this.platform === 'darwin') {
      const release = os.release();
      const major = parseInt(release.split('.')[0]);
      return major - 9; // Convert Darwin to macOS version
    }
    return 0;
  }

  /**
   * Get current platform capabilities
   */
  getPlatformCapabilities() {
    const method = this.selectedMethod;
    if (!method) return null;

    return {
      platform: method.platform,
      systemAudio: method.systemAudio === 'native' || method.systemAudio === 'browser',
      systemAudioMethod: method.systemAudio,
      microphone: method.microphone === 'cpal' || method.microphone === 'browser',
      microphoneMethod: method.microphone,
      merger: method.merger,
      quality: method.platform === 'darwin' ? 'excellent' : 'good',
      performance: method.platform === 'darwin' ? 'excellent' : 'good'
    };
  }
}

module.exports = PlatformRecordingRouter;