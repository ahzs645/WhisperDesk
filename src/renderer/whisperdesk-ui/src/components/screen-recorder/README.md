# Screen Recorder Module

This module provides a centralized screen recording system for WhisperDesk. It replaces the previous scattered implementation with a more organized, maintainable structure.

## Architecture

The screen recorder is organized into several key components:

### Core Components

- **ScreenRecorderProvider**: Context provider that manages all screen recorder state
- **ScreenRecorderCore**: Main UI component that combines all other components
- **ScreenRecorderService**: Service layer that handles backend communication
- **ScreenRecorder**: Simple wrapper component for easy usage

### UI Components

- **ScreenRecorderControls**: Recording start/stop/pause controls
- **ScreenRecorderSettings**: Recording quality and audio settings
- **ScreenRecorderDevices**: Device selection (screens and audio inputs)
- **ScreenRecorderStatus**: Status indicator badge
- **ScreenRecorderDebug**: Debug panel with logging and diagnostics

### Hooks

- **useScreenRecorderContext**: Main context hook
- **useScreenRecorderActions**: Hook for recording actions
- **useScreenRecorderState**: Hook for reading state
- **useScreenRecorderDebug**: Hook for debug functionality

## Usage

### Simple Usage (Recommended)

```jsx
import { ScreenRecorder } from './components/screen-recorder';

function MyComponent() {
  return <ScreenRecorder />;
}
```

### Advanced Usage with Context

```jsx
import { 
  ScreenRecorderProvider, 
  ScreenRecorderCore,
  useScreenRecorderContext 
} from './components/screen-recorder';

function MyComponent() {
  return (
    <ScreenRecorderProvider>
      <ScreenRecorderCore />
      <CustomComponent />
    </ScreenRecorderProvider>
  );
}

function CustomComponent() {
  const { isRecording, startRecording, stopRecording } = useScreenRecorderContext();
  
  return (
    <button onClick={isRecording ? stopRecording : startRecording}>
      {isRecording ? 'Stop' : 'Start'} Recording
    </button>
  );
}
```

### Using Individual Components

```jsx
import { 
  ScreenRecorderProvider,
  ScreenRecorderControls,
  ScreenRecorderSettings,
  ScreenRecorderDevices
} from './components/screen-recorder';

function CustomRecorderUI() {
  return (
    <ScreenRecorderProvider>
      <div className="grid grid-cols-2 gap-4">
        <ScreenRecorderDevices />
        <ScreenRecorderSettings />
      </div>
      <ScreenRecorderControls />
    </ScreenRecorderProvider>
  );
}
```

## State Management

The screen recorder uses a centralized state management system:

```javascript
{
  // Recording state
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  recordingValidated: false,
  
  // Device state
  availableDevices: { screens: [], audio: [] },
  selectedScreen: '',
  selectedAudioInput: '',
  devicesInitialized: false,
  loadingDevices: false,
  
  // Settings state
  recordingSettings: {
    includeMicrophone: true,
    includeSystemAudio: false,
    videoQuality: 'medium',
    audioQuality: 'medium',
    recordingDirectory: null,
    autoTranscribe: false
  },
  
  // API state
  apiStatus: 'checking',
  localError: null,
  
  // Debug state
  debugMode: false,
  eventLog: []
}
```

## Actions

The context provides these actions:

- `startRecording(options)`: Start recording with optional settings
- `stopRecording()`: Stop the current recording
- `pauseResume()`: Toggle pause/resume state
- `refreshDevices()`: Refresh available devices
- `updateSettings(newSettings)`: Update recording settings
- `selectScreen(screenId)`: Select a screen device
- `selectAudioInput(audioInputId)`: Select an audio input device
- `toggleDebugMode()`: Toggle debug panel visibility
- `addToEventLog(event)`: Add event to debug log
- `clearEventLog()`: Clear the debug log

## Migration from EnhancedScreenRecorder

The old `EnhancedScreenRecorder` component has been replaced with this centralized system. To migrate:

### Before
```jsx
import { EnhancedScreenRecorder } from './components/EnhancedScreenRecorder';

function MyComponent() {
  return <EnhancedScreenRecorder />;
}
```

### After
```jsx
import { ScreenRecorder } from './components/screen-recorder';

function MyComponent() {
  return <ScreenRecorder />;
}
```

The old component is still available as a deprecated wrapper for backward compatibility.

## Benefits

1. **Centralized State**: All screen recorder state is managed in one place
2. **Modular Components**: Each component has a single responsibility
3. **Reusable**: Components can be used independently or together
4. **Type Safety**: Better TypeScript support (when migrated)
5. **Testing**: Easier to test individual components
6. **Maintainability**: Clear separation of concerns
7. **Debugging**: Built-in debug panel and logging

## Files Structure

```
src/components/screen-recorder/
├── index.js                    # Main exports
├── ScreenRecorderProvider.jsx  # Context provider
├── ScreenRecorderService.js    # Service layer
├── ScreenRecorderCore.jsx      # Main UI component
├── ScreenRecorder.jsx          # Simple wrapper
├── ScreenRecorderControls.jsx  # Recording controls
├── ScreenRecorderSettings.jsx  # Settings UI
├── ScreenRecorderDevices.jsx   # Device selection
├── ScreenRecorderStatus.jsx    # Status indicator
├── ScreenRecorderDebug.jsx     # Debug panel
├── ScreenRecorderHooks.js      # Custom hooks
└── README.md                   # This file
``` 