#!/bin/bash

# WhisperDesk Local Build and Test Script
# This script mimics the GitHub Actions workflow for local testing

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Detect OS
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    OS="windows"
    BINARY_EXT=".exe"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    BINARY_EXT=""
else
    OS="linux"
    BINARY_EXT=""
fi

log_info "Detected OS: $OS"

# Check for required tools
check_requirements() {
    log_info "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    log_success "Node.js found: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        exit 1
    fi
    log_success "npm found: $(npm --version)"
    
    # Check if pnpm is available (optional)
    if command -v pnpm &> /dev/null; then
        log_success "pnpm found: $(pnpm --version)"
        USE_PNPM=true
    else
        log_warning "pnpm not found, will use npm for renderer"
        USE_PNPM=false
    fi
    
    # Check CMake
    if ! command -v cmake &> /dev/null; then
        log_error "CMake is required but not installed"
        log_info "Install CMake from: https://cmake.org/download/"
        exit 1
    fi
    log_success "CMake found: $(cmake --version | head -1)"
    
    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is required but not installed"
        exit 1
    fi
    log_success "Git found: $(git --version)"
    
    # OS-specific checks
    if [[ "$OS" == "windows" ]]; then
        # Check for Visual Studio Build Tools or MSBuild
        if ! command -v msbuild &> /dev/null && ! command -v "MSBuild.exe" &> /dev/null; then
            log_warning "MSBuild not found in PATH"
            log_info "Make sure Visual Studio Build Tools are installed"
        else
            log_success "MSBuild found"
        fi
    elif [[ "$OS" == "macos" ]]; then
        # Check for Xcode Command Line Tools
        if ! xcode-select -p &> /dev/null; then
            log_error "Xcode Command Line Tools not installed"
            log_info "Run: xcode-select --install"
            exit 1
        fi
        log_success "Xcode Command Line Tools found"
    elif [[ "$OS" == "linux" ]]; then
        # Check for build essentials
        if ! command -v gcc &> /dev/null; then
            log_error "GCC not found. Install build-essential package"
            exit 1
        fi
        log_success "GCC found: $(gcc --version | head -1)"
    fi
}

# Fix package.json electron dependency
fix_package_json() {
    log_info "Checking and fixing package.json..."
    
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found in current directory"
        exit 1
    fi
    
    # Check if electron is in dependencies
    if node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).dependencies?.electron" 2>/dev/null | grep -v "undefined"; then
        log_warning "Found electron in dependencies, moving to devDependencies..."
        
        # Create fixed package.json
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            
            if (pkg.dependencies && pkg.dependencies.electron) {
                // Ensure devDependencies exists
                if (!pkg.devDependencies) pkg.devDependencies = {};
                
                // Move electron
                pkg.devDependencies.electron = pkg.dependencies.electron;
                delete pkg.dependencies.electron;
                
                console.log('✅ Moved electron from dependencies to devDependencies');
            }
            
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
        "
        
        log_success "Fixed package.json electron dependency"
    else
        log_success "package.json is already correct (electron in devDependencies or not present)"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing main dependencies..."
    npm install
    log_success "Main dependencies installed"
    
    # Install renderer dependencies if directory exists
    if [[ -d "src/renderer/whisperdesk-ui" ]]; then
        log_info "Installing renderer dependencies..."
        cd src/renderer/whisperdesk-ui
        
        if [[ "$USE_PNPM" == true ]]; then
            pnpm install
        else
            npm install
        fi
        
        cd ../../..
        log_success "Renderer dependencies installed"
    else
        log_warning "Renderer directory not found, skipping"
    fi
}

