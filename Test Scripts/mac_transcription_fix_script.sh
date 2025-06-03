#!/bin/bash

echo "🔧 WhisperDesk Mac Transcription Fix Script"
echo "==========================================="
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

# Find WhisperDesk installation
WHISPERDESK_PATH=""
POSSIBLE_PATHS=(
    "/Applications/WhisperDesk Enhanced.app"
    "/Applications/WhisperDesk.app"
    "$HOME/Applications/WhisperDesk Enhanced.app"
    "$HOME/Applications/WhisperDesk.app"
    "$HOME/Downloads/WhisperDesk"*
)

for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ]; then
        WHISPERDESK_PATH="$path"
        break
    fi
done

if [ -z "$WHISPERDESK_PATH" ]; then
    print_error "WhisperDesk installation not found"
    print_info "Please ensure WhisperDesk is installed in Applications folder"
    exit 1
fi

print_success "Found WhisperDesk at: $WHISPERDESK_PATH"

# Find binaries directory
BINARIES_PATH=""
POSSIBLE_BINARY_PATHS=(
    "$WHISPERDESK_PATH/Contents/Resources/binaries"
    "$WHISPERDESK_PATH/binaries"
    "$WHISPERDESK_PATH/resources/binaries"
)

for path in "${POSSIBLE_BINARY_PATHS[@]}"; do
    if [ -d "$path" ]; then
        BINARIES_PATH="$path"
        break
    fi
done

if [ -z "$BINARIES_PATH" ]; then
    print_error "Binaries directory not found"
    exit 1
fi

print_success "Binaries directory: $BINARIES_PATH"

# Find whisper binary
WHISPER_BINARY=""
POSSIBLE_BINARIES=("whisper" "whisper-cli" "whisper-cpp")

for binary in "${POSSIBLE_BINARIES[@]}"; do
    binary_path="$BINARIES_PATH/$binary"
    if [ -f "$binary_path" ]; then
        WHISPER_BINARY="$binary_path"
        break
    fi
done

if [ -z "$WHISPER_BINARY" ]; then
    print_error "Whisper binary not found in $BINARIES_PATH"
    ls -la "$BINARIES_PATH"
    exit 1
fi

print_success "Found whisper binary: $WHISPER_BINARY"

# Check binary permissions
if [ ! -x "$WHISPER_BINARY" ]; then
    print_warning "Binary is not executable, fixing permissions..."
    chmod +x "$WHISPER_BINARY"
    print_success "Fixed binary permissions"
fi

# Get binary info
BINARY_SIZE=$(stat -f%z "$WHISPER_BINARY" 2>/dev/null || stat -c%s "$WHISPER_BINARY" 2>/dev/null || echo "unknown")
if [ "$BINARY_SIZE" != "unknown" ]; then
    BINARY_SIZE_KB=$((BINARY_SIZE / 1024))
    print_info "Binary size: ${BINARY_SIZE_KB} KB"
    
    if [ "$BINARY_SIZE" -lt 100000 ]; then
        print_error "Binary is too small (${BINARY_SIZE_KB} KB) - this might be a stub"
        print_info "Consider rebuilding the binary with: npm run build:whisper"
    fi
fi

print_info "Testing whisper binary format..."

# Test binary to determine argument format
TEST_OUTPUT=$(timeout 10s "$WHISPER_BINARY" --help 2>&1 || echo "TIMEOUT_OR_ERROR")

if echo "$TEST_OUTPUT" | grep -q "TIMEOUT_OR_ERROR"; then
    print_warning "Binary test timed out or failed"
    print_info "Trying alternative test..."
    TEST_OUTPUT=$(timeout 5s "$WHISPER_BINARY" -h 2>&1 || echo "FAILED")
fi

print_info "Binary test output preview:"
echo "$TEST_OUTPUT" | head -5 | sed 's/^/  /'

# Determine argument format
ARGUMENT_FORMAT="unknown"
if echo "$TEST_OUTPUT" | grep -q -E "(--file|--model|--output-dir|--timestamps)"; then
    ARGUMENT_FORMAT="new"
    print_success "Detected NEW argument format (whisper-cli style)"
elif echo "$TEST_OUTPUT" | grep -q -E "(-f|-m|-t.*threads|-p.*processors)"; then
    ARGUMENT_FORMAT="legacy"
    print_success "Detected LEGACY argument format (old whisper style)"
