# WhisperDesk Enhanced - Native Implementation

A powerful desktop transcription application powered by native whisper.cpp with persistent state management and real-time progress feedback.

## 📦 Download & Install

Download the latest version for your platform:

**[📥 Download Latest Release](https://github.com/ahzs645/WhisperDesk/releases/latest)**

| Platform | Download | Notes |
|----------|----------|-------|
| 🪟 **Windows** | `WhisperDesk-Enhanced-windows-x64.exe` | Installer for 64-bit Windows |
| 🍎 **macOS Intel** | `WhisperDesk-Enhanced-mac-x64.dmg` | For Intel-based Macs |
| 🍎 **macOS Apple Silicon** | `WhisperDesk-Enhanced-mac-arm64.dmg` | For M1/M2/M3 Macs |
| 🐧 **Linux** | `WhisperDesk-Enhanced-linux-x64.AppImage` | Portable, no installation needed |
| 🐧 **Linux (Debian/Ubuntu)** | `WhisperDesk-Enhanced-linux-x64.deb` | For Debian-based systems |
| 🐧 **Linux (RPM)** | `WhisperDesk-Enhanced-linux-x64.rpm` | For Red Hat-based systems |

### Installation and First Run
1. **Download** the appropriate file for your operating system from the link above.
2. **Install** using your platform's standard method:
   - **Windows**: Run the `.exe` installer.
   - **macOS**: Open the `.dmg` and drag the application to your Applications folder.
   - **Linux**:
     - For `.AppImage`: Make it executable (`chmod +x WhisperDesk-Enhanced-*.AppImage`) then run it.
     - For `.deb`/`.rpm`: Install using your system's package manager (e.g., `sudo dpkg -i file.deb` or `sudo rpm -i file.rpm`).
3. **Launch** WhisperDesk Enhanced.
4. Upon first launch, or by navigating to the "Models" tab, **download a model** (e.g., "Whisper Tiny" - 39MB is a good start).
5. Go to the "Transcribe" tab, select your audio file, and **start transcribing**!

## 🛠️ Build from Source

If you prefer to build from source or want to contribute to development:

### Setup
You can use the automated setup scripts or follow the manual steps:

**Automated Setup:**
*   **Linux/macOS:**
    ```bash
    git clone https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced.git
    cd whisperdesk-enhanced
    scripts/setup.sh
    ```
*   **Windows (PowerShell):**
    ```powershell
    git clone https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced.git
    cd whisperdesk-enhanced
    scripts\setup.ps1
    ```
    *This script will guide you through installing dependencies and building the native whisper.cpp binary.*

**Manual Setup:**
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced.git
    cd whisperdesk-enhanced
    ```
2.  **Install Node.js Dependencies:**
    ```bash
    npm install
    cd src/renderer/whisperdesk-ui
    npm install --legacy-peer-deps
    cd ../../..
    ```
3.  **Set up Whisper Binary:**
    Build the whisper.cpp native binary. This is often handled by the `setup.sh` or `setup.ps1` scripts.
    ```bash
    # Build from source (recommended for all platforms)
    npm run build:whisper
    ```
    *(Refer to `scripts/build-whisper.sh` for Unix or `scripts/compile-whisper-windows.ps1` for Windows for more details on the native build process).*
4.  **Download a Model:**
    Manually download a model if needed (the application can also do this via the UI).
    ```bash
    mkdir -p ~/.config/whisperdesk-enhanced/models
    # Example: download the 'tiny' model
    wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin \
      -O ~/.config/whisperdesk-enhanced/models/ggml-tiny.bin
    ```

### Running (After Building from Source)
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

## ✨ Features

- **Easy Installation**: Pre-built releases for Windows, macOS, and Linux – no compilation required.
- **Native Performance**: Utilizes whisper.cpp for fast, efficient, and local transcription. No Python dependencies.
- **Cross-Platform**: Optimized builds for each operating system and architecture (Windows, macOS Intel & Apple Silicon, Linux).
- **Model Marketplace**: Easily download and manage Whisper models with progress tracking.
- **Live Transcription & Real-time Progress**: Visual feedback during transcription and model downloads.
- **Persistent State Management**: File selections, transcription results, and session work survive tab switches and application restarts.
- **Dual Interface Options**: Choose between a full-featured Electron desktop application or a web interface with a native backend.
- **Multiple Audio/Video Formats**: Support for various input file types.
- **Versatile Export Options**: Export transcriptions to text, JSON, SRT, and other formats.
- **Smart Notifications**: Clean, non-intrusive progress updates.
- **Robust Event Handling**: Proper IPC communication and memory management.
- **Auto-Updates**: The Electron app automatically notifies you of new releases.
- **One-Click Workflow**: Simple file selection and processing.

## 📋 Available Scripts

- `npm run dev` - Start Electron app in development mode
- `npm run web` - Start web interface with API server
- `npm run server` - Start transcription API server only
- `npm run test:native` - Test native services
- `npm run test:transcription` - Test with audio file
- `npm run build` - Build for production
- `npm run build:whisper` - Builds the whisper.cpp command-line binary from source.
- `scripts/setup.sh` / `scripts\setup.ps1` - Automated setup scripts

## 🤖 Automated Release System

Details about the automated build and release system using GitHub Actions can be found in [docs/automated_release_system.md](docs/automated_release_system.md).

## 🎮 User Guide

This section assumes you have followed either the "Download & Install" or "Build from Source" instructions above.

### General Usage
1.  **Launch WhisperDesk Enhanced.**
2.  **Download a Model:** If you haven't already, go to the "Models" tab and download a transcription model. "Whisper Tiny" (approx. 39MB) is recommended for first-time use due to its small size.
3.  **Transcribe Audio:**
    *   Navigate to the "Transcribe" tab.
    *   Drag and drop your audio/video file onto the application or click "Select Audio File".
    *   Click "Start Transcription".
4.  **View Results:** The transcription will appear in real-time. Results and progress persist even if you switch tabs within the application.

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

Details about the project structure can be found in [docs/project_structure.md](docs/project_structure.md).

## 🚀 Development & Contributing

Information on setting up your development environment, building the application, and contributing to the project can be found in the [Development & Contributing Guide (docs/development_guide.md)](docs/development_guide.md).

## 🌟 Use Cases

WhisperDesk Enhanced is perfect for:

- **Content Creation**: Transcribe podcasts, videos, and audio content
- **Academic Research**: Process interviews and research materials  
- **Business**: Convert meetings and presentations to text
- **Accessibility**: Create captions and transcripts for media
- **Personal**: Transcribe voice memos and personal recordings

## 📞 Support & Getting Help

### For End Users (Release Version)
- **Download Issues**: Check the [latest release page](https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced/releases) for updated versions.
- **Installation Problems**: Refer to the platform-specific troubleshooting tips in the "Troubleshooting" section.
- **Usage Questions**: Review the "User Guide" and "Best Practices" sections.
- **Bug Reports**: [Open an issue](https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced/issues) detailing your OS, application version, and steps to reproduce.

### For Developers
- **Build Issues**: Consult the "Build from Source" section and ensure all prerequisite tools and steps are completed.
- **Contributing**: Please read the "Contributing Guidelines" below.
- **Feature Requests**: [Open an issue](https://github.com/<PROJECT_OWNER>/whisperdesk-enhanced/issues) using the "enhancement" label.
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
