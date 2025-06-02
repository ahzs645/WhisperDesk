# WhisperDesk Setup Instructions - Windows

## 🪟 Windows Setup Guide

### Prerequisites
- Windows 10/11 (64-bit)
- Node.js 18+
- Visual Studio Build Tools or Visual Studio Community

### Step 1: Install Prerequisites

#### Install Node.js
```powershell
# Option A: Download from nodejs.org
# Go to https://nodejs.org and download the Windows Installer (.msi)

# Option B: Using Chocolatey
choco install nodejs

# Option C: Using winget
winget install OpenJS.NodeJS

# Option D: Using Scoop
scoop install nodejs
```

#### Install Build Tools
```powershell
# Option A: Visual Studio Build Tools (Recommended)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Install "C++ build tools" workload

# Option B: Visual Studio Community
# Download from: https://visualstudio.microsoft.com/vs/community/
# Install with "Desktop development with C++" workload

# Option C: Using Chocolatey
choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools"
```

#### Install Git (if not already installed)
```powershell
# Download from: https://git-scm.com/download/win
# Or using package managers:
choco install git
# or
winget install Git.Git
```

### Step 2: Clone and Setup Project

```powershell
# Clone the repository
git clone <your-repo-url>
cd WhisperDesk

# Install main dependencies
npm install

# Install renderer dependencies
cd src\renderer\whisperdesk-ui
npm install --legacy-peer-deps
cd ..\..\..
```

### Step 3: Set up Whisper Binary

#### Option A: Build from Source (Recommended)

```powershell
# Install CMake
choco install cmake
# or
winget install Kitware.CMake

# Clone whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git C:\temp\whisper.cpp
cd C:\temp\whisper.cpp

# Build using CMake
mkdir build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Copy binary to project (adjust path as needed)
mkdir C:\path\to\WhisperDesk\binaries
copy bin\Release\whisper-cli.exe C:\path\to\WhisperDesk\binaries\whisper.exe

# Return to project directory
cd C:\path\to\WhisperDesk
```

#### Option B: Build using Visual Studio

```powershell
# Open Developer Command Prompt for VS 2022
# Clone and build
git clone https://github.com/ggerganov/whisper.cpp.git C:\temp\whisper.cpp
cd C:\temp\whisper.cpp

# Build with MSBuild
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64
msbuild whisper.cpp.sln /p:Configuration=Release

# Copy binary
copy bin\Release\whisper-cli.exe C:\path\to\WhisperDesk\binaries\whisper.exe
```

#### Option C: Use Pre-built Binary (if available)

```powershell
# Download from releases (PowerShell)
Invoke-WebRequest -Uri "https://github.com/ggerganov/whisper.cpp/releases/latest/download/whisper-win64.zip" -OutFile "binaries\whisper-win64.zip"
Expand-Archive -Path "binaries\whisper-win64.zip" -DestinationPath "binaries\"
```

### Step 4: Download Models

```powershell
# Create models directory
$modelsDir = "$env:APPDATA\whisperdesk-enhanced\models"
New-Item -ItemType Directory -Force -Path $modelsDir

# Download tiny model for testing
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" -OutFile "$modelsDir\ggml-tiny.bin"
```

### Step 5: Test and Run

```powershell
# Test native services
npm run test:native

# Start the application
npm run dev

# Or start web interface
npm run web
```

## 🔧 Windows-Specific Notes

### File Paths
- **Models Directory**: `%APPDATA%\whisperdesk-enhanced\models\`
- **Config Directory**: `%APPDATA%\whisperdesk-enhanced\`
- **Binary Location**: `.\binaries\whisper.exe`

### PowerShell vs Command Prompt
Most commands work in both, but PowerShell is recommended for better functionality.

### Common Issues

#### Node.js Permission Issues
```powershell
# Run PowerShell as Administrator if you get permission errors
# Or set execution policy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Build Tools Not Found
```powershell
# Verify Visual Studio Build Tools installation
where cl
# Should show path to compiler

# If not found, reinstall Visual Studio Build Tools
```

#### Python Not Found (for some npm packages)
```powershell
# Install Python (some native modules need it)
choco install python
# or
winget install Python.Python.3.11
```

#### Long Path Issues
```powershell
# Enable long paths in Windows (run as Administrator)
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### Windows Defender / Antivirus

If Windows Defender blocks the whisper binary:

```powershell
# Add exclusion for the project directory
Add-MpPreference -ExclusionPath "C:\path\to\WhisperDesk"

# Or add exclusion for the binary
Add-MpPreference -ExclusionPath "C:\path\to\WhisperDesk\binaries\whisper.exe"
```

## 🚀 Running Options

### Electron App
```powershell
npm run dev
```

### Web Interface
```powershell
npm run web
# Open http://localhost:3000
```

### API Server Only
```powershell
npm run server
# Server runs on http://localhost:3001
```

## 🛠️ Alternative Setup Methods

### Using WSL2 (Windows Subsystem for Linux)

If you prefer a Linux-like environment:

```powershell
# Install WSL2
wsl --install

# Then follow the Linux setup instructions inside WSL2
```

### Using Docker

```powershell
# Build Docker image (if Dockerfile is provided)
docker build -t whisperdesk .

# Run container
docker run -p 3000:3000 -p 3001:3001 whisperdesk
```

## 📋 Troubleshooting

### MSBuild Errors
- Ensure Visual Studio Build Tools are properly installed
- Try running from "Developer Command Prompt"
- Check that Windows SDK is installed

### Node.js Module Compilation Errors
- Install Python: `npm install --global windows-build-tools`
- Or use: `npm install --global @microsoft/rush-stack-compiler-3.9`

### Path Issues
- Use forward slashes in npm scripts: `/` instead of `\`
- Or use cross-platform tools like `cross-env`

