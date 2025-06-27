/**
 * @fileoverview WhisperDesk Screen Recorder - CapRecorder Implementation
 * Entry point for the CapRecorder-based screen recording system
 */

const { createCapRecorderSystem, getCapRecorderSystemInfo } = require('./caprecorder');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('./types');

/**
 * Create a CapRecorder-based screen recorder system
 * @returns {Promise<Object>} Complete screen recorder system
 */
async function createPlatformAwareScreenRecorderSystem() {
  console.log('🏗️ Creating CapRecorder Screen Recorder System...');
  
  try {
    // Create and initialize the CapRecorder system
    const capRecorderSystem = await createCapRecorderSystem();
    console.log('✅ CapRecorder system created successfully');
    
    // Log system info
    const systemInfo = getCapRecorderSystemInfo();
    console.log('🎯 CapRecorder Info:', systemInfo.name, '-', systemInfo.description);
    
    // Create platform info for compatibility
    const platformInfo = capRecorderSystem.platformInfo;
    console.log('🎯 Platform Setup:', platformInfo.platform, '|', platformInfo.selectedMethod);
    
    return {
      service: capRecorderSystem.service,
      handlers: capRecorderSystem.handlers,
      platformInfo,
      // Constants for compatibility
      RECORDING_EVENTS,
      RECORDING_STATES,
      ERROR_TYPES,
      // Cleanup function
      cleanup: capRecorderSystem.cleanup
    };
    
  } catch (error) {
    console.error('❌ Failed to create CapRecorder system:', error);
    throw error;
  }
}

// Export the main factory function and CapRecorder components
module.exports = {
  // Primary factory function
  createPlatformAwareScreenRecorderSystem,
  
  // Backward compatibility alias
  createScreenRecorderSystem: createPlatformAwareScreenRecorderSystem,
  
  // CapRecorder components
  ...require('./caprecorder'),
  
  // Constants
  RECORDING_EVENTS,
  RECORDING_STATES,
  ERROR_TYPES
};