elif echo "$TEST_OUTPUT" | grep -q "deprecated"; then
    ARGUMENT_FORMAT="deprecated"
    print_warning "Binary shows deprecation warning"
    print_info "This binary might use legacy format despite warnings"
    ARGUMENT_FORMAT="legacy"
else
    print_warning "Could not determine argument format"
    print_info "Will test both formats"
fi

# Check for models directory
MODELS_DIR="$HOME/Library/Application Support/whisperdesk-enhanced/models"
if [ ! -d "$MODELS_DIR" ]; then
    MODELS_DIR="$HOME/.config/whisperdesk-enhanced/models"
fi

if [ ! -d "$MODELS_DIR" ]; then
    print_warning "Models directory not found"
    print_info "Expected at: $HOME/Library/Application Support/whisperdesk-enhanced/models"
    print_info "Please download a model from the Models tab first"
else
    print_success "Models directory found: $MODELS_DIR"
    
    # List available models
    MODEL_COUNT=$(find "$MODELS_DIR" -name "*.bin" | wc -l)
    print_info "Available models: $MODEL_COUNT"
    
    if [ "$MODEL_COUNT" -gt 0 ]; then
        echo "📋 Model files:"
        find "$MODELS_DIR" -name "*.bin" | while read model; do
            model_name=$(basename "$model")
            model_size=$(stat -f%z "$model" 2>/dev/null || stat -c%s "$model" 2>/dev/null || echo "0")
            model_size_mb=$((model_size / 1024 / 1024))
            echo "  📦 $model_name (${model_size_mb}MB)"
        done
    fi
fi

