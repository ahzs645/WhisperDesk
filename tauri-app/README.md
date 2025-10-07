# WhisperDesk Tauri Migration

This directory contains the **Tauri v2 + Next.js** migration of WhisperDesk from Electron.

## 🏗️ Monorepo Structure

```
tauri-app/
├── apps/
│   ├── web/          # Next.js web app (API backend + web frontend)
│   └── native/       # Tauri desktop app (macOS, Windows, Linux)
├── packages/
│   ├── ui/           # Shared UI components (React + Tailwind + shadcn)
│   └── typescript-config/  # Shared TypeScript configurations
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 📋 Migration Status

### ✅ Completed
- [x] Monorepo setup with Turbo Repo
- [x] Next.js web app initialized
- [x] Tauri v2 native app initialized
- [x] Shared UI package with Tailwind CSS
- [x] pnpm workspace configuration
- [x] Rust toolchain installed

### 🚧 In Progress
- [ ] Migrate Electron IPC handlers to Tauri commands
- [ ] Port native modules (CapRecorder, Whisper) to Rust
- [ ] Migrate UI components from existing app
- [ ] Configure build and packaging

## 🔄 Electron vs Tauri Comparison

| Feature | Electron | Tauri |
|---------|----------|-------|
| **Backend** | Node.js (main process) | Rust |
| **IPC** | `ipcMain.handle()` / `ipcRenderer.invoke()` | `#[tauri::command]` / `invoke()` |
| **Window** | BrowserWindow | WebviewWindow |
| **Store** | electron-store | tauri-plugin-store |
| **Bundle Size** | ~150MB (includes Chromium) | ~15MB (uses system webview) |
| **Performance** | Heavy | Lightweight |

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Rust (installed automatically)
- pnpm 10+ (installed automatically)

### Installation

```bash
# From the tauri-app directory
/Users/ahmadjalil/Library/pnpm/pnpm install
```

### Development

```bash
# Run Next.js web app
/Users/ahmadjalil/Library/pnpm/pnpm --filter web dev

# Run Tauri desktop app
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri dev
```

### Build

```bash
# Build Next.js web app
/Users/ahmadjalil/Library/pnpm/pnpm --filter web build

# Build Tauri desktop app
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri build
```

## 📝 Migration Guide

### 1. IPC Handler Migration

**Electron:**
```javascript
// src/main/ipc-handlers/transcription-handlers.js
ipcMain.handle('transcription:start', async (event, options) => {
  // Handle transcription
  return result;
});
```

**Tauri:**
```rust
// apps/native/src-tauri/src/main.rs
#[tauri::command]
async fn start_transcription(options: TranscriptionOptions) -> Result<String, String> {
  // Handle transcription
  Ok(result)
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![start_transcription])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

**Frontend (React):**
```tsx
// Before (Electron)
const result = await window.electron.ipcRenderer.invoke('transcription:start', options);

// After (Tauri)
import { invoke } from '@tauri-apps/api/core';
const result = await invoke('start_transcription', { options });
```

### 2. File System Operations

**Electron:**
```javascript
const fs = require('fs');
const path = require('path');
```

**Tauri:**
```rust
use tauri::api::path;
use std::fs;
```

### 3. Screen Recording

**Electron (CapRecorder):**
```javascript
const { CapRecorder } = require('@firstform/caprecorder');
```

**Tauri (Will use Rust crates):**
```rust
// To be implemented using:
// - scap for screen capture on macOS
// - windows-capture for Windows
// - Custom solution for Linux
```

## 🎯 Next Steps

1. **Map all Electron IPC handlers** to Tauri commands
2. **Port native modules**:
   - CapRecorder → Rust screen capture
   - Whisper CLI integration
   - Diarization service
3. **Migrate React components** from `src/renderer/whisperdesk-ui` to `packages/ui`
4. **Configure Tauri permissions** for file system, screen recording, microphone
5. **Setup CI/CD** for multi-platform builds

## 📚 Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri + Next.js Guide](https://tauri.app/guides/frontend/nextjs)
- [Electron to Tauri Migration](https://tauri.app/guides/migrate/from-electron)
- [Turbo Repo](https://turbo.build/repo)

## 🤝 Key Decisions

1. **Why monorepo?** Share components between web and desktop, easier maintenance
2. **Why Next.js?** API routes for backend, server-side rendering, great DX
3. **Why Tauri?** Smaller bundle size, better performance, modern architecture
4. **Why pnpm?** Fast, efficient, workspace support

## 📄 License

MIT - Same as the original WhisperDesk project
