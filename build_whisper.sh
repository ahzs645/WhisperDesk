#!/bin/bash

echo "🔨 Building Whisper.cpp from Source..."

# Check dependencies
echo "1. Checking dependencies..."

if ! command -v make >/dev/null 2>&1; then
    echo "❌ make not found. Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "⏳ Please complete the Xcode tools installation and run this script again"
    exit 1
fi

if ! command -v cmake >/dev/null 2>&1; then
    echo "❌ cmake not found. Installing via Homebrew..."
    if command -v brew >/dev/null 2>&1; then
        brew install cmake
    else
        echo "❌ Homebrew not found. Please install cmake manually:"
        echo "   brew install cmake"
        exit 1
    fi
fi

echo "✅ Dependencies ready"

# Clone whisper.cpp
echo ""
echo "2. Cloning whisper.cpp..."
TEMP_DIR="/tmp/whisper-cpp-build"
rm -rf "$TEMP_DIR"
git clone https://github.com/ggerganov/whisper.cpp.git "$TEMP_DIR"

if [ $? -ne 0 ]; then
    echo "❌ Failed to clone whisper.cpp"
    exit 1
fi

cd "$TEMP_DIR"

# Build for macOS ARM64
echo ""
echo "3. Building whisper.cpp for macOS ARM64..."

# Use make for simplicity
make -j$(sysctl -n hw.ncpu)

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Copy binary to project
echo ""
echo "4. Installing binary..."
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BINARIES_DIR="$PROJECT_DIR/binaries"
mkdir -p "$BINARIES_DIR"

if [ -f "build/bin/main" ]; then
    cp "build/bin/main" "$BINARIES_DIR/whisper"
elif [ -f "main" ]; then
    cp "main" "$BINARIES_DIR/whisper"
else
    echo "❌ Could not find compiled binary"
    echo "📋 Available files:"
    find . -name "*main*" -o -name "*whisper*" | head -10
    exit 1
fi

chmod +x "$BINARIES_DIR/whisper"

# Test the binary
echo ""
echo "5. Testing binary..."
if "$BINARIES_DIR/whisper" --help >/dev/null 2>&1; then
    echo "✅ Binary test passed"
    echo "🎉 Whisper.cpp built and installed successfully!"
else
    echo "❌ Binary test failed"
    "$BINARIES_DIR/whisper" --help
fi

# Clean up
echo ""
echo "6. Cleaning up..."
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Setup complete! You can now run:"
echo "   npm run test:native"
echo "   npm run dev"