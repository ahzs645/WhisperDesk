#!/bin/bash

echo "🚀 Starting WhisperDesk Enhanced with Debug Mode"
echo "================================================"

# Set debug environment variables
export DEBUG=whisperdesk:*
export NODE_ENV=development
export ELECTRON_ENABLE_LOGGING=1

# Check if everything is ready
echo "Pre-flight checks:"

# Check if frontend is built
if [ ! -d "src/renderer/whisperdesk-ui/dist" ]; then
    echo "❌ Frontend not built. Building now..."
    cd src/renderer/whisperdesk-ui
    pnpm run build
    cd ../../..
fi

# Check if models are available
echo "📋 Testing services..."
node test-services.js

echo ""
echo "🎙️ Starting application..."
npm run dev
