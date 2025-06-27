/**
 * @fileoverview CapRecorder system entry point
 * Creates and manages the complete CapRecorder-based screen recording system
 */

const CapRecorderService = require('./CapRecorderService');
const CapRecorderHandlers = require('./CapRecorderHandlers');

/**
 * Factory function to create a complete CapRecorder system
 * @returns {Promise<Object>} Complete CapRecorder system
 */
async function createCapRecorderSystem() {
  console.log('🏗️ Creating CapRecorder System...');
  
  try {
    // Create and initialize the CapRecorder service
    console.log('🔧 Creating CapRecorderService...');
    const service = new CapRecorderService();
    console.log('✅ CapRecorderService created');
    
    console.log('🔧 Initializing CapRecorder service...');
    await service.initialize();
    console.log('✅ CapRecorder service initialized');
    
    // Create IPC handlers
    console.log('🔧 Creating CapRecorderHandlers...');
    const handlers = new CapRecorderHandlers(service);
    console.log('✅ CapRecorderHandlers created');
    
    console.log('🔧 Setting up handlers...');
    handlers.setup();
    console.log('✅ Handlers set up');
    
    // Get platform information
    const platformInfo = {
      platform: process.platform,
      selectedMethod: 'caprecorder',
      supportedFeatures: [
        'screen-capture',
        'window-capture',
        'system-audio',
        'pause-resume',
        'cross-platform'
      ],
      capabilities: service.getStatus().capabilities
    };
    
    console.log('🎯 CapRecorder Platform Setup:', platformInfo);
    console.log('✅ CapRecorder System created successfully');
    
    return {
      service,
      handlers,
      platformInfo,
      // Compatibility methods
      getService: () => service,
      getHandlers: () => handlers,
      getPlatformInfo: () => platformInfo,
      cleanup: async () => {
        console.log('🧹 Cleaning up CapRecorder system...');
        if (handlers) {
          handlers.cleanup();
        }
        if (service) {
          await service.cleanup();
        }
        console.log('✅ CapRecorder system cleanup completed');
      }
    };
    
  } catch (error) {
    console.error('❌ Failed to create CapRecorder system:', error);
    throw error;
  }
}

/**
 * Get CapRecorder system information
 * @returns {Object} System information
 */
function getCapRecorderSystemInfo() {
  return {
    name: 'CapRecorder',
    description: 'High-performance screen recording powered by Cap',
    platform: process.platform,
    features: [
      'Cross-platform recording',
      'Screen and window capture',
      'System audio recording',
      'Pause/resume functionality',
      'Native Rust performance',
      'Headless operation'
    ],
    outputFormats: ['MP4', 'OGG'],
    audioCodec: 'Opus',
    videoCodec: 'H.264'
  };
}

module.exports = {
  createCapRecorderSystem,
  getCapRecorderSystemInfo,
  CapRecorderService,
  CapRecorderHandlers
};
