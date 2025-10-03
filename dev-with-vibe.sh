#!/bin/bash

# WhisperDesk + Vibe Development Launcher
# This script starts WhisperDesk with Vibe backend for testing

echo "🚀 Starting WhisperDesk with Vibe Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Please install it first:${NC}"
    echo "npm install -g pnpm"
    exit 1
fi

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust/Cargo is not installed. Please install it first:${NC}"
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"

# Install WhisperDesk UI dependencies
cd src/renderer/whisperdesk-ui
if [ ! -d "node_modules" ]; then
    echo "Installing WhisperDesk UI dependencies..."
    pnpm install
fi

# Go back to root
cd ../../..

# Check if Vibe exists
if [ ! -d "vibe-main" ]; then
    echo -e "${RED}❌ Vibe directory not found at ./vibe-main${NC}"
    echo "Please ensure Vibe is cloned to: /Users/ahzs645/Github/WhisperDesk/vibe-main"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies ready${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup INT TERM

echo -e "${YELLOW}🎯 Starting services...${NC}"

# Start WhisperDesk UI
echo -e "${GREEN}1. Starting WhisperDesk UI on http://localhost:5173${NC}"
(cd src/renderer/whisperdesk-ui && pnpm dev) &
UI_PID=$!

# Wait for UI to be ready
echo "Waiting for UI to start..."
sleep 3

# Start Tauri with WhisperDesk+Vibe backend
echo -e "${GREEN}2. Starting Tauri with Vibe integration...${NC}"
pnpm tauri dev &
TAURI_PID=$!

echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "==================================="
echo "WhisperDesk is running with Vibe backend!"
echo "==================================="
echo ""
echo "📝 Quick Test Guide:"
echo "1. The app should open automatically"
echo "2. Go to Settings → Backend Configuration"
echo "3. Ensure 'Vibe Backend' is selected"
echo "4. Click 'Test Connection' to verify"
echo "5. Try transcribing an audio file"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait