# WhisperDesk Tauri - Quick Start Guide

## ✅ What's Been Set Up

Your Tauri migration is ready! Here's what we've built:

### 1. **Monorepo Structure** ✅
```
tauri-app/
├── apps/
│   ├── web/          # Next.js (for API & web version)
│   └── native/       # Tauri desktop app
├── packages/
│   ├── ui/           # Shared React components
│   └── typescript-config/
└── Configuration files (turbo.json, pnpm-workspace.yaml, etc.)
```

### 2. **Tauri Commands** ✅
Created example Rust commands that mirror your Electron IPC handlers:

**App Commands** (`apps/native/src-tauri/src/commands/app_commands.rs`):
- `get_app_info()` - Get app version and platform info
- `get_platform()` - Get OS platform
- `quit_app()` - Quit application
- `restart_app()` - Restart application

**Settings Commands** (`apps/native/src-tauri/src/commands/settings_commands.rs`):
- `get_setting()` - Get a setting value
- `set_setting()` - Set a setting value
- `get_all_settings()` - Get all settings
- `delete_setting()` - Delete a setting
- `reset_settings()` - Reset all settings

**Transcription Commands** (`apps/native/src-tauri/src/commands/transcription_commands.rs`):
- `start_transcription()` - Start transcription (placeholder)
- `stop_transcription()` - Stop transcription
- `get_transcription_status()` - Get status
- `list_models()` - List available models

### 3. **Documentation** ✅
- `README.md` - Complete migration overview
- `MIGRATION_MAPPING.md` - Maps all Electron IPC handlers to Tauri commands
- `QUICKSTART.md` - This file!

## 🚀 Get Started

### Prerequisites Check
```bash
# Check Node.js
node --version  # Should be v20+

# Check Rust (already installed)
/Users/ahmadjalil/.cargo/bin/cargo --version

# Check pnpm (already installed)
/Users/ahmadjalil/Library/pnpm/pnpm --version
```

### Install Dependencies
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm install
```

### Run Development

#### Option 1: Tauri Desktop App
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app

# Run the native desktop app
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri dev
```

This will:
1. Start the Vite dev server (React frontend)
2. Compile Rust code
3. Launch the desktop app window

#### Option 2: Next.js Web App
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app

# Run the web app
/Users/ahmadjalil/Library/pnpm/pnpm --filter web dev
```

Then open http://localhost:3000

### Test Tauri Commands

The native app includes a "Greet" example. To test your new commands:

1. **From React (Frontend)**:
```tsx
import { invoke } from '@tauri-apps/api/core';

// Get app info
const info = await invoke('get_app_info');
console.log(info); // { version: "0.1.0", name: "WhisperDesk", platform: "macos" }

// Get a setting
const value = await invoke('get_setting', { key: 'theme' });
console.log(value);

// Start transcription (placeholder)
const result = await invoke('start_transcription', {
  options: {
    model: 'tiny',
    language: 'en',
    task: 'transcribe'
  }
});
```

2. **Test with Browser DevTools**:
- Open the app
- Press `Cmd+Option+I` (macOS) to open DevTools
- Run commands in console

### Build for Production

```bash
# Build the desktop app
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri build
```

Output will be in: `apps/native/src-tauri/target/release/bundle/`

## 📋 Next Steps (Migration Tasks)

### Phase 1: Core Infrastructure (Week 1)
- [ ] Add tauri-plugin-store for persistent settings
- [ ] Add tauri-plugin-dialog for file dialogs
- [ ] Add tauri-plugin-fs for file system operations
- [ ] Implement proper error handling in all commands
- [ ] Add logging with `log` and `env_logger` crates

### Phase 2: Transcription (Week 2-3)
- [ ] Integrate whisper.cpp or whisper-rs
- [ ] Port model management logic
- [ ] Implement file-based transcription
- [ ] Add progress tracking with Tauri events
- [ ] Port export functionality (TXT, JSON, SRT, VTT)

### Phase 3: Advanced Features (Week 4-5)
- [ ] Port speaker recognition/diarization
  - Research ONNX Runtime for Rust (`ort` crate)
  - Port embedding models
- [ ] Implement device management
  - Use `cpal` for audio devices
- [ ] Add real-time transcription
  - WebSocket or Tauri events for streaming

### Phase 4: Screen Recording (Week 6+)
This is the most complex part:

**macOS**:
- Use `scap` crate or write custom ScreenCaptureKit bindings
- Reference: https://github.com/svtlabs/screencapturekit-rs

**Windows**:
- Use `windows-capture` or similar
- Reference: https://github.com/NiiightmareXD/windows-capture

**Linux**:
- PipeWire/FFmpeg integration
- More research needed

### Phase 5: UI Migration
- [ ] Copy components from `src/renderer/whisperdesk-ui` to `packages/ui`
- [ ] Update components to use Tauri's `invoke()` instead of Electron IPC
- [ ] Test all UI flows

## 🔧 Common Tasks

### Add a New Tauri Plugin
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app/apps/native
/Users/ahmadjalil/Library/pnpm/pnpm add @tauri-apps/plugin-store
```

