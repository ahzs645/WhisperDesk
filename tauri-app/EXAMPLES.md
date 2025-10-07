# Code Comparison: Electron → Tauri

This document shows real examples from your WhisperDesk codebase and how they translate to Tauri.

## Example 1: Get App Information

### Electron (Before)

**Backend (IPC Handler):**
```javascript
// src/main/ipc-handlers/app-handlers.js
const { ipcMain, app } = require('electron');

ipcMain.handle('app:getInfo', async () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform
  };
});
```

**Frontend (React):**
```javascript
// src/renderer/whisperdesk-ui/src/App.jsx
const getAppInfo = async () => {
  const info = await window.electron.ipcRenderer.invoke('app:getInfo');
  console.log(info);
};
```

### Tauri (After)

**Backend (Rust Command):**
```rust
// apps/native/src-tauri/src/commands/app_commands.rs
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct AppInfo {
    pub version: String,
    pub name: String,
    pub platform: String,
}

#[tauri::command]
pub async fn get_app_info() -> Result<AppInfo, String> {
    Ok(AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        name: "WhisperDesk".to_string(),
        platform: std::env::consts::OS.to_string(),
    })
}
```

**Frontend (React):**
```tsx
// packages/ui/src/components/AppInfo.tsx
import { invoke } from '@tauri-apps/api/core';

const getAppInfo = async () => {
  const info = await invoke('get_app_info');
  console.log(info);
};
```

---

## Example 2: Settings Management

### Electron (Before)

**Backend:**
```javascript
// src/main/ipc-handlers/settings-handlers.js
const Store = require('electron-store');
const store = new Store();

ipcMain.handle('settings:get', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('settings:set', async (event, key, value) => {
  store.set(key, value);
  return true;
});
```

**Frontend:**
```javascript
// Get setting
const theme = await window.electron.ipcRenderer.invoke('settings:get', 'theme');

// Set setting
await window.electron.ipcRenderer.invoke('settings:set', 'theme', 'dark');
```

### Tauri (After)

**Backend:**
```rust
// apps/native/src-tauri/src/commands/settings_commands.rs
use tauri::State;
use serde_json::Value;
use std::sync::Mutex;

pub struct SettingsState {
    settings: Mutex<std::collections::HashMap<String, Value>>,
}

#[tauri::command]
pub async fn get_setting(
    key: String,
    state: State<'_, SettingsState>,
) -> Result<Option<Value>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.get(&key).cloned())
}

#[tauri::command]
pub async fn set_setting(
    key: String,
    value: Value,
    state: State<'_, SettingsState>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.insert(key, value);
    Ok(())
}
```

**Frontend:**
```tsx
import { invoke } from '@tauri-apps/api/core';

// Get setting
const theme = await invoke('get_setting', { key: 'theme' });

// Set setting
await invoke('set_setting', { key: 'theme', value: 'dark' });
```

---

## Example 3: File Operations

### Electron (Before)

**Backend:**
```javascript
// src/main/ipc-handlers/file-handlers.js
const { dialog } = require('electron');
const fs = require('fs').promises;

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'mp4'] }]
  });

  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('file:read', async (event, path) => {
  const content = await fs.readFile(path, 'utf-8');
  return content;
});
```

**Frontend:**
```javascript
const filePath = await window.electron.ipcRenderer.invoke('file:open');
if (filePath) {
  const content = await window.electron.ipcRenderer.invoke('file:read', filePath);
}
```

### Tauri (After)

**Backend:**
```rust
// apps/native/src-tauri/src/commands/file_commands.rs
use tauri::api::dialog::blocking::FileDialogBuilder;
use std::fs;

#[tauri::command]
pub async fn open_file() -> Result<Option<String>, String> {
    let file = FileDialogBuilder::new()
        .add_filter("Audio", &["mp3", "wav", "mp4"])
        .pick_file();

    Ok(file.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}
```

**Frontend:**
```tsx
import { invoke } from '@tauri-apps/api/core';

const filePath = await invoke('open_file');
if (filePath) {
  const content = await invoke('read_file', { path: filePath });
}
```

---

## Example 4: Transcription Service

### Electron (Before)

**Backend:**
```javascript
// src/main/services/transcription-service-native.js
const { spawn } = require('child_process');
const path = require('path');

class TranscriptionService {
  async startTranscription(options) {
    const whisperPath = path.join(__dirname, '../../binaries/whisper-cli');
    const modelPath = path.join(__dirname, '../../models', `ggml-${options.model}.bin`);

    const args = [
      '-m', modelPath,
      '-f', options.audioPath,
      '-l', options.language || 'auto'
    ];

    return new Promise((resolve, reject) => {
      const process = spawn(whisperPath, args);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseOutput(output));
        } else {
          reject(new Error('Transcription failed'));
        }
      });
    });
  }
}
```

**Frontend:**
```javascript
const result = await window.electron.ipcRenderer.invoke('transcription:start', {
  model: 'tiny',
  audioPath: '/path/to/audio.wav',
  language: 'en'
});
```

### Tauri (After)