# Test transcription if we have a model
if [ "$MODEL_COUNT" -gt 0 ]; then
    print_info "Testing transcription with sample audio..."
    
    # Find a model to test with
    TEST_MODEL=$(find "$MODELS_DIR" -name "ggml-*.bin" | head -1)
    if [ -z "$TEST_MODEL" ]; then
        TEST_MODEL=$(find "$MODELS_DIR" -name "*.bin" | head -1)
    fi
    
    if [ -n "$TEST_MODEL" ]; then
        print_info "Using model: $(basename "$TEST_MODEL")"
        
        # Create a test audio file (silence)
        TEST_AUDIO="/tmp/whisper_test_audio.wav"
        
        # Generate 3 seconds of silence using built-in tools
        if command -v sox >/dev/null 2>&1; then
            sox -n -r 16000 -c 1 "$TEST_AUDIO" trim 0.0 3.0 2>/dev/null
        elif command -v ffmpeg >/dev/null 2>&1; then
            ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=16000" -t 3 "$TEST_AUDIO" -y 2>/dev/null
        else
            print_warning "Cannot create test audio (sox or ffmpeg not available)"
            TEST_AUDIO=""
        fi
        
        if [ -n "$TEST_AUDIO" ] && [ -f "$TEST_AUDIO" ]; then
            print_info "Created test audio file"
            
            # Test with detected format
            OUTPUT_DIR="/tmp/whisper_test_output"
            mkdir -p "$OUTPUT_DIR"
            
            if [ "$ARGUMENT_FORMAT" = "new" ]; then
                print_info "Testing with NEW argument format..."
                timeout 30s "$WHISPER_BINARY" \
                    --model "$TEST_MODEL" \
                    --file "$TEST_AUDIO" \
                    --output-txt \
                    --output-dir "$OUTPUT_DIR" \
                    --threads 2 \
                    >/tmp/whisper_new_test.log 2>&1
                
                NEW_EXIT_CODE=$?
                print_info "NEW format test exit code: $NEW_EXIT_CODE"
                
                if [ -f "$OUTPUT_DIR/whisper_test_audio.txt" ]; then
                    print_success "NEW format created output file successfully"
                    CONTENT=$(cat "$OUTPUT_DIR/whisper_test_audio.txt")
                    print_info "Output: '$CONTENT'"
                else
                    print_warning "NEW format did not create expected output file"
                fi
                
            elif [ "$ARGUMENT_FORMAT" = "legacy" ]; then
                print_info "Testing with LEGACY argument format..."
                timeout 30s "$WHISPER_BINARY" \
                    -m "$TEST_MODEL" \
                    -f "$TEST_AUDIO" \
                    --output-txt \
                    -t 2 \
                    >/tmp/whisper_legacy_test.log 2>&1
                
                LEGACY_EXIT_CODE=$?
                print_info "LEGACY format test exit code: $LEGACY_EXIT_CODE"
                
                # Look for output files in current directory or elsewhere
                if [ -f "whisper_test_audio.txt" ]; then
                    print_success "LEGACY format created output file in current directory"
                    CONTENT=$(cat "whisper_test_audio.txt")
                    print_info "Output: '$CONTENT'"
                    rm -f "whisper_test_audio.txt"
                else
                    print_warning "LEGACY format did not create expected output file"
                fi
                
            else
                print_info "Testing both argument formats..."
                
                # Test NEW format
                timeout 30s "$WHISPER_BINARY" \
                    --model "$TEST_MODEL" \
                    --file "$TEST_AUDIO" \
                    --output-txt \
                    --output-dir "$OUTPUT_DIR" \
                    >/tmp/whisper_new_test.log 2>&1
                NEW_EXIT_CODE=$?
                
                # Test LEGACY format
                timeout 30s "$WHISPER_BINARY" \
                    -m "$TEST_MODEL" \
                    -f "$TEST_AUDIO" \
                    --output-txt \
                    >/tmp/whisper_legacy_test.log 2>&1
                LEGACY_EXIT_CODE=$?
                
                print_info "NEW format exit code: $NEW_EXIT_CODE"
                print_info "LEGACY format exit code: $LEGACY_EXIT_CODE"
                
                if [ -f "$OUTPUT_DIR/whisper_test_audio.txt" ]; then
                    print_success "NEW format works!"
                    ARGUMENT_FORMAT="new"
                elif [ -f "whisper_test_audio.txt" ]; then
                    print_success "LEGACY format works!"
                    ARGUMENT_FORMAT="legacy"
                    rm -f "whisper_test_audio.txt"
                else
                    print_warning "Neither format produced output files"
                fi
            fi
            
            # Show test logs if available
            if [ -f "/tmp/whisper_new_test.log" ]; then
                print_info "NEW format test log:"
                head -10 /tmp/whisper_new_test.log | sed 's/^/  /'
            fi
            
            if [ -f "/tmp/whisper_legacy_test.log" ]; then
                print_info "LEGACY format test log:"
                head -10 /tmp/whisper_legacy_test.log | sed 's/^/  /'
            fi
            
            # Cleanup
            rm -f "$TEST_AUDIO"
            rm -rf "$OUTPUT_DIR"
            rm -f /tmp/whisper_*_test.log
        else
            print_warning "Could not create test audio file"
        fi
    else
        print_warning "No models found for testing"
    fi
else
    print_info "No models available for testing"
    print_info "Please download a model from the Models tab first"
fi

echo ""
print_info "Fix Summary:"
echo "============"

if [ "$ARGUMENT_FORMAT" = "new" ]; then
    print_success "Binary uses NEW argument format (should work with latest provider code)"
elif [ "$ARGUMENT_FORMAT" = "legacy" ]; then
    print_success "Binary uses LEGACY argument format (provider will auto-detect)"
elif [ "$ARGUMENT_FORMAT" = "deprecated" ]; then
    print_warning "Binary shows deprecation warnings but should still work"
else
    print_warning "Could not determine binary format - may need manual configuration"
fi

echo ""
print_info "Recommendations:"

if [ "$ARGUMENT_FORMAT" = "unknown" ]; then
    echo "  1. 🔄 Update the native-whisper-provider.js with the fixed version"
    echo "  2. 🧪 The provider will auto-detect the correct argument format"
    echo "  3. 📝 Check app console logs for detailed error messages"
fi

echo "  4. ✅ Binary permissions and location are correct"
echo "  5. 🎵 Download models from the Models tab if you haven't already"
echo "  6. 🔄 Restart WhisperDesk after applying any fixes"

if [ "$MODEL_COUNT" -eq 0 ]; then
    echo ""
    print_warning "Important: Download at least one model before testing transcription!"
    echo "           Go to Models tab → Download 'Whisper Tiny' (39MB) for testing"
fi

echo ""
print_success "Mac transcription environment check complete!"
print_info "The fixed provider code should resolve the empty output issue."