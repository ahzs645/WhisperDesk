#!/bin/bash

echo "📥 Downloading Whisper Tiny Model..."

# Create models directory
MODELS_DIR="$HOME/Library/Application Support/whisperdesk-enhanced/models"
mkdir -p "$MODELS_DIR"

# Download tiny model using curl (since wget is not available)
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
MODEL_PATH="$MODELS_DIR/ggml-tiny.bin"

echo "🌐 Downloading from: $MODEL_URL"
echo "💾 Saving to: $MODEL_PATH"

if command -v curl >/dev/null 2>&1; then
    curl -L -o "$MODEL_PATH" "$MODEL_URL"
    
    if [ $? -eq 0 ] && [ -f "$MODEL_PATH" ]; then
        echo "✅ Model downloaded successfully"
        echo "📊 File size: $(ls -lh "$MODEL_PATH" | awk '{print $5}')"
    else
        echo "❌ Download failed"
        exit 1
    fi
else
    echo "❌ Neither curl nor wget available"
    echo "💡 Please install curl or download manually from:"
    echo "   $MODEL_URL"
    exit 1
fi