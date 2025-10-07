# Screen Recorder Frontend Components

This directory contains the frontend React components for WhisperDesk's screen recording functionality. The components are designed to work with the simplified backend architecture.

## Architecture Overview

### Backend Architecture (Simplified)

The backend now uses a simplified, platform-specific approach:

- **macOS**: Pure ScreenCaptureKit (single stream, no merging)
- **Windows/Linux**: Browser + CPAL + FFmpeg (hybrid approach)
- **Fallback**: Pure browser recording (cross-platform compatibility)

### Frontend Components

#### Core Components

1. **PlatformRecorderBridge.js** - Main bridge between frontend and backend
   - Detects recording method (`screencapturekit-native`, `windows-hybrid`, `linux-hybrid`, `browser-fallback`)
   - Handles platform-specific coordination
   - Only loads browser recorder for hybrid/fallback methods
   - Provides architecture-aware status and testing

2. **ScreenRecorderProvider.jsx** - React context provider
   - Manages global recording state
   - Coordinates between UI components and service layer
   - Handles device management and settings

3. **ScreenRecorderServiceRenderer.js** - Service layer
   - Wraps PlatformRecorderBridge for React integration
   - Manages IPC communication with main process
   - Handles event forwarding and state synchronization

#### UI Components

4. **ScreenRecorder.jsx** - Main recording interface
5. **ScreenRecorderControls.jsx** - Recording controls (start/stop/pause)
6. **ScreenRecorderSettings.jsx** - Settings configuration
7. **ScreenRecorderDevices.jsx** - Device selection
8. **ScreenRecorderStatus.jsx** - Status display
9. **ScreenRecorderDebug.jsx** - Debug and testing interface

## Recording Methods

### Native Recording (macOS)
- **Method**: `screencapturekit-native`
- **Components**: ScreenCaptureKit only
- **Browser Recorder**: Not loaded
- **Merging**: None (single stream)
- **Quality**: Highest

### Hybrid Recording (Windows/Linux)
- **Method**: `windows-hybrid` / `linux-hybrid`
- **Components**: Browser MediaRecorder + CPAL + FFmpeg
- **Browser Recorder**: Loaded for screen capture
- **Merging**: FFmpeg combines streams
- **Quality**: High

### Fallback Recording (All Platforms)
- **Method**: `browser-fallback`
- **Components**: Browser MediaRecorder only
- **Browser Recorder**: Loaded for all recording
- **Merging**: None (browser output only)
- **Quality**: Medium (limited system audio)

## Key Features

### Architecture Awareness
- Components detect recording method automatically
- UI adapts based on capabilities (native vs hybrid vs fallback)
- Debug interface shows architecture-specific information

### Platform-Specific Optimizations
- **macOS**: No browser coordination needed, direct ScreenCaptureKit
- **Windows/Linux**: Coordinated browser + native components
- **Fallback**: Pure browser with graceful degradation

### Event Handling
- Unified event system across all recording methods
- Progress tracking with fallback mechanisms
- Error handling with architecture-specific context

## Development

### Testing
Use the debug interface (`ScreenRecorderDebug.jsx`) to:
- Test architecture detection
- Verify component initialization
- Check file saving flows
- Validate platform-specific features

### Adding New Methods
1. Update method detection in `PlatformRecorderBridge.js`
2. Add method-specific logic in bridge methods
3. Update architecture info in `getArchitectureInfo()`
4. Add tests in debug component

## File Structure

```
screen-recorder/
├── README.md                           # This file
├── index.js                           # Component exports
├── PlatformRecorderBridge.js          # Core bridge (architecture-aware)
├── ScreenRecorderProvider.jsx         # React context
├── ScreenRecorderServiceRenderer.js   # Service layer
├── ScreenRecorder.jsx                 # Main component
├── ScreenRecorderControls.jsx         # Controls UI
├── ScreenRecorderCore.jsx             # Core logic
├── ScreenRecorderDebug.jsx            # Debug interface (updated)
├── ScreenRecorderDevices.jsx          # Device selection
├── ScreenRecorderHandler.js           # Browser recording handler
├── ScreenRecorderHooks.js             # React hooks
├── ScreenRecorderService.js           # Legacy service
├── ScreenRecorderSettings.jsx         # Settings UI
├── ScreenRecorderStatus.jsx           # Status display
└── ScreenRecorderProvider.jsx         # Context provider
```

## Migration Notes

### From Old Architecture
- Method names changed: `aperture-screencapturekit` → `screencapturekit-native`
- Hybrid methods now explicitly named: `windows-hybrid`, `linux-hybrid`
- Browser coordination simplified for native methods
- Debug interface updated with architecture awareness

### Breaking Changes
- `testApertureSystem()` renamed to `testArchitectureSystem()`
- Architecture info now includes type, components, and merging info
- Method detection updated for new naming scheme 