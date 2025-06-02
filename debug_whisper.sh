#!/bin/bash

echo "🔍 Debugging Whisper Binary Issue..."

# Check if binary exists
BINARY_PATH="./binaries/whisper"
if [ -f "$BINARY_PATH" ]; then
    echo "✅ Binary exists at: $BINARY_PATH"
    
    # Check permissions
    ls -la "$BINARY_PATH"
    
    # Check if it's executable
    if [ -x "$BINARY_PATH" ]; then
        echo "✅ Binary has execute permissions"
    else
        echo "❌ Binary missing execute permissions - fixing..."
        chmod +x "$BINARY_PATH"
    fi
    
    # Test the binary
    echo "🧪 Testing binary..."
    if "$BINARY_PATH" --help >/dev/null 2>&1; then
        echo "✅ Binary test passed"
    else
        echo "❌ Binary test failed - let's see the error:"
        "$BINARY_PATH" --help 2>&1 || echo "Error code: $?"
        
        # Check if it's the right architecture
        echo "🔍 Checking binary architecture:"
        file "$BINARY_PATH"
        
        # Check if we need to build it
        echo "💡 The binary might need to be built from source"
    fi
else
    echo "❌ Binary not found at: $BINARY_PATH"
    echo "📋 Available files in binaries directory:"
    ls -la binaries/ 2>/dev/null || echo "No binaries directory found"
fi

# Check if models were actually downloaded
echo ""
echo "🔍 Checking models..."
MODELS_DIR="$HOME/Library/Application Support/whisperdesk-enhanced/models"
if [ -d "$MODELS_DIR" ]; then
    echo "📁 Models directory exists"
    ls -la "$MODELS_DIR"
else
    echo "❌ Models directory not found at: $MODELS_DIR"
fi