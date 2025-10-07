# Development Workflow Guide

Quick reference for daily development tasks.

## 🚀 Starting Development

### Option 1: Tauri Desktop App (Recommended)
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri dev
```

This starts:
- Vite dev server (React frontend) on http://localhost:5173
- Rust backend compilation
- Desktop window with hot reload

### Option 2: Web App Only
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm --filter web dev
```

Opens http://localhost:3000

## 🔧 Common Development Tasks

### Adding a New Tauri Command

1. **Create the command file:**
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app/apps/native/src-tauri
touch src/commands/my_feature_commands.rs
```

2. **Write the command:**
```rust
// src/commands/my_feature_commands.rs
use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
pub struct MyInput {
    pub value: String,
}

#[derive(Serialize)]
pub struct MyOutput {
    pub result: String,
}

#[tauri::command]
pub async fn my_command(input: MyInput) -> Result<MyOutput, String> {
    Ok(MyOutput {
        result: format!("Processed: {}", input.value)
    })
}
```

3. **Export in mod.rs:**
```rust
// src/commands/mod.rs
pub mod my_feature_commands;
pub use my_feature_commands::*;
```

4. **Register in lib.rs:**
```rust
// src/lib.rs
.invoke_handler(tauri::generate_handler![
    // ... existing commands
    my_command,
])
```

5. **Test Rust compilation:**
```bash
/Users/ahmadjalil/.cargo/bin/cargo check
```

6. **Use in React:**
```tsx
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('my_command', {
  input: { value: 'hello' }
});
console.log(result.result); // "Processed: hello"
```

### Adding a Rust Dependency

1. **Add to Cargo.toml:**
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app/apps/native/src-tauri
```

Edit `Cargo.toml`:
```toml
[dependencies]
# ... existing
reqwest = { version = "0.11", features = ["json"] }
```

2. **Download and compile:**
```bash
/Users/ahmadjalil/.cargo/bin/cargo build
```

3. **Use in code:**
```rust
use reqwest;

#[tauri::command]
pub async fn fetch_data(url: String) -> Result<String, String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    Ok(response)
}
```

### Adding a JavaScript/TypeScript Dependency

```bash
# For shared UI package
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm add react-query --filter @repo/ui

# For native app
/Users/ahmadjalil/Library/pnpm/pnpm add axios --filter native

# For web app
/Users/ahmadjalil/Library/pnpm/pnpm add zod --filter web
```

### Checking TypeScript Types

```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm check-types
```

### Cleaning Build Artifacts

```bash
# Clean everything
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm clean

# Clean just Rust
cd apps/native/src-tauri
/Users/ahmadjalil/.cargo/bin/cargo clean

# Clean just Node modules
rm -rf node_modules apps/*/node_modules packages/*/node_modules
/Users/ahmadjalil/Library/pnpm/pnpm install
```

## 🐛 Debugging

### Debug Rust Code

Add `println!` statements:
```rust
#[tauri::command]
pub async fn my_command() -> Result<String, String> {
    println!("Debug: Starting command");
    // Your code
    Ok("done".to_string())
}
```

Output appears in the terminal where you ran `tauri dev`.

### Debug React Code

Use browser DevTools:
- **macOS**: `Cmd+Option+I`
- **Windows/Linux**: `F12`

### View Rust Errors

Rust compilation errors show in terminal:
```bash
/Users/ahmadjalil/.cargo/bin/cargo check
```

### Test a Single Command

Create a test file:
```rust
// src/commands/my_feature_commands.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_my_command() {
        let input = MyInput { value: "test".to_string() };
        let result = my_command(input).await.unwrap();
        assert_eq!(result.result, "Processed: test");
    }
}
```

Run tests:
```bash
cd apps/native/src-tauri
/Users/ahmadjalil/.cargo/bin/cargo test
```

## 📦 Building for Production

### Desktop App

```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri build
```

Output locations:
- **macOS**: `apps/native/src-tauri/target/release/bundle/macos/`
- **Windows**: `apps/native/src-tauri/target/release/bundle/msi/`
- **Linux**: `apps/native/src-tauri/target/release/bundle/appimage/`

### Web App

```bash
/Users/ahmadjalil/Library/pnpm/pnpm --filter web build
```

Output: `apps/web/.next/`

## 🔍 Troubleshooting

### Issue: "Command not found: pnpm"

**Solution:**
```bash
export PNPM_HOME="/Users/ahmadjalil/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"
```

Or use full path:
```bash
/Users/ahmadjalil/Library/pnpm/pnpm [command]
```

### Issue: Rust compilation fails

**Solution:**
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app/apps/native/src-tauri
/Users/ahmadjalil/.cargo/bin/cargo clean
/Users/ahmadjalil/.cargo/bin/cargo check
```

### Issue: "invoke: command not defined"

**Solution:**
1. Check command is in `invoke_handler![]` in `lib.rs`
2. Check spelling matches exactly
3. Restart `tauri dev`

### Issue: Frontend can't connect to Tauri

**Solution:**
1. Check Vite is running: http://localhost:5173
2. Check `tauri.conf.json` has correct dev URL
3. Restart `tauri dev`

### Issue: Changes not reflected

**Solution:**
- **Rust changes**: Save file, Tauri will auto-rebuild
- **React changes**: Should hot reload automatically
- **Config changes**: Restart `tauri dev`

## 📋 Daily Workflow Checklist

Starting a new feature:
1. [ ] Create new command file in `src/commands/`
2. [ ] Export in `mod.rs`
3. [ ] Register in `lib.rs`
4. [ ] Run `cargo check` to verify compilation
5. [ ] Update frontend to call new command
6. [ ] Test in dev mode
7. [ ] Add error handling
8. [ ] Add logging
9. [ ] Update documentation

## 🎯 Code Style

### Rust (use rustfmt)
```bash
cd apps/native/src-tauri
/Users/ahmadjalil/.cargo/bin/cargo fmt
```

### TypeScript (use prettier)
```bash
cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app
npx prettier --write "**/*.{ts,tsx,js,jsx}"
```

## 🚀 Performance Tips

1. **Use `--release` for performance testing:**
```bash
/Users/ahmadjalil/Library/pnpm/pnpm --filter native tauri build --debug
```

2. **Profile Rust code:**
```bash
cd apps/native/src-tauri
/Users/ahmadjalil/.cargo/bin/cargo build --release
```

3. **Minimize bundle size:**
- Enable `strip = true` in `Cargo.toml` `[profile.release]`
- Use `opt-level = "z"` for size optimization

## 🔗 Quick Links

- **Project Root**: `/Users/ahmadjalil/Github/WhisperDesk/tauri-app`
- **Tauri Source**: `apps/native/src-tauri/src/`
- **React Source**: `apps/native/src/`
- **Shared UI**: `packages/ui/src/`
- **Cargo.toml**: `apps/native/src-tauri/Cargo.toml`
- **Tauri Config**: `apps/native/src-tauri/tauri.conf.json`

---

Keep this file open in a tab for quick reference! 🚀
