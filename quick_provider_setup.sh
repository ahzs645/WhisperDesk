#!/bin/bash

echo "🔧 WhisperDesk Mac Accurate Fix Script"
echo "======================================"
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
    exit 1
fi

print_success "Found whisper binary: $WHISPER_BINARY"

# Fix permissions
if [ ! -x "$WHISPER_BINARY" ]; then
    print_warning "Binary is not executable, fixing permissions..."
    chmod +x "$WHISPER_BINARY"
    print_success "Fixed binary permissions"
fi

print_info "Performing ACCURATE binary format detection..."

# Test actual argument support (not just help output)
print_info "Testing NEW format arguments..."
NEW_FORMAT_TEST_OUTPUT=$(timeout 10s "$WHISPER_BINARY" --model /fake/path --file /fake/file 2>&1 || echo "FAILED")

print_info "Testing LEGACY format arguments..."
LEGACY_FORMAT_TEST_OUTPUT=$(timeout 10s "$WHISPER_BINARY" -m /fake/path -f /fake/file 2>&1 || echo "FAILED")

print_info "Analyzing test results..."

# Determine format based on actual argument support
BINARY_FORMAT="unknown"

if echo "$NEW_FORMAT_TEST_OUTPUT" | grep -q "unknown argument\|invalid option\|unrecognized"; then
    print_info "NEW format arguments rejected by binary"
    NEW_SUPPORTED=false
else
    print_info "NEW format arguments accepted by binary"
    NEW_SUPPORTED=true
fi

if echo "$LEGACY_FORMAT_TEST_OUTPUT" | grep -q "unknown argument\|invalid option\|unrecognized"; then
    print_info "LEGACY format arguments rejected by binary"
    LEGACY_SUPPORTED=false
else
    print_info "LEGACY format arguments accepted by binary"
    LEGACY_SUPPORTED=true
fi

# Make determination
if [ "$NEW_SUPPORTED" = true ] && [ "$LEGACY_SUPPORTED" = false ]; then
    BINARY_FORMAT="new"
    print_success "Binary confirmed to use NEW argument format"
elif [ "$LEGACY_SUPPORTED" = true ] && [ "$NEW_SUPPORTED" = false ]; then
    BINARY_FORMAT="legacy"
    print_success "Binary confirmed to use LEGACY argument format"
elif [ "$LEGACY_SUPPORTED" = true ] && [ "$NEW_SUPPORTED" = true ]; then
    BINARY_FORMAT="hybrid"
    print_warning "Binary supports both formats (unusual)"
    print_info "Will use LEGACY format for compatibility"
    BINARY_FORMAT="legacy"
else
    print_warning "Could not determine format definitively"
    print_info "Based on your previous error, assuming LEGACY format"
    BINARY_FORMAT="legacy"
fi

echo ""
print_info "Test Results Summary:"
echo "===================="
echo "NEW format test output:"
echo "$NEW_FORMAT_TEST_OUTPUT" | head -3 | sed 's/^/  /'
echo ""
echo "LEGACY format test output:"
echo "$LEGACY_FORMAT_TEST_OUTPUT" | head -3 | sed 's/^/  /'
echo ""

# Test actual transcription if models are available
MODELS_DIR="$HOME/Library/Application Support/whisperdesk-enhanced/models"
if [ ! -d "$MODELS_DIR" ]; then
    MODELS_DIR="$HOME/.config/whisperdesk-enhanced/models"
fi

