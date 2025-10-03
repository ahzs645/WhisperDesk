# Disabled Features During Tauri Migration

This document outlines the features and functions that were temporarily disabled during the WhisperDesk migration from Electron to Tauri. These features are commented out due to API compatibility issues and will need to be re-enabled and fixed in future development phases.

## Overview

During the migration process, several vibe-main functions were disabled because they use `eyre::Result<T, E>` return types, which are not compatible with Tauri's command system. Tauri commands require return types that implement specific traits for IPC serialization.

## Disabled Backend Commands

The following commands in `src-tauri/src/main.rs` were temporarily disabled:

### Core Functionality
- **`cmd::download_file`** - File download functionality
- **`cmd::transcribe`** - Core transcription function  
- **`cmd::download_model`** - Model download functionality
- **`cmd::load_model`** - Model loading functionality
- **`cmd::is_online`** - Internet connectivity check

### File System Operations
- **`cmd::get_path_dst`** - Destination path resolution
- **`cmd::get_logs`** - Log file access
- **`cmd::open_path`** - System path opening
- **`cmd::get_save_path`** - Save path resolution
- **`cmd::get_models_folder`** - Models directory path
- **`cmd::get_logs_folder`** - Logs directory path
- **`cmd::show_log_path`** - Show log file location
- **`cmd::show_temp_path`** - Show temp directory location

### System Features
- **`cmd::check_vulkan`** - Vulkan graphics check
- **`cmd::rename_crash_file`** - Crash file management

### Audio System
- **`cmd::audio::get_audio_devices`** - Audio device enumeration
- **`cmd::audio::start_record`** - Audio recording functionality

### YouTube-DL Integration
- **`cmd::ytdlp::download_audio`** - YouTube audio download

## Technical Reason for Disabling

All disabled functions return `eyre::Result<T, E>` types, which do not implement the required traits for Tauri IPC:
- `IpcResponse`
- `ResultKind` 
- `Into<InvokeError>` for the error type

### Error Example
```
error[E0599]: the method `blocking_kind` exists for reference `&Result<T, Report>`, but its trait bounds were not satisfied
```

## Temporarily Disabled Core Features

### 1. Diarization (Speaker Separation)
**Location**: `core/Cargo.toml` and `core/src/transcribe.rs`

**What was disabled**:
```rust
# pyannote-rs = "0.2.7"  # Temporarily disabled for initial build
```

**Reason**: The `pyannote-rs` dependency had C++ compilation issues with `knf-rs-sys` that were blocking the entire build process.

**Current behavior**: Diarization requests fall back to simple transcription without speaker separation.

### 2. Real Transcription Engine
**Location**: `src-tauri/src/whisperdesk_cmd.rs`

**What was disabled**: The actual integration with vibe-main's transcription engine was replaced with placeholder responses.

**Current behavior**: 
- `transcribe_audio` returns mock transcript data
- No actual audio processing occurs
- Returns empty segments and placeholder text

## Frontend API Compatibility

### Issue: Electron → Tauri API Bridge
**Current Problem**: The frontend still tries to access `window.electronAPI` but needs to use Tauri APIs.

**Error**: "Window API not available"

**Location**: `src/renderer/whisperdesk-ui/src/utils/AppInitializer.js:171`

## Solutions Required

### 1. Fix Backend Commands (High Priority)
Convert disabled functions to use Tauri-compatible return types:

```rust
// Before (incompatible)
pub async fn transcribe(...) -> Result<Transcript> { ... }

// After (compatible) 
#[tauri::command]
pub async fn transcribe(...) -> Result<Transcript, String> { 
    // Convert eyre::Result to Result<T, String>
    original_function().map_err(|e| e.to_string())
}
```

### 2. Re-enable Diarization (Medium Priority)
- Investigate and fix `knf-rs-sys` compilation issues
- Alternative: Use different speaker diarization library
- Test pyannote-rs integration thoroughly

### 3. Connect Real Transcription (High Priority)  
- Remove placeholder transcription code
- Integrate with vibe-main's actual whisper-rs transcription engine
- Set up proper WhisperContext initialization
- Handle model loading and GPU acceleration

### 4. Fix Frontend API Bridge (Critical)
- Update `AppInitializer.js` to use Tauri APIs instead of Electron APIs
- Update `TauriBridge.js` to provide complete API compatibility  
- Test all frontend functionality with new backend

## Current Status

✅ **Working**: Basic Tauri application compiles and launches  
✅ **Working**: WhisperDesk-specific commands (placeholder implementations)  
⚠️ **Partial**: Frontend runs but cannot communicate with backend  
❌ **Broken**: Real transcription functionality  
❌ **Broken**: Diarization (speaker separation)  
❌ **Broken**: File system operations  
❌ **Broken**: Audio device management  

## Migration Progress

- **Phase 1-4**: ✅ Complete (Basic structure and compilation)
- **Phase 5**: 🔄 In Progress (Advanced features re-enablement needed)
- **Phase 6**: ✅ Complete (Basic testing completed)  
- **Phase 7**: ⏳ Pending (Documentation and deployment)

## Next Steps

1. **Immediate**: Fix Window API issue to enable frontend-backend communication
2. **Short-term**: Re-enable critical backend commands with proper error handling
3. **Medium-term**: Restore real transcription functionality  
4. **Long-term**: Re-enable diarization and advanced features

---

*Generated during WhisperDesk Tauri migration - August 2025*