**Backend:**
```rust
// apps/native/src-tauri/src/commands/transcription_commands.rs
use std::process::Command;
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
pub struct TranscriptionOptions {
    model: String,
    audio_path: String,
    language: Option<String>,
}

#[derive(Serialize)]
pub struct TranscriptionResult {
    text: String,
    segments: Vec<Segment>,
}

#[derive(Serialize)]
pub struct Segment {
    start: f64,
    end: f64,
    text: String,
}

#[tauri::command]
pub async fn start_transcription(
    options: TranscriptionOptions,
    app: tauri::AppHandle,
) -> Result<TranscriptionResult, String> {
    let resource_path = app.path_resolver()
        .resource_dir()
        .ok_or("Failed to get resource dir")?;

    let whisper_path = resource_path.join("binaries/whisper-cli");
    let model_path = resource_path.join(format!("models/ggml-{}.bin", options.model));

    let output = Command::new(whisper_path)
        .arg("-m").arg(model_path)
        .arg("-f").arg(&options.audio_path)
        .arg("-l").arg(options.language.unwrap_or("auto".to_string()))
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Parse output and return result
        Ok(parse_output(&stdout))
    } else {
        Err("Transcription failed".to_string())
    }
}

fn parse_output(output: &str) -> TranscriptionResult {
    // Implementation...
    TranscriptionResult {
        text: output.to_string(),
        segments: vec![],
    }
}
```

**Frontend:**
```tsx
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('start_transcription', {
  options: {
    model: 'tiny',
    audioPath: '/path/to/audio.wav',
    language: 'en'
  }
});
```

---

## Example 5: Window Events

### Electron (Before)

**Backend:**
```javascript
// src/main/managers/window-manager.js
const mainWindow = new BrowserWindow({...});

mainWindow.webContents.on('did-finish-load', () => {
  mainWindow.webContents.send('window:loaded');
});

// Send event to renderer
mainWindow.webContents.send('transcription:progress', { progress: 50 });
```

**Frontend:**
```javascript
window.electron.ipcRenderer.on('window:loaded', () => {
  console.log('Window loaded');
});

window.electron.ipcRenderer.on('transcription:progress', (event, data) => {
  console.log('Progress:', data.progress);
});
```

### Tauri (After)

**Backend:**
```rust
// apps/native/src-tauri/src/lib.rs
use tauri::{Manager, Window};

#[tauri::command]
async fn start_long_task(window: Window) -> Result<(), String> {
    // Emit events during task
    window.emit("transcription:progress", json!({ "progress": 25 }))
        .map_err(|e| e.to_string())?;

    // Do work...

    window.emit("transcription:progress", json!({ "progress": 50 }))
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Frontend:**
```tsx
import { listen } from '@tauri-apps/api/event';

// Listen for events
const unlisten = await listen('transcription:progress', (event) => {
  console.log('Progress:', event.payload.progress);
});

// Don't forget to cleanup
unlisten();
```

---

## Example 6: Model Download with Progress

### Electron (Before)

**Backend:**
```javascript
// src/main/services/model-manager.js
const axios = require('axios');
const fs = require('fs');

async function downloadModel(modelName, window) {
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`;
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream'
  });

  const totalLength = response.headers['content-length'];
  let downloaded = 0;

  response.data.on('data', (chunk) => {
    downloaded += chunk.length;
    const progress = (downloaded / totalLength) * 100;
    window.webContents.send('model:download:progress', { progress });
  });

  const writer = fs.createWriteStream(`models/ggml-${modelName}.bin`);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
```

### Tauri (After)

**Backend:**
```rust
// apps/native/src-tauri/src/commands/model_commands.rs
use reqwest;
use std::io::Write;
use tauri::{Manager, Window};

#[tauri::command]
pub async fn download_model(
    model_name: String,
    window: Window,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let url = format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{}.bin",
        model_name
    );

    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);

    let models_dir = app.path_resolver()
        .resource_dir()
        .ok_or("Failed to get resource dir")?
        .join("models");

    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

    let file_path = models_dir.join(format!("ggml-{}.bin", model_name));
    let mut file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    use futures_util::StreamExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let progress = (downloaded as f64 / total_size as f64) * 100.0;
        window.emit("model:download:progress", json!({ "progress": progress }))
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
```

**Cargo.toml additions:**
```toml
[dependencies]
reqwest = { version = "0.11", features = ["stream"] }
futures-util = "0.3"
```

**Frontend:**
```tsx
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

const downloadModel = async (modelName: string) => {
  const unlisten = await listen('model:download:progress', (event) => {
    console.log('Progress:', event.payload.progress, '%');
    // Update UI progress bar
  });

  try {
    await invoke('download_model', { modelName });
    console.log('Download complete!');
  } finally {
    unlisten();
  }
};
```

---

## Key Takeaways

1. **Type Safety**: Rust's type system catches errors at compile time
2. **Performance**: Rust is faster and uses less memory
3. **Bundle Size**: Tauri apps are ~10x smaller than Electron
4. **Security**: Rust prevents many common vulnerabilities
5. **Modern Architecture**: Better separation of concerns

## Migration Checklist for Each Handler

When migrating an Electron IPC handler:

- [ ] Create corresponding Rust struct for request/response types
- [ ] Implement `#[tauri::command]` function
- [ ] Add to `invoke_handler![]` in `lib.rs`
- [ ] Update frontend to use `invoke()` instead of `ipcRenderer.invoke()`
- [ ] Test the command works
- [ ] Add error handling
- [ ] Add logging
- [ ] Document the command

Happy migrating! 🚀
