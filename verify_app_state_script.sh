#!/bin/bash

echo "🔍 Verifying WhisperDesk App State Implementation"
echo "================================================"

# Check if App.jsx has the persistent state context
APP_FILE="src/renderer/whisperdesk-ui/src/App.jsx"

if [ ! -f "$APP_FILE" ]; then
    echo "❌ App.jsx not found at $APP_FILE"
    exit 1
fi

echo "📋 Checking App.jsx for persistent state features..."

# Check for AppStateContext
if grep -q "AppStateContext" "$APP_FILE"; then
    echo "✅ AppStateContext found"
else
    echo "❌ AppStateContext missing - App.jsx needs to be updated"
    echo ""
    echo "🔧 To fix this:"
    echo "1. Replace your src/renderer/whisperdesk-ui/src/App.jsx"
    echo "2. With the 'App with Persistent File State' artifact"
    echo "3. This provides the useAppState hook for persistent state"
    exit 1
fi

# Check for useAppState
if grep -q "useAppState" "$APP_FILE"; then
    echo "✅ useAppState hook found"
else
    echo "❌ useAppState hook missing"
    exit 1
fi

# Check for persistent state properties
if grep -q "selectedFile" "$APP_FILE"; then
    echo "✅ selectedFile state found"
else
    echo "❌ selectedFile state missing"
    exit 1
fi

if grep -q "isTranscribing" "$APP_FILE"; then
    echo "✅ isTranscribing state found"
else
    echo "❌ isTranscribing state missing"
    exit 1
fi

if grep -q "transcription:" "$APP_FILE"; then
    echo "✅ transcription state found"
else
    echo "❌ transcription state missing"
    exit 1
fi

# Check for AppStateProvider
if grep -q "AppStateProvider" "$APP_FILE"; then
    echo "✅ AppStateProvider found"
else
    echo "❌ AppStateProvider missing"
    exit 1
fi

echo ""
echo "📋 Checking if TranscriptionTab-Electron uses persistent state..."

ELECTRON_TAB="src/renderer/whisperdesk-ui/src/components/TranscriptionTab-Electron.jsx"

if [ ! -f "$ELECTRON_TAB" ]; then
    echo "❌ TranscriptionTab-Electron.jsx not found"
    echo "📁 Expected location: $ELECTRON_TAB"
    echo ""
    echo "🔧 To fix this:"
    echo "1. Create the file TranscriptionTab-Electron.jsx"
    echo "2. Copy the 'Fixed TranscriptionTab-Electron' artifact content"
    exit 1
fi

if grep -q "useAppState" "$ELECTRON_TAB"; then
    echo "✅ TranscriptionTab-Electron uses useAppState"
else
    echo "❌ TranscriptionTab-Electron doesn't use useAppState"
    echo ""
    echo "🔧 To fix this:"
    echo "1. Replace TranscriptionTab-Electron.jsx content"
    echo "2. With the 'Fixed TranscriptionTab-Electron' artifact"
    exit 1
fi

echo ""
echo "📋 Testing state structure..."

# Check if the state structure looks correct
if grep -q "selectedFile:" "$APP_FILE" && grep -q "transcription:" "$APP_FILE" && grep -q "isTranscribing:" "$APP_FILE"; then
    echo "✅ State structure looks correct"
else
    echo "❌ State structure incomplete"
    exit 1
fi

echo ""
echo "🎉 App state verification passed!"
echo ""
echo "📋 Your persistent state should include:"
echo "   ✅ selectedFile - survives tab switches"
echo "   ✅ transcription text - survives tab switches"  
echo "   ✅ isTranscribing flag - survives tab switches"
echo "   ✅ progress tracking - survives tab switches"
echo "   ✅ last result - survives tab switches"
echo ""
echo "🚀 To test persistent state:"
echo "1. npm run dev"
echo "2. Select a file in Transcribe tab"
echo "3. Switch to Models tab"
echo "4. Switch back to Transcribe tab"
echo "5. File should still be selected"
echo ""
echo "🔧 If state doesn't persist:"
echo "   - Make sure you copied the App.jsx artifact exactly"
echo "   - Check that TranscriptionTab-Electron.jsx uses useAppState"
echo "   - Restart the app after making changes"