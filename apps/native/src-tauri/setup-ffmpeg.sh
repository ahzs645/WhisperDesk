#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARIES_DIR="$SCRIPT_DIR/binaries"

mkdir -p "$BINARIES_DIR"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    FFMPEG_ARCH="aarch64"
elif [ "$ARCH" = "x86_64" ]; then
    FFMPEG_ARCH="x86_64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

# Download ffmpeg static build for macOS
FFMPEG_URL="https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip"
FFMPEG_ZIP="$BINARIES_DIR/ffmpeg.zip"
FFMPEG_BIN="$BINARIES_DIR/ffmpeg-${FFMPEG_ARCH}-apple-darwin"

if [ ! -f "$FFMPEG_BIN" ]; then
    echo "Downloading ffmpeg for macOS ($FFMPEG_ARCH)..."
    curl -L "$FFMPEG_URL" -o "$FFMPEG_ZIP"

    echo "Extracting ffmpeg..."
    unzip -o "$FFMPEG_ZIP" -d "$BINARIES_DIR"

    # Rename to the expected format for Tauri
    mv "$BINARIES_DIR/ffmpeg" "$FFMPEG_BIN"

    # Make it executable
    chmod +x "$FFMPEG_BIN"

    # Clean up
    rm "$FFMPEG_ZIP"

    echo "ffmpeg setup complete!"
else
    echo "ffmpeg already exists at $FFMPEG_BIN"
fi
