# scripts/build-all.sh - Master build script for all platforms
#!/bin/bash

echo "🚀 WhisperDesk - Build All Platforms"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if we're on the right platform for cross-compilation
CURRENT_OS=$(uname -s)
print_status "Current OS: $CURRENT_OS"

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is required but not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is required but not installed"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Function to build whisper.cpp
build_whisper_cpp() {
    print_status "Building whisper.cpp from source..."
    
    # Create temporary directory
    TEMP_DIR="/tmp/whisper-cpp-build-$(date +%s)"
    mkdir -p "$TEMP_DIR"
    
    # Clone whisper.cpp
    git clone https://github.com/ggerganov/whisper.cpp.git "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Build
    if [[ "$CURRENT_OS" == "Darwin" ]]; then
        make -j$(sysctl -n hw.ncpu)
    else
        make -j$(nproc)
    fi
    
    # Copy binary
    mkdir -p "$PROJECT_ROOT/binaries"
    if [[ -f "build/bin/whisper-cli" ]]; then
        cp "build/bin/whisper-cli" "$PROJECT_ROOT/binaries/whisper"
    elif [[ -f "whisper-cli" ]]; then
        cp "whisper-cli" "$PROJECT_ROOT/binaries/whisper"
    else
        print_error "Could not find whisper-cli binary"
        return 1
    fi
    
    chmod +x "$PROJECT_ROOT/binaries/whisper"
    
    # Cleanup
    cd "$PROJECT_ROOT"
    rm -rf "$TEMP_DIR"
    
    print_success "whisper.cpp built successfully"
}

# Function to download models
download_models() {
    print_status "Downloading essential models..."
    
    mkdir -p models
    
    # Download tiny model (essential for basic functionality)
    if [[ ! -f "models/ggml-tiny.bin" ]]; then
        print_status "Downloading Whisper Tiny model..."
        curl -L -o models/ggml-tiny.bin \
            https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin
        
        if [[ $? -eq 0 ]]; then
            print_success "Tiny model downloaded"
        else
            print_warning "Failed to download tiny model"
        fi
    else
        print_status "Tiny model already exists"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Main dependencies
    npm install
    
    # Renderer dependencies
    cd src/renderer/whisperdesk-ui
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install --legacy-peer-deps
    fi
    
    cd "$PROJECT_ROOT"
    print_success "Dependencies installed"
}

# Function to build renderer
build_renderer() {
    print_status "Building renderer..."
    
    cd src/renderer/whisperdesk-ui
    
    if command -v pnpm &> /dev/null; then
        pnpm run build
    else
        npm run build
    fi
    
    cd "$PROJECT_ROOT"
    print_success "Renderer built"
}

# Function to build for current platform
build_current_platform() {
    print_status "Building for current platform ($CURRENT_OS)..."
    
    case "$CURRENT_OS" in
        "Darwin")
            npm run dist:mac
            print_success "macOS build completed"
            ;;
        "Linux")
            npm run dist:linux
            print_success "Linux build completed"
            ;;
        "MINGW"*|"CYGWIN"*|"MSYS"*)
            npm run dist:win
            print_success "Windows build completed"
            ;;
        *)
            print_warning "Unknown platform, attempting generic build"
            npm run dist
            ;;
    esac
}

# Function to build all platforms (requires appropriate OS)
build_all_platforms() {
    print_status "Building for all platforms..."
    
    # This only works well on macOS for cross-compilation
    if [[ "$CURRENT_OS" == "Darwin" ]]; then
        print_status "Building macOS versions..."
        npm run dist:mac
        
        print_status "Building Windows version..."
        npm run dist:win
        
        print_status "Building Linux version..."
        npm run dist:linux
        
        print_success "All platform builds completed"
    else
        print_warning "Cross-platform building works best on macOS"
        print_status "Building for current platform only"
        build_current_platform
    fi
}

# Function to show build results
show_results() {
    print_status "Build results:"
    
    if [[ -d "dist" ]]; then
        ls -la dist/
        
        echo ""
        print_success "📦 Build artifacts created in 'dist' directory"
        
        # Show platform-specific instructions
        echo ""
        print_status "📋 Installation instructions:"
        echo "  macOS:   Double-click the .dmg file"
        echo "  Windows: Run the .exe installer"
        echo "  Linux:   Use .AppImage (portable) or install .deb/.rpm"
        
    else
        print_error "No dist directory found - build may have failed"
    fi
}

# Main execution
main() {
    PROJECT_ROOT=$(pwd)
    
    print_status "Starting WhisperDesk build process..."
    print_status "Project root: $PROJECT_ROOT"
    
    # Check what to build
    if [[ "$1" == "all" ]]; then
        BUILD_ALL=true
    else
        BUILD_ALL=false
    fi
    
    # Execute build steps
    check_dependencies
    install_dependencies
    build_whisper_cpp
    download_models
    build_renderer
    
    if [[ "$BUILD_ALL" == "true" ]]; then
        build_all_platforms
    else
        build_current_platform
    fi
    
    show_results
    
    print_success "🎉 Build process completed!"
}

# Script usage
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [[ "$1" == "--help" || "$1" == "-h" ]]; then
        echo "Usage: $0 [all]"
        echo ""
        echo "Options:"
        echo "  all     Build for all platforms (works best on macOS)"
        echo "  (none)  Build for current platform only"
        echo ""
        echo "Examples:"
        echo "  $0          # Build for current platform"
        echo "  $0 all      # Build for all platforms"
        exit 0
    fi
    
    main "$@"
fi