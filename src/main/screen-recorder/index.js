/**
 * @fileoverview Main entry point for the centralized screen recorder system
 */

const ScreenRecorderService = require('./ScreenRecorderService');
const ScreenRecorderHandlers = require('./handlers/ScreenRecorderHandlers');
const ScreenRecorderEngine = require('./core/ScreenRecorderEngine');
const DeviceManager = require('./managers/DeviceManager');
const FileManager = require('./managers/FileManager');
const { RECORDING_EVENTS, RECORDING_STATES, ERROR_TYPES } = require('./types');

/**
 * Factory function to create a complete screen recorder system
 * @returns {Promise<Object>} Complete screen recorder system
 */
async function createScreenRecorderSystem() {
  console.log('🏗️ Creating centralized screen recorder system...');
  
  try {
    // Create and initialize the main service
    const service = new ScreenRecorderService();
    await service.initialize();
    
    // Create IPC handlers
    const handlers = new ScreenRecorderHandlers(service);
    handlers.setup();
    
    console.log('✅ Centralized screen recorder system created successfully');
    
    return {
      service,
      handlers,
      // Expose constants for external use
      RECORDING_EVENTS,
      RECORDING_STATES,
      ERROR_TYPES
    };
    
  } catch (error) {
    console.error('❌ Failed to create screen recorder system:', error);
    throw error;
  }
}

/**
 * Factory function to create individual components
 * @returns {Object} Component constructors
 */
function createComponents() {
  return {
    ScreenRecorderService,
    ScreenRecorderEngine,
    DeviceManager,
    FileManager,
    ScreenRecorderHandlers
  };
}

module.exports = {
  // Main factory function
  createScreenRecorderSystem,
  
  // Individual components
  ScreenRecorderService,
  ScreenRecorderHandlers,
  ScreenRecorderEngine,
  DeviceManager,
  FileManager,
  
  // Component factory
  createComponents,
  
  // Constants
  RECORDING_EVENTS,
  RECORDING_STATES,
  ERROR_TYPES
}; 