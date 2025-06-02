#!/bin/bash

echo "🚀 WhisperDesk Native Setup Script"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install main dependencies
echo "📦 Installing main dependencies..."
npm install

# Install renderer dependencies
echo "📦 Installing renderer dependencies..."
cd src/renderer/whisperdesk-ui
npm install --legacy-peer-deps
cd ../../..

# Check if whisper binary exists
if [ -f "binaries/whisper" ]; then
    echo "✅ Whisper binary found"
    chmod +x binaries/whisper
else
    echo "⚠️  Whisper binary not found"
    echo "📋 Choose setup option:"
    echo "1) Build from source (recommended)"
    echo "2) Skip binary setup (web interface only)"
    read -p "Enter choice (1 or 2): " choice
    
    if [ "$choice" = "1" ]; then
        echo "🔨 Building whisper.cpp from source..."
        
        # Check for build dependencies
        if ! command -v make &> /dev/null; then
            echo "Installing build dependencies..."
            if command -v apt-get &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y build-essential cmake
            elif command -v brew &> /dev/null; then
                brew install cmake
            else
                echo "❌ Please install build tools (make, cmake) manually"
                exit 1
            fi
        fi
        
        # Clone and build whisper.cpp
        echo "📥 Cloning whisper.cpp..."
        git clone https://github.com/ggerganov/whisper.cpp.git /tmp/whisper.cpp
        
        echo "🔨 Building whisper.cpp..."
        cd /tmp/whisper.cpp
        make -j$(nproc)
        
        echo "📋 Installing binary..."
        mkdir -p "$OLDPWD/binaries"
        cp build/bin/whisper-cli "$OLDPWD/binaries/whisper"
        chmod +x "$OLDPWD/binaries/whisper"
        cd "$OLDPWD"
        
        echo "✅ Whisper binary built and installed"
    else
        echo "⏭️  Skipping binary setup"
    fi
fi

# Check for models
echo "🔍 Checking for models..."
MODELS_DIR="$HOME/.config/whisperdesk-enhanced/models"
mkdir -p "$MODELS_DIR"

if [ ! -f "$MODELS_DIR/ggml-tiny.bin" ]; then
    echo "📥 Downloading tiny model for testing..."
    wget -q --show-progress \
        https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin \
        -O "$MODELS_DIR/ggml-tiny.bin"
    echo "✅ Tiny model downloaded"
else
    echo "✅ Models found"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test native services: npm run test:native"
echo "2. Start development: npm run dev"
echo "3. Or start web interface: node transcription-server.js"
echo ""
echo "📖 See SETUP_GUIDE.md for detailed instructions"

