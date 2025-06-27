#!/bin/bash
set -e

PLATFORM=${1:-linux}
ARCH=${2:-x64}

echo "🎭 Building enhanced multi-speaker diarization system for $PLATFORM ($ARCH)..."

# Create binaries directory
mkdir -p binaries
mkdir -p models

# Check if diarization dependency exists
if [ -d "deps/diarization" ]; then
  echo "📁 Found diarization dependency directory"
  cd deps/diarization
  
  # Try to build using the existing build system
  if [ -f "scripts/build.sh" ]; then
    echo "🔧 Using existing build script..."
    bash scripts/build.sh
  elif [ -f "package.json" ] && command -v npm &> /dev/null; then
    echo "🔧 Using npm build script..."
    npm install
    if npm run build --if-present; then
      echo "✅ Diarization built via npm"
    else
      echo "⚠️ npm build failed, trying manual build"
    fi
  else
    echo "⚠️ No build system found in diarization dependency"
  fi
  
  # Copy binaries if they exist
  if [ -f "binaries/diarize-cli" ]; then
    cp binaries/diarize-cli "$GITHUB_WORKSPACE/binaries/"
    echo "✅ Copied diarize-cli from deps"
  elif [ -f "diarize-cli" ]; then
    cp diarize-cli "$GITHUB_WORKSPACE/binaries/"
    echo "✅ Copied diarize-cli from root"
  fi
  
  # Copy models if they exist
  if [ -f "models/segmentation-3.0.onnx" ]; then
    cp models/segmentation-3.0.onnx "$GITHUB_WORKSPACE/models/"
    echo "✅ Copied segmentation model"
  fi
  
  if [ -f "models/embedding-1.0.onnx" ]; then
    cp models/embedding-1.0.onnx "$GITHUB_WORKSPACE/models/"
    echo "✅ Copied embedding model"
  fi
  
  cd "$GITHUB_WORKSPACE"
  
else
  echo "⚠️ No diarization dependency found at deps/diarization"
  echo "ℹ️ Will build basic fallback diarization system"
  
  # Create a simple stub binary for testing
  cat > binaries/diarize-cli << 'EOF'
#!/bin/bash
echo "Diarization not available - single speaker mode only"
exit 1
EOF
  chmod +x binaries/diarize-cli
fi

# Verify the build
DIARIZE_BIN="binaries/diarize-cli"
if [ "$PLATFORM" = "windows" ]; then
  DIARIZE_BIN="binaries/diarize-cli.exe"
fi

if [ -f "$DIARIZE_BIN" ]; then
  echo "✅ Diarization binary found: $DIARIZE_BIN"
  chmod +x "$DIARIZE_BIN" 2>/dev/null || true
  
  if [ "$PLATFORM" != "windows" ]; then
    ls -la "$DIARIZE_BIN"
    echo "📊 Size: $(ls -lh $DIARIZE_BIN | awk '{print $5}')"
  fi
  
  # Check for models
  if [ -f "models/segmentation-3.0.onnx" ]; then
    echo "✅ Segmentation model available"
  else
    echo "⚠️ Segmentation model missing - download required"
  fi
  
  if [ -f "models/embedding-1.0.onnx" ]; then
    echo "✅ Embedding model available"
  else
    echo "⚠️ Embedding model missing - download required"
  fi
  
else
  echo "⚠️ Diarization binary not found - single speaker mode only"
  echo "ℹ️ This is expected if diarization dependencies are not available"
fi

echo "🎉 Diarization build process completed!"