Then add to `src-tauri/Cargo.toml`:
```toml
[dependencies]
tauri-plugin-store = "2"
```

### Add a Rust Dependency
Edit `apps/native/src-tauri/Cargo.toml`:
```toml
[dependencies]
reqwest = { version = "0.11", features = ["json"] }
tokio = { version = "1", features = ["full"] }
```

### Create a New Tauri Command
1. Create file in `src-tauri/src/commands/`
2. Add module to `src-tauri/src/commands/mod.rs`
3. Import and register in `src-tauri/src/lib.rs`:
```rust
use commands::my_new_command;

.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_new_command,
])
```

### Debug Rust Code
Add this to see println! output:
```bash
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri dev
```

Console output will show in the terminal (not browser DevTools).

## 📚 Key Differences: Electron vs Tauri

| Aspect | Electron | Tauri |
|--------|----------|-------|
| **Language** | JavaScript (Node.js) | Rust |
| **IPC Call** | `ipcRenderer.invoke('channel', data)` | `invoke('command', { data })` |
| **Handler** | `ipcMain.handle('channel', async (e, data) => {})` | `#[tauri::command] async fn command(data: Type) -> Result<T, E>` |
| **State** | Global variables or stores | `tauri::State<T>` |
| **Events** | `webContents.send('event', data)` | `app.emit('event', data)` |
| **File System** | `fs`, `path` | `std::fs`, `tauri::api::fs` |
| **Window** | `BrowserWindow` | `WebviewWindow` |

## 🆘 Troubleshooting

### Rust compilation errors
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app/apps/native/src-tauri
/Users/ahmadjalil/.cargo/bin/cargo clean
/Users/ahmadjalil/.cargo/bin/cargo check
```

### pnpm command not found
Use full path:
```bash
/Users/ahmadjalil/Library/pnpm/pnpm [command]
```

Or add to PATH in `~/.zshrc`:
```bash
export PNPM_HOME="/Users/ahmadjalil/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"
```

### Tauri dev server not starting
Check Vite is running first:
```bash
cd apps/native
npm run dev  # Should start on http://localhost:5173
```

## 🎯 Success Metrics

You'll know the migration is working when:

1. ✅ Tauri app compiles and runs
2. ✅ You can invoke Rust commands from React
3. ✅ Settings persist between app restarts (after adding plugin-store)
4. ✅ File transcription works (after porting whisper integration)
5. ✅ Screen recording works (after porting CapRecorder logic)
6. ✅ All existing features work in Tauri version
7. ✅ Bundle size is < 50MB (vs ~150MB for Electron)

## 📞 Need Help?

- [Tauri Discord](https://discord.gg/tauri)
- [Tauri Documentation](https://tauri.app/)
- [Tauri Examples](https://github.com/tauri-apps/tauri/tree/dev/examples)
- Check `MIGRATION_MAPPING.md` for specific handler conversions

---

**You're all set!** 🎉 Start with the Phase 1 tasks and work your way through the migration systematically.
