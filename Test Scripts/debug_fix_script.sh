#!/bin/bash

echo "🔧 WhisperDesk Debug and Fix Script"
echo "==================================="
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

# Step 1: Check if files exist
echo "1. Checking current file status..."

if [ -f "src/main/services/providers/native-whisper-provider.js" ]; then
    print_success "native-whisper-provider.js exists"
    
    # Check for the "Cannot access 'process'" error
    if grep -q "process =" "src/main/services/providers/native-whisper-provider.js"; then
        print_warning "Found potential process variable issue"
        echo "   💡 Copy the 'Fixed Native Whisper Provider' artifact to fix this"
    else
        print_info "Process variable handling looks okay"
    fi
else
    print_error "native-whisper-provider.js not found"
fi

if [ -f "src/main/services/transcription-service-native.js" ]; then
    print_success "transcription-service-native.js exists"
    
    # Check provider naming
    if grep -q "getProviderDisplayName" "src/main/services/transcription-service-native.js"; then
        print_success "Provider display name handling exists"
    else
        print_warning "Provider display name handling missing"
        echo "   💡 Copy the 'Fixed Transcription Service Native' artifact to fix UI issues"
    fi
else
    print_error "transcription-service-native.js not found"
fi

echo ""

# Step 2: Check model files and naming
echo "2. Checking model files and naming..."

MODELS_DIR="$HOME/Library/Application Support/whisperdesk-enhanced/models"
if [ ! -d "$MODELS_DIR" ]; then
    MODELS_DIR="$HOME/.config/whisperdesk-enhanced/models"
fi

if [ -d "$MODELS_DIR" ]; then
    print_success "Models directory found: $MODELS_DIR"
    
    echo "   📋 Files in models directory:"
    ls -la "$MODELS_DIR" | while read line; do
        echo "      $line"
    done
    
    # Check for correct GGML naming
    GGML_FILES=$(find "$MODELS_DIR" -name "ggml-*.bin" 2>/dev/null | wc -l)
    WHISPER_FILES=$(find "$MODELS_DIR" -name "whisper-*.bin" 2>/dev/null | wc -l)
    
    print_info "GGML-named files: $GGML_FILES"
    print_info "Whisper-named files: $WHISPER_FILES"
    
    if [ "$GGML_FILES" -eq 0 ] && [ "$WHISPER_FILES" -gt 0 ]; then
        print_warning "Models need to be renamed for whisper.cpp compatibility"
        echo "   💡 The fixed provider will automatically create correctly named copies"
    fi
else
    print_error "Models directory not found"
    echo "   💡 Expected locations:"
    echo "      - $HOME/Library/Application Support/whisperdesk-enhanced/models (macOS)"
    echo "      - $HOME/.config/whisperdesk-enhanced/models (Linux)"
fi

echo ""

# Step 3: Check binary status
echo "3. Checking whisper binary..."

if [ -f "binaries/whisper" ]; then
    print_success "whisper binary found"
    
    # Test the binary
    if ./binaries/whisper --help >/dev/null 2>&1; then
        print_success "Binary is executable and responds"
    else
        print_warning "Binary exists but may have issues"
        echo "   💡 Try rebuilding: npm run build:whisper"
    fi
elif [ -f "binaries/whisper.exe" ]; then
    print_success "whisper.exe binary found (Windows)"
else
    print_error "whisper binary not found"
    echo "   💡 Build it with: npm run build:whisper"
fi

echo ""

# Step 4: Identify root causes
echo "4. Root cause analysis..."

print_info "Based on your error logs:"
echo ""
print_error "Error 1: 'Cannot access 'process' before initialization'"
echo "   🔍 Cause: JavaScript variable scoping issue in native-whisper-provider.js"
echo "   🔧 Fix: The variable 'process' is being used before it's declared"
echo "   📝 Solution: Copy the 'Fixed Native Whisper Provider' artifact"
echo ""

print_error "Error 2: 'Deepgram API key not configured'"
echo "   🔍 Cause: Fallback to Deepgram when native provider fails"
echo "   🔧 Fix: This is expected - Deepgram needs API key configuration"
echo "   📝 Solution: Focus on fixing the native provider instead"
echo ""

print_error "Error 3: Provider selection UI showing all options on one line"
echo "   🔍 Cause: Provider names not being formatted correctly for UI"
echo "   🔧 Fix: Missing display name conversion in transcription service"
echo "   📝 Solution: Copy the 'Fixed Transcription Service Native' artifact"
echo ""

# Step 5: Manual fix instructions
echo "5. How to fix these issues..."
echo ""

print_info "STEP 1: Fix the 'Cannot access process' error"
echo "   1. Copy the content from 'Fixed Native Whisper Provider' artifact"
echo "   2. Replace your src/main/services/providers/native-whisper-provider.js"
echo "   3. This fixes the variable scoping issue on line 347"
echo ""

print_info "STEP 2: Fix the provider selection UI"
echo "   1. Copy the content from 'Fixed Transcription Service Native' artifact" 
echo "   2. Replace your src/main/services/transcription-service-native.js"
echo "   3. This adds proper provider display name handling"
echo ""

print_info "STEP 3: Test the fixes"
echo "   1. Restart your app: npm run dev"
echo "   2. Check if 'Native Whisper' appears correctly in provider dropdown"
echo "   3. Try transcribing a file to test the process variable fix"
echo ""

# Step 6: Model naming explanation
echo "6. Model naming explanation..."
echo ""

print_info "What defines the model name whisper.cpp looks for:"
echo "   • whisper.cpp expects GGML format: 'ggml-tiny.bin', 'ggml-base.bin', etc."
echo "   • WhisperDesk downloads as: 'whisper-tiny.bin', 'whisper-base.bin', etc."
echo "   • The fixed provider automatically creates correctly named copies"
echo "   • Model lookup order:"
echo "     1. Exact GGML filename match"
echo "     2. ID-based match (whisper-tiny -> ggml-tiny.bin)"
echo "     3. Create correctly named copy if needed"
echo ""

# Step 7: Next steps
echo "7. After applying fixes..."
echo ""

print_success "Expected behavior:"
echo "   ✅ Provider dropdown shows 'Native Whisper' (not concatenated text)"
echo "   ✅ No 'Cannot access process' errors"
echo "   ✅ Model files automatically get correct names for whisper.cpp"
echo "   ✅ Transcription works with your existing models"
echo ""

print_warning "If you still have issues after applying fixes:"
echo "   1. Check the console for different error messages"
echo "   2. Verify model files exist and are accessible"
echo "   3. Test with a small audio file first"
echo "   4. Make sure the whisper binary is working: ./binaries/whisper --help"
echo ""

echo "🎯 The main issue is the JavaScript scoping error in the native provider."
echo "🔧 Applying the artifacts should resolve all three problems you mentioned."