# scripts/build-macos.sh - macOS specific build script
#!/bin/bash

echo "🍎 Building WhisperDesk for macOS"
echo "================================="

# Check for Xcode Command Line Tools
if ! xcode-select -p &> /dev/null; then
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "Please complete the installation and run this script again"
    exit 1
fi

# Install Homebrew dependencies
if command -v brew &> /dev/null; then
    brew install cmake
else
    echo "Homebrew not found. Please install: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

# Build whisper.cpp for macOS (Universal Binary)
echo "Building whisper.cpp for macOS..."
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
cd /tmp/whisper.cpp

# Build for both architectures
make clean
make -j$(sysctl -n hw.ncpu)

# Copy binary
mkdir -p "$(dirname "$0")/../binaries"
cp build/bin/whisper-cli "$(dirname "$0")/../binaries/whisper" 2>/dev/null || \
cp whisper-cli "$(dirname "$0")/../binaries/whisper"
chmod +x "$(dirname "$0")/../binaries/whisper"

cd "$(dirname "$0")/.."

# Install dependencies and build
npm install
cd src/renderer/whisperdesk-ui
pnpm install 2>/dev/null || npm install --legacy-peer-deps
pnpm run build 2>/dev/null || npm run build
cd ../../..

# Build for macOS
echo "Building Electron app for macOS..."
export CSC_IDENTITY_AUTO_DISCOVERY=false  # Disable code signing for now
npm run dist:mac

echo "✅ macOS build completed!"
echo "📦 Check the 'dist' directory for .dmg and .zip files"

# --- scripts/build-linux.sh - Linux specific build script ---
#!/bin/bash

echo "🐧 Building WhisperDesk for Linux"
echo "================================="

# Install dependencies based on distro
if command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    sudo apt-get update
    sudo apt-get install -y build-essential cmake libasound2-dev fuse libfuse2
elif command -v yum &> /dev/null; then
    # CentOS/RHEL
    sudo yum groupinstall -y "Development Tools"
    sudo yum install -y cmake alsa-lib-devel fuse fuse-libs
elif command -v pacman &> /dev/null; then
    # Arch Linux
    sudo pacman -S --needed base-devel cmake alsa-lib fuse2
else
    echo "⚠️  Please install build-essential, cmake, and alsa development libraries manually"
fi

# Build whisper.cpp for Linux
echo "Building whisper.cpp for Linux..."
git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
cd /tmp/whisper.cpp
make -j$(nproc)

# Copy binary
mkdir -p "$(dirname "$0")/../binaries"
cp build/bin/whisper-cli "$(dirname "$0")/../binaries/whisper" 2>/dev/null || \
cp whisper-cli "$(dirname "$0")/../binaries/whisper"
chmod +x "$(dirname "$0")/../binaries/whisper"

cd "$(dirname "$0")/.."

# Install dependencies and build
npm install
cd src/renderer/whisperdesk-ui
pnpm install 2>/dev/null || npm install --legacy-peer-deps
pnpm run build 2>/dev/null || npm run build
cd ../../..

# Build for Linux
echo "Building Electron app for Linux..."
npm run dist:linux

echo "✅ Linux build completed!"
echo "📦 Available formats:"
echo "   - AppImage (portable): dist/*.AppImage"
echo "   - Debian package: dist/*.deb"
echo "   - RPM package: dist/*.rpm"
echo "   - Tarball: dist/*.tar.gz"

# --- scripts/build-windows.ps1 - Windows PowerShell build script ---
# WhisperDesk Windows Build Script

Write-Host "🪟 Building WhisperDesk for Windows" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Check for required tools
$tools = @{
    "node" = "Node.js"
    "npm" = "npm"
    "git" = "Git"
}

foreach ($tool in $tools.Keys) {
    if (!(Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "❌ $($tools[$tool]) is required but not installed" -ForegroundColor Red
        exit 1
    }
}

# Install Visual Studio Build Tools if not present
try {
    & cl.exe /? 2>$null >$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing Visual Studio Build Tools..." -ForegroundColor Yellow
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            choco install visualstudio2022buildtools --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools" -y
        } else {
            Write-Host "⚠️  Please install Visual Studio Build Tools manually" -ForegroundColor Yellow
            Write-Host "Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "⚠️  Visual Studio Build Tools may not be installed" -ForegroundColor Yellow
}

# Install cmake if not present
if (!(Get-Command cmake -ErrorAction SilentlyContinue)) {
    Write-Host "Installing CMake..." -ForegroundColor Yellow
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install cmake -y
    } elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install Kitware.CMake
    } else {
        Write-Host "❌ Please install CMake manually" -ForegroundColor Red
        exit 1
    }
}

# Build whisper.cpp for Windows
Write-Host "Building whisper.cpp for Windows..." -ForegroundColor Blue
if (Test-Path "C:\temp\whisper.cpp") {
    Remove-Item -Recurse -Force "C:\temp\whisper.cpp"
}

git clone https://github.com/ggerganov/whisper.cpp.git C:\temp\whisper.cpp
Set-Location C:\temp\whisper.cpp

mkdir build -Force
Set-Location build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

# Copy binary
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path "$projectRoot\binaries"
Copy-Item "bin\Release\whisper-cli.exe" "$projectRoot\binaries\whisper.exe"

Set-Location $projectRoot

# Install dependencies and build
Write-Host "Installing dependencies..." -ForegroundColor Blue
npm install

Set-Location "src\renderer\whisperdesk-ui"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install
    pnpm run build
} else {
    npm install --legacy-peer-deps
    npm run build
}

Set-Location $projectRoot

# Build for Windows
Write-Host "Building Electron app for Windows..." -ForegroundColor Blue
$env:CSC_LINK = ""  # Disable code signing
npm run dist:win

Write-Host "✅ Windows build completed!" -ForegroundColor Green
Write-Host "📦 Available formats:" -ForegroundColor Blue
Write-Host "   - Installer: dist/*.exe" -ForegroundColor White
Write-Host "   - Portable: dist/*.zip" -ForegroundColor White

# --- scripts/build-universal.sh - Universal build script ---
#!/bin/bash

echo "🌍 WhisperDesk Universal Build Script"
echo "====================================="

# Detect current OS
case "$(uname -s)" in
    Darwin*)
        echo "🍎 Detected macOS - running macOS build script"
        ./scripts/build-macos.sh
        ;;
    Linux*)
        echo "🐧 Detected Linux - running Linux build script"  
        ./scripts/build-linux.sh
        ;;
    CYGWIN*|MINGW*|MSYS*)
        echo "🪟 Detected Windows - please run build-windows.ps1"
        echo "Run: powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1"
        ;;
    *)
        echo "❌ Unknown operating system"
        echo "Please use the appropriate platform-specific build script:"
        echo "  - macOS: ./scripts/build-macos.sh"
        echo "  - Linux: ./scripts/build-linux.sh"  
        echo "  - Windows: powershell scripts/build-windows.ps1"
        exit 1
        ;;
esac