#!/bin/bash

echo "🔧 WhisperDesk Complete Fix Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the WhisperDesk root directory"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Fix the whisper binary issue
echo "Step 1: Fixing whisper binary (this is the main issue)"
echo "======================================================"

print_info "Your current binary is causing C++ crashes"
print_info "Error: 'stoi: no conversion' indicates binary incompatibility"
print_info "Solution: Rebuild whisper.cpp with correct configuration"
echo ""

# Remove existing binary
if [ -f "binaries/whisper" ]; then
    print_warning "Removing corrupted whisper binary..."
    rm -f binaries/whisper
    print_success "Old binary removed"
fi

# Create binaries directory if it doesn't exist
mkdir -p binaries

# Build whisper.cpp from source
print_info "Building whisper.cpp from source (this may take a few minutes)..."

# Clone whisper.cpp to temp directory
TEMP_DIR="/tmp/whisper-cpp-build-$(date +%s)"
print_info "Cloning whisper.cpp to: $TEMP_DIR"

git clone https://github.com/ggerganov/whisper.cpp.git "$TEMP_DIR"
cd "$TEMP_DIR"

# Build for macOS ARM64 with proper flags
print_info "Building whisper.cpp for macOS ARM64..."

# Use make with ARM64 optimizations
make clean
make -j$(sysctl -n hw.ncpu) UNAME_M=arm64

# Check if build was successful
if [ -f "main" ]; then
    print_success "whisper.cpp built successfully"
    
    # Copy to project directory
    PROJECT_DIR="$OLDPWD"
    cp main "$PROJECT_DIR/binaries/whisper"
    chmod +x "$PROJECT_DIR/binaries/whisper"
    
    print_success "Binary installed to: $PROJECT_DIR/binaries/whisper"
    
    # Test the binary
    cd "$PROJECT_DIR"
    if ./binaries/whisper --help >/dev/null 2>&1; then
        print_success "New binary is working correctly!"
    else
        print_warning "Binary may still have issues, but continuing..."
    fi
    
elif [ -f "build/bin/main" ]; then
    print_success "whisper.cpp built successfully (cmake build)"
    
    # Copy cmake build
    PROJECT_DIR="$OLDPWD"
    cp build/bin/main "$PROJECT_DIR/binaries/whisper"
    chmod +x "$PROJECT_DIR/binaries/whisper"
    
    print_success "Binary installed to: $PROJECT_DIR/binaries/whisper"
    
    cd "$PROJECT_DIR"
    if ./binaries/whisper --help >/dev/null 2>&1; then
        print_success "New binary is working correctly!"
    else
        print_warning "Binary may still have issues, but continuing..."
    fi
else
    print_error "Build failed - no whisper binary found"
    cd "$PROJECT_DIR"
    exit 1
fi

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo ""

# Step 2: Create missing provider files
echo "Step 2: Creating missing provider files"
echo "======================================="

# Check if provider files exist and create them if missing
if [ ! -f "src/main/services/providers/native-whisper-provider.js" ]; then
    print_warning "native-whisper-provider.js is missing"
    print_info "You need to copy the 'Fixed Native Whisper Provider' artifact"
    print_info "This file is required for the app to work"
    echo ""
    echo "📋 TODO: Copy the 'Fixed Native Whisper Provider' artifact to:"
    echo "   src/main/services/providers/native-whisper-provider.js"
    echo ""
else
    print_success "native-whisper-provider.js exists"
fi

if [ ! -f "src/main/services/transcription-service-native.js" ]; then
    print_warning "transcription-service-native.js is missing"
    print_info "You need to copy the 'Fixed Transcription Service Native' artifact"
    echo ""
    echo "📋 TODO: Copy the 'Fixed Transcription Service Native' artifact to:"
    echo "   src/main/services/transcription-service-native.js"
    echo ""
else
    print_success "transcription-service-native.js exists"
fi

echo ""

# Step 3: Verify model files
echo "Step 3: Verifying model files"
echo "============================="

