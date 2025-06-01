# WhisperDesk Enhanced - Complete Documentation

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Installation](#installation)
4. [Quick Start Guide](#quick-start-guide)
5. [User Guide](#user-guide)
6. [Developer Guide](#developer-guide)
7. [API Reference](#api-reference)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)
10. [Support](#support)

---

## Overview

WhisperDesk Enhanced is a comprehensive, cross-platform transcription application that transforms audio and video content into accurate text transcriptions. Built with modern technologies and AI-powered speech recognition, it offers professional-grade features for individuals, businesses, and developers.

### Key Highlights

- **Cross-Platform**: Native applications for Windows, macOS, and Linux
- **Multiple AI Providers**: Local Whisper models and cloud-based Deepgram Nova API
- **Model Marketplace**: Easy download and management of transcription models
- **Speaker Recognition**: Advanced speaker diarization and labeling system
- **Real-time Transcription**: Live audio transcription with instant results
- **File Processing**: Support for various audio and video formats
- **Export Options**: Multiple output formats including TXT, SRT, VTT, JSON, and more
- **Professional UI**: Modern, responsive interface with dark/light themes

---

## Features

### Core Transcription Features

#### Multiple Provider Support
- **Local Whisper Models**: OpenAI Whisper models running locally using whisper.cpp
  - Tiny (39 MB) - Fast, English only
  - Base (142 MB) - Good balance of speed and accuracy
  - Small (461 MB) - Better accuracy, still fast
  - Medium (1.42 GB) - High accuracy
  - Large v2/v3 (2.87 GB) - Best accuracy, multilingual

- **Deepgram Nova API**: Cloud-based transcription with enterprise features
  - Nova 2 - Latest and most accurate model
  - Nova - High-accuracy general model
  - Enhanced - Improved accuracy over base
  - Base - Standard accuracy, fast processing

#### Audio Input Methods
- **Real-time Recording**: Live microphone input with instant transcription
- **File Upload**: Support for audio and video files
  - Supported formats: WAV, MP3, MP4, FLAC, M4A, OGG, OPUS, WEBM, AAC
  - Automatic format conversion and optimization
  - Batch processing capabilities

#### Advanced Features
- **Speaker Diarization**: Automatic speaker detection and separation
- **Speaker Labeling**: Custom speaker names and management
- **Timestamp Synchronization**: Precise timing for audio playback
- **Confidence Scoring**: Accuracy indicators for transcribed content
- **Language Detection**: Automatic language identification
- **Multi-language Support**: 80+ languages supported

### User Interface Features

#### Modern Design
- **Responsive Layout**: Optimized for desktop and touch devices
- **Dark/Light Themes**: Customizable appearance
- **Tabbed Interface**: Organized workflow with Transcribe, Models, History, and Settings
- **Real-time Visualization**: Audio waveform display during recording/playback

#### Audio Playback Controls
- **Synchronized Playback**: Click on transcription segments to jump to specific times
- **Playback Controls**: Play, pause, skip forward/backward
- **Volume Control**: Adjustable audio levels with mute option
- **Speed Control**: Variable playback speed for review

#### Export and Sharing
- **Multiple Formats**: 
  - Plain Text (.txt)
  - SubRip Subtitles (.srt)
  - WebVTT (.vtt)
  - JSON (.json)
  - CSV (.csv)
  - XML (.xml)
  - Markdown (.md)
- **Clipboard Integration**: One-click copy to clipboard
- **Custom Export Settings**: Include/exclude timestamps, speaker labels, confidence scores

### Model Management

#### Model Marketplace
- **Easy Discovery**: Browse available models with detailed information
- **One-Click Download**: Simple installation process
- **Progress Tracking**: Real-time download progress and status
- **Version Management**: Automatic updates and version control
- **Storage Optimization**: Efficient model storage and organization

#### Model Information
- **Size and Performance**: Clear indicators of model size and speed
- **Language Support**: Detailed language compatibility
- **Accuracy Ratings**: Performance benchmarks and recommendations
- **Usage Statistics**: Track model usage and performance

### Speaker Recognition System

#### Advanced Diarization
- **Automatic Detection**: AI-powered speaker identification
- **Voice Fingerprinting**: Unique voice characteristic analysis
- **Speaker Clustering**: Group similar voices automatically
- **Confidence Scoring**: Reliability indicators for speaker assignments

#### Speaker Management
- **Custom Labels**: Assign meaningful names to speakers
- **Speaker Profiles**: Persistent speaker information across sessions
- **Voice Learning**: Improved accuracy over time
- **Speaker Merging**: Combine duplicate speaker profiles
- **Export/Import**: Backup and restore speaker data

---



## Installation

### System Requirements

#### Minimum Requirements
- **Operating System**: Windows 10, macOS 10.14, or Linux (Ubuntu 18.04+)
- **RAM**: 4 GB (8 GB recommended for large models)
- **Storage**: 2 GB free space (additional space for models)
- **Audio**: Microphone for recording, speakers/headphones for playback

#### Recommended Requirements
- **RAM**: 16 GB for optimal performance with large models
- **Storage**: 10 GB free space for multiple models
- **CPU**: Multi-core processor for faster transcription
- **Internet**: Stable connection for Deepgram API and model downloads

### Download and Installation

#### Windows Installation

1. **Download the Installer**
   - Visit the [releases page](https://github.com/whisperdesk/whisperdesk-enhanced/releases)
   - Download `WhisperDesk-Enhanced-Setup-x.x.x.exe`

2. **Run the Installer**
   - Double-click the downloaded file
   - Follow the installation wizard
   - Choose installation directory (default recommended)
   - Select additional options:
     - Create desktop shortcut
     - Add to Start Menu
     - Associate audio file types

3. **First Launch**
   - Launch from desktop shortcut or Start Menu
   - Grant microphone permissions when prompted
   - Complete initial setup wizard

#### macOS Installation

1. **Download the DMG**
   - Download `WhisperDesk-Enhanced-x.x.x.dmg`
   - Open the downloaded DMG file

2. **Install the Application**
   - Drag WhisperDesk Enhanced to Applications folder
   - Eject the DMG file

3. **Security Settings**
   - First launch: Right-click → Open (bypass Gatekeeper)
   - Grant microphone access in System Preferences → Security & Privacy
   - Allow network connections if prompted

#### Linux Installation

##### AppImage (Recommended)
```bash
# Download AppImage
wget https://github.com/whisperdesk/whisperdesk-enhanced/releases/download/v2.0.0/WhisperDesk-Enhanced-x.x.x.AppImage

# Make executable
chmod +x WhisperDesk-Enhanced-x.x.x.AppImage

# Run
./WhisperDesk-Enhanced-x.x.x.AppImage
```

##### Debian/Ubuntu (.deb)
```bash
# Download and install
wget https://github.com/whisperdesk/whisperdesk-enhanced/releases/download/v2.0.0/whisperdesk-enhanced_x.x.x_amd64.deb
sudo dpkg -i whisperdesk-enhanced_x.x.x_amd64.deb

# Install dependencies if needed
sudo apt-get install -f
```

##### Red Hat/Fedora (.rpm)
```bash
# Download and install
wget https://github.com/whisperdesk/whisperdesk-enhanced/releases/download/v2.0.0/whisperdesk-enhanced-x.x.x.x86_64.rpm
sudo rpm -i whisperdesk-enhanced-x.x.x.x86_64.rpm
```

### Post-Installation Setup

#### Initial Configuration

1. **Audio Device Setup**
   - Go to Settings → Audio Settings
   - Select your preferred microphone
   - Test audio levels
   - Configure noise reduction settings

2. **Provider Configuration**
   - **For Local Whisper**: Download your first model from the Models tab
   - **For Deepgram**: Enter your API key in Settings → Deepgram API

3. **Default Settings**
   - Choose default transcription provider
   - Set preferred export format
   - Configure speaker diarization options

---

## Quick Start Guide

### Your First Transcription

#### Method 1: Real-time Recording

1. **Start the Application**
   - Launch WhisperDesk Enhanced
   - Navigate to the "Transcribe" tab

2. **Configure Settings**
   - Select transcription provider (Whisper or Deepgram)
   - Choose model (Base recommended for first use)
   - Enable speaker diarization if needed

3. **Start Recording**
   - Click "Start Recording" button
   - Speak clearly into your microphone
   - Watch real-time transcription appear

4. **Stop and Review**
   - Click "Stop Recording" when finished
   - Review transcription accuracy
   - Edit speaker labels if needed

5. **Export Results**
   - Click "Export" dropdown
   - Choose desired format (TXT, SRT, etc.)
   - Save to your preferred location

#### Method 2: File Upload

1. **Upload Audio File**
   - Click "Upload Audio File" button
   - Select your audio/video file
   - Wait for file processing to begin

2. **Monitor Progress**
   - Watch transcription progress bar
   - Processing time varies by file length and model

3. **Review and Export**
   - Review completed transcription
   - Use audio playback controls to verify accuracy
   - Export in your preferred format

### Setting Up Deepgram API

1. **Get API Key**
   - Sign up at [Deepgram Console](https://console.deepgram.com)
   - Create a new project
   - Generate an API key

2. **Configure in WhisperDesk**
   - Go to Settings → Deepgram API
   - Enter your API key
   - Select default model (Nova 2 recommended)
   - Click "Test Connection" to verify

3. **Start Transcribing**
   - Return to Transcribe tab
   - Select "Deepgram Nova" as provider
   - Enjoy cloud-powered transcription

---

## User Guide

### Interface Overview

#### Main Navigation
The application features a tabbed interface with four main sections:

1. **Transcribe Tab**: Primary workspace for recording and file processing
2. **Models Tab**: Model marketplace and management
3. **History Tab**: Previous transcription sessions
4. **Settings Tab**: Application configuration

#### Transcribe Tab Layout

**Left Panel - Controls**
- Provider selection (Whisper/Deepgram)
- Model selection dropdown
- Recording controls
- File upload button
- Audio playback controls
- Settings toggles

**Right Panel - Results**
- Audio waveform visualization
- Transcription text with segments
- Speaker labels and timestamps
- Export and copy options

### Advanced Features

#### Speaker Management

**Automatic Speaker Detection**
- Enable "Speaker Diarization" in settings
- System automatically detects different speakers
- Assigns temporary labels (Speaker 1, Speaker 2, etc.)

**Custom Speaker Labels**
1. Click on any speaker label in transcription
2. Enter custom name (e.g., "John Smith", "Interviewer")
3. Label persists across future transcriptions
4. System learns voice characteristics for better recognition

**Speaker Profile Management**
- View all speakers in Settings → Speaker Management
- Merge duplicate speaker profiles
- Export/import speaker data for backup
- Delete unused speaker profiles

#### Audio Playback Features

**Synchronized Navigation**
- Click any transcription segment to jump to that audio position
- Segments highlight during playback
- Precise timestamp synchronization

**Playback Controls**
- Play/Pause: Space bar or click button
- Skip: 10-second forward/backward buttons
- Volume: Slider control with mute option
- Speed: Adjust playback speed (0.5x to 2x)

**Waveform Visualization**
- Visual representation of audio levels
- Real-time animation during recording/playback
- Click to navigate to specific positions

#### Export Options

**Format Selection**
- **Plain Text (.txt)**: Simple text output
- **SubRip (.srt)**: Standard subtitle format
- **WebVTT (.vtt)**: Web-compatible subtitles
- **JSON (.json)**: Structured data with metadata
- **CSV (.csv)**: Spreadsheet-compatible format
- **XML (.xml)**: Structured markup format
- **Markdown (.md)**: Formatted text with headers

**Export Settings**
- Include/exclude timestamps
- Include/exclude speaker labels
- Include/exclude confidence scores
- Custom filename patterns
- Automatic export location

#### Model Management

**Downloading Models**
1. Navigate to Models tab
2. Browse available models
3. Click "Download" on desired model
4. Monitor download progress
5. Model becomes available for use

**Model Information**
- Size and download time estimates
- Accuracy and speed ratings
- Language support details
- Usage recommendations

**Storage Management**
- View total storage used by models
- Delete unused models to free space
- Automatic cleanup options
- Model update notifications

---


## Developer Guide

### Building from Source

#### Prerequisites

**Required Software**
- Node.js 18.0.0 or later
- npm 8.0.0 or later
- Git
- Python 3.8+ (for Whisper fallback)

**Platform-Specific Requirements**

*Windows:*
- Visual Studio Build Tools 2019 or later
- Windows SDK

*macOS:*
- Xcode Command Line Tools
- macOS 10.14 SDK or later

*Linux:*
- build-essential package
- libasound2-dev (for audio support)

#### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/whisperdesk/whisperdesk-enhanced.git
cd whisperdesk-enhanced

# Install dependencies
npm install

# Install renderer dependencies
cd src/renderer/whisperdesk-ui
pnpm install
cd ../../..
```

#### Development Workflow

**Start Development Server**
```bash
# Start both main and renderer processes
npm run dev

# Or start separately
npm run dev:main    # Main Electron process
npm run dev:renderer # React development server
```

**Build for Production**
```bash
# Build all components
npm run build

# Build specific platforms
npm run dist:win     # Windows
npm run dist:mac     # macOS
npm run dist:linux   # Linux
npm run dist:all     # All platforms
```

**Using Build Scripts**
```bash
# Linux/macOS
./scripts/build.sh [win|mac|linux|all]

# Windows
scripts\build.bat [win|all]
```

### Architecture Overview

#### Application Structure

```
whisperdesk-enhanced/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.js          # Application entry point
│   │   ├── preload.js       # Secure IPC bridge
│   │   ├── services/        # Core services
│   │   │   ├── transcription-service.js
│   │   │   ├── model-manager.js
│   │   │   ├── speaker-recognition-service.js
│   │   │   ├── audio-service.js
│   │   │   ├── export-service.js
│   │   │   ├── settings-service.js
│   │   │   └── providers/   # Transcription providers
│   │   │       ├── whisper-provider.js
│   │   │       └── deepgram-provider.js
│   │   └── utils/           # Utility functions
│   ├── renderer/            # Frontend application
│   │   └── whisperdesk-ui/  # React application
│   │       ├── src/
│   │       │   ├── components/
│   │       │   ├── pages/
│   │       │   └── utils/
│   │       └── dist/        # Built frontend
│   └── shared/              # Shared utilities
├── resources/               # Build resources
├── scripts/                 # Build scripts
└── dist/                   # Built applications
```

#### Service Architecture

**Transcription Service**
- Central coordinator for all transcription operations
- Manages multiple provider implementations
- Handles real-time and file-based transcription
- Event-driven architecture for UI updates

**Model Manager**
- Downloads and manages AI models
- Handles model metadata and versioning
- Provides model marketplace functionality
- Optimizes storage and performance

**Speaker Recognition Service**
- Processes speaker diarization results
- Manages speaker profiles and labels
- Learns voice characteristics over time
- Provides speaker identification capabilities

**Audio Service**
- Handles audio device management
- Processes audio input/output
- Manages recording and playback
- Provides audio format conversion

### API Reference

#### IPC Communication

**Main → Renderer Events**
```javascript
// Transcription events
'transcription:started'
'transcription:progress'
'transcription:result'
'transcription:complete'
'transcription:error'

// Model events
'model:download-progress'
'model:download-complete'
'model:installed'

// Speaker events
'speaker:created'
'speaker:updated'
'speaker:merged'
```

**Renderer → Main Commands**
```javascript
// Transcription commands
window.electronAPI.startTranscription(options)
window.electronAPI.stopTranscription(id)
window.electronAPI.processFile(filePath, options)

// Model commands
window.electronAPI.downloadModel(modelId)
window.electronAPI.getAvailableModels()
window.electronAPI.deleteModel(modelId)

// Speaker commands
window.electronAPI.setSpeakerLabel(speakerId, label)
window.electronAPI.mergeSpeakers(primaryId, secondaryId)
window.electronAPI.getAllSpeakers()

// Export commands
window.electronAPI.exportTranscription(data, format)
window.electronAPI.copyToClipboard(text)
```

#### Service APIs

**Transcription Service**
```javascript
const transcriptionService = new TranscriptionService();

// Initialize service
await transcriptionService.initialize();

// Start real-time transcription
const result = await transcriptionService.startTranscription({
  provider: 'whisper',
  model: 'base',
  language: 'en',
  enableSpeakerDiarization: true
});

// Process audio file
const transcription = await transcriptionService.processFile({
  filePath: '/path/to/audio.wav',
  provider: 'deepgram',
  model: 'nova-2'
});
```

**Model Manager**
```javascript
const modelManager = new ModelManager();

// Get available models
const models = await modelManager.getAvailableModels();

// Download model
await modelManager.downloadModel('whisper-base', {
  onProgress: (progress) => console.log(`${progress}%`)
});

// Check if model is installed
const isInstalled = await modelManager.isModelInstalled('whisper-base');
```

### Contributing

#### Development Setup

1. **Fork the Repository**
   - Fork on GitHub
   - Clone your fork locally
   - Add upstream remote

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

4. **Test Changes**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

5. **Submit Pull Request**
   - Push to your fork
   - Create pull request
   - Describe changes clearly

#### Code Style Guidelines

**JavaScript/Node.js**
- Use ES6+ features
- Prefer async/await over callbacks
- Use meaningful variable names
- Add JSDoc comments for functions
- Follow existing error handling patterns

**React/Frontend**
- Use functional components with hooks
- Implement proper prop validation
- Follow component composition patterns
- Use Tailwind CSS for styling
- Maintain responsive design principles

**File Organization**
- Group related functionality
- Use descriptive file names
- Maintain consistent directory structure
- Separate concerns appropriately

---

## Troubleshooting

### Common Issues

#### Installation Problems

**Windows: "App can't run on this PC"**
- Ensure you're running Windows 10 or later
- Download the correct architecture (x64/x86)
- Temporarily disable antivirus during installation

**macOS: "App is damaged and can't be opened"**
- Right-click the app and select "Open"
- Go to System Preferences → Security & Privacy
- Click "Open Anyway" for WhisperDesk Enhanced

**Linux: "Permission denied"**
- Make AppImage executable: `chmod +x WhisperDesk-Enhanced.AppImage`
- Install missing dependencies: `sudo apt-get install -f`

#### Audio Issues

**Microphone Not Working**
1. Check system audio settings
2. Grant microphone permissions to WhisperDesk
3. Test with other applications
4. Restart the application
5. Try different audio device

**No Audio Playback**
1. Check system volume settings
2. Verify audio output device
3. Test with other media players
4. Check WhisperDesk volume controls
5. Restart audio service

**Poor Audio Quality**
1. Use external microphone if possible
2. Reduce background noise
3. Adjust microphone gain
4. Enable noise reduction in settings
5. Record in quiet environment

#### Transcription Issues

**Low Accuracy Results**
1. Ensure clear speech and good audio quality
2. Try different model (larger models = better accuracy)
3. Verify correct language setting
4. Check for background noise
5. Consider using Deepgram for better accuracy

**Slow Transcription Speed**
1. Use smaller models for faster processing
2. Close other resource-intensive applications
3. Ensure sufficient RAM available
4. Consider cloud-based Deepgram for speed
5. Process shorter audio segments

**Speaker Diarization Not Working**
1. Enable speaker diarization in settings
2. Ensure speakers have distinct voices
3. Use longer audio samples for better detection
4. Manually label speakers for learning
5. Try different models with better diarization

#### Model Download Issues

**Download Fails or Stalls**
1. Check internet connection stability
2. Restart the download
3. Try downloading during off-peak hours
4. Check available disk space
5. Temporarily disable firewall/antivirus

**Model Not Appearing After Download**
1. Wait for download to complete fully
2. Restart the application
3. Check Models tab for status
4. Verify sufficient disk space
5. Re-download if necessary

#### Deepgram API Issues

**API Key Not Working**
1. Verify API key is correct
2. Check Deepgram account status
3. Ensure sufficient API credits
4. Test connection in settings
5. Contact Deepgram support if needed

**Connection Timeouts**
1. Check internet connection
2. Try different network if possible
3. Verify firewall settings
4. Contact network administrator
5. Use local Whisper as fallback

### Performance Optimization

#### System Requirements

**For Large Models (Large-v2, Large-v3)**
- Minimum 8 GB RAM (16 GB recommended)
- SSD storage for faster model loading
- Multi-core CPU for parallel processing

**For Real-time Transcription**
- Stable internet connection (for Deepgram)
- Low-latency audio interface
- Sufficient CPU resources

#### Optimization Tips

1. **Close Unnecessary Applications**
   - Free up system resources
   - Reduce CPU and memory usage
   - Improve transcription speed

2. **Use Appropriate Models**
   - Tiny/Base for speed
   - Medium/Large for accuracy
   - Consider use case requirements

3. **Optimize Audio Settings**
   - Use recommended sample rates
   - Enable hardware acceleration
   - Adjust buffer sizes if needed

4. **Regular Maintenance**
   - Clear transcription history periodically
   - Remove unused models
   - Update to latest version

### Getting Help

#### Log Files

**Windows**: `%APPDATA%\WhisperDesk\logs\`
**macOS**: `~/Library/Logs/WhisperDesk/`
**Linux**: `~/.config/WhisperDesk/logs/`

#### Diagnostic Information

1. Go to Settings → About
2. Click "Copy Diagnostic Info"
3. Include in support requests

#### Support Channels

- **GitHub Issues**: Bug reports and feature requests
- **Documentation**: Comprehensive guides and tutorials
- **Community Forum**: User discussions and tips
- **Email Support**: Direct technical assistance

---

## FAQ

### General Questions

**Q: Is WhisperDesk Enhanced free to use?**
A: Yes, the application is free and open-source. However, using Deepgram API requires a paid account with Deepgram.

**Q: What's the difference between local and cloud transcription?**
A: Local transcription (Whisper) runs on your computer and works offline but may be slower. Cloud transcription (Deepgram) is faster and more accurate but requires internet connection and API credits.

**Q: Can I use WhisperDesk Enhanced offline?**
A: Yes, when using local Whisper models. You need internet only for downloading models and using Deepgram API.

**Q: How accurate is the transcription?**
A: Accuracy depends on audio quality, speaker clarity, and model used. Large models can achieve 95%+ accuracy with clear audio. Deepgram Nova typically provides the highest accuracy.

### Technical Questions

**Q: Which model should I choose?**
A: For beginners, start with Whisper Base for good balance of speed and accuracy. Use Large models for best accuracy, Tiny for speed, or Deepgram Nova for cloud-based excellence.

**Q: How much storage do models require?**
A: Model sizes range from 39 MB (Tiny) to 2.87 GB (Large). Plan accordingly based on your storage capacity.

**Q: Can I transcribe multiple languages?**
A: Yes, most models support 80+ languages. Set language to "auto" for automatic detection or specify the language for better accuracy.

**Q: How does speaker recognition work?**
A: The system analyzes voice characteristics to identify different speakers. Accuracy improves over time as it learns voice patterns. You can manually label speakers for better recognition.

### Privacy and Security

**Q: Is my audio data secure?**
A: Local transcription keeps all data on your device. When using Deepgram, audio is processed on their secure servers according to their privacy policy.

**Q: Can I use this for confidential content?**
A: Yes, use local Whisper models for complete privacy. Avoid cloud services for sensitive content unless you trust the provider's security measures.

**Q: Where is my data stored?**
A: Transcriptions, models, and settings are stored locally on your device. You have full control over your data.

---

## Support

### Community Resources

- **GitHub Repository**: [https://github.com/whisperdesk/whisperdesk-enhanced](https://github.com/whisperdesk/whisperdesk-enhanced)
- **Documentation**: [https://docs.whisperdesk.com](https://docs.whisperdesk.com)
- **Community Forum**: [https://community.whisperdesk.com](https://community.whisperdesk.com)

### Professional Support

For enterprise users and professional support:
- **Email**: support@whisperdesk.com
- **Business Inquiries**: business@whisperdesk.com

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Code contributions
- Bug reports
- Feature requests
- Documentation improvements
- Translations

### License

WhisperDesk Enhanced is released under the MIT License. See [LICENSE](LICENSE) file for details.

---

*Last updated: June 2024*
*Version: 2.0.0*

**Thank you for using WhisperDesk Enhanced!**

For the latest updates and announcements, follow us on [GitHub](https://github.com/whisperdesk/whisperdesk-enhanced) and star the repository if you find it useful.

