# WhisperDesk Enhanced - Native Implementation

A powerful desktop transcription application powered by native whisper.cpp with persistent state management and real-time progress feedback.

## 🚀 Quick Start

### Automated Setup (Recommended)

**Linux/macOS:**
```bash
git clone <your-repo-url>
cd WhisperDesk
./setup.sh
```

**Windows (PowerShell):**
```powershell
git clone <your-repo-url>
cd WhisperDesk
.\setup.ps1
```

### Manual Setup

1. **Install Dependencies**
```bash
npm install
cd src/renderer/whisperdesk-ui
npm install --legacy-peer-deps
cd ../../..
```

2. **Set up Whisper Binary**
```bash
# Option A: Use included binary (Linux only)
chmod +x binaries/whisper

# Option B: Build from source (all platforms)
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
cd /tmp/whisper.cpp
make -j$(nproc)
cp build/bin/whisper-cli ./binaries/whisper
chmod +x ./binaries/whisper
```

3. **Download a Model**
```bash
mkdir -p ~/.config/whisperdesk-enhanced/models
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin \
  -O ~/.config/whisperdesk-enhanced/models/ggml-tiny.bin
```

## 🎯 Running the Application

### Electron App (Recommended)
```bash
npm run dev
```
**Features:** Full native integration, model downloads, persistent state, real-time progress

### Web Interface with Native Backend
```bash
npm run web
# Opens http://localhost:3000 with live transcription
```
**Features:** Web-based UI with native whisper.cpp backend

### API Server Only
```bash
npm run server
# Server runs on http://localhost:3001
```

## 🧪 Testing

```bash
# Test native services
npm run test:native

# Test transcription with audio file
npm run test:transcription

# Complete system test
./quick_test_script.sh
```

## ✨ New Features & Fixes (v2.1.0)

### 🎉 Enhanced User Experience
- ✅ **Persistent State Management**: File selections and transcription results survive tab switches
- ✅ **Real-time Progress Feedback**: Live progress bars for transcription and model downloads
- ✅ **Smart Toast Notifications**: Single loading toast with updates, no spam
- ✅ **Enhanced Model Marketplace**: Real-time download progress with speed indicators

### 🔧 Technical Improvements
- ✅ **Fixed Event Forwarding**: Proper IPC communication between main and renderer processes
- ✅ **Improved VTT Parsing**: Better whisper.cpp output handling with completion events
- ✅ **Memory Management**: Proper event handler cleanup to prevent memory leaks
- ✅ **Cross-tab State**: Global app state that persists across tab navigation

### 🎵 Better Transcription Experience
- ✅ **One-Click Transcription**: Select file → Start → View results seamlessly
- ✅ **Session Persistence**: Switch tabs without losing your work
- ✅ **Progress Tracking**: Real-time updates without need to switch tabs
- ✅ **Completion Feedback**: Clear success notifications and result display

## 📋 Available Scripts

- `npm run dev` - Start Electron app in development
- `npm run web` - Start web interface with API server
- `npm run server` - Start transcription API server only
- `npm run test:native` - Test native services
- `npm run test:transcription` - Test with audio file
- `npm run build` - Build for production
- `./setup.sh` / `.\setup.ps1` - Automated setup scripts

## 🔧 Features

✅ **Native Performance** - No Python dependencies  
✅ **Cross-Platform** - Windows, macOS, Linux support  
✅ **Model Marketplace** - Download models with real-time progress tracking  
✅ **Live Transcription** - Real-time audio processing with progress feedback  
✅ **Persistent State** - Work continues seamlessly across tab switches  
✅ **Web Interface** - Use as web app or Electron app  
✅ **Multiple Formats** - Support for various audio/video files  
✅ **Smart Notifications** - Clean, non-spammy progress updates  

## 🎮 User Guide

### Getting Started
1. **Launch the app**: `npm run dev`
2. **Download a model**: Go to Models tab → Download "Whisper Tiny" (39MB)
3. **Select audio file**: Transcribe tab → Drop file or click "Select Audio File"
4. **Start transcription**: Click "Start Transcription"
5. **View results**: Text appears in real-time, persists across tab switches

### Best Practices
- **Start with Tiny model**: Fast downloads and good for testing
- **Use drag & drop**: Easiest way to select files
- **Monitor progress**: Stay in tab or switch freely - progress persists
- **Check History tab**: View current session and manage files

## 📖 Platform-Specific Setup

For detailed platform-specific instructions:

- 🐧 **Linux**: Use the commands above or run `./setup.sh`
- 🍎 **macOS**: [SETUP_MACOS.md](SETUP_MACOS.md)
- 🪟 **Windows**: [SETUP_WINDOWS.md](SETUP_WINDOWS.md)
- 🌍 **All Platforms**: [PLATFORM_GUIDE.md](PLATFORM_GUIDE.md)

