# WhisperDesk Enhanced - Native Implementation

A powerful desktop transcription application powered by native whisper.cpp (no Python dependencies required).

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

### Electron App
```bash
npm run dev
```

### Web Interface with Native Backend
```bash
npm run web
# Opens http://localhost:3000 with live transcription
```

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
```

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
✅ **Model Marketplace** - Download models with progress tracking  
✅ **Live Transcription** - Real-time audio processing  
✅ **Web Interface** - Use as web app or Electron app  
✅ **Multiple Formats** - Support for various audio/video files  

## 📖 Platform-Specific Setup

For detailed platform-specific instructions:

- 🐧 **Linux**: Use the commands above or run `./setup.sh`
- 🍎 **macOS**: [SETUP_MACOS.md](SETUP_MACOS.md)
- 🪟 **Windows**: [SETUP_WINDOWS.md](SETUP_WINDOWS.md)
- 🌍 **All Platforms**: [PLATFORM_GUIDE.md](PLATFORM_GUIDE.md)

## 🐛 Troubleshooting

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

## 📁 Project Structure

```
WhisperDesk/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── services/
│   │   │   ├── binary-manager.js      # Manages whisper.cpp binaries
│   │   │   ├── transcription-service-native.js  # Native transcription service
│   │   │   └── providers/
│   │   │       └── native-whisper-provider.js   # Native whisper provider
│   │   └── main.js                    # Updated to use native services
│   └── renderer/                      # React frontend
│       └── whisperdesk-ui/
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

## 🎉 What's New in Native Implementation

- **Removed Python Dependencies**: No more Python/pip requirements
- **Native whisper.cpp**: Direct binary execution for better performance
- **Cross-Platform Binaries**: Support for Windows, macOS, and Linux
- **Web API**: Can run as both Electron app and web service
- **Model Marketplace**: Download GGML models with progress tracking
- **Real Transcription**: Tested with actual audio files

This implementation maintains full backward compatibility while adding native capabilities and removing Python dependencies.

