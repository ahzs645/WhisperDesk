#!/bin/bash
# scripts/build-whisper.sh - Modern whisper.cpp build script

echo "🔨 Building whisper.cpp with Modern CMAKE Approach"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
print_status "Checking build dependencies..."

if ! command -v cmake >/dev/null 2>&1; then
    print_error "cmake not found"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        print_status "Installing cmake via Homebrew..."
        if command -v brew >/dev/null 2>&1; then
            brew install cmake
        else
            print_error "Homebrew not found. Please install cmake manually"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        print_status "Installing cmake via package manager..."
        sudo apt-get update && sudo apt-get install -y cmake build-essential || {
            print_error "Failed to install cmake. Please install manually"
            exit 1
        }
    else
        print_error "Please install cmake manually"
        exit 1
    fi
fi

# Check for build tools
if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! xcode-select -p >/dev/null 2>&1; then
        print_warning "Xcode Command Line Tools not found"
        print_status "Installing Xcode Command Line Tools..."
        xcode-select --install
        print_warning "Please complete the installation and run this script again"
        exit 1
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if ! command -v make >/dev/null 2>&1 || ! command -v gcc >/dev/null 2>&1; then
        print_warning "Build tools not found"
        print_status "Installing build tools..."
        sudo apt-get update && sudo apt-get install -y build-essential
    fi
fi

print_success "Dependencies ready"

# Set up directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMP_DIR="/tmp/whisper-cpp-build-$(date +%s)"
BINARIES_DIR="$PROJECT_ROOT/binaries"

print_status "Project root: $PROJECT_ROOT"
print_status "Temp directory: $TEMP_DIR"
print_status "Binaries directory: $BINARIES_DIR"

# Clean up any existing temp directory
rm -rf "$TEMP_DIR"

# Clone whisper.cpp
print_status "Cloning whisper.cpp..."
git clone https://github.com/ggerganov/whisper.cpp.git "$TEMP_DIR"

if [ $? -ne 0 ]; then
    print_error "Failed to clone whisper.cpp"
    exit 1
fi

cd "$TEMP_DIR"

# Build with cmake (modern approach)
print_status "Configuring build with cmake..."
# Base CMake arguments applicable to all platforms
CMAKE_ARGS=("-S" "." "-B" "build" "-DCMAKE_BUILD_TYPE=Release" "-DBUILD_SHARED_LIBS=OFF" "-DWHISPER_BUILD_TESTS=OFF" "-DWHISPER_BUILD_EXAMPLES=ON")

if [[ "$OSTYPE" == "darwin"* ]]; then
    print_status "Configuring for macOS..."
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
        print_status "Detected Apple Silicon (arm64). Configuring specific architecture."
        CMAKE_ARGS+=("-DCMAKE_OSX_ARCHITECTURES=arm64")
    else
        print_status "Detected Intel macOS (x86_64). Configuring specific architecture."
        CMAKE_ARGS+=("-DCMAKE_OSX_ARCHITECTURES=x86_64")
        # Consider adding -DGGML_NATIVE=OFF for broader compatibility on older x86_64 Macs if needed
        # CMAKE_ARGS+=("-DGGML_NATIVE=OFF")
    fi
    CMAKE_ARGS+=("-DCMAKE_OSX_DEPLOYMENT_TARGET=11.0") # macOS specific
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    print_status "Configuring for Linux (x86_64 assumed)..."
    # Explicitly enable common x86_64 features. This helps guide ggml.
    # whisper.cpp's CMakeLists should pick these up.
    CMAKE_ARGS+=("-DGGML_AVX=ON" "-DGGML_AVX2=ON" "-DGGML_FMA=ON" "-DGGML_F16C=ON")
    # If issues with ARM detection persist on x64 runners, consider:
    # CMAKE_ARGS+=("-DWHISPER_SUPPORT_NEON=OFF")
    # CMAKE_ARGS+=("-DGGML_NATIVE=OFF")
else
    print_warning "Unsupported OS for specific CMake configuration: $OSTYPE. Using potentially generic config."
    # No platform-specific args added here, relies on CMake defaults + base args
fi

print_status "Final CMake arguments: ${CMAKE_ARGS[@]}"
cmake "${CMAKE_ARGS[@]}"

if [ $? -ne 0 ]; then
    print_error "CMake configuration failed."
    # Attempt to show CMake logs if they exist for easier debugging
    if [ -f "build/CMakeFiles/CMakeOutput.log" ]; then
        print_error "--- CMake Output Log (build/CMakeFiles/CMakeOutput.log) ---"
        cat "build/CMakeFiles/CMakeOutput.log"
        print_error "--- End of CMake Output Log ---"
    fi
    if [ -f "build/CMakeFiles/CMakeError.log" ]; then
        print_error "--- CMake Error Log (build/CMakeFiles/CMakeError.log) ---"
        cat "build/CMakeFiles/CMakeError.log"
        print_error "--- End of CMake Error Log ---"
    fi
    exit 1
fi

print_status "Building whisper.cpp..."

# Get the number of CPU cores
if [[ "$OSTYPE" == "darwin"* ]]; then
    CORES=$(sysctl -n hw.ncpu)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CORES=$(nproc)
else
    CORES=4
fi

cmake --build build --config Release --parallel "$CORES"

if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi

# Find the whisper binary
print_status "Locating whisper binary..."

WHISPER_BINARY=""
if [ -f "build/bin/whisper-cli" ]; then
    WHISPER_BINARY="build/bin/whisper-cli"
elif [ -f "bin/whisper-cli" ]; then
    WHISPER_BINARY="bin/whisper-cli"
else
    print_error "Could not find whisper-cli binary"
    print_status "Available files:"
    find . -name "*whisper*" -type f | head -10
    exit 1
fi

print_success "Found whisper binary at: $WHISPER_BINARY"

# Test the binary
print_status "Testing whisper binary..."
if "$WHISPER_BINARY" --help >/dev/null 2>&1; then
    print_success "Binary test passed"
else
    print_warning "Binary test failed, but continuing..."
fi

# Create binaries directory and copy binary
mkdir -p "$BINARIES_DIR"

if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cp "$WHISPER_BINARY" "$BINARIES_DIR/whisper-cli"
    chmod +x "$BINARIES_DIR/whisper-cli"
    FINAL_BINARY="$BINARIES_DIR/whisper-cli"
else
    cp "$WHISPER_BINARY" "$BINARIES_DIR/whisper-cli.exe"
    FINAL_BINARY="$BINARIES_DIR/whisper-cli.exe"
fi

# Verify the copied binary
print_status "Verifying copied binary..."
if [ -f "$FINAL_BINARY" ]; then
    print_success "Binary copied successfully to: $FINAL_BINARY"
    
    # Get file info
    ls -la "$FINAL_BINARY"
    
    # Test the final binary
    if "$FINAL_BINARY" --help >/dev/null 2>&1; then
        print_success "Final binary test passed"
    else
        print_warning "Final binary test failed, but file exists"
    fi
else
    print_error "Failed to copy binary"
    exit 1
fi

# Clean up
print_status "Cleaning up temporary files..."
cd "$PROJECT_ROOT"
rm -rf "$TEMP_DIR"

print_success "🎉 whisper.cpp built successfully!"
print_status "Binary location: $FINAL_BINARY"

# Show next steps
echo ""
print_status "Next steps:"
echo "  1. Download a model: curl -L -o models/ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
echo "  2. Test transcription: npm run test:native"
echo "  3. Start the application: npm run dev"
echo ""
print_success "Ready to transcribe! 🎵"