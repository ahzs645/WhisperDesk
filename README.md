# WhisperDesk Enhanced - Native Implementation

A powerful desktop transcription application powered by native whisper.cpp with persistent state management and real-time progress feedback.

## 📦 Download & Install (Recommended)

### Pre-built Releases
Download the latest version for your platform:

**[📥 Download Latest Release](https://github.com/your-username/whisperdesk-enhanced/releases/latest)**

| Platform | Download | Notes |
|----------|----------|-------|
| 🪟 **Windows** | `WhisperDesk-Enhanced-windows-x64.exe` | Installer for 64-bit Windows |
| 🍎 **macOS Intel** | `WhisperDesk-Enhanced-mac-x64.dmg` | For Intel-based Macs |
| 🍎 **macOS Apple Silicon** | `WhisperDesk-Enhanced-mac-arm64.dmg` | For M1/M2/M3 Macs |
| 🐧 **Linux** | `WhisperDesk-Enhanced-linux-x64.AppImage` | Portable, no installation needed |
| 🐧 **Linux (Debian/Ubuntu)** | `WhisperDesk-Enhanced-linux-x64.deb` | For Debian-based systems |
| 🐧 **Linux (RPM)** | `WhisperDesk-Enhanced-linux-x64.rpm` | For Red Hat-based systems |

### Quick Installation

1. **Download** the appropriate file for your operating system
2. **Install** using your platform's standard method:
   - **Windows**: Run the `.exe` installer
   - **macOS**: Open the `.dmg` and drag to Applications
   - **Linux**: Make `.AppImage` executable or install `.deb`/`.rpm`
3. **Launch** WhisperDesk Enhanced
4. **Download a model** from the Models tab (start with "Whisper Tiny" - 39MB)
5. **Start transcribing** your audio files!

## 🛠️ Build from Source (Developers)

If you prefer to build from source or want to contribute to development:

### Automated Setup
**Linux/macOS:**
```bash
git clone https://github.com/your-username/whisperdesk-enhanced.git
cd whisperdesk-enhanced
scripts/setup.sh
```

**Windows (PowerShell):**
```powershell
git clone https://github.com/your-username/whisperdesk-enhanced.git
cd whisperdesk-enhanced
scripts\setup.ps1
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
# Build from source (recommended for all platforms)
npm run build:whisper
```

3. **Download a Model**
```bash
mkdir -p ~/.config/whisperdesk-enhanced/models
wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin \
  -O ~/.config/whisperdesk-enhanced/models/ggml-tiny.bin
```

## 🎯 Running the Application

### Pre-built Releases (Recommended)
Simply download and install the appropriate release for your platform. Everything is included:
- ✅ Native whisper.cpp binary (pre-compiled)
- ✅ Optimized Electron application
- ✅ All dependencies bundled
- ✅ Ready to use immediately

### Development Mode (Source Build)
If you've built from source, you can run in development mode:

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
```

## ✨ Key Features

### 🎉 User Experience
- **Easy Installation**: Pre-built releases for all platforms - no compilation required
- **Persistent State Management**: File selections and transcription results survive tab switches
- **Real-time Progress Feedback**: Live progress bars for transcription and model downloads
- **Smart Toast Notifications**: Clean, non-intrusive progress updates
- **Enhanced Model Marketplace**: Easy model download and management with progress tracking

### 🔧 Technical Capabilities
- **Native Performance**: Uses whisper.cpp for fast, local transcription
- **Cross-Platform Support**: Windows, macOS (Intel & Apple Silicon), and Linux
- **Multiple Interfaces**: Available as both Electron app and web interface
- **Pre-compiled Binaries**: Releases include optimized whisper.cpp for each platform
- **Robust Event Handling**: Proper IPC communication and memory management
- **Advanced Audio Processing**: Support for various audio and video formats

### 🎵 Transcription Experience
- **One-Click Workflow**: Simple file selection and processing
- **Session Persistence**: Work continues seamlessly across interface navigation
- **Real-time Updates**: Live progress tracking without blocking the UI
- **Multiple Output Formats**: Export to text, JSON, SRT, and other formats

## 📋 Available Scripts

- `npm run dev` - Start Electron app in development mode
- `npm run web` - Start web interface with API server
- `npm run server` - Start transcription API server only
- `npm run test:native` - Test native services
- `npm run test:transcription` - Test with audio file
- `npm run build` - Build for production
- `npm run build:whisper` - Builds the whisper.cpp command-line binary from source.
- `scripts/setup.sh` / `scripts\setup.ps1` - Automated setup scripts

## 🔧 Core Features

✅ **Ready-to-Use Releases** - Pre-built packages for Windows, macOS, and Linux  
✅ **Native Performance** - No Python dependencies, runs entirely with native code  
✅ **Cross-Platform** - Optimized builds for each operating system and architecture  
✅ **Model Marketplace** - Download and manage Whisper models with progress tracking  
✅ **Live Transcription** - Real-time audio processing with visual feedback  
✅ **Persistent State** - Seamless experience across application restarts and tab switches  
✅ **Dual Interface** - Choose between Electron desktop app or web interface  
✅ **Multiple Formats** - Support for various audio and video file types  
✅ **Export Options** - Multiple output formats for different use cases  
✅ **Auto-Updates** - Automatic notification of new releases (Electron app)  

## 🤖 Automated Release System

WhisperDesk Enhanced uses GitHub Actions to automatically build and release optimized versions:

- **Multi-Platform Builds**: Simultaneous builds for Windows, macOS (Intel & ARM), and Linux
- **Optimized Binaries**: Each release includes platform-specific whisper.cpp compiled with optimal flags
- **Comprehensive Testing**: Automated testing ensures reliability across all platforms
- **Code Signing**: macOS and Windows releases are prepared for proper security verification
- **Release Notes**: Automatic generation of detailed release notes for each version

### Release Schedule
- **Stable Releases**: Tagged versions (v1.0.0, v1.1.0, etc.) with full testing
- **Beta Releases**: Pre-release versions for testing new features
- **Automatic Builds**: Every push to main triggers artifact builds for testing  

## 🎮 User Guide

### Getting Started with Pre-built Release
1. **Download**: Get the latest release for your platform from the [releases page](https://github.com/your-username/whisperdesk-enhanced/releases)
2. **Install**: Follow your platform's standard installation process
3. **Launch**: Open WhisperDesk Enhanced from your applications
4. **Download a model**: Navigate to Models tab → Download "Whisper Tiny" (39MB) - perfect for getting started
5. **Select audio file**: Go to Transcribe tab → Drop file or click "Select Audio File"
6. **Start transcription**: Click "Start Transcription"
7. **View results**: Text appears in real-time and persists across tab switches

### Getting Started with Source Build
If you've built from source:
1. **Launch the app**: `npm run dev`
2. **Download a model**: Navigate to Models tab → Download "Whisper Tiny" (39MB)
3. **Select audio file**: Go to Transcribe tab → Drop file or click "Select Audio File"
4. **Start transcription**: Click "Start Transcription"
5. **View results**: Text appears in real-time and persists across tab switches

### Best Practices
- **Use Pre-built Releases**: Fastest and most reliable way to get started
- **Start with Tiny model**: Fastest download and good for initial testing
- **Use drag & drop**: Easiest way to select and upload files
- **Monitor progress**: Stay in tab or navigate freely - progress persists
- **Check for Updates**: The app will notify you of new releases automatically
- **Check History tab**: View current session and manage transcribed files

## 💻 System Requirements

### Minimum Requirements
- **Windows**: Windows 10 (64-bit) or later
- **macOS**: macOS 10.15 (Catalina) or later
- **Linux**: Modern 64-bit distribution (Ubuntu 18.04+, CentOS 7+, etc.)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB for application + additional space for models (39MB - 3GB per model)
- **Internet**: Required for initial model downloads, optional afterward

### What's Included in Releases
- ✅ **Whisper.cpp Binary**: Pre-compiled and optimized for each platform
- ✅ **Electron Application**: Complete desktop application with all dependencies
- ✅ **Native Libraries**: All required system libraries bundled
- ✅ **Auto-updater**: Automatic notification system for new versions
- ✅ **Platform Integration**: Proper file associations and system integration

## 📖 Platform-Specific Setup

For detailed platform-specific instructions:

- 🐧 **Linux**: Use the commands above or run `./setup.sh`
- 🍎 **macOS**: See SETUP_MACOS.md for detailed instructions
- 🪟 **Windows**: See SETUP_WINDOWS.md for detailed instructions
- 🌍 **All Platforms**: See PLATFORM_GUIDE.md for comprehensive setup guide

## 🐛 Troubleshooting

### Release Version Issues

**App won't start on Windows:**
- Right-click the installer and "Run as Administrator"
- Check Windows Defender/antivirus isn't blocking the app
- Ensure you downloaded the correct architecture (x64)

**App won't start on macOS:**
- Right-click the app and select "Open" to bypass Gatekeeper
- Check System Preferences → Security & Privacy for blocked apps
- For M1/M2 Macs, ensure you downloaded the ARM64 version

**App won't start on Linux:**
- Make AppImage executable: `chmod +x WhisperDesk-Enhanced-*.AppImage`
- Install required dependencies: `sudo apt install fuse libfuse2` (Ubuntu/Debian)
- For older systems, try the .deb or .rpm packages instead

**Model download fails:**
- Check internet connection
- Verify you have sufficient disk space
- Try downloading a smaller model first (Tiny model)
- Check firewall isn't blocking the download

### Source Build Issues

**Binary setup issues:**
- Use the included binary: `chmod +x binaries/whisper`
- Or build from source using the instructions above

**Electron app won't start:**
- Build the renderer: `cd src/renderer/whisperdesk-ui && npm run build`
- Verify that the dist folder exists

**Web interface connection issues:**
- Ensure API server is running on port 3001
- Verify whisper binary is executable
- Check that required models are downloaded

## 🔧 Troubleshooting Scripts

If you encounter issues on Windows, you can use the diagnostic script:

```powershell
# Diagnose common issues with whisper.cpp binary on Windows
scripts\diagnose-whisper-windows.ps1
```
For other platforms, ensure all dependencies are correctly installed as per the build scripts (`scripts/build-whisper.sh`).

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
│   │   └── main.js                    # Main process entry point
│   └── renderer/                      # React frontend
│       └── whisperdesk-ui/
│           ├── src/App.jsx            # Main application component
│           └── components/
│               ├── TranscriptionTab-Electron.jsx  # Electron transcription interface
│               └── ModelMarketplace-WebCompatible.jsx     # Model management
├── binaries/
│   └── whisper-cli                    # whisper.cpp binary
├── scripts/
│   ├── build-whisper.sh               # (Unix) Builds whisper.cpp binary
│   ├── compile-whisper-windows.ps1    # (Windows) Compiles whisper.cpp binary
│   ├── build-whisper-cross-platform.js # Cross-platform wrapper to build whisper.cpp
│   └── diagnose-whisper-windows.ps1   # Windows diagnostic script
├── transcription-server.js            # API server for web interface
├── test-native-services.js            # Native services testing
├── test-transcription.js              # Transcription testing
├── setup.sh                           # Linux/macOS setup script
└── setup.ps1                          # Windows setup script
```

## 🚀 Development & Contributing

### For Contributors & Developers

WhisperDesk Enhanced welcomes contributions! Here's how to get involved:

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-username/whisperdesk-enhanced.git
cd whisperdesk-enhanced

# Install dependencies
npm install
cd src/renderer/whisperdesk-ui
npm install --legacy-peer-deps
cd ../../..

# Build whisper.cpp binary (if not already done by setup scripts)
npm run build:whisper

# Start in development mode
npm run dev
```

### Building Releases
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

### Available Build Targets
- **Windows**: Creates .exe installers and portable versions
- **macOS**: Generates .dmg files for both Intel and Apple Silicon
- **Linux**: Produces AppImage, .deb, and .rpm packages

### Contributing Guidelines
1. **Fork the repository** and create a feature branch
2. **Test your changes** on multiple platforms if possible
3. **Update documentation** for any new features
4. **Submit a pull request** with a clear description of changes
5. **Ensure CI passes** - all platforms must build successfully

## 🌟 Use Cases

WhisperDesk Enhanced is perfect for:

- **Content Creation**: Transcribe podcasts, videos, and audio content
- **Academic Research**: Process interviews and research materials  
- **Business**: Convert meetings and presentations to text
- **Accessibility**: Create captions and transcripts for media
- **Personal**: Transcribe voice memos and personal recordings

## 📞 Support & Getting Help

### For End Users (Release Version)
- **Download Issues**: Check the [latest release page](https://github.com/your-username/whisperdesk-enhanced/releases) for updated versions
- **Installation Problems**: See platform-specific troubleshooting above
- **Usage Questions**: Check the user guide and best practices sections
- **Bug Reports**: [Open an issue](https://github.com/your-username/whisperdesk-enhanced/issues) with your OS and app version

### For Developers
- **Build Issues**: Check the development setup instructions
- **Contributing**: Read the contributing guidelines above
- **Feature Requests**: [Open an issue](https://github.com/your-username/whisperdesk-enhanced/issues) with the "enhancement" label
- **Documentation**: Help improve setup guides for all platforms

### Community Resources
- **GitHub Discussions**: Share experiences and get help from other users
- **Issue Tracker**: Report bugs and track feature development  
- **Release Notes**: Stay updated with new features and improvements
- **Wiki**: Comprehensive documentation and advanced usage guides

## 🔒 Privacy & Security

- **Local Processing**: All transcription happens on your machine
- **No Cloud Dependencies**: No audio data sent to external services
- **Open Source**: Full transparency in code and functionality
- **Offline Capable**: Works without internet connection once set up

This implementation provides a robust, cross-platform transcription solution with modern UX principles and reliable performance across different operating systems and use cases.