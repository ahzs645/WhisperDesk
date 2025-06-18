// src/main/screen-recorder/core/PlatformRecordingRouter.js
/**
 * Updated Platform-aware recording router with simplified macOS approach
 * macOS: Pure ScreenCaptureKit (no CPAL, no FFmpeg)
 * Windows/Linux: Browser + CPAL + FFmpeg
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

    // macOS: Pure ScreenCaptureKit (highest priority, simplified)
    if (this.platform === 'darwin') {
      methods.push({
        name: 'screencapturekit-native',
        platform: 'darwin',
        systemAudio: 'native',
        microphone: 'native', // ← ScreenCaptureKit handles microphone natively
        merger: 'none',       // ← No merging needed
        dependencies: ['screencapturekit'], // ← Only ScreenCaptureKit
        priority: 1,
        test: () => this.testScreenCaptureKit(),
        create: () => this.createMacOSRecorder()
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
        dependencies: ['browser', 'cpal', 'ffmpeg'],
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
        dependencies: ['browser', 'cpal', 'ffmpeg'],
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
      dependencies: ['browser'],
      priority: 10,
      test: () => this.testBrowserFallback(),
      create: () => this.createBrowserRecorder()
    });

    return methods.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Test pure ScreenCaptureKit availability (macOS - SIMPLIFIED)
   */
  async testScreenCaptureKit() {
    if (this.platform !== 'darwin') return false;
    
    // Check macOS version (ScreenCaptureKit requires 13+)
    if (this.osVersion < 13) {
      console.log('ℹ️ macOS version too old for ScreenCaptureKit');
      return false;
    }
    
    try {
      // Test Aperture v7 with ScreenCaptureKit
      const aperture = await import('aperture');
      if (!aperture.screens) return false;
      
      // Test screens enumeration
      const screens = await aperture.screens();
      if (screens.length === 0) return false;
      
      // Test audio devices (for microphone support)
      try {
        const audioDevices = await aperture.audioDevices();
        console.log(`✅ ScreenCaptureKit: ${screens.length} screens, ${audioDevices.length} audio devices`);
      } catch (audioError) {
        console.log('⚠️ Audio devices unavailable, but ScreenCaptureKit still usable');
      }
      
      console.log('✅ Pure ScreenCaptureKit available (no CPAL/FFmpeg needed)');
      return true;
      
    } catch (error) {
      console.log('ScreenCaptureKit test failed:', error.message);
      return false;
    }
  }

  /**
   * Test Browser + CPAL combination (Windows/Linux)
   */
  async testBrowserCPAL() {
    try {
      // Test browser MediaRecorder (this would be done in renderer)
      // For now, assume it's available
      console.log('🌐 Browser MediaRecorder assumed available');
      
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
    // Browser is always available as fallback
    return true;
  }

  /**
   * Test CPAL availability (Windows/Linux only)
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
   * Test FFmpeg availability (Windows/Linux only)
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
  createMacOSRecorder() {
    const MacOSScreenCaptureRecorder = require('../recorders/MacOSScreenCaptureRecorder');
    return new MacOSScreenCaptureRecorder();
  }

  createWindowsRecorder() {
    const WindowsHybridRecorder = require('../recorders/WindowsHybridRecorder');
    return new WindowsHybridRecorder();
  }

  createLinuxRecorder() {
    const LinuxHybridRecorder = require('../recorders/LinuxHybridRecorder');
    return new LinuxHybridRecorder();
  }

  createBrowserRecorder() {
    const BrowserFallbackRecorder = require('../recorders/BrowserFallbackRecorder');
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

    const capabilities = {
      platform: method.platform,
      systemAudio: method.systemAudio === 'native' || method.systemAudio === 'browser',
      systemAudioMethod: method.systemAudio,
      microphone: method.microphone === 'native' || method.microphone === 'cpal' || method.microphone === 'browser',
      microphoneMethod: method.microphone,
      merger: method.merger,
      dependencies: method.dependencies,
      quality: 'good',
      performance: 'good'
    };

    // Enhanced capabilities for pure ScreenCaptureKit
    if (method.name === 'screencapturekit-native') {
      capabilities.quality = 'excellent';
      capabilities.performance = 'excellent';
      capabilities.singleStream = true;
      capabilities.nativeIntegration = true;
      capabilities.simplifiedArchitecture = true;
    }

    return capabilities;
  }
}

module.exports = PlatformRecordingRouter;