## 🐛 Troubleshooting

### Common Issues & Solutions

**🔄 "No progress shown during transcription"**
- ✅ **Fixed in v2.1.0**: Real-time progress now works correctly
- Solution: Update to latest version with fixed event handlers

**📱 "State lost when switching tabs"**
- ✅ **Fixed in v2.1.0**: Persistent state management implemented
- Solution: Update App.jsx and components with persistent state context

**🔔 "Too many notification popups"**
- ✅ **Fixed in v2.1.0**: Smart toast notifications with single loading toast
- Solution: Update TranscriptionTab-Electron.jsx with fixed toast handling

**📥 "Model download progress not visible"**
- ✅ **Fixed in v2.1.0**: Real-time download progress in Models tab
- Solution: Update ModelMarketplace component with event handlers

### Legacy Issues

**Binary download fails (404 errors):**
- Use the included binary: `chmod +x binaries/whisper`
- Or build from source (see setup instructions above)

**Electron app won't start:**
- Build the renderer: `cd src/renderer/whisperdesk-ui && npm run build`
- Check that dist folder exists

**Web interface connection issues:**
- Make sure API server is running on port 3001
- Verify whisper binary is executable
- Check that models are downloaded

## 🔧 Fix Scripts

If you encounter issues, use these automated fix scripts:

```bash
# Complete setup and verification
chmod +x quick_test_script.sh
./quick_test_script.sh

# Fix toast spam and persistent state
chmod +x quick_fix_script.sh
./quick_fix_script.sh

# Fix model download progress
chmod +x model_interface_fix_script.sh
./model_interface_fix_script.sh

# Verify app state implementation
chmod +x verify_app_state_script.sh
./verify_app_state_script.sh
```

## 📁 Project Structure

```
WhisperDesk/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── services/
│   │   │   ├── binary-manager.js      # Manages whisper.cpp binaries
│   │   │   ├── transcription-service-native.js  # Native transcription service
│   │   │   └── providers/
│   │   │       └── native-whisper-provider.js   # Native whisper provider (FIXED)
│   │   └── main.js                    # Updated with proper event forwarding (FIXED)
│   └── renderer/                      # React frontend
│       └── whisperdesk-ui/
│           ├── src/App.jsx            # Persistent state management (UPDATED)
│           └── components/
│               ├── TranscriptionTab-Electron.jsx  # Fixed toast handling
│               └── ModelMarketplace-Fixed.jsx     # Real-time progress
├── binaries/
│   └── whisper                        # whisper.cpp binary
├── scripts/
│   └── download-binaries.js           # Binary download script
├── transcription-server.js            # API server for web interface
├── test-native-services.js            # Test native services
├── test-transcription.js              # Test transcription with audio
├── setup.sh                           # Linux/macOS setup script
└── setup.ps1                          # Windows setup script
```

## 🎉 What's New in v2.1.0

### Major Improvements
- **🔄 Persistent State**: App state survives tab switches
- **⚡ Real-time Updates**: Live progress for transcription and downloads  
- **🔔 Smart Notifications**: Clean, single-toast progress feedback
- **🎵 Better UX**: Seamless transcription workflow with visual feedback

### Fixed Issues
- ❌ ~~Toast notification spam during progress~~
- ❌ ~~State lost when switching tabs~~
- ❌ ~~Download progress not visible~~
- ❌ ~~Completion events not reaching UI~~
- ❌ ~~Memory leaks from event handlers~~

### Performance
- **Faster**: Improved event handling and state management
- **Smoother**: Real-time progress updates without blocking UI
- **Cleaner**: Proper resource cleanup and memory management

## 🚀 Development

### Building for Production
```bash
npm run build               # Build all components
npm run dist               # Create distribution packages
npm run dist:all           # Build for all platforms
```

### Development Workflow
```bash
npm run dev                # Start with hot reload
npm run web                # Test web interface
npm run test:native        # Verify native services
```

## 🎵 Example: Transcribing "Bohemian Rhapsody"

With the latest fixes, transcribing the classic Queen song works flawlessly:

1. **Select**: Drop test.mp3 into the app
2. **Configure**: Choose whisper-tiny model  
3. **Transcribe**: Click start and watch real-time progress
4. **Results**: Get 42 segments with full lyrics properly parsed
5. **Persist**: Switch tabs freely - your work is saved

Expected output: *"is this the real life is this just fantasy caught in a landslide no escape from reality..."*

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Complete setup guides for all platforms
- **Fix Scripts**: Automated solutions for common issues
- **Test Suite**: Verify your installation works correctly

This implementation maintains full backward compatibility while adding persistent state management, real-time progress feedback, and a dramatically improved user experience.