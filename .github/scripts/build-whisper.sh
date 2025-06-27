#!/bin/bash
set -e

echo "🔧 Building whisper.cpp..."
echo "Platform: $(uname -s)"
echo "Architecture: $(uname -m)"

# Create binaries directory
mkdir -p binaries

# Set up temporary directory
TEMP_DIR="/tmp/whisper-cpp-official"
rm -rf "$TEMP_DIR"

echo "📥 Cloning whisper.cpp repository..."
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "$TEMP_DIR"
cd "$TEMP_DIR"

echo "🏗️ Building whisper.cpp..."
mkdir build
cd build

# Configure build
cmake .. \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_SHARED_LIBS=ON \
  -DWHISPER_BUILD_EXAMPLES=ON

# Build
if command -v nproc &> /dev/null; then
  CORES=$(nproc)
elif command -v sysctl &> /dev/null; then
  CORES=$(sysctl -n hw.ncpu)
else
  CORES=4
fi

echo "🚀 Building with $CORES cores..."
make -j$CORES

echo "📦 Copying binaries..."
# Copy the whisper-cli binary
if [ -f "bin/whisper-cli" ]; then
  cp bin/whisper-cli "$GITHUB_WORKSPACE/binaries/"
elif [ -f "whisper-cli" ]; then
  cp whisper-cli "$GITHUB_WORKSPACE/binaries/"
else
  echo "❌ whisper-cli binary not found"
  find . -name "*whisper*" -type f -executable
  exit 1
fi

# Copy shared libraries if they exist
if [ -f "libwhisper.so" ]; then
  cp libwhisper.so "$GITHUB_WORKSPACE/binaries/"
elif [ -f "libwhisper.dylib" ]; then
  cp libwhisper.dylib "$GITHUB_WORKSPACE/binaries/"
fi

# Return to workspace
cd "$GITHUB_WORKSPACE"

# Verify binary
BINARY_PATH="binaries/whisper-cli"
if [ -f "$BINARY_PATH" ]; then
  chmod +x "$BINARY_PATH"
  echo "✅ whisper-cli binary built successfully"
  ls -la "$BINARY_PATH"
  echo "📊 Size: $(ls -lh $BINARY_PATH | awk '{print $5}')"
else
  echo "❌ whisper-cli binary not found at expected location"
  exit 1
fi

echo "🎉 Whisper.cpp build completed successfully!"
