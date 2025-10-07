#!/bin/bash

echo "🚀 Starting WhisperDesk Tauri UI..."
echo ""
echo "📍 Location: /Users/ahmadjalil/Github/WhisperDesk/tauri-app"
echo ""

cd /Users/ahmadjalil/Github/WhisperDesk/tauri-app

echo "📦 Installing dependencies (if needed)..."
/Users/ahmadjalil/Library/pnpm/pnpm install

echo ""
echo "✨ Starting development server..."
echo "🌐 The UI will open at: http://localhost:1420"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

/Users/ahmadjalil/Library/pnpm/pnpm --filter native dev
