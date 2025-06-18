#!/bin/bash
set -e

echo "�� Building Universal ScreenCaptureKit binary with objc2..."

cd "$(dirname "$0")/whisperdesk-screencapturekit"

# Ensure we have the right Rust targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Clean previous builds
cargo clean

# Set environment variables for ScreenCaptureKit
export MACOSX_DEPLOYMENT_TARGET=12.3

# Build for both architectures with ScreenCaptureKit support
echo "🍎 Building for Intel (x86_64) with ScreenCaptureKit..."
MACOSX_DEPLOYMENT_TARGET=12.3 cargo build --release --target x86_64-apple-darwin

echo "🍎 Building for Apple Silicon (arm64) with ScreenCaptureKit..."
MACOSX_DEPLOYMENT_TARGET=12.3 cargo build --release --target aarch64-apple-darwin

# Create universal binary
echo "🔗 Creating universal binary..."
mkdir -p ../target/release
lipo -create \
    "target/x86_64-apple-darwin/release/libwhisperdesk_screencapturekit.dylib" \
    "target/aarch64-apple-darwin/release/libwhisperdesk_screencapturekit.dylib" \
    -output "../target/release/libwhisperdesk_screencapturekit.node"

echo "✅ Universal ScreenCaptureKit binary built successfully"
echo "📦 Output: ../target/release/libwhisperdesk_screencapturekit.node"

# Verify the binary
echo "🔍 Binary architecture info:"
lipo -info "../target/release/libwhisperdesk_screencapturekit.node"

# Check linked frameworks
echo "🔗 Linked frameworks:"
otool -L "../target/release/libwhisperdesk_screencapturekit.node" | grep -E "(ScreenCaptureKit|CoreMedia|CoreVideo|AVFoundation)" || echo "Note: Framework dependencies may not show in otool for Node.js modules" 