# WhisperDesk Native Setup Script for Windows
# Run this in PowerShell

Write-Host "🚀 WhisperDesk Native Setup Script (Windows)" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Install main dependencies
Write-Host "📦 Installing main dependencies..." -ForegroundColor Blue
npm install

# Install renderer dependencies
Write-Host "📦 Installing renderer dependencies..." -ForegroundColor Blue
Set-Location "src\renderer\whisperdesk-ui"
npm install --legacy-peer-deps
Set-Location "..\..\..\"

# Check if whisper binary exists
$binaryPath = "binaries\whisper-cli.exe"
if (Test-Path $binaryPath) {
    Write-Host "✅ Whisper binary found" -ForegroundColor Green
} else {
    Write-Host "⚠️  Whisper binary not found" -ForegroundColor Yellow
    Write-Host "📋 Choose setup option:" -ForegroundColor Blue
    Write-Host "1) Build from source (recommended)" -ForegroundColor White
    Write-Host "2) Skip binary setup (web interface only)" -ForegroundColor White
    $choice = Read-Host "Enter choice (1 or 2)"
    
    if ($choice -eq "1") {
        Write-Host "🔨 Building whisper.cpp from source using 'npm run build:whisper'..." -ForegroundColor Blue
        try {
            npm run build:whisper
            Write-Host "✅ Whisper binary built successfully via npm script." -ForegroundColor Green
            # The compile-whisper-windows.ps1 script should place it correctly in binaries/whisper-cli.exe
        }
        catch {
            Write-Host "❌ Failed to build whisper.cpp using npm script." -ForegroundColor Red
            Write-Host "Please check for errors and ensure all build dependencies (CMake, Visual Studio C++ Build Tools) are installed." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "⏭️  Skipping binary setup" -ForegroundColor Yellow
    }
}

# Check for models
Write-Host "🔍 Checking for models..." -ForegroundColor Blue
$modelsDir = "$env:APPDATA\whisperdesk-enhanced\models"
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

$tinyModelPath = "$modelsDir\ggml-tiny.bin"
if (-not (Test-Path $tinyModelPath)) {
    Write-Host "📥 Downloading tiny model for testing..." -ForegroundColor Blue
    try {
        Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" -OutFile $tinyModelPath
        Write-Host "✅ Tiny model downloaded" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Failed to download model. You can download it manually later." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Models found" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Blue
Write-Host "1. Test native services: npm run test:native" -ForegroundColor White
Write-Host "2. Start development: npm run dev" -ForegroundColor White
Write-Host "3. Or start web interface: npm run web" -ForegroundColor White
Write-Host ""
Write-Host "📖 See SETUP_WINDOWS.md for detailed instructions" -ForegroundColor Yellow

