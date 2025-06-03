#!/bin/bash

echo "🚀 Quick Provider Files Setup"
echo "============================="

# Ensure directories exist
mkdir -p src/main/services/providers

# Check what files are missing and need to be created from artifacts
if [ ! -f "src/main/services/providers/native-whisper-provider.js" ]; then
    echo "❌ Missing: src/main/services/providers/native-whisper-provider.js"
    echo "   📋 Copy the 'Fixed Native Whisper Provider' artifact to this location"
    echo ""
fi

if [ ! -f "src/main/services/transcription-service-native.js" ]; then
    echo "❌ Missing: src/main/services/transcription-service-native.js"
    echo "   📋 Copy the 'Fixed Transcription Service Native' artifact to this location"
    echo ""
fi

# Show current file structure
echo "📁 Current file structure:"
echo ""
echo "src/main/services/"
find src/main/services -name "*.js" | head -10 | sed 's/^/   /'

echo ""
echo "📋 After copying the artifacts, restart with: npm run dev"