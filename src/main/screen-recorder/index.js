// ============================================================================

// src/main/screen-recorder/index.js - Updated entry point
/**
 * Updated entry point for the platform-aware screen recorder system
 */

const PlatformAwareScreenRecorderService = require('./core/PlatformAwareScreenRecorderService');
const ScreenRecorderHandlers = require('./handlers/ScreenRecorderHandlers');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('./types');

/**
 * Factory function to create a platform-aware screen recorder system
 * @returns {Promise<Object>} Complete screen recorder system
 */
async function createPlatformAwareScreenRecorderSystem() {
  console.log('🏗️ Creating Platform-Aware Screen Recorder System...');
  
  try {
    // Create and initialize the platform-aware service
    const service = new PlatformAwareScreenRecorderService();
    await service.initialize();
    
    // Create IPC handlers
    const handlers = new ScreenRecorderHandlers(service);
    handlers.setup();
    
    // Log platform information
    const platformInfo = service.getPlatformInfo();
    console.log('🎯 Platform Recording Setup:', platformInfo);
    
    console.log('✅ Platform-Aware Screen Recorder System created successfully');
    
    return {
      service,
      handlers,
      platformInfo,
      // Expose constants for external use
      RECORDING_EVENTS,
      RECORDING_STATES,
      ERROR_TYPES
    };
    
  } catch (error) {
    console.error('❌ Failed to create platform-aware screen recorder system:', error);
    throw error;
  }
}

module.exports = {
  // Main factory function (new preferred method)
  createPlatformAwareScreenRecorderSystem,
  
  // Legacy factory function for backward compatibility
  createScreenRecorderSystem: createPlatformAwareScreenRecorderSystem,
  
  // Individual components
  PlatformAwareScreenRecorderService,
  ScreenRecorderHandlers,
  
  // Constants
  RECORDING_EVENTS,
  RECORDING_STATES,
  ERROR_TYPES
};