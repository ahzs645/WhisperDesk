# WhisperDesk Setup Instructions - macOS

## 🍎 macOS Setup Guide

### Prerequisites
- macOS 10.15+ (Catalina or later)
- Node.js 18+ 
- Xcode Command Line Tools

### Step 1: Install Prerequisites

#### Install Node.js
```bash
# Option A: Download from nodejs.org
# Go to https://nodejs.org and download the LTS version

# Option B: Using Homebrew (recommended)
brew install node

# Option C: Using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

#### Install Xcode Command Line Tools
```bash
xcode-select --install
```

#### Install Homebrew (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Clone and Setup Project

```bash
# Clone the repository
git clone <your-repo-url>
cd WhisperDesk

# Install main dependencies
npm install

# Install renderer dependencies
cd src/renderer/whisperdesk-ui
npm install --legacy-peer-deps
cd ../../..
```

### Step 3: Set up Whisper Binary

#### Option A: Build from Source (Recommended)
```bash
# Install build dependencies
brew install cmake

# Clone and build whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
cd /tmp/whisper.cpp

# Build for macOS
make -j$(sysctl -n hw.ncpu)

# Copy binary to project
mkdir -p ~/path/to/WhisperDesk/binaries
cp build/bin/whisper-cli ~/path/to/WhisperDesk/binaries/whisper
chmod +x ~/path/to/WhisperDesk/binaries/whisper

# Return to project directory
cd ~/path/to/WhisperDesk
```

#### Option B: Use Pre-built Binary (if available)
```bash
# Download from releases (if available)
curl -L -o binaries/whisper-macos.zip \
  https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-macos.zip
unzip binaries/whisper-macos.zip -d binaries/
chmod +x binaries/whisper
```

### Step 4: Download Models

```bash
# Create models directory
mkdir -p ~/Library/Application\ Support/whisperdesk-enhanced/models

# Download tiny model for testing
curl -L -o ~/Library/Application\ Support/whisperdesk-enhanced/models/ggml-tiny.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
```

### Step 5: Test and Run

```bash
# Test native services
npm run test:native

# Start the application
npm run dev

# Or start web interface
npm run web
```

## 🔧 macOS-Specific Notes

### File Paths
- **Models Directory**: `~/Library/Application Support/whisperdesk-enhanced/models/`
- **Config Directory**: `~/Library/Application Support/whisperdesk-enhanced/`
- **Binary Location**: `./binaries/whisper`

### Common Issues

#### Permission Denied
```bash
# If you get permission denied errors
sudo xcode-select --reset
sudo xcode-select --install
```

#### Homebrew Issues
```bash
# If brew command not found
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### Node.js Version Issues
```bash
# Check Node.js version
node --version

# If version is too old, update
brew upgrade node
```

### Apple Silicon (M1/M2) Specific

```bash
# For Apple Silicon Macs, you might need Rosetta for some dependencies
softwareupdate --install-rosetta

# Build whisper.cpp with optimizations
cd /tmp/whisper.cpp
make -j$(sysctl -n hw.ncpu) WHISPER_METAL=1
```

## 🚀 Running Options

### Electron App
```bash
npm run dev
```

### Web Interface
```bash
npm run web
# Open http://localhost:3000
```

### API Server Only
```bash
npm run server
# Server runs on http://localhost:3001
```

