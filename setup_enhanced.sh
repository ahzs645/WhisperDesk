#!/bin/bash

# WhisperDesk Enhanced - Automated Setup Script
# This script sets up the complete WhisperDesk Enhanced application

set -e  # Exit on any error

echo "🚀 WhisperDesk Enhanced - Automated Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
check_os() {
    print_status "Checking operating system..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_success "macOS detected"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        print_success "Windows detected"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
}

# Check for required tools
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm not found. Please install npm"
        exit 1
    fi
    
    # Check Python
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_success "Python found: $PYTHON_VERSION"
    else
        print_warning "Python3 not found. Transcription features may not work."
        print_warning "Please install Python 3.8+ from https://python.org/"
    fi
    
    # Check FFmpeg
    if command -v ffmpeg &> /dev/null; then
        print_success "FFmpeg found"
    else
        print_warning "FFmpeg not found. Audio processing may not work."
        if [[ "$OS" == "linux" ]]; then
            print_status "Installing FFmpeg..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y ffmpeg
            elif command -v yum &> /dev/null; then
                sudo yum install -y ffmpeg
            else
                print_warning "Please install FFmpeg manually"
            fi
        elif [[ "$OS" == "macos" ]]; then
            if command -v brew &> /dev/null; then
                print_status "Installing FFmpeg via Homebrew..."
                brew install ffmpeg
            else
                print_warning "Please install FFmpeg manually or install Homebrew first"
            fi
        fi
    fi
}

# Install build tools for native modules
install_build_tools() {
    print_status "Installing build tools..."
    
    if [[ "$OS" == "linux" ]]; then
        if command -v apt-get &> /dev/null; then
            print_status "Installing build tools for Ubuntu/Debian..."
            sudo apt-get update
            sudo apt-get install -y build-essential libasound2-dev
            print_success "Build tools installed"
        elif command -v yum &> /dev/null; then
            print_status "Installing build tools for CentOS/RHEL..."
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y alsa-lib-devel
            print_success "Build tools installed"
        else
            print_warning "Please install build tools manually for your Linux distribution"
        fi
    elif [[ "$OS" == "macos" ]]; then
        if ! xcode-select -p &> /dev/null; then
            print_status "Installing Xcode command line tools..."
            xcode-select --install
            print_warning "Please complete the Xcode installation and run this script again"
            exit 1
        else
            print_success "Xcode command line tools already installed"
        fi
    fi
}

# Install pnpm globally
install_pnpm() {
    print_status "Checking for pnpm..."
    
    if command -v pnpm &> /dev/null; then
        PNPM_VERSION=$(pnpm --version)
        print_success "pnpm found: $PNPM_VERSION"
    else
        print_status "Installing pnpm..."
        npm install -g pnpm
        print_success "pnpm installed"
    fi
}

# Install main application dependencies
install_main_deps() {
    print_status "Installing main application dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        print_success "Main dependencies installed"
    else
        print_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
}

# Install frontend dependencies
install_frontend_deps() {
    print_status "Installing frontend dependencies..."
    
    if [ -d "src/renderer/whisperdesk-ui" ]; then
        cd src/renderer/whisperdesk-ui
        pnpm install
        cd ../../..
        print_success "Frontend dependencies installed"
    else
        print_warning "Frontend directory not found. Skipping frontend setup."
    fi
}

# Install Python dependencies
install_python_deps() {
    if command -v python3 &> /dev/null && command -v pip3 &> /dev/null; then
        print_status "Installing Python dependencies..."
        pip3 install openai-whisper
        print_success "Python dependencies installed"
    else
        print_warning "Python3 or pip3 not found. Skipping Python dependencies."
        print_warning "Install manually with: pip3 install openai-whisper"
    fi
}

# Test the installation
test_installation() {
    print_status "Testing installation..."
    
    # Test services
    if [ -f "test-services.js" ]; then
        print_status "Testing backend services..."
        if node test-services.js; then
            print_success "Backend services test passed"
        else
            print_warning "Backend services test failed, but installation may still work"
        fi
    fi
    
    print_success "Installation test completed"
}

# Main installation process
main() {
    echo "Starting WhisperDesk Enhanced setup..."
    echo ""
    
    check_os
    check_dependencies
    install_build_tools
    install_pnpm
    install_main_deps
    install_frontend_deps
    install_python_deps
    test_installation
    
    echo ""
    echo "🎉 Setup Complete!"
    echo "=================="
    echo ""
    print_success "WhisperDesk Enhanced has been successfully installed!"
    echo ""
    echo "To start the application:"
    echo "  npm run dev"
    echo ""
    echo "Then open your browser to: http://localhost:3000"
    echo ""
    echo "For transcription via command line:"
    echo "  python3 transcribe_audio.py"
    echo ""
    echo "For model management:"
    echo "  node download-tiny-model.js"
    echo "  node test-services.js"
    echo ""
    print_status "Check README_ENHANCED.md for detailed usage instructions"
    echo ""
}

# Run main function
main "$@"

