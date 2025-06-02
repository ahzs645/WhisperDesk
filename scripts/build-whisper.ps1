# scripts/build-whisper.ps1 - Windows PowerShell script to build whisper.cpp

Write-Host "🔨 Building whisper.cpp for Windows with PowerShell" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green

# Check dependencies
Write-Host "Checking dependencies..." -ForegroundColor Blue

# Check for cmake
try {
    $cmakeVersion = cmake --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ CMake found" -ForegroundColor Green
    } else {
        throw "CMake not found"
    }
} catch {
    Write-Host "❌ CMake not found. Installing..." -ForegroundColor Red
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install cmake -y
    } elseif (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install Kitware.CMake
    } else {
        Write-Host "❌ Please install CMake manually from https://cmake.org" -ForegroundColor Red
        exit 1
    }
}

# Set up directories
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TempDir = "C:\temp\whisper-cpp-build-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$BinariesDir = Join-Path $ProjectRoot "binaries"

Write-Host "Project root: $ProjectRoot" -ForegroundColor Cyan
Write-Host "Temp directory: $TempDir" -ForegroundColor Cyan
Write-Host "Binaries directory: $BinariesDir" -ForegroundColor Cyan

# Clean up any existing temp directory
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}

# Clone whisper.cpp
Write-Host "Cloning whisper.cpp..." -ForegroundColor Blue
git clone https://github.com/ggerganov/whisper.cpp.git $TempDir

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to clone whisper.cpp" -ForegroundColor Red
    exit 1
}

Set-Location $TempDir

# Build with cmake
Write-Host "Configuring build with cmake..." -ForegroundColor Blue
cmake -B build -DCMAKE_BUILD_TYPE=Release

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CMake configuration failed" -ForegroundColor Red
    exit 1
}

Write-Host "Building whisper.cpp..." -ForegroundColor Blue
$Cores = (Get-CimInstance -ClassName Win32_ComputerSystem).NumberOfLogicalProcessors
cmake --build build --config Release --parallel $Cores

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}

# Find the whisper binary
Write-Host "Locating whisper binary..." -ForegroundColor Blue

$WhisperBinary = ""
$PossiblePaths = @(
    "build\bin\Release\whisper-cli.exe",
    "build\bin\whisper-cli.exe", 
    "build\Release\whisper-cli.exe",
    "bin\Release\whisper-cli.exe"
)

foreach ($BinaryPath in $PossiblePaths) {
    if (Test-Path $BinaryPath) {
        $WhisperBinary = $BinaryPath
        break
    }
}

if (-not $WhisperBinary) {
    Write-Host "❌ Could not find whisper-cli.exe binary" -ForegroundColor Red
    Write-Host "Available files:" -ForegroundColor Yellow
    Get-ChildItem -Recurse -Filter "*whisper*" | Select-Object FullName | Format-Table -AutoSize
    exit 1
}

Write-Host "✅ Found whisper binary at: $WhisperBinary" -ForegroundColor Green

# Test the binary
Write-Host "Testing whisper binary..." -ForegroundColor Blue
try {
    $TestResult = & $WhisperBinary --help 2>&1
    if ($LASTEXITCODE -eq 0 -or $TestResult -match "whisper|usage|transcribe") {
        Write-Host "✅ Binary test passed" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Binary test failed, but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Binary test failed, but continuing..." -ForegroundColor Yellow
}

# Create binaries directory and copy binary
if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Path $BinariesDir -Force | Out-Null
}

$FinalBinary = Join-Path $BinariesDir "whisper.exe"
Copy-Item $WhisperBinary $FinalBinary -Force

# Verify the copied binary and dependencies
Write-Host "Verifying copied binary and dependencies..." -ForegroundColor Blue
if (Test-Path $FinalBinary) {
    Write-Host "✅ Binary copied successfully to: $FinalBinary" -ForegroundColor Green
    
    # List all files in binaries directory
    Write-Host "📋 Files in binaries directory:" -ForegroundColor Cyan
    Get-ChildItem $BinariesDir | Format-Table Name, Length, LastWriteTime -AutoSize
    
    # Test the final binary
    try {
        $TestResult = & $FinalBinary --help 2>&1
        if ($LASTEXITCODE -eq 0 -or $TestResult -match "whisper|usage|transcribe") {
            Write-Host "✅ Final binary test passed" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Final binary test failed, but file exists" -ForegroundColor Yellow
            Write-Host "Exit code: $LASTEXITCODE" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️ Final binary test failed, but file exists" -ForegroundColor Yellow
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Failed to copy binary" -ForegroundColor Red
    exit 1
}

# Clean up
Write-Host "Cleaning up temporary files..." -ForegroundColor Blue
Set-Location $ProjectRoot
Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ 🎉 whisper.cpp built successfully!" -ForegroundColor Green
Write-Host "Binary location: $FinalBinary" -ForegroundColor Cyan

# Show next steps
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "  1. Download a model: curl -L -o models/ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" -ForegroundColor White
Write-Host "  2. Test transcription: npm run test:native" -ForegroundColor White
Write-Host "  3. Start the application: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "✅ Ready to transcribe! 🎵" -ForegroundColor Green