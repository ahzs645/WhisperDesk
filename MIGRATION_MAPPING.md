# Electron to Tauri IPC Handler Migration Mapping

This document maps all Electron IPC handlers to their corresponding Tauri commands.

## Status Legend
- ✅ Implemented
- 🚧 In Progress
- ⏳ Planned
- 🔴 Needs Research

## App Handlers (`src/main/ipc-handlers/app-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `app:getInfo` | `get_app_info` | ✅ | `commands/app_commands.rs` |
| `app:getPlatform` | `get_platform` | ✅ | `commands/app_commands.rs` |
| `app:quit` | `quit_app` | ✅ | `commands/app_commands.rs` |
| `app:restart` | `restart_app` | ✅ | `commands/app_commands.rs` |
| `app:getVersion` | `get_app_info` | ✅ | `commands/app_commands.rs` |

## Settings Handlers (`src/main/ipc-handlers/settings-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `settings:get` | `get_setting` | ✅ | `commands/settings_commands.rs` |
| `settings:set` | `set_setting` | ✅ | `commands/settings_commands.rs` |
| `settings:getAll` | `get_all_settings` | ✅ | `commands/settings_commands.rs` |
| `settings:delete` | `delete_setting` | ✅ | `commands/settings_commands.rs` |
| `settings:reset` | `reset_settings` | ✅ | `commands/settings_commands.rs` |

**Notes:**
- Consider using [tauri-plugin-store](https://github.com/tauri-apps/tauri-plugin-store) for production
- Current implementation uses in-memory HashMap (data not persisted)

## Transcription Handlers (`src/main/ipc-handlers/transcription-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `transcription:start` | `start_transcription` | ✅ | `commands/transcription_commands.rs` |
| `transcription:stop` | `stop_transcription` | ✅ | `commands/transcription_commands.rs` |
| `transcription:getStatus` | `get_transcription_status` | ✅ | `commands/transcription_commands.rs` |
| `transcription:realtime:start` | `start_realtime_transcription` | ⏳ | TBD |
| `transcription:realtime:stop` | `stop_realtime_transcription` | ⏳ | TBD |

**Implementation Notes:**
- Need to integrate whisper.cpp or whisper-rs
- Binary management for whisper-cli
- Real-time streaming requires WebSocket or event system

## Model Handlers (`src/main/ipc-handlers/model-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `models:list` | `list_models` | ✅ | `commands/transcription_commands.rs` |
| `models:download` | `download_model` | ⏳ | TBD |
| `models:delete` | `delete_model` | ⏳ | TBD |
| `models:getInfo` | `get_model_info` | ⏳ | TBD |
| `models:getPath` | `get_model_path` | ⏳ | TBD |

**Implementation Notes:**
- Use `reqwest` for HTTP downloads
- Progress tracking with channels/events
- File system operations with `std::fs` and `tauri::api::path`

## File Handlers (`src/main/ipc-handlers/file-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `file:open` | Use `tauri::api::dialog::FileDialogBuilder` | 🚧 | TBD |
| `file:save` | Use `tauri::api::dialog::FileDialogBuilder` | 🚧 | TBD |
| `file:read` | Use `tauri::api::fs` or `std::fs` | 🚧 | TBD |
| `file:write` | Use `tauri::api::fs` or `std::fs` | 🚧 | TBD |
| `file:delete` | Use `std::fs::remove_file` | 🚧 | TBD |
| `file:exists` | Use `std::path::Path::exists` | 🚧 | TBD |

**Implementation Notes:**
- Configure file system permissions in `tauri.conf.json`
- Use Tauri's scoped file system API for security

## Export Handlers (`src/main/ipc-handlers/export-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `export:transcription` | `export_transcription` | ⏳ | TBD |
| `export:enhanced` | `export_enhanced_transcription` | ⏳ | TBD |
| `export:txt` | `export_to_txt` | ⏳ | TBD |
| `export:json` | `export_to_json` | ⏳ | TBD |
| `export:srt` | `export_to_srt` | ⏳ | TBD |
| `export:vtt` | `export_to_vtt` | ⏳ | TBD |

**Implementation Notes:**
- Format serialization with `serde`
- Template rendering for structured formats

## Speaker Handlers (`src/main/ipc-handlers/speaker-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `speaker:recognize` | `recognize_speaker` | ⏳ | TBD |
| `speaker:list` | `list_speakers` | ⏳ | TBD |
| `speaker:add` | `add_speaker` | ⏳ | TBD |
| `speaker:update` | `update_speaker` | ⏳ | TBD |
| `speaker:delete` | `delete_speaker` | ⏳ | TBD |

**Implementation Notes:**
- Port diarization service to Rust
- ONNX runtime integration for speaker embeddings
- Consider using `ort` (ONNX Runtime for Rust)

## Screen Recorder Handlers (CapRecorder)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `screenRecorder:getStatus` | `get_recorder_status` | 🔴 | TBD |
| `screenRecorder:startRecording` | `start_recording` | 🔴 | TBD |
| `screenRecorder:stopRecording` | `stop_recording` | 🔴 | TBD |
| `screenRecorder:pauseRecording` | `pause_recording` | 🔴 | TBD |
| `screenRecorder:resumeRecording` | `resume_recording` | 🔴 | TBD |
| `screenRecorder:getDevices` | `get_recording_devices` | 🔴 | TBD |

**Implementation Notes:**
- **macOS**: Use `scap` crate or implement ScreenCaptureKit bindings
- **Windows**: Use `windows-capture` or similar
- **Linux**: Use PipeWire/FFmpeg bindings
- Complex - requires native platform APIs

## Device Manager

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `device:listAudio` | `list_audio_devices` | ⏳ | TBD |
| `device:listVideo` | `list_video_devices` | ⏳ | TBD |
| `device:getDefault` | `get_default_device` | ⏳ | TBD |

**Implementation Notes:**
- Use `cpal` for cross-platform audio device enumeration
- Video device enumeration varies by platform

## Basic Handlers (`src/main/ipc-handlers/basic-handlers.js`)

| Electron IPC | Tauri Command | Status | File |
|--------------|---------------|--------|------|
| `ping` | `ping` | ⏳ | TBD |
| `getPath` | Use `tauri::api::path` functions | ⏳ | TBD |

## Migration Priority

### Phase 1: Core App (Week 1)
- ✅ App handlers
- ✅ Settings handlers (with proper persistence)
- File handlers
- Basic handlers

### Phase 2: Transcription (Week 2-3)
- Whisper integration
- Model management
- Transcription commands
- Export handlers

### Phase 3: Advanced Features (Week 4-5)
- Speaker recognition/diarization
- Device management
- Real-time transcription

### Phase 4: Platform-Specific (Week 6+)
- Screen recording (most complex)
- Platform-specific optimizations
- Testing on all platforms

## Testing Strategy

1. **Unit Tests**: Test each Rust command independently
2. **Integration Tests**: Test Tauri commands from TypeScript
3. **E2E Tests**: Test full workflows
4. **Platform Tests**: Test on macOS, Windows, Linux

## Resources

- [Tauri Command Documentation](https://tauri.app/develop/calling-rust/)
- [Tauri Events](https://tauri.app/develop/inter-process-communication/#events)
- [Tauri Plugins](https://tauri.app/plugin/)
- [whisper-rs](https://github.com/tazz4843/whisper-rs)
- [ONNX Runtime Rust](https://github.com/pykeio/ort)