# Build whisper.cpp
build_whisper() {
    log_info "Building whisper.cpp..."
    
    # Create temp directory for whisper build
    WHISPER_BUILD_DIR="/tmp/whisper-build"
    if [[ "$OS" == "windows" ]]; then
        WHISPER_BUILD_DIR="C:/temp/whisper-build"
    fi
    
    # Clean up any previous build
    rm -rf "$WHISPER_BUILD_DIR"
    
    # Clone whisper.cpp
    log_info "Cloning whisper.cpp repository..."
    git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_BUILD_DIR"
    cd "$WHISPER_BUILD_DIR"
    
    # Configure CMake based on OS
    if [[ "$OS" == "windows" ]]; then
        log_info "Configuring CMake for Windows..."
        cmake -S . -B build -A x64 \
            -DCMAKE_BUILD_TYPE=Release \
            -DBUILD_SHARED_LIBS=ON \
            -DWHISPER_BUILD_TESTS=OFF \
            -DWHISPER_BUILD_EXAMPLES=ON
    elif [[ "$OS" == "macos" ]]; then
        log_info "Configuring CMake for macOS..."
        # Detect architecture
        ARCH=$(uname -m)
        if [[ "$ARCH" == "arm64" ]]; then
            CMAKE_ARCH_FLAGS="-DCMAKE_OSX_ARCHITECTURES=arm64"
        else
            CMAKE_ARCH_FLAGS="-DCMAKE_OSX_ARCHITECTURES=x86_64 -DGGML_NATIVE=OFF"
        fi
        
        cmake -B build \
            -DCMAKE_BUILD_TYPE=Release \
            -DWHISPER_BUILD_TESTS=OFF \
            -DWHISPER_BUILD_EXAMPLES=ON \
            $CMAKE_ARCH_FLAGS
    else
        log_info "Configuring CMake for Linux..."
        cmake -B build \
            -DCMAKE_BUILD_TYPE=Release \
            -DWHISPER_BUILD_TESTS=OFF \
            -DWHISPER_BUILD_EXAMPLES=ON
    fi
    
    # Build
    log_info "Building whisper.cpp (this may take a few minutes)..."
    if [[ "$OS" == "windows" ]]; then
        cmake --build build --config Release --parallel 4
        BUILD_DIR="build/bin/Release"
    else
        cmake --build build --config Release --parallel $(nproc 2>/dev/null || sysctl -n hw.logicalcpu 2>/dev/null || echo 4)
        BUILD_DIR="build/bin"
    fi
    
    # Find the binary
    if [[ -f "$BUILD_DIR/whisper-cli$BINARY_EXT" ]]; then
        WHISPER_BINARY="$BUILD_DIR/whisper-cli$BINARY_EXT"
    elif [[ -f "$BUILD_DIR/main$BINARY_EXT" ]]; then
        WHISPER_BINARY="$BUILD_DIR/main$BINARY_EXT"
    else
        log_error "No suitable binary found in $BUILD_DIR"
        ls -la "$BUILD_DIR"
        exit 1
    fi
    
    # Verify binary
    if [[ ! -f "$WHISPER_BINARY" ]]; then
        log_error "Binary not found: $WHISPER_BINARY"
        exit 1
    fi
    
    # Check size
    if [[ "$OS" == "macos" || "$OS" == "linux" ]]; then
        SIZE=$(stat -c%s "$WHISPER_BINARY" 2>/dev/null || stat -f%z "$WHISPER_BINARY")
    else
        SIZE=$(wc -c < "$WHISPER_BINARY" | tr -d ' ')
    fi
    
    log_info "Binary size: $SIZE bytes"
    
    if [[ "$SIZE" -lt 50000 ]]; then
        log_error "Binary too small ($SIZE bytes), likely corrupted"
        exit 1
    fi
    
    # Copy to project directory
    cd - > /dev/null  # Return to original directory
    mkdir -p binaries
    cp "$WHISPER_BINARY" "binaries/whisper-cli$BINARY_EXT"
    chmod +x "binaries/whisper-cli$BINARY_EXT" 2>/dev/null || true
    
    # Copy DLLs on Windows
    if [[ "$OS" == "windows" ]]; then
        log_info "Copying Windows DLLs..."
        cp "$WHISPER_BUILD_DIR/$BUILD_DIR"/*.dll binaries/ 2>/dev/null || log_warning "No DLLs found to copy"
    fi
    
    log_success "whisper.cpp built and copied to binaries/"
}

# Test the binary
test_binary() {
    log_info "Testing whisper binary..."
    
    BINARY_PATH="binaries/whisper-cli$BINARY_EXT"
    
    if [[ ! -f "$BINARY_PATH" ]]; then
        log_error "Binary not found: $BINARY_PATH"
        exit 1
    fi
    
    # Try to run the binary with --help (should not crash)
    if [[ "$OS" == "windows" ]]; then
        # On Windows, just check if file exists and has reasonable size
        log_success "Binary exists and appears valid"
    else
        # On Unix systems, try to run it
        if timeout 5s "$BINARY_PATH" --help &>/dev/null; then
            log_success "Binary runs successfully"
        else
            log_warning "Binary exists but may have runtime issues"
            log_info "This might be normal if dependencies are missing"
        fi
    fi
}

# Download tiny model
download_model() {
    log_info "Downloading tiny model for testing..."
    
    mkdir -p models
    
    if command -v curl &> /dev/null; then
        curl -L -o models/ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
    elif command -v wget &> /dev/null; then
        wget -O models/ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
    else
        log_warning "Neither curl nor wget found, skipping model download"
        return
    fi
    
    log_success "Model downloaded to models/ggml-tiny.bin"
}

# Build renderer
build_renderer() {
    if [[ -d "src/renderer/whisperdesk-ui" ]]; then
        log_info "Building renderer..."
        cd src/renderer/whisperdesk-ui
        
        if [[ "$USE_PNPM" == true ]]; then
            pnpm run build
        else
            npm run build
        fi
        
        cd ../../..
        log_success "Renderer built"
    else
        log_warning "Renderer directory not found, skipping"
    fi
}

# Build Electron app
build_electron() {
    log_info "Building Electron app..."
    
    # Set environment variables
    export CSC_IDENTITY_AUTO_DISCOVERY=false
    
    # Build for current platform
    if [[ "$OS" == "windows" ]]; then
        npx electron-builder --win --x64 --publish=never
    elif [[ "$OS" == "macos" ]]; then
        ARCH=$(uname -m)
        if [[ "$ARCH" == "arm64" ]]; then
            npx electron-builder --mac --arm64 --publish=never
        else
            npx electron-builder --mac --x64 --publish=never
        fi
    else
        npx electron-builder --linux --x64 --publish=never
    fi
    
    log_success "Electron app built"
    
    # Show output files
    if [[ -d "dist" ]]; then
        log_info "Built files:"
        ls -la dist/
    fi
}

# Main execution
main() {
    log_info "Starting WhisperDesk local build process..."
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]]; then
        log_error "package.json not found. Please run this script from the project root directory."
        exit 1
    fi
    
    check_requirements
    fix_package_json
    install_dependencies
    build_whisper
    test_binary
    download_model
    build_renderer
    build_electron
    
    log_success "Build process completed successfully!"
    log_info "Check the 'dist' directory for your built application"
}

# Run with option parsing
SKIP_WHISPER=false
SKIP_MODEL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-whisper)
            SKIP_WHISPER=true
            shift
            ;;
        --skip-model)
            SKIP_MODEL=true
            shift
            ;;
        --help)
            echo "WhisperDesk Local Build Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-whisper   Skip building whisper.cpp (use existing binary)"
            echo "  --skip-model     Skip downloading the tiny model"
            echo "  --help           Show this help message"
            echo ""
            echo "This script mimics the GitHub Actions workflow for local testing."
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            log_info "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Override functions if skipping
if [[ "$SKIP_WHISPER" == true ]]; then
    build_whisper() {
        log_info "Skipping whisper.cpp build (--skip-whisper)"
    }
    test_binary() {
        log_info "Skipping binary test (--skip-whisper)"
    }
fi

if [[ "$SKIP_MODEL" == true ]]; then
    download_model() {
        log_info "Skipping model download (--skip-model)"
    }
fi

# Run main function
main