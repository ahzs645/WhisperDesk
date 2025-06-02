#!/bin/bash

echo "🚀 Quick Fix for Toast Spam + Persistent State"
echo "=============================================="
echo ""
echo "Issues to fix:"
echo "1. ❌ Too many progress toast notifications"
echo "2. ❌ State doesn't persist when switching tabs"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Step 1: Check current state
echo "📋 Step 1: Checking current implementation..."

APP_FILE="src/renderer/whisperdesk-ui/src/App.jsx"
ELECTRON_TAB="src/renderer/whisperdesk-ui/src/components/TranscriptionTab-Electron.jsx"

# Check App.jsx
if [ -f "$APP_FILE" ]; then
    if grep -q "AppStateContext" "$APP_FILE"; then
        print_success "App.jsx has persistent state context"
        HAS_PERSISTENT_STATE=true
    else
        print_warning "App.jsx missing persistent state - needs update"
        HAS_PERSISTENT_STATE=false
    fi
else
    print_error "App.jsx not found"
    HAS_PERSISTENT_STATE=false
fi

# Check TranscriptionTab-Electron
if [ -f "$ELECTRON_TAB" ]; then
    if grep -q "toast.loading" "$ELECTRON_TAB"; then
        print_warning "TranscriptionTab-Electron has toast spam issue"
        HAS_TOAST_SPAM=true
    else
        print_success "TranscriptionTab-Electron toast handling looks good"
        HAS_TOAST_SPAM=false
    fi
    
    if grep -q "useAppState" "$ELECTRON_TAB"; then
        print_success "TranscriptionTab-Electron uses persistent state"
        USES_PERSISTENT_STATE=true
    else
        print_warning "TranscriptionTab-Electron doesn't use persistent state"
        USES_PERSISTENT_STATE=false
    fi
else
    print_error "TranscriptionTab-Electron.jsx not found"
    HAS_TOAST_SPAM=true
    USES_PERSISTENT_STATE=false
fi

echo ""

# Step 2: Determine what needs to be fixed
echo "📋 Step 2: Required fixes..."

NEEDS_APP_UPDATE=false
NEEDS_TAB_UPDATE=false

if [ "$HAS_PERSISTENT_STATE" = false ]; then
    print_warning "Need to update App.jsx for persistent state"
    NEEDS_APP_UPDATE=true
fi

if [ "$HAS_TOAST_SPAM" = true ] || [ "$USES_PERSISTENT_STATE" = false ]; then
    print_warning "Need to update TranscriptionTab-Electron.jsx"
    NEEDS_TAB_UPDATE=true
fi

if [ "$NEEDS_APP_UPDATE" = false ] && [ "$NEEDS_TAB_UPDATE" = false ]; then
    print_success "All files look good!"
    echo ""
    echo "If you're still having issues:"
    echo "1. Restart the app: npm run dev"
    echo "2. Clear browser cache"
    echo "3. Check browser console for errors"
    exit 0
fi

echo ""

# Step 3: Manual fix instructions
echo "📋 Step 3: Manual fixes required..."
echo ""

if [ "$NEEDS_APP_UPDATE" = true ]; then
    print_warning "Fix 1: Update App.jsx for persistent state"
    echo ""
    echo "Replace your src/renderer/whisperdesk-ui/src/App.jsx with this code:"
    echo "👉 Copy the 'App with Persistent File State' artifact"
    echo ""
    echo "This adds:"
    echo "   - AppStateContext for global state"
    echo "   - useAppState hook"
    echo "   - Persistent file selection"
    echo "   - State that survives tab switches"
    echo ""
fi

if [ "$NEEDS_TAB_UPDATE" = true ]; then
    print_warning "Fix 2: Update TranscriptionTab-Electron.jsx to fix toast spam"
    echo ""
    echo "Replace your TranscriptionTab-Electron.jsx with this code:"
    echo "👉 Copy the 'Fixed TranscriptionTab-Electron with No Toast Spam' artifact"
    echo ""
    echo "This fixes:"
    echo "   - ✅ Only ONE loading toast during transcription"
    echo "   - ✅ ONE success toast when complete"
    echo "   - ✅ Uses persistent state from App.jsx"
    echo "   - ✅ State persists across tab switches"
    echo ""
fi

# Step 4: Build instructions
echo "📋 Step 4: After copying the artifacts..."
echo ""
echo "1. Rebuild the renderer:"
echo "   cd src/renderer/whisperdesk-ui"
echo "   npm run build"
echo "   cd ../../.."
echo ""
echo "2. Restart the app:"
echo "   npm run dev"
echo ""

# Step 5: Test instructions
echo "📋 Step 5: Testing the fixes..."
echo ""
echo "Test 1 - Toast Spam Fix:"
echo "   1. Select an audio file"
echo "   2. Start transcription"  
echo "   3. Should see: ONE loading toast with progress updates"
echo "   4. Should see: ONE success toast when complete"
echo "   5. Should NOT see: Multiple toasts popping up"
echo ""
echo "Test 2 - Persistent State:"
echo "   1. Select an audio file in Transcribe tab"
echo "   2. Switch to Models tab"
echo "   3. Switch back to Transcribe tab"
echo "   4. File should still be selected"
echo "   5. Switch to History tab - should show current session"
echo ""

# Wait for user
echo "📋 Ready to apply fixes?"
read -p "Press Enter when you have copied the artifacts and are ready to rebuild..."

# Auto-rebuild if user wants
echo ""
echo "🔨 Rebuilding renderer..."
cd src/renderer/whisperdesk-ui

if npm run build; then
    print_success "Renderer rebuilt successfully"
else
    print_error "Rebuild failed - check for syntax errors"
    exit 1
fi

cd ../../..

echo ""
print_success "🎉 Fixes applied!"
echo ""
echo "Expected behavior:"
echo "✅ Only one loading toast during transcription"
echo "✅ One success toast when complete"  
echo "✅ File selection persists across tabs"
echo "✅ Progress bar updates smoothly"
echo "✅ Transcription result appears properly"
echo ""

# Optional: Start the app
read -p "Start the app now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting app..."
    npm run dev
fi