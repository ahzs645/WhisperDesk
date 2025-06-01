#!/bin/bash

# WhisperDesk Enhanced - Quick Start Script
# This script starts the application in development mode

echo "🚀 Starting WhisperDesk Enhanced..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if renderer dependencies are installed
if [ ! -d "src/renderer/whisperdesk-ui/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd src/renderer/whisperdesk-ui
    if ! command -v pnpm &> /dev/null; then
        npm install -g pnpm
    fi
    pnpm install
    cd ../../..
fi

# Start the application
echo "🎙️ Launching WhisperDesk Enhanced..."
npm run dev

