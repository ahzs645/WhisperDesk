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
$binaryPath = "binaries\whisper.exe"
if (Test-Path $binaryPath) {
    Write-Host "✅ Whisper binary found" -ForegroundColor Green
} else {
    Write-Host "⚠️  Whisper binary not found" -ForegroundColor Yellow
    Write-Host "📋 Choose setup option:" -ForegroundColor Blue
    Write-Host "1) Build from source (recommended)" -ForegroundColor White
    Write-Host "2) Skip binary setup (web interface only)" -ForegroundColor White
    $choice = Read-Host "Enter choice (1 or 2)"
    
    if ($choice -eq "1") {
        Write-Host "🔨 Building whisper.cpp from source..." -ForegroundColor Blue
        
        # Check for build dependencies
        try {
            cmake --version | Out-Null
            Write-Host "✅ CMake found" -ForegroundColor Green
        } catch {
            Write-Host "Installing CMake..." -ForegroundColor Yellow
            if (Get-Command choco -ErrorAction SilentlyContinue) {
                choco install cmake -y
            } elseif (Get-Command winget -ErrorAction SilentlyContinue) {
                winget install Kitware.CMake
            } else {
                Write-Host "❌ Please install CMake manually from https://cmake.org" -ForegroundColor Red
                exit 1
            }
        }
        
        # Clone and build whisper.cpp
        Write-Host "📥 Cloning whisper.cpp..." -ForegroundColor Blue
        if (Test-Path "C:\temp\whisper.cpp") {
            Remove-Item -Recurse -Force "C:\temp\whisper.cpp"
        }
        git clone https://github.com/ggerganov/whisper.cpp.git C:\temp\whisper.cpp
        
        Write-Host "🔨 Building whisper.cpp..." -ForegroundColor Blue
        Set-Location "C:\temp\whisper.cpp"
        
        New-Item -ItemType Directory -Force -Path "build"
        Set-Location "build"
        cmake .. -DCMAKE_BUILD_TYPE=Release
        cmake --build . --config Release
        
        Write-Host "📋 Installing binary..." -ForegroundColor Blue
        $projectPath = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
        New-Item -ItemType Directory -Force -Path "$projectPath\binaries"
        Copy-Item "bin\Release\whisper-cli.exe" "$projectPath\binaries\whisper.exe"
        Set-Location $projectPath
        
        Write-Host "✅ Whisper binary built and installed" -ForegroundColor Green
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