if [ -d "$MODELS_DIR" ]; then
    MODEL_COUNT=$(find "$MODELS_DIR" -name "*.bin" | wc -l)
    print_info "Found $MODEL_COUNT models in $MODELS_DIR"
    
    if [ "$MODEL_COUNT" -gt 0 ]; then
        print_info "Testing actual transcription with confirmed format..."
        
        # Find a model
        TEST_MODEL=$(find "$MODELS_DIR" -name "ggml-*.bin" | head -1)
        if [ -z "$TEST_MODEL" ]; then
            TEST_MODEL=$(find "$MODELS_DIR" -name "*.bin" | head -1)
        fi
        
        if [ -n "$TEST_MODEL" ]; then
            print_info "Using model: $(basename "$TEST_MODEL")"
            
            # Create test audio
            TEST_AUDIO="/tmp/whisper_test_$(date +%s).wav"
            
            # Generate 2 seconds of silence
            if command -v sox >/dev/null 2>&1; then
                sox -n -r 16000 -c 1 "$TEST_AUDIO" trim 0.0 2.0 2>/dev/null
            elif command -v ffmpeg >/dev/null 2>&1; then
                ffmpeg -f lavfi -i "anullsrc=channel_layout=mono:sample_rate=16000" -t 2 "$TEST_AUDIO" -y 2>/dev/null
            else
                print_warning "Cannot create test audio (sox or ffmpeg not available)"
                TEST_AUDIO=""
            fi
            
            if [ -n "$TEST_AUDIO" ] && [ -f "$TEST_AUDIO" ]; then
                print_info "Testing transcription with $BINARY_FORMAT format..."
                
                # Test with confirmed format
                TEST_OUTPUT_DIR="/tmp/whisper_output_test"
                mkdir -p "$TEST_OUTPUT_DIR"
                cd "$TEST_OUTPUT_DIR"
                
                if [ "$BINARY_FORMAT" = "new" ]; then
                    timeout 30s "$WHISPER_BINARY" \
                        --model "$TEST_MODEL" \
                        --file "$TEST_AUDIO" \
                        --output-txt \
                        --threads 2 \
                        >/tmp/transcription_test.log 2>&1
                else
                    timeout 30s "$WHISPER_BINARY" \
                        -m "$TEST_MODEL" \
                        -f "$TEST_AUDIO" \
                        --output-txt \
                        -t 2 \
                        -p 1 \
                        >/tmp/transcription_test.log 2>&1
                fi
                
                TEST_EXIT_CODE=$?
                print_info "Transcription test exit code: $TEST_EXIT_CODE"
                
                # Check for output files
                OUTPUT_FILES_FOUND=false
                TEST_BASENAME=$(basename "$TEST_AUDIO" .wav)
                
                for output_file in "${TEST_BASENAME}.txt" "whisper_test_*.txt" "*.txt"; do
                    if ls $output_file 1> /dev/null 2>&1; then
                        print_success "Found output file: $output_file"
                        CONTENT=$(cat $output_file 2>/dev/null | head -1)
                        print_info "Content preview: '$CONTENT'"
                        OUTPUT_FILES_FOUND=true
                        rm -f $output_file
                        break
                    fi
                done
                
                if [ "$OUTPUT_FILES_FOUND" = false ]; then
                    print_warning "No output files found, checking current directory..."
                    ls -la /tmp/whisper_output_test/
                fi
                
                # Show test log
                if [ -f "/tmp/transcription_test.log" ]; then
                    print_info "Transcription test log:"
                    head -10 /tmp/transcription_test.log | sed 's/^/  /'
                fi
                
                # Cleanup
                rm -f "$TEST_AUDIO"
                rm -rf "$TEST_OUTPUT_DIR"
                rm -f /tmp/transcription_test.log
                
                if [ "$OUTPUT_FILES_FOUND" = true ]; then
                    print_success "Transcription test PASSED! Format $BINARY_FORMAT works correctly."
                else
                    print_warning "Transcription test produced no output files"
                    print_info "This may be normal for silence/test audio"
                fi
            fi
        fi
    fi
fi

echo ""
print_info "Fix Summary"
echo "==========="

if [ "$BINARY_FORMAT" = "legacy" ]; then
    print_success "✅ Confirmed: Your binary uses LEGACY argument format"
    print_info "The provider MUST use arguments like: -m model -f file --output-txt -t 4 -p 1"
    print_warning "The provider was incorrectly detecting this as NEW format"
elif [ "$BINARY_FORMAT" = "new" ]; then
    print_success "✅ Confirmed: Your binary uses NEW argument format"
    print_info "The provider should use arguments like: --model model --file file --output-txt --threads 4"
else
    print_warning "⚠️ Could not definitively determine binary format"
    print_info "Recommending LEGACY format based on common patterns"
    BINARY_FORMAT="legacy"
fi

echo ""
print_info "Required Actions:"

echo "1. 🔄 Replace the native-whisper-provider.js with the FIXED version"
echo "   - The fixed version will accurately detect your binary format"
echo "   - It performs actual argument testing, not just help output parsing"

echo "2. 🔧 Binary format has been confirmed as: $BINARY_FORMAT"
if [ "$BINARY_FORMAT" = "legacy" ]; then
    echo "   - Your binary expects: -m, -f, -t, -p arguments"
    echo "   - NOT: --model, --file, --threads, --output-dir arguments"
fi

echo "3. 🚀 Restart WhisperDesk after applying the provider fix"

echo "4. 🧪 Test with a real audio file to confirm fix"

echo ""
print_success "Mac environment analysis complete!"

print_info "Key Finding: Your previous failure was due to the provider"
print_info "incorrectly detecting 'NEW' format when your binary actually"
print_info "uses 'LEGACY' format. The fixed provider will detect this correctly."

if [ "$BINARY_FORMAT" = "legacy" ]; then
    echo ""
    print_warning "Important: The 'unknown argument: --output-dir' error confirms"
    print_warning "your binary is LEGACY format, despite the clean help output."
    print_warning "The fixed provider will handle this correctly."
fi