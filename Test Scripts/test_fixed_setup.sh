#!/bin/bash

echo "🧪 Testing Fixed WhisperDesk Setup..."

# Test 1: Check binary
echo ""
echo "1. Testing whisper binary..."
if [ -f "./binaries/whisper" ]; then
    echo "✅ Binary exists"
    
    # Check architecture
    arch_info=$(file ./binaries/whisper)
    echo "🔍 Architecture: $arch_info"
    
    if [[ $arch_info == *"Mach-O"* && $arch_info == *"arm64"* ]]; then
        echo "✅ Correct macOS ARM64 binary"
    elif [[ $arch_info == *"ELF"* ]]; then
        echo "❌ Wrong architecture (Linux binary on macOS)"
    else
        echo "⚠️  Unknown binary type"
    fi
    
    # Test execution
    echo "🧪 Testing execution..."
    if ./binaries/whisper --help >/dev/null 2>&1; then
        echo "✅ Binary executes successfully"
    else
        echo "❌ Binary execution failed:"
        ./binaries/whisper --help 2>&1 | head -5
    fi
else
    echo "❌ Binary not found"
fi

# Test 2: Check models
echo ""
echo "2. Testing models..."
models_dir="$HOME/Library/Application Support/whisperdesk-enhanced/models"
if [ -d "$models_dir" ]; then
    echo "✅ Models directory exists"
    
    model_file="$models_dir/ggml-tiny.bin"
    if [ -f "$model_file" ]; then
        size=$(ls -lh "$model_file" | awk '{print $5}')
        echo "✅ Tiny model found (size: $size)"
        
        # Check if size is reasonable (should be around 74MB)
        size_bytes=$(stat -f%z "$model_file" 2>/dev/null || stat -c%s "$model_file" 2>/dev/null)
        if [ "$size_bytes" -gt 70000000 ] && [ "$size_bytes" -lt 80000000 ]; then
            echo "✅ Model size looks correct"
        else
            echo "⚠️  Model size seems unusual: $size"
        fi
    else
        echo "❌ Tiny model not found"
    fi
else
    echo "❌ Models directory not found"
fi

# Test 3: Test Node.js services
echo ""
echo "3. Testing Node.js services..."
if npm run test:native >/dev/null 2>&1; then
    echo "✅ Native services test passed"
else
    echo "❌ Native services test failed"
    echo "🔧 Try running: npm run test:native"
fi

# Test 4: Check if web server can start
echo ""
echo "4. Testing web server startup..."
timeout 10s npm run server >/dev/null 2>&1 &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Web server starts successfully"
    kill $SERVER_PID 2>/dev/null
else
    echo "❌ Web server failed to start"
fi

echo ""
echo "📋 Summary:"
echo "   Binary: $([ -f './binaries/whisper' ] && echo '✅' || echo '❌')"
echo "   Models: $([ -f '$models_dir/ggml-tiny.bin' ] && echo '✅' || echo '❌')"
echo ""
echo "🚀 Next steps:"
echo "   1. If all tests pass: npm run dev"
echo "   2. If binary fails: Run ./fix_whisper_binary.sh"
echo "   3. If models missing: Run ./download_model.sh"
echo "   4. For web interface: npm run web"