MODELS_DIR="$HOME/Library/Application Support/whisperdesk-enhanced/models"

if [ -d "$MODELS_DIR" ]; then
    print_success "Models directory found"
    
    # List models
    echo "📋 Available models:"
    ls -la "$MODELS_DIR" | grep "\.bin$" | while read -r line; do
        filename=$(echo "$line" | awk '{print $NF}')
        size=$(echo "$line" | awk '{print $5}')
        size_mb=$((size / 1024 / 1024))
        echo "   📦 $filename (${size_mb}MB)"
    done
    
    # Check for required models
    if [ -f "$MODELS_DIR/ggml-tiny.bin" ] || [ -f "$MODELS_DIR/whisper-tiny.bin" ]; then
        print_success "Tiny model is available"
    else
        print_warning "No tiny model found - download one from the Models tab"
    fi
    
    if [ -f "$MODELS_DIR/ggml-base.bin" ] || [ -f "$MODELS_DIR/whisper-base.bin" ]; then
        print_success "Base model is available"
    else
        print_info "Base model not found (optional)"
    fi
    
else
    print_error "Models directory not found"
    print_info "Models will be downloaded when you use the app"
fi

echo ""

# Step 4: Test the fix
echo "Step 4: Testing the complete fix"
echo "================================"

print_info "Testing whisper binary with your audio file..."

if [ -f "/Users/ahzs645/Downloads/test.mp3" ] && [ -f "$MODELS_DIR/ggml-tiny.bin" ]; then
    print_info "Attempting test transcription..."
    
    # Test the binary directly
    if timeout 30s ./binaries/whisper \
        -m "$MODELS_DIR/ggml-tiny.bin" \
        -f "/Users/ahzs645/Downloads/test.mp3" \
        --output-txt \
        -t \
        -p 4 > /tmp/whisper_test.log 2>&1; then
        
        print_success "Direct whisper test passed!"
        echo "   📝 Whisper output preview:"
        head -5 /tmp/whisper_test.log | sed 's/^/      /'
        
    else
        print_error "Direct whisper test failed"
        echo "   📝 Error output:"
        head -10 /tmp/whisper_test.log | sed 's/^/      /'
    fi
else
    print_info "Skipping test - missing audio file or model"
    echo "   📋 For testing, you need:"
    echo "      - Audio file: /Users/ahzs645/Downloads/test.mp3"
    echo "      - Model file: $MODELS_DIR/ggml-tiny.bin"
fi

echo ""

# Step 5: Next steps
echo "Step 5: What to do next"
echo "======================="

print_info "Required actions:"

if [ ! -f "src/main/services/providers/native-whisper-provider.js" ]; then
    echo "   1. ❌ Copy 'Fixed Native Whisper Provider' artifact to:"
    echo "      src/main/services/providers/native-whisper-provider.js"
else
    echo "   1. ✅ Native whisper provider file exists"
fi

if [ ! -f "src/main/services/transcription-service-native.js" ]; then
    echo "   2. ❌ Copy 'Fixed Transcription Service Native' artifact to:"
    echo "      src/main/services/transcription-service-native.js"
else
    echo "   2. ✅ Transcription service file exists"
fi

print_success "3. ✅ Whisper binary has been rebuilt"

echo "   4. 🔄 Restart your app: npm run dev"
echo "   5. 🧪 Test transcription with a small audio file"

echo ""

print_info "Expected results after completing all steps:"
echo "   ✅ No more 'stoi: no conversion' errors"
echo "   ✅ Provider dropdown shows 'Native Whisper' properly"
echo "   ✅ Transcription works with your existing models"
echo "   ✅ App uses the rebuilt, compatible whisper binary"

echo ""

print_warning "If you still get errors after completing all steps:"
echo "   1. Check that all artifacts were copied correctly"
echo "   2. Ensure models directory has proper permissions"
echo "   3. Try with a different audio file"
echo "   4. Check console for different error messages"

echo ""
print_success "🎯 Main issue (binary crash) should now be fixed!"
print_info "📝 Complete the artifact copying to fix the UI issues"