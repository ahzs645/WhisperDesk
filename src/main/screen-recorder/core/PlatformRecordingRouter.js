// src/main/screen-recorder/core/PlatformRecordingRouter.js
/**
 * Updated Platform-aware recording router with ScreenCaptureKit Node.js support
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

    // macOS: ScreenCaptureKit Node.js (highest priority - optimized for transcription)
    if (this.platform === 'darwin') {
      methods.push({
        name: 'screencapturekit-node',
        platform: 'darwin',
        systemAudio: 'native',
        microphone: 'native',
        merger: 'built-in',
        dependencies: ['screencapturekit'],
        priority: 1,
        transcriptionOptimized: true,
        test: () => this.testScreenCaptureKitNode(),
        create: () => this.createScreenCaptureKitNodeRecorder()
      });

      // Fallback: Pure ScreenCaptureKit with Aperture (if ScreenCaptureKit Node.js fails)
      methods.push({
        name: 'screencapturekit-aperture',
        platform: 'darwin',
        systemAudio: 'native',
        microphone: 'native',
        merger: 'none',
        dependencies: ['aperture-v7', 'screencapturekit'],
        priority: 2,
        test: () => this.testScreenCaptureKitAperture(),
        create: () => this.createMacOSScreenCaptureRecorder()
      });

      // Browser fallback for macOS
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
   * Test ScreenCaptureKit Node.js (NEW - highest priority for macOS)
   */
  async testScreenCaptureKitNode() {
    if (this.platform !== 'darwin') {
      throw new Error('ScreenCaptureKit Node.js only available on macOS');
    }
    
    try {
      console.log('🧪 Testing ScreenCaptureKit Node.js...');
      
      // Test dynamic import of screencapturekit
      const screencapturekit = await import('screencapturekit').catch(error => {
        if (error.code === 'ERR_MODULE_NOT_FOUND') {
          throw new Error('ScreenCaptureKit Node.js not installed (npm install screencapturekit)');
        }
        throw error;
      });
      
      // Test basic functionality
      const screens = await screencapturekit.screens();
      
      if (!Array.isArray(screens) || screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      console.log(`✅ ScreenCaptureKit Node.js: ${screens.length} screen(s) available`);
      
      // Test audio devices (non-critical)
      try {
        const audioDevices = await screencapturekit.audioDevices();
        console.log(`✅ ScreenCaptureKit Node.js: ${audioDevices.length} audio device(s) available`);
      } catch (audioError) {
        console.log('⚠️ Audio devices test failed (non-critical):', audioError.message);
      }
      
      // Test microphones (non-critical)
      try {
        const microphones = await screencapturekit.microphoneDevices();
        console.log(`✅ ScreenCaptureKit Node.js: ${microphones.length} microphone(s) available`);
      } catch (micError) {
        console.log('⚠️ Microphones test failed (non-critical):', micError.message);
      }
      
      // Log transcription-optimized features
      console.log('🎵 ScreenCaptureKit Node.js transcription features:');
      console.log('   • Audio-only recording mode');
      console.log('   • Automatic MP3 conversion');
      console.log('   • Multi-source audio merging');
      console.log('   • Built-in FFmpeg processing');
      
      return true;
      
    } catch (error) {
      throw new Error(`ScreenCaptureKit Node.js test failed: ${error.message}`);
    }
  }

  /**
   * Test traditional ScreenCaptureKit with Aperture (fallback)
   */
  async testScreenCaptureKitAperture() {
    if (this.platform !== 'darwin') {
      throw new Error('ScreenCaptureKit only available on macOS');
    }
    
    // Check macOS version
    if (this.osVersion < 13) {
      throw new Error(`macOS ${this.osVersion} too old for ScreenCaptureKit (requires 13+)`);
    }
    
    try {
      console.log('🧪 Testing Aperture v7 fallback...');
      
      // Test dynamic import of Aperture v7
      const aperture = await import('aperture');
      
      if (!aperture.screens) {
        throw new Error('Aperture screens() function not available');
      }
      
      const screens = await aperture.screens();
      
      if (!Array.isArray(screens) || screens.length === 0) {
        throw new Error('No screens available for recording');
      }
      
      console.log(`✅ Aperture fallback: ${screens.length} screen(s) available`);
      
      return true;
      
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        throw new Error('Aperture v7 not installed (npm install aperture@7)');
      }
      throw new Error(`Aperture fallback test failed: ${error.message}`);
    }
  }

  /**
   * Test Browser + CPAL combination (Windows/Linux)
   */
  async testBrowserCPAL() {
    try {
      console.log('🧪 Testing Browser + CPAL combination...');
      
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
   * Test CPAL module
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
   * Test FFmpeg availability
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
  createScreenCaptureKitNodeRecorder() {
    try {
      const ScreenCaptureKitNodeRecorder = require('../recorders/ScreenCaptureKitNodeRecorder');
      return new ScreenCaptureKitNodeRecorder();
    } catch (error) {
      throw new Error(`Failed to create ScreenCaptureKit Node.js recorder: ${error.message}`);
    }
  }

  createMacOSScreenCaptureRecorder() {
    try {
      const MacOSScreenCaptureRecorder = require('../recorders/MacOSScreenCaptureRecorder');
      return new MacOSScreenCaptureRecorder();
    } catch (error) {
      throw new Error(`Failed to create macOS ScreenCaptureKit recorder: ${error.message}`);
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
      reliability: this.getReliabilityRating(method),
      transcriptionOptimized: method.transcriptionOptimized || false
    };

    // Enhanced capabilities for ScreenCaptureKit Node.js
    if (method.name === 'screencapturekit-node') {
      capabilities.audioOnlyMode = true;
      capabilities.mp3Conversion = true;
      capabilities.multiSourceAudio = true;
      capabilities.builtInFFmpeg = true;
      capabilities.transcriptionReady = true;
    }

    // Enhanced capabilities for traditional ScreenCaptureKit
    if (method.name === 'screencapturekit-aperture') {
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
    if (method.name === 'screencapturekit-node') return 'excellent';
    if (method.name === 'screencapturekit-aperture') return 'excellent';
    if (method.systemAudio === 'native') return 'excellent';
    if (method.systemAudio === 'browser' && method.microphone === 'cpal') return 'good';
    if (method.systemAudio === 'browser') return 'fair';
    return 'basic';
  }

  /**
   * Get performance rating for method
   */
  getPerformanceRating(method) {
    if (method.name === 'screencapturekit-node') return 'excellent';
    if (method.name === 'screencapturekit-aperture') return 'excellent';
    if (method.merger === 'built-in') return 'excellent';
    if (method.merger === 'none') return 'excellent';
    if (method.merger === 'ffmpeg') return 'good';
    return 'fair';
  }

  /**
   * Get reliability rating for method
   */
  getReliabilityRating(method) {
    if (method.name === 'screencapturekit-node') return 'excellent';
    if (method.name === 'screencapturekit-aperture') return 'excellent';
    if (method.dependencies.length <= 1) return 'excellent';
    if (method.dependencies.length <= 2) return 'good';
    if (method.dependencies.length <= 3) return 'fair';
    return 'basic';
  }
}

module.exports = PlatformRecordingRouter;