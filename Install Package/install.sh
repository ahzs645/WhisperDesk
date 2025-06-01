#!/bin/bash

# WhisperDesk Enhanced - Installation Script
# This script sets up the complete WhisperDesk Enhanced application

set -e

echo "🚀 WhisperDesk Enhanced - Installation Script"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on supported OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*)    MACHINE=Cygwin;;
    MINGW*)     MACHINE=MinGw;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

print_status "Detected OS: $MACHINE"

# Check Node.js version
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or later."
    print_status "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
print_status "Node.js version: $NODE_VERSION"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

# Install system dependencies based on OS
print_status "Installing system dependencies..."

case "${MACHINE}" in
    Linux)
        if command -v apt-get &> /dev/null; then
            print_status "Installing dependencies with apt-get..."
            sudo apt-get update
            sudo apt-get install -y build-essential libasound2-dev ffmpeg python3 python3-pip
        elif command -v yum &> /dev/null; then
            print_status "Installing dependencies with yum..."
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y alsa-lib-devel ffmpeg python3 python3-pip
        elif command -v pacman &> /dev/null; then
            print_status "Installing dependencies with pacman..."
            sudo pacman -S --noconfirm base-devel alsa-lib ffmpeg python python-pip
        else
            print_warning "Unknown Linux distribution. Please install build tools, ALSA development libraries, and FFmpeg manually."
        fi
        ;;
    Mac)
        if command -v brew &> /dev/null; then
            print_status "Installing dependencies with Homebrew..."
            brew install ffmpeg python3
        else
            print_warning "Homebrew not found. Please install FFmpeg and Python3 manually."
            print_status "Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        fi
        ;;
    *)
        print_warning "Unsupported OS. Please install FFmpeg and Python3 manually."
        ;;
esac

# Install Python dependencies for Whisper
print_status "Installing Python dependencies..."
pip3 install --user openai-whisper torch torchaudio

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install

# Install renderer dependencies
print_status "Installing frontend dependencies..."
cd src/renderer/whisperdesk-ui
if ! command -v pnpm &> /dev/null; then
    print_status "Installing pnpm..."
    npm install -g pnpm
fi
pnpm install
cd ../../..

# Create necessary directories
print_status "Creating application directories..."
mkdir -p ~/.whisperdesk/{models,speakers,exports,logs}

# Download a basic Whisper model
print_status "Downloading Whisper base model..."
python3 -c "
import whisper
print('Downloading Whisper base model...')
model = whisper.load_model('base')
print('Model downloaded successfully!')
"

# Make scripts executable
chmod +x scripts/build.sh
if [ -f scripts/build.bat ]; then
    chmod +x scripts/build.bat
fi

# Create desktop entry for Linux
if [ "$MACHINE" = "Linux" ]; then
    print_status "Creating desktop entry..."
    cat > ~/.local/share/applications/whisperdesk-enhanced.desktop << EOF
[Desktop Entry]
Name=WhisperDesk Enhanced
Comment=Advanced AI-powered transcription application
Exec=$(pwd)/scripts/start.sh
Icon=$(pwd)/resources/icons/icon.png
Terminal=false
Type=Application
Categories=AudioVideo;Audio;
EOF
fi

print_success "Installation complete!"
echo ""
echo "🎉 WhisperDesk Enhanced is ready to use!"
echo ""
echo "📋 Next steps:"
echo "   1. Run 'npm run dev' to start development mode"
echo "   2. Or run 'npm run build && npm run dist' to create distributable packages"
echo "   3. Configure Deepgram API key in Settings (optional)"
echo ""
echo "📁 Application data stored in: ~/.whisperdesk/"
echo "📖 Documentation: README.md"
echo ""
print_status "Happy transcribing! 🎙️"

