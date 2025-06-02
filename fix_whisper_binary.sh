#!/bin/bash

echo "🔧 Fixing Whisper Binary..."

# Check if the build directory still exists
BUILD_DIR="/tmp/whisper-cpp-build/build/bin"
if [ -d "$BUILD_DIR" ]; then
    echo "✅ Build directory found"
    
    # List available binaries
    echo "📋 Available binaries:"
    ls -la "$BUILD_DIR"
    
    # Copy the correct binary
    if [ -f "$BUILD_DIR/whisper-cli" ]; then
        echo "📦 Copying whisper-cli binary..."
        cp "$BUILD_DIR/whisper-cli" "./binaries/whisper"
        chmod +x "./binaries/whisper"
        echo "✅ Binary updated"
    else
        echo "❌ whisper-cli not found in build directory"
        exit 1
    fi
else
    echo "❌ Build directory not found. Rebuilding..."
    
    # Quick rebuild
    TEMP_DIR="/tmp/whisper-cpp-build"
    if [ ! -d "$TEMP_DIR" ]; then
        echo "🔄 Cloning whisper.cpp..."
        git clone https://github.com/ggerganov/whisper.cpp.git "$TEMP_DIR"
    fi
    
    cd "$TEMP_DIR"
    echo "🔨 Building whisper-cli..."
    make -j$(sysctl -n hw.ncpu)
    
    if [ -f "build/bin/whisper-cli" ]; then
        echo "📦 Installing whisper-cli..."
        cp "build/bin/whisper-cli" "$(pwd)/../../WhisperDesk/binaries/whisper"
        chmod +x "$(pwd)/../../WhisperDesk/binaries/whisper"
    elif [ -f "whisper-cli" ]; then
        echo "📦 Installing whisper-cli (alt location)..."
        cp "whisper-cli" "$(pwd)/../../WhisperDesk/binaries/whisper"
        chmod +x "$(pwd)/../../WhisperDesk/binaries/whisper"
    else
        echo "❌ Could not find whisper-cli binary"
        exit 1
    fi
fi

# Test the new binary
echo ""
echo "🧪 Testing new binary..."
if ./binaries/whisper --help >/dev/null 2>&1; then
    echo "✅ Binary test passed!"
    echo "🎉 Whisper binary is now working"
else
    echo "❌ Binary test still failing:"
    ./binaries/whisper --help 2>&1 | head -10
fi

# Check architecture
echo ""
echo "🔍 Binary architecture:"
file ./binaries/whisper