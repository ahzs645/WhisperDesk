# CapRecorder Integration

This directory contains the CapRecorder-based screen recording implementation for WhisperDesk. CapRecorder is a high-performance screen recording library powered by Cap, built with Rust and exposed to Node.js via NAPI.

## Features

🎥 **High-performance screen recording** - Native Rust performance  
🖥️ **Support for both screen and window capture** - Flexible recording options  
🔊 **System audio recording** - Capture system audio along with video  
🎯 **Cross-platform** - Works on macOS, Windows, and Linux  
⚡ **Native Rust performance** - Fast and efficient recording  
🚀 **Async/await API** - Modern JavaScript API  
🎮 **Headless operation** - No GUI required for recording  
⏸️ **Pause/resume functionality** - Control recording flow  

## Architecture

```
src/main/screen-recorder/caprecorder/
├── CapRecorderService.js      # Main service implementation
├── CapRecorderHandlers.js     # IPC handlers for renderer communication
├── index.js                   # System factory and exports
├── examples.js               # Usage examples and testing
└── README.md                 # This file
```

## Integration Points

### Service Manager
The CapRecorder system is integrated into WhisperDesk through the Service Manager:

```javascript
// In service-manager.js
await this.initializePlatformAwareScreenRecorder();
```

### IPC Communication
The system provides the following IPC channels:

- `screenRecorder:startRecording` - Start a new recording
- `screenRecorder:stopRecording` - Stop the current recording
- `screenRecorder:pauseRecording` - Pause the current recording
- `screenRecorder:resumeRecording` - Resume a paused recording
- `screenRecorder:cancelRecording` - Cancel the current recording
- `screenRecorder:getStatus` - Get current recording status
- `screenRecorder:getAvailableScreens` - List available screens
- `screenRecorder:getAvailableWindows` - List available windows
- `screenRecorder:checkPermissions` - Check recording permissions

### Event Forwarding
The system emits the following events to the renderer:

- `screenRecorder:recordingStarted` - Recording has started
- `screenRecorder:recordingStopped` - Recording has completed
- `screenRecorder:recordingPaused` - Recording has been paused
- `screenRecorder:recordingResumed` - Recording has been resumed
- `screenRecorder:recordingCanceled` - Recording has been canceled

## Usage Examples

### Basic Screen Recording

```javascript
const recorder = new CapRecorder();
const screens = listAvailableScreens();

await recorder.startRecording({
  outputPath: './recordings/screen-recording',
  screenId: screens[0].id,
  captureSystemAudio: true,
  fps: 30
});

// Record for 10 seconds
setTimeout(async () => {
  const outputPath = await recorder.stopRecording();
  console.log('Recording saved to:', outputPath);
}, 10000);
```

### Window Recording

```javascript
const recorder = new CapRecorder();
const windows = listAvailableWindows();

const targetWindow = windows.find(w => w.title.includes('VS Code')) || windows[0];

await recorder.startRecording({
  outputPath: './recordings/window-recording',
  windowId: targetWindow.id,
  captureSystemAudio: false,
  fps: 30
});
```

### Pause and Resume

```javascript
const recorder = new CapRecorder();

// Start recording
await recorder.startRecording(config);

// Pause after 5 seconds
setTimeout(() => recorder.pauseRecording(), 5000);

// Resume after 2 more seconds
setTimeout(() => recorder.resumeRecording(), 7000);

// Stop after another 5 seconds
setTimeout(() => recorder.stopRecording(), 12000);
```

## Output Format

Recordings are saved in a structured format:

```
your-recording/
├── project-config.json    # Recording metadata
└── content/
    ├── cursors/           # Cursor data (if enabled)
    └── segments/
        └── segment-0/
            ├── display.mp4      # Video recording (H.264)
            └── system_audio.ogg # Audio recording (Opus, if enabled)
```

## Configuration Options

### Recording Configuration

```javascript
{
  outputPath: string,           // Required: Output directory path
  screenId?: number,            // Screen ID (from listAvailableScreens)
  windowId?: number,            // Window ID (from listAvailableWindows)  
  captureSystemAudio?: boolean, // Default: false
  fps?: number,                 // Default: 30
  filename?: string             // Custom filename prefix
}
```

## Error Handling

The CapRecorder implementation provides comprehensive error handling:

- **Permission errors** - When screen capture permission is not granted
- **Device errors** - When screens or windows are not available
- **Recording errors** - When recording fails to start or continue
- **IPC errors** - When communication between main and renderer fails

## Testing

Run the examples to test CapRecorder functionality:

```bash
# Run all examples
node src/main/screen-recorder/caprecorder/examples.js

# Run specific examples
node src/main/screen-recorder/caprecorder/examples.js screen
node src/main/screen-recorder/caprecorder/examples.js window
node src/main/screen-recorder/caprecorder/examples.js audio
node src/main/screen-recorder/caprecorder/examples.js pause
```

## Troubleshooting

### Permission Issues

If you get permission errors:

1. **macOS**: Go to System Preferences > Security & Privacy > Privacy > Screen Recording
2. **Windows**: Permissions are typically granted automatically
3. **Linux**: Permissions depend on your desktop environment

### No Screens/Windows Found

```javascript
const screens = listAvailableScreens();
const windows = listAvailableWindows();

if (screens.length === 0) console.log('No screens detected');
if (windows.length === 0) console.log('No windows available');
```

### Audio Issues

- Ensure system audio is playing during recording
- Check that `captureSystemAudio: true` is set
- Verify audio permissions in system settings

## Performance Tips

- Use appropriate FPS settings (30 fps is usually sufficient)
- Consider audio-only recording for long sessions where video isn't needed
- Use pause/resume to avoid large continuous recordings
- Monitor disk space during long recordings

## Migration from Previous Implementation

The CapRecorder implementation replaces the previous complex platform-specific recording system with a unified, high-performance solution. Key improvements:

- **Simplified architecture** - Single library instead of multiple platform-specific implementations
- **Better performance** - Native Rust implementation
- **More reliable** - Proven Cap recording engine
- **Easier maintenance** - Single codebase for all platforms
- **Modern API** - Clean async/await interface

## Dependencies

- `@firstform/caprecorder` - The main CapRecorder library
- `events` - Node.js EventEmitter for event handling
- `path` - Path manipulation utilities
- `fs.promises` - File system operations
