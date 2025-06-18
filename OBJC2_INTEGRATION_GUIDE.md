# objc2 ScreenCaptureKit Integration Guide

This guide shows how to integrate objc2 Rust bindings for direct ScreenCaptureKit access in your WhisperDesk Electron app.

## 🦀 Overview

The objc2 ScreenCaptureKit integration provides:
- **Direct API Access**: No JavaScript bridge overhead
- **Maximum Performance**: Zero-copy operations where possible
- **Type Safety**: Rust's memory safety guarantees
- **Native Features**: Access to all ScreenCaptureKit capabilities
- **Future-Proof**: Easy to extend with new Apple frameworks

## 📁 Directory Structure

```
WhisperDesk/
├── native/
│   ├── whisperdesk-screencapturekit/
│   │   ├── Cargo.toml
│   │   ├── build.rs
│   │   └── src/
│   │       └── lib.rs
│   ├── build.sh
│   └── build-universal.sh
├── src/main/screen-recorder/recorders/
│   └── Objc2ScreenCaptureRecorder.js
├── scripts/
│   └── test-objc2-screencapturekit.js
└── package.json (updated with objc2 scripts)
```

## 🚀 Setup Steps

### 1. Prerequisites

Ensure you have the required tools installed:

```bash
# Install Rust if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Add macOS targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Install required tools
cargo install napi-cli
```

### 2. Verify macOS Version

```bash
# Check macOS version (requires 13.0+)
sw_vers -productVersion
```

ScreenCaptureKit requires macOS 13.0 (Ventura) or later.

### 3. Build the Native Module

```bash
# Build for current architecture
npm run build:native

# Or build universal binary (Intel + Apple Silicon)
npm run build:native:universal
```

### 4. Test the Integration

```bash
# Run the comprehensive test suite
npm run test:objc2
```

### 5. Clean Build (if needed)

```bash
# Clean native build artifacts
npm run clean:native
```

## 🔧 Available NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run build:native` | Build for current architecture |
| `npm run build:native:universal` | Build universal binary (Intel + Apple Silicon) |
| `npm run clean:native` | Clean native build artifacts |
| `npm run setup:objc2` | Build and test objc2 integration |
| `npm run test:objc2` | Test objc2 ScreenCaptureKit functionality |

## 🎯 Integration Status

The objc2 ScreenCaptureKit recorder is automatically integrated into WhisperDesk's platform-aware recording system:

1. **Highest Priority**: objc2 ScreenCaptureKit (macOS 13.0+)
2. **Second Priority**: ScreenCaptureKit Node.js
3. **Fallback**: Browser-based recording

## ✅ Features

### Direct ScreenCaptureKit API Access
- Native screen enumeration
- Window capture with metadata
- Audio device detection
- Real-time configuration

### Performance Optimizations
- Zero-copy memory operations
- Native pixel format handling
- Efficient audio processing
- Minimal JavaScript overhead

### Advanced Capabilities
- Custom pixel formats and color spaces
- Advanced audio configuration
- Multi-source audio merging
- Built-in error handling

## 🧪 Testing

### Basic Functionality Test

```bash
npm run test:objc2
```

This will test:
- ✅ Native module loading
- ✅ Screen enumeration
- ✅ Audio device detection
- ✅ Permission handling
- ✅ Status reporting

### Manual Integration Test

```javascript
const Objc2ScreenCaptureRecorder = require('./src/main/screen-recorder/recorders/Objc2ScreenCaptureRecorder');

async function testRecording() {
  const recorder = new Objc2ScreenCaptureRecorder();
  
  // Initialize
  await recorder.initialize();
  
  // Get available screens
  const screens = await recorder.getAvailableScreens();
  console.log('Available screens:', screens);
  
  // Start recording
  const result = await recorder.startRecording({
    screenId: screens.screens[0].id,
    outputPath: './test-recording.mov',
    fps: 30,
    showCursor: true,
    includeMicrophone: true
  });
  
  console.log('Recording started:', result);
  
  // Stop after 5 seconds
  setTimeout(async () => {
    const stopResult = await recorder.stopRecording();
    console.log('Recording stopped:', stopResult);
    recorder.destroy();
  }, 5000);
}

testRecording().catch(console.error);
```

## 🔍 Troubleshooting

### Build Issues

**Error: "ScreenCaptureKit requires macOS 13.0 or later"**
```bash
# Check your macOS version
sw_vers -productVersion
# Update macOS if needed
```

**Error: "Rust not found"**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

**Error: "napi-cli not found"**
```bash
# Install napi-cli
cargo install napi-cli
```

### Runtime Issues

**Error: "Native objc2 module not found"**
- Ensure you've run `npm run build:native`
- Check that the `.node` file exists in `native/target/release/`

**Error: "Failed to get shareable content"**
- Grant screen recording permissions in System Preferences
- Restart the application after granting permissions

**Error: "No screens available"**
- Check System Preferences > Security & Privacy > Screen Recording
- Ensure your application has permission

### Permission Issues

```bash
# Check current permissions
npm run test:objc2

# Grant permissions manually:
# System Preferences > Security & Privacy > Screen Recording
# Add your Electron app to the list
```

## 📊 Performance Comparison

| Method | Performance | Features | Compatibility |
|--------|------------|----------|---------------|
| objc2 ScreenCaptureKit | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | macOS 13.0+ |
| ScreenCaptureKit Node.js | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | macOS 13.0+ |
| Browser Fallback | ⭐⭐ | ⭐⭐ | All platforms |

## 🔮 Future Extensions

The objc2 integration can be extended to support other Apple frameworks:

```toml
# Add to Cargo.toml
objc2-core-audio = "0.2"
objc2-av-foundation = "0.2"
objc2-metal = "0.2"
objc2-vision = "0.2"
```

This creates a foundation for accessing any Apple framework from your Electron app with maximum performance and control.

## 🛠️ Development

### Adding New Features

1. **Extend the Rust Library** (`native/whisperdesk-screencapturekit/src/lib.rs`)
2. **Update JavaScript Wrapper** (`src/main/screen-recorder/recorders/Objc2ScreenCaptureRecorder.js`)
3. **Add Tests** (`scripts/test-objc2-screencapturekit.js`)
4. **Update Documentation**

### Building for Production

```bash
# Build universal binary for distribution
npm run build:native:universal

# Verify the binary
lipo -info native/target/release/libwhisperdesk_screencapturekit.node
```

The universal binary will work on both Intel and Apple Silicon Macs.

## 📋 Deployment Checklist

- [ ] macOS 13.0+ requirement documented
- [ ] Universal binary built for production
- [ ] Screen recording permissions configured
- [ ] Error handling tested
- [ ] Fallback methods available
- [ ] Performance benchmarks completed

## 🎉 Benefits Summary

✅ **Performance**: Direct API access with zero-copy operations  
✅ **Control**: Access to all ScreenCaptureKit features  
✅ **Reliability**: Type-safe Rust bindings with memory safety  
✅ **Future-Proof**: Easy to add new Apple framework bindings  
✅ **Integration**: Seamlessly integrated into WhisperDesk's platform-aware system 