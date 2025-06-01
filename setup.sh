#!/bin/bash

echo "🎙️  WhisperDesk Setup Script"
echo "=========================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the WhisperDesk root directory"
    exit 1
fi

echo "📦 Installing main dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install main dependencies"
    exit 1
fi

echo ""
echo "🎨 Installing renderer dependencies..."
cd src/renderer/whisperdesk-ui
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    echo "❌ Failed to install renderer dependencies"
    exit 1
fi

echo ""
echo "🔨 Building renderer..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build renderer"
    exit 1
fi

cd ../../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start the application:"
echo "   npm start"
echo ""
echo "📋 Available commands:"
echo "   npm start          - Start the application"
echo "   npm run dev        - Start in development mode"
echo "   npm run build      - Build for production"
echo "   npm run dist       - Create distribution packages"
echo ""
echo "🎯 Features available:"
echo "   • Model marketplace with 6 Whisper models"
echo "   • Drag-and-drop file transcription"
echo "   • File picker for audio/video files"
echo "   • Recording with microphone"
echo "   • System audio recording (What U Hear)"
echo "   • Combined microphone + system audio"
echo ""

