// src/main/screen-recorder/core/PlatformRecordingRouter.js
/**
 * Fixed Platform-aware recording router with improved macOS ScreenCaptureKit handling
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
    
    // Priority-based selection with enhanced error reporting
    const testResults = [];
    
    for (const method of methods) {
      try {
        console.log(`🧪 Testing ${method.name}...`);
        const testResult = await method.test();
        
        if (testResult) {
          this.selectedMethod = method;
          console.log(`✅ Selected: ${method.name}`);
          return method;
        } else {
          testResults.push({ method: method.name, result: 'test returned false' });
        }
      } catch (error) {
        console.log(`❌ ${method.name} failed: ${error.message}`);
        testResults.push({ method: method.name, error: error.message });
      }
    }
    
    // Enhanced error message with test results
    const errorDetails = testResults.map(r => 
      `${r.method}: ${r.error || r.result}`
    ).join('; ');
    
    throw new Error(`No suitable recording method available. Test results: ${errorDetails}`);
  }

  /**
   * Get available recording methods in priority order
   */
  async getAvailableMethods() {
    const methods = [];

    // macOS: Pure ScreenCaptureKit (highest priority)
    if (this.platform === 'darwin') {
      methods.push({
        name: 'screencapturekit-native',
        platform: 'darwin',
        systemAudio: 'native',
        microphone: 'native',
        merger: 'none',
        dependencies: ['aperture-v7', 'screencapturekit'],
        priority: 1,
        test: () => this.testScreenCaptureKit(),
        create: () => this.createMacOSRecorder()
      });

      // Fallback: Browser-only for macOS (if ScreenCaptureKit fails)
      methods.push({
        name: 'browser-macos-fallback',
        platform: 'darwin',
        systemAudio: 'browser-limited',
        microphone: 'browser',
        merger: 'browser',
        dependencies: ['browser'],
        priority: 5,
        test: () => this.testBrowserFallback(),
        create: () => this.createBrowserRecorder()
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

    // Universal fallback: Pure browser (all platforms)
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
   * Enhanced ScreenCaptureKit testing with better error handling
   */
  async testScreenCaptureKit() {
    if (this.platform !== 'darwin') {
      throw new Error('ScreenCaptureKit only available on macOS');
    }
    
    // Check macOS version
    if (this.osVersion < 13) {
      throw new Error(`macOS ${this.osVersion} too old for ScreenCaptureKit (requires 13+)`);
    }
    
    try {
      console.log('🧪 Testing Aperture v7 import...');
      
      // Test dynamic import of Aperture v7
      const aperture = await import('aperture');
      
      if (!aperture.screens) {
        throw new Error('Aperture screens() function not available');
      }
      
      console.log('🧪 Testing screen enumeration...');
      
      // Test screens enumeration with timeout
      const screensPromise = aperture.screens();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Screen enumeration timeout')), 10000)
      );
      
      const screens = await Promise.race([screensPromise, timeoutPromise]);
      
      if (!Array.isArray(screens) || screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      console.log(`✅ ScreenCaptureKit: ${screens.length} screen(s) available`);
      
      // Test audio devices (non-critical)
      try {
        console.log('🧪 Testing audio device enumeration...');
        const audioDevices = await aperture.audioDevices();
        console.log(`✅ ScreenCaptureKit: ${audioDevices.length} audio device(s) available`);
      } catch (audioError) {
        console.log('⚠️ Audio devices test failed (non-critical):', audioError.message);
      }
      
      return true;
      
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error('Aperture v7 not installed (npm install aperture@7)');
      } else if (error.message.includes('ESM')) {
        throw new Error('Aperture v7 ESM import issue - check Node.js version');
      } else {
        throw new Error(`ScreenCaptureKit test failed: ${error.message}`);
      }
    }
  }

  /**
   * Test Browser + CPAL combination (Windows/Linux)
   */
  async testBrowserCPAL() {
    try {
      console.log('🧪 Testing Browser + CPAL combination...');
      
      // Test browser MediaRecorder availability (simulated check)
      if (typeof global !== 'undefined' && !global.MediaRecorder) {
        console.log('⚠️ MediaRecorder not available in main process (will be checked in renderer)');
      }
      
      // Test CPAL
      await this.testCPAL();
      
      // Test FFmpeg  
      await this.testFFmpeg();
      
      console.log('✅ Browser + CPAL combination available');
      return true;
    } catch (error) {
      throw new Error(`Browser + CPAL test failed: ${error.message}`);
    }
  }

  /**
   * Test pure browser fallback
   */
  async testBrowserFallback() {
    console.log('🧪 Testing browser fallback...');
    // Browser is always available as fallback
    console.log('✅ Browser fallback available');
    return true;
  }

  /**
   * Enhanced CPAL testing
   */
  async testCPAL() {
    try {
      console.log('🧪 Testing CPAL module...');
      
      const CPALMicrophone = require('../services/CPALMicrophone');
      const cpal = new CPALMicrophone();
      
      await cpal.initialize();
      
      // Test device enumeration
      const devices = await cpal.getAvailableDevices();
      console.log(`✅ CPAL: ${devices.length} audio device(s) available`);
      
      cpal.cleanup();
      return true;
    } catch (error) {
      if (error.message.includes('node-cpal')) {
        throw new Error('CPAL module not installed or incompatible');
      } else {
        throw new Error(`CPAL test failed: ${error.message}`);
      }
    }
  }

  /**
   * Enhanced FFmpeg testing
   */
  async testFFmpeg() {
    try {
      console.log('🧪 Testing FFmpeg availability...');
      
      const { execAsync } = require('../../utils/exec-utils');
      const result = await execAsync('ffmpeg -version', { timeout: 5000 });
      
      if (!result.stdout.includes('ffmpeg version')) {
        throw new Error('FFmpeg version check failed');
      }
      
      console.log('✅ FFmpeg available');
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('FFmpeg not found in PATH');
      } else {
        throw new Error(`FFmpeg test failed: ${error.message}`);
      }
    }
  }

  /**
   * Create recorders with enhanced error handling
   */
  createMacOSRecorder() {
    try {
      const MacOSScreenCaptureRecorder = require('../recorders/MacOSScreenCaptureRecorder');
      return new MacOSScreenCaptureRecorder();
    } catch (error) {
      throw new Error(`Failed to create macOS recorder: ${error.message}`);
    }
  }

  createWindowsRecorder() {
    try {
      const WindowsHybridRecorder = require('../recorders/WindowsHybridRecorder');
      return new WindowsHybridRecorder();
    } catch (error) {
      throw new Error(`Failed to create Windows recorder: ${error.message}`);
    }
  }

  createLinuxRecorder() {
    try {
      const LinuxHybridRecorder = require('../recorders/LinuxHybridRecorder');
      return new LinuxHybridRecorder();
    } catch (error) {
      throw new Error(`Failed to create Linux recorder: ${error.message}`);
    }
  }

  createBrowserRecorder() {
    try {
      const BrowserFallbackRecorder = require('../recorders/BrowserFallbackRecorder');
      return new BrowserFallbackRecorder();
    } catch (error) {
      throw new Error(`Failed to create browser recorder: ${error.message}`);
    }
  }

  /**
   * Get OS version with better detection
   */
  getOSVersion() {
    if (this.platform === 'darwin') {
      try {
        const release = os.release();
        const major = parseInt(release.split('.')[0]);
        const macOSVersion = major - 9; // Convert Darwin to macOS version
        console.log(`🍎 macOS version detected: ${macOSVersion} (Darwin ${major})`);
        return macOSVersion;
      } catch (error) {
        console.warn('⚠️ Could not detect macOS version:', error.message);
        return 0;
      }
    }
    return 0;
  }

  /**
   * Get current platform capabilities with more detail
   */
  getPlatformCapabilities() {
    const method = this.selectedMethod;
    if (!method) return null;

    const capabilities = {
      platform: method.platform,
      method: method.name,
      systemAudio: method.systemAudio !== 'none',
      systemAudioMethod: method.systemAudio,
      microphone: method.microphone !== 'none',
      microphoneMethod: method.microphone,
      merger: method.merger,
      dependencies: method.dependencies,
      quality: this.getQualityRating(method),
      performance: this.getPerformanceRating(method),
      reliability: this.getReliabilityRating(method)
    };

    // Enhanced capabilities for ScreenCaptureKit
    if (method.name === 'screencapturekit-native') {
      capabilities.singleStream = true;
      capabilities.nativeIntegration = true;
      capabilities.hardwareAccelerated = true;
      capabilities.lowLatency = true;
    }

    return capabilities;
  }

  /**
   * Get quality rating for method
   */
  getQualityRating(method) {
    if (method.name === 'screencapturekit-native') return 'excellent';
    if (method.systemAudio === 'native') return 'excellent';
    if (method.systemAudio === 'browser' && method.microphone === 'cpal') return 'good';
    if (method.systemAudio === 'browser') return 'fair';
    return 'basic';
  }

  /**
   * Get performance rating for method
   */
  getPerformanceRating(method) {
    if (method.name === 'screencapturekit-native') return 'excellent';
    if (method.merger === 'none') return 'excellent';
    if (method.merger === 'ffmpeg') return 'good';
    return 'fair';
  }

  /**
   * Get reliability rating for method
   */
  getReliabilityRating(method) {
    if (method.name === 'screencapturekit-native') return 'excellent';
    if (method.dependencies.length <= 2) return 'good';
    if (method.dependencies.length <= 3) return 'fair';
    return 'basic';
  }
}

module.exports = PlatformRecordingRouter;