# Centralized Screen Recorder System

This directory contains the centralized and restructured screen recording functionality for WhisperDesk. The system is designed with separation of concerns, modularity, and maintainability in mind.

## Architecture Overview

The screen recorder system is organized into several key components:

```
src/main/screen-recorder/
├── core/                    # Core recording logic
│   └── ScreenRecorderEngine.js
├── managers/                # Specialized managers
│   ├── DeviceManager.js     # Device discovery and validation
│   └── FileManager.js       # File operations and storage
├── handlers/                # IPC communication
│   └── ScreenRecorderHandlers.js
├── types/                   # Type definitions and constants
│   └── index.js
├── ScreenRecorderService.js # Main orchestrator service
├── index.js                 # Entry point and factory
└── README.md               # This documentation
```

## Components

### 1. ScreenRecorderEngine (`core/ScreenRecorderEngine.js`)
The core recording engine that handles:
- Recording state management
- Start/stop/pause/resume operations
- Duration tracking and progress events
- File path generation and validation
- Error handling and recovery

### 2. DeviceManager (`managers/DeviceManager.js`)
Manages recording devices:
- Screen and window source discovery
- Audio device enumeration (from renderer)
- Device validation and compatibility checks
- Permission management (macOS)
- Periodic device refresh

### 3. FileManager (`managers/FileManager.js`)
Handles file operations:
- Recording file registration and tracking
- File cleanup and storage management
- Recording completion confirmation
- Storage statistics and monitoring
- Automatic cleanup of old files

### 4. ScreenRecorderService (`ScreenRecorderService.js`)
Main orchestrator that:
- Coordinates all components
- Provides unified API
- Handles component initialization
- Manages service lifecycle
- Forwards events between components

### 5. ScreenRecorderHandlers (`handlers/ScreenRecorderHandlers.js`)
Centralized IPC handlers:
- All screen recorder IPC communication
- Device-related operations
- Recording control operations
- File management operations
- Permission handling

### 6. Types (`types/index.js`)
Type definitions and constants:
- TypeScript-style JSDoc type definitions
- Recording events and states
- Error type categorization
- Shared constants

## Usage

### Basic Setup

```javascript
const { createScreenRecorderSystem } = require('./screen-recorder');

// Create and initialize the complete system
const screenRecorderSystem = await createScreenRecorderSystem();

// Access components
const service = screenRecorderSystem.service;
const handlers = screenRecorderSystem.handlers;
```

### Integration with Service Manager

The system integrates with the existing service manager:

```javascript
// In service-manager.js
const { createScreenRecorderSystem } = require('../screen-recorder');

async initializeEnhancedScreenRecorder() {
  const screenRecorderSystem = await createScreenRecorderSystem();
  this.services.screenRecorder = screenRecorderSystem.service;
  this.screenRecorderSystem = screenRecorderSystem;
}
```

### Recording Operations

```javascript
// Start recording
const result = await service.startRecording({
  screenId: 'screen:0',
  audioInputId: 'default',
  includeMicrophone: true,
  videoQuality: 'medium'
});

// Stop recording
await service.stopRecording();

// Confirm completion (called by renderer)
await service.confirmRecordingComplete('/path/to/actual/file.webm');
```

### Device Management

```javascript
// Get available screens
const screens = await service.getAvailableScreens();

// Update audio devices from renderer
service.updateAudioDevices(audioDeviceList);

// Validate device selection
const validation = service.validateDeviceSelection(screenId, audioId);
```

## Events

The system emits various events for monitoring and UI updates:

### Recording Events
- `started` - Recording has started
- `completed` - Recording completed successfully
- `paused` - Recording paused
- `resumed` - Recording resumed
- `error` - Recording error occurred
- `progress` - Recording progress update
- `validated` - Recording validated by renderer

### Device Events
- `devicesRefreshed` - Device list updated
- `audioDevicesUpdated` - Audio devices updated from renderer

## Error Handling

The system uses categorized error types for better error handling:

```javascript
const { ERROR_TYPES } = require('./screen-recorder');

// Error types include:
// - SERVICE_UNAVAILABLE
// - VALIDATION_ERROR
// - START_ERROR, STOP_ERROR, PAUSE_ERROR, RESUME_ERROR
// - PERMISSION_ERROR, DEVICE_ERROR, FILE_ERROR
```

## Configuration

Each component has configurable options:

### DeviceManager Configuration
```javascript
{
  refreshIntervalMs: 30000,    // Device refresh interval
  maxWindows: 10,              // Max windows to show
  cacheTimeoutMs: 60000        // Cache validity timeout
}
```

### FileManager Configuration
```javascript
{
  maxTempFiles: 50,            // Max temp files to keep
  maxFileAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  allowedExtensions: ['.webm', '.mp4', '.mov', '.avi'],
  maxFileSize: 5 * 1024 * 1024 * 1024    // 5GB
}
```

## Migration from Old System

The new system maintains API compatibility with the old screen recorder service. Existing code should continue to work without changes, but new features should use the centralized system.

### Key Improvements

1. **Separation of Concerns**: Each component has a specific responsibility
2. **Better Error Handling**: Categorized errors with detailed context
3. **Improved Device Management**: Centralized device discovery and validation
4. **File Management**: Proper file tracking and cleanup
5. **Event System**: Comprehensive event emission for monitoring
6. **Type Safety**: JSDoc type definitions for better development experience
7. **Testability**: Modular design makes testing easier
8. **Maintainability**: Clear structure and documentation

## Future Enhancements

The modular design allows for easy extension:

- **Recording Formats**: Add support for different output formats
- **Quality Presets**: Implement recording quality presets
- **Cloud Storage**: Add cloud storage integration
- **Recording Scheduling**: Implement scheduled recordings
- **Advanced Permissions**: Enhanced permission management
- **Performance Monitoring**: Add performance metrics and monitoring

## Cleanup

The system properly cleans up all resources:

```javascript
// Cleanup is handled automatically by the service manager
// Manual cleanup if needed:
screenRecorderSystem.handlers.cleanup();
screenRecorderSystem.service.destroy();
``` 