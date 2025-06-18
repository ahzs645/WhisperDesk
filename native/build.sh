#!/bin/bash
set -e

echo "🦀 Building objc2 ScreenCaptureKit native module..."

cd "$(dirname "$0")/whisperdesk-screencapturekit"

# Clean previous builds
cargo clean

# Set RUSTFLAGS for macOS dynamic linking
export RUSTFLAGS="-C link-args=-Wl,-undefined,dynamic_lookup"

# Build using napi-rs which handles the proper .node file generation
echo "🍎 Building with napi-rs..."
npm run build

echo "✅ Native module built successfully"

# List the generated files
echo "📦 Generated files:"
ls -la *.node 2>/dev/null || echo "No .node files found"
ls -la target/release/libwhisperdesk_screencapturekit.dylib 2>/dev/null || echo "No .dylib file found" 