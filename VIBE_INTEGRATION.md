# WhisperDesk + Vibe Backend Integration

## Overview

WhisperDesk has been enhanced to use Vibe's high-performance Rust/Tauri backend directly, while maintaining its own UI and feature set. This integration provides the best of both worlds:

- **Backend**: Vibe's proven Rust/Tauri recording and transcription technology
- **Frontend**: WhisperDesk's polished UI and advanced features

## Architecture

### Integration Approach

The integration uses a **Bridge Adapter Pattern** that allows WhisperDesk to seamlessly switch between:
1. **Vibe Backend** (recommended) - Uses Vibe's recorder backend directly
2. **WhisperDesk Tauri Backend** - Uses WhisperDesk's built-in Tauri backend

### Key Components

```
WhisperDesk UI
     ↓
BridgeAdapter (src/utils/BridgeAdapter.js)
     ↓
   ┌─────────────────┬──────────────────┐
   ↓                 ↓                  ↓
VibeBridge     TauriBridge      (Future bridges)
   ↓                 ↓
Vibe Backend   WhisperDesk Backend
```

## Files Created/Modified

### New Files
- `src/utils/VibeBridge.js` - Bridge to interface with Vibe's backend
- `src/utils/BridgeAdapter.js` - Adapter to switch between backends
- `src/components/BackendSettings.jsx` - UI for backend configuration

### Modified Files
- `src/utils/AppInitializer.js` - Updated to use BridgeAdapter instead of TauriBridge directly

## How It Works

### 1. Command Mapping
VibeBridge maps WhisperDesk commands to Vibe's command structure:

```javascript
// WhisperDesk command → Vibe command
'transcribe-audio' → 'transcribe'
'start-recording' → 'start_record'
'load-model' → 'load_model'
```

### 2. Argument Transformation
Arguments are transformed to match Vibe's expected format:

```javascript
// WhisperDesk format
transcribe('audio.wav', { language: 'en' })

// Transformed to Vibe format
transcribe({ 
  path: 'audio.wav', 
  options: { lang: 'en', word_timestamps: true } 
})
```

### 3. Response Transformation
Vibe responses are transformed back to WhisperDesk format:

```javascript
// Vibe response
{ segments: [...], text: "..." }

// Transformed to WhisperDesk format
{ 
  text: "...", 
  segments: [...], 
  duration: ..., 
  language: ... 
}
```

## Configuration

### Setting the Vibe Path

The Vibe installation path can be configured:

1. **Programmatically**:
```javascript
await bridgeAdapter.setVibePath('/path/to/vibe-main');
```

2. **Through UI**:
Use the Backend Settings component in the app settings

3. **Default Path**:
`/Users/ahzs645/Github/WhisperDesk/vibe-main`

### Switching Backends

```javascript
// Switch to Vibe backend
await bridgeAdapter.switchBackend('vibe');

// Switch to WhisperDesk Tauri backend
await bridgeAdapter.switchBackend('tauri');
```

## Features Supported

### With Vibe Backend
- ✅ Audio transcription (whisper-rs)
- ✅ GPU acceleration (CUDA/Metal/Vulkan)
- ✅ Model management
- ✅ Audio recording (CPAL)
- ✅ Screen recording (platform-specific)
- ✅ Batch processing
- ✅ LLM integration

### Additional WhisperDesk Features
- ✅ Speaker diarization
- ✅ Analytics dashboard
- ✅ Real-time transcription display
- ✅ Export formats (SRT, VTT, JSON)
- ✅ Advanced UI controls

## Usage Example

```javascript
import bridgeAdapter from './utils/BridgeAdapter';

// Initialize with Vibe backend
await bridgeAdapter.initialize('vibe');

// Transcribe audio
const result = await bridgeAdapter.invoke('transcribe-audio', 'audio.wav');

// Start recording
await bridgeAdapter.startRecording('default', { sampleRate: 16000 });

// Stop and auto-transcribe
const { audioPath, transcript } = await bridgeAdapter.stopRecording();
```

## Benefits

1. **Performance**: Vibe's Rust backend provides native performance
2. **Flexibility**: Easy switching between backends
3. **Upgradability**: Vibe backend can be updated independently
4. **Compatibility**: Maintains full WhisperDesk UI compatibility
5. **Future-proof**: Easy to add more backend adapters

## Testing

To test the integration:

1. **Test Connection**:
```javascript
const devices = await bridgeAdapter.invoke('get-audio-devices');
console.log('Connected! Found devices:', devices);
```

2. **Test Transcription**:
```javascript
const result = await bridgeAdapter.invoke('transcribe-audio', 'test.wav');
console.log('Transcription:', result.text);
```

3. **Test Recording**:
```javascript
await bridgeAdapter.startRecording();
// ... record for a few seconds ...
const result = await bridgeAdapter.stopRecording();
console.log('Recorded to:', result.audioPath);
```

## Migration Status

✅ **Completed**:
- Tauri migration foundation
- Vibe backend integration
- Command mapping system
- Argument/response transformation
- Backend switching capability
- Configuration UI

🚧 **In Progress**:
- Full testing of all commands
- Performance optimization
- Error handling improvements

## Troubleshooting

### Backend Not Responding
1. Check Vibe path is correct
2. Ensure Vibe backend is compiled
3. Test with `Test Connection` button in settings

### Commands Not Working
1. Check command mapping in VibeBridge.js
2. Verify argument transformation
3. Check Vibe backend logs

### Performance Issues
1. Ensure GPU acceleration is enabled
2. Check model size vs available memory
3. Verify Rust optimizations are enabled

## Future Enhancements

1. **Auto-detection** of Vibe installation
2. **Version compatibility** checking
3. **Backend health monitoring**
4. **Automatic fallback** on errors
5. **Performance metrics** comparison
6. **Plugin system** for additional backends

## Development

To add a new backend:

1. Create a new bridge file (e.g., `NewBackendBridge.js`)
2. Implement the standard interface methods
3. Add to BridgeAdapter's backend options
4. Test all commands with the new backend

## Notes

- The Vibe path is configurable and persisted in app settings
- Backend preference is saved and restored on app restart
- All WhisperDesk UI features work with both backends
- Performance improvements are most notable with GPU acceleration enabled