#!/bin/bash

# WhisperDesk Enhanced - Cross-Platform Build Script
# This script builds the application for all supported platforms

set -e

echo "🚀 Starting WhisperDesk Enhanced build process..."

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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
    print_error "Node.js version $NODE_VERSION is not supported. Please install Node.js $REQUIRED_VERSION or later."
    exit 1
fi

print_status "Node.js version: $NODE_VERSION ✓"

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build renderer process
print_status "Building renderer process..."
cd src/renderer/whisperdesk-ui
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found, installing..."
    npm install -g pnpm
fi

pnpm install
pnpm run build
cd ../../..

print_success "Renderer build complete"

# Create dist directory
mkdir -p dist

# Build for different platforms based on arguments
PLATFORM=${1:-"all"}

case $PLATFORM in
    "win"|"windows")
        print_status "Building for Windows..."
        npm run dist:win
        print_success "Windows build complete"
        ;;
    "mac"|"macos")
        print_status "Building for macOS..."
        npm run dist:mac
        print_success "macOS build complete"
        ;;
    "linux")
        print_status "Building for Linux..."
        npm run dist:linux
        print_success "Linux build complete"
        ;;
    "all")
        print_status "Building for all platforms..."
        npm run dist:all
        print_success "All platform builds complete"
        ;;
    *)
        print_error "Unknown platform: $PLATFORM"
        print_status "Usage: $0 [win|mac|linux|all]"
        exit 1
        ;;
esac

# Display build results
print_status "Build artifacts:"
ls -la dist/

print_success "🎉 Build process completed successfully!"
print_status "📦 Installers are available in the 'dist' directory"

# Calculate total size
TOTAL_SIZE=$(du -sh dist/ | cut -f1)
print_status "📊 Total build size: $TOTAL_SIZE"

echo ""
echo "🚀 WhisperDesk Enhanced is ready for distribution!"
echo "   Windows: dist/*.exe"
echo "   macOS:   dist/*.dmg"
echo "   Linux:   dist/*.AppImage, dist/*.deb, dist/*.rpm"

