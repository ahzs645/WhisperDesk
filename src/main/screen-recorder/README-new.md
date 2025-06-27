# WhisperDesk Screen Recorder

This directory contains the screen recording implementation for WhisperDesk, powered by **CapRecorder** - a high-performance screen recording library built with Rust and exposed to Node.js via NAPI.

## 🎯 Architecture

WhisperDesk uses a unified CapRecorder-based implementation that replaces the previous complex platform-specific recording system.

```
src/main/screen-recorder/
├── index.js              # Main entry point and factory
├── types/                # TypeScript definitions and constants
├── caprecorder/          # CapRecorder implementation
│   ├── CapRecorderService.js    # Core recording service
│   ├── CapRecorderHandlers.js   # IPC communication handlers  
│   ├── index.js                 # CapRecorder system factory
│   ├── examples.js              # Usage examples
│   └── README.md                # Detailed CapRecorder docs
└── README.md             # This file
```

## ✨ Features

🎥 **High-performance recording** - Native Rust backend via Cap  
🖥️ **Screen & window capture** - Flexible recording targets  
🔊 **System audio recording** - Built-in audio capture  
🎯 **Cross-platform** - macOS, Windows, Linux support  
⚡ **Async/await API** - Modern JavaScript interface  
🎮 **Headless operation** - No GUI required  
⏸️ **Pause/resume** - Full recording control  

## 🚀 Quick Start

```javascript
const { createPlatformAwareScreenRecorderSystem } = require('./screen-recorder');

// Initialize the recording system
const system = await createPlatformAwareScreenRecorderSystem();
const { service, handlers } = system;

// Start recording
await service.startRecording({
  outputPath: './recordings/my-recording',
  screenId: screens[0].id,
  captureSystemAudio: true,
  fps: 30
});

// Stop recording
const result = await service.stopRecording();
console.log('Recording saved to:', result.outputPath);
```

## 🔌 Integration

The screen recorder integrates with WhisperDesk through:

1. **Service Manager** - Initializes the CapRecorder system
2. **IPC Manager** - Sets up communication channels with the renderer
3. **Event System** - Forwards recording events to the UI

### Service Integration

```javascript
// In ServiceManager
await this.initializePlatformAwareScreenRecorder();
this.services.screenRecorder = this.screenRecorderSystem.service;
```

### IPC Channels

- `screenRecorder:startRecording` - Begin new recording
- `screenRecorder:stopRecording` - End current recording  
- `screenRecorder:pauseRecording` - Pause recording
- `screenRecorder:resumeRecording` - Resume paused recording
- `screenRecorder:getAvailableScreens` - List capture sources
- `screenRecorder:getStatus` - Get current state

## 📁 Output Format

Recordings are saved in Cap's structured format:

```
recording-name/
├── project-config.json    # Recording metadata
└── content/
    └── segments/
        └── segment-0/
            ├── display.mp4      # Video (H.264)
            └── system_audio.ogg # Audio (Opus)
```

## 🛠️ Development

### Testing

Run CapRecorder examples:

```bash
# All examples
node src/main/screen-recorder/caprecorder/examples.js

# Specific examples  
node src/main/screen-recorder/caprecorder/examples.js screen
node src/main/screen-recorder/caprecorder/examples.js window
node src/main/screen-recorder/caprecorder/examples.js audio
```

### Adding Features

To extend the recording system:

1. **Service Level** - Add methods to `CapRecorderService.js`
2. **IPC Level** - Add handlers to `CapRecorderHandlers.js`  
3. **Integration** - Update event forwarding in `ServiceManager.js`

## 🔄 Migration Notes

This implementation replaces the previous multi-recorder system with:

- **Simplified Architecture** - Single service instead of multiple engines
- **Better Performance** - Native Rust implementation  
- **Unified API** - Same interface across all platforms
- **Reduced Complexity** - Much smaller, maintainable codebase

## 📚 Documentation

For detailed API documentation and examples, see:
- [CapRecorder Implementation](./caprecorder/README.md)
- [Examples](./caprecorder/examples.js)

## 🔗 Dependencies

- `@firstform/caprecorder` - Core recording library
- `events` - Event emitter for state management
- `path` & `fs` - File system operations
