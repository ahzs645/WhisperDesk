<img src="https://github.com/ahzs645/WhisperDesk/blob/main/resources/icons/icon.png" alt="Icon" width="250"/>

# WhisperDesk - Enhanced Native Implementation

A powerful desktop transcription application powered by native whisper.cpp with real-time progress feedback, multi-speaker detection, and advanced analytics.

## 📦 Download & Install

Download the latest version for your platform:

**[📥 Download Latest Release](https://github.com/ahzs645/WhisperDesk/releases/latest)**

**[🚧 Download Development Build](https://github.com/ahzs645/WhisperDesk/releases/tag/dev)** *(Latest features, may be unstable)*

| Platform | Release Download | Notes |
|----------|-----------------|-------|
| 🪟 **Windows** | `WhisperDesk-Setup-X.X.X-win-x64.exe` | Installer for 64-bit Windows |
| 🪟 **Windows Portable** | `WhisperDesk-Portable-X.X.X-win-x64.exe` | Portable version, no installation needed |
| 🍎 **macOS Intel** | `WhisperDesk-X.X.X-mac-x64.zip` | For Intel-based Macs |
| 🍎 **macOS Apple Silicon** | `WhisperDesk-X.X.X-mac-arm64.zip` | For M1/M2/M3/M4 Macs |
| 🐧 **Linux** | `WhisperDesk-X.X.X-linux-x64.AppImage` | Portable, no installation needed |
| 🐧 **Linux (Debian/Ubuntu)** | `WhisperDesk-X.X.X-linux-x64.deb` | For Debian-based systems |
| 🐧 **Linux (RPM)** | `WhisperDesk-X.X.X-linux-x64.rpm` | For Red Hat-based systems |

### Installation and First Run
1. **Download** the appropriate file for your operating system from the links above.
2. **Install** using your platform's standard method:
   - **Windows**: 
     - **Installer**: Run the `Setup` `.exe` file and follow the installation wizard.
     - **Portable**: Download the `Portable` `.exe` file and run it directly (no installation required).
   - **macOS**: Extract the `.zip` file and drag the WhisperDesk.app to your Applications folder. Right-click → Open if blocked by Gatekeeper.
   - **Linux**:
     - For `.AppImage`: Make it executable (`chmod +x WhisperDesk-*.AppImage`) then run it.
     - For `.deb`/`.rpm`: Install using your system's package manager (e.g., `sudo dpkg -i file.deb` or `sudo rpm -i file.rpm`).
3. **Launch** WhisperDesk.
4. Upon first launch, or by navigating to the "Models" tab, **download a model** (e.g., "Whisper Tiny" - 39MB is a good start).
5. Go to the "Transcribe" tab, select your audio file, and **start transcribing**!

## 🛠️ Build from Source

If you prefer to build from source or want to contribute to development:

### Prerequisites
- **Node.js** 20.x or later
- **npm** 10.x or later
- **PNPM** (for UI dependencies)
- **Git**
- Platform-specific build tools:
  - **Windows**: Visual Studio Build Tools or Visual Studio Community
  - **macOS**: Xcode Command Line Tools
  - **Linux**: GCC, CMake, build-essential

### 🚀 Streamlined Setup

**Super Quick (2 commands):**
```bash
git clone https://github.com/ahzs645/WhisperDesk.git && cd WhisperDesk
npm install && npm run setup:dev
```

This will:
- Install all dependencies (Node.js + UI)
- Build the whisper-cli binary
- Download the tiny model for testing
- Start the development environment

**Alternative Setup Methods:**

*   **Automated Scripts:**
    - **Linux/macOS:** `scripts/setup.sh`
    - **Windows:** `scripts\setup.ps1`

*   **Manual Setup:**
    ```bash
    git clone https://github.com/ahzs645/WhisperDesk.git
    cd WhisperDesk
    npm run install:all        # Install deps + build binary
    npm run download:model:tiny # Get starter model
    npm run dev                 # Start development
    ```

### Running (After Building from Source)

**Electron App (Recommended)**
```bash
npm run dev
```
*Features:* Full native integration, model downloads, persistent state, real-time progress

**Web Interface with Native Backend**
```bash
npm run web
# Opens http://localhost:3000 with live transcription
```
*Features:* Web-based UI with native whisper.cpp backend

**API Server Only**
```bash
npm run server
# Server runs on http://localhost:3001
```

## ✨ Key Features

### Core Functionality
- **Native Performance**: Built on whisper.cpp for fast, efficient local transcription
- **Cross-Platform**: Optimized builds for Windows, macOS (Intel & Apple Silicon), and Linux
- **Multiple Audio/Video Formats**: Support for MP3, WAV, MP4, AVI, MOV, and more
- **Real-time Progress**: Live feedback during transcription with progress bars
- **Offline Operation**: No internet required after initial setup

### Enhanced Transcription
- **Multi-Speaker Detection**: Identify and label different speakers in conversations
- **Speaker Analytics**: Detailed statistics including speaking time, turn-taking, and dominance
- **Adaptive Speaker Sensitivity**: Configurable thresholds for optimal speaker detection
- **Timestamp Support**: Precise timing information for all segments
- **Confidence Scoring**: Quality metrics for transcription accuracy

### Smart Interface
- **Persistent State**: Work survives application restarts and tab switches
- **Live Search**: Find specific words or speakers in transcriptions instantly
- **Auto-transcription**: Record screen and automatically transcribe the audio
- **Dual Mode**: Choose between Electron desktop app or web interface
- **Smart Notifications**: Clean, non-intrusive progress updates

### Advanced Analytics
- **Speaker Analysis**: Speaking time distribution, turn patterns, conversation flow
- **Sentiment Analysis**: Emotional tone tracking throughout conversations
- **Speech Patterns**: Filler detection, pause analysis, speech rate metrics
- **Quality Metrics**: Confidence distribution, accuracy indicators
- **Topic Detection**: Automatic identification of discussion themes

### Export Options
- **Multiple Formats**: TXT, JSON, SRT, VTT, CSV, XML
- **Speaker-aware Export**: Include or exclude speaker labels
- **Timestamp Options**: Flexible timestamp formatting
- **Analytics Reports**: Export detailed analytics and insights
- **Clipboard Integration**: Quick copy/paste functionality

### Screen Recording
- **Enhanced Recorder**: Built-in screen capture with audio
- **Device Management**: Smart detection and validation of screens/microphones
- **Auto-transcription**: Seamless recording-to-text workflow
- **Permission Handling**: Intelligent permission management across platforms
- **Debug Tools**: Comprehensive troubleshooting and diagnostics

## 📋 Available Scripts

### Core Application
- `npm run dev` - Start Electron app in development mode
- `npm run web` - Start web interface with API server
- `npm run server` - Start transcription API server only
- `npm run build` - Build for production

### Build & Setup
- `npm run build:whisper` - Build whisper-cli binary from source
- `npm run setup:complete` - Complete setup including models
- `npm run install:all` - Install all dependencies and build binary

### Model Management
- `npm run download:model:tiny` - Download tiny model (39MB)

### Testing & Development
- `npm run test:transcription` - Test with audio file
- `npm run test:binary` - Test binary status
- `npm run lint` - Code linting

### Distribution
- `npm run dist` - Build distributable packages
- `npm run dist:win` - Windows build
- `npm run dist:mac` - macOS build  
- `npm run dist:linux` - Linux build

## 🎮 User Guide

### Getting Started
1. **Launch WhisperDesk**
2. **Download a Model**: Go to "Models" tab and download "Whisper Tiny" (39MB) for quick setup
3. **Transcribe Audio**:
   - Navigate to "Transcribe" tab
   - Drag and drop your file or click "Select Audio File"
   - Configure speaker detection if needed
   - Click "Start Transcription"
4. **View Results**: Results appear in real-time with speaker labels and timestamps

### Screen Recording
1. **Go to Recording Section**: Find the Enhanced Screen Recorder
2. **Select Devices**: Choose your screen and audio input
3. **Configure Settings**: Enable auto-transcription for automatic processing
4. **Start Recording**: Click record and capture your session
5. **Auto-Process**: Recording automatically transcribes when complete

### Speaker Detection
- **Enable in Settings**: Turn on "Speaker Diarization" for multi-speaker audio
- **Adjust Sensitivity**: Use "very_high" for 4+ speakers, "normal" for 2-3 speakers
- **Review Results**: Check speaker analytics for accuracy verification
- **Export by Speaker**: Filter and export individual speaker contributions

### Analytics & Insights
- **Speaker Analysis**: View speaking time, turn patterns, and conversation dynamics
- **Search Transcript**: Use Ctrl+F to search for specific words or phrases
- **Export Reports**: Generate detailed analytics reports in multiple formats
- **Quality Metrics**: Review confidence scores and transcription accuracy

## 💻 System Requirements

### Minimum Requirements
- **Windows**: Windows 10 (64-bit) or later
- **macOS**: macOS 10.15 (Catalina) or later
- **Linux**: Modern 64-bit distribution (Ubuntu 18.04+, CentOS 7+, etc.)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB for application + space for models (39MB - 3GB per model)
- **Internet**: Required for initial model downloads only

### What's Included in Releases
- ✅ **Whisper.cpp Binary**: Pre-compiled and optimized for each platform
- ✅ **Complete Desktop App**: Full Electron application with all dependencies
- ✅ **Native Libraries**: All required system libraries bundled
- ✅ **Auto-updater**: Automatic notification system for new versions
- ✅ **Platform Integration**: Proper file associations and system integration

## 🐛 Troubleshooting

### Common Issues

**App won't start on Windows:**
- Try the portable version if the installer fails
- Right-click installer and "Run as Administrator"
- Check Windows Defender/antivirus isn't blocking the app
- Ensure you downloaded the correct architecture (x64)

**App won't start on macOS:**
- Extract .zip and drag to Applications folder
- Right-click app and select "Open" to bypass Gatekeeper
- For damaged app error, run: `sudo xattr -rd com.apple.quarantine /Applications/WhisperDesk.app`
- Check System Preferences → Privacy & Security → Screen Recording

**App won't start on Linux:**
- Make AppImage executable: `chmod +x WhisperDesk-*.AppImage`
- Install dependencies: `sudo apt install fuse libfuse2` (Ubuntu/Debian)
- Try .deb or .rpm packages for older systems

**Model download fails:**
- Check internet connection and available disk space
- Try downloading a smaller model first (Tiny model)
- Verify firewall isn't blocking downloads

**Transcription fails:**
- Check if whisper binary exists: `npm run test:binary`
- Rebuild binary: `npm run build:whisper`
- Verify model is downloaded and compatible
- Check file format is supported

**Recording permission issues (macOS):**
- Open System Preferences → Security & Privacy → Privacy
- Add WhisperDesk to Screen Recording and Microphone sections
- Restart application after granting permissions

### Build Issues

**Binary setup issues:**
- Ensure build tools are installed for your platform
- Check that CMAKE and compiler are available
- Run setup script: `scripts/setup.sh` or `scripts\setup.ps1`

**Electron app won't start:**
- Build the renderer: `cd src/renderer/whisperdesk-ui && pnpm run build`
- Verify dist folder exists and contains built files

**Dependencies missing:**
- Run complete setup: `npm run install:all`
- Clear caches: `npm run clean && npm install`

## 📁 Project Structure

```
WhisperDesk/
├── src/
│   ├── main/                     # Electron main process
│   │   ├── managers/            # Service and state management
│   │   ├── services/            # Core business logic
│   │   ├── ipc-handlers/        # Inter-process communication
│   │   └── utils/               # Utilities and helpers
│   ├── renderer/                # Frontend application
│   │   └── whisperdesk-ui/      # React-based UI
│   │       ├── src/components/  # UI components
│   │       └── src/hooks/       # Custom React hooks
│   └── shared/                  # Shared code between processes
├── binaries/                    # Native binaries (whisper-cli, etc.)
├── models/                      # Downloaded AI models
├── scripts/                     # Setup and build scripts
├── tools/                       # Development tools
└── resources/                   # App icons and assets
```

## 🚀 Use Cases

WhisperDesk excels in:

- **Content Creation**: Transcribe podcasts, videos, and audio content with speaker identification
- **Business Meetings**: Convert recordings to searchable transcripts with speaker analytics
- **Academic Research**: Process interviews with detailed conversation analysis
- **Accessibility**: Create captions and transcripts for media content
- **Personal Use**: Transcribe voice memos and personal recordings
- **Live Recording**: Record screen sessions with automatic transcription

## 🔒 Privacy & Security

- **Local Processing**: All transcription happens on your machine
- **No Cloud Dependencies**: Audio never leaves your device
- **Open Source**: Full transparency in code and functionality
- **Offline Capable**: Works without internet after initial setup
- **Data Control**: You own and control all your transcriptions

## 🌟 Advanced Features

### Multi-Speaker Detection
- Supports up to 20 speakers in a single recording
- Adaptive sensitivity settings for optimal detection
- Speaker transition smoothing for natural conversation flow
- Detailed speaker statistics and analytics

### Real-time Processing
- Live progress updates during transcription
- Streaming results as they're processed
- Cancellable operations with proper cleanup

### Enhanced Analytics
- Speaking time distribution and turn analysis
- Sentiment analysis and emotional tone detection
- Speech pattern analysis including filler detection
- Quality metrics and confidence scoring

### Professional Export
- Multiple export formats with speaker-aware options
- Customizable timestamp formatting
- Analytics reports for detailed insights
- Clipboard integration for quick sharing

---

**WhisperDesk** provides a comprehensive, privacy-focused transcription solution with advanced speaker detection and analytics. Whether you're a content creator, researcher, or business professional, WhisperDesk delivers professional-grade transcription with the convenience of local processing.