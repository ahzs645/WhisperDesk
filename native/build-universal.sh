#!/bin/bash
set -e

echo "🦀 Building Universal objc2 ScreenCaptureKit binary..."

cd "$(dirname "$0")/whisperdesk-screencapturekit"

# Clean previous builds
cargo clean

# Build for both architectures
echo "🍎 Building for Intel (x86_64)..."
cargo build --release --target x86_64-apple-darwin

echo "🍎 Building for Apple Silicon (arm64)..."
cargo build --release --target aarch64-apple-darwin

# Create universal binary
echo "🔗 Creating universal binary..."
mkdir -p ../target/release
lipo -create \
    "target/x86_64-apple-darwin/release/libwhisperdesk_screencapturekit.dylib" \
    "target/aarch64-apple-darwin/release/libwhisperdesk_screencapturekit.dylib" \
    -output "../target/release/libwhisperdesk_screencapturekit.node"

echo "✅ Universal binary built successfully"
echo "📦 Output: ../target/release/libwhisperdesk_screencapturekit.node"

# Verify the binary
lipo -info "../target/release/libwhisperdesk_screencapturekit.node" 