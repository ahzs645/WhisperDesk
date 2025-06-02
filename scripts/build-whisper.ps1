# scripts/build-whisper.ps1 - ENHANCED VERSION with deprecation detection and size verification
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

# Find the whisper binary with ENHANCED detection - UPDATED
Write-Host "Locating whisper binary with enhanced detection..." -ForegroundColor Blue

$WhisperBinary = ""
$PossiblePaths = @(
    "build\bin\Release\whisper-cpp.exe",      # Latest CLI name
    "build\bin\Release\whisper-whisper.exe",  # Previous default name
    "build\bin\Release\whisper-cli.exe",      # Alternative new name
    "build\bin\Release\main.exe",             # Legacy name
    "build\bin\Release\whisper.exe",          # Old name (might be deprecated stub)
    "build\bin\whisper-whisper.exe",          # Alternative location
    "build\bin\whisper-cli.exe",
    "build\bin\main.exe",
    "build\bin\whisper.exe",
    "build\Release\whisper-whisper.exe",      # Alternative build structure
    "build\Release\whisper-cli.exe",
    "build\Release\main.exe",
    "build\Release\whisper.exe",
    "bin\Release\whisper-whisper.exe",        # Another possible location
    "bin\Release\whisper-cli.exe",
    "bin\Release\main.exe",
    "bin\Release\whisper.exe"
)

foreach ($BinaryPath in $PossiblePaths) {
    if (Test-Path $BinaryPath) {
        $WhisperBinary = $BinaryPath
        Write-Host "✅ Found whisper binary at: $BinaryPath" -ForegroundColor Green
        break
    }
}

if (-not $WhisperBinary) {
    Write-Host "❌ Could not find whisper binary" -ForegroundColor Red
    Write-Host "Available files in build directory:" -ForegroundColor Yellow
    
    # List all exe files in build directory recursively
    Get-ChildItem -Recurse -Filter "*.exe" | ForEach-Object {
        Write-Host "  Found: $($_.FullName)" -ForegroundColor Yellow
    }
    
    exit 1
}

# ENHANCED: Test the binary for deprecation and size issues
Write-Host "Testing whisper binary for deprecation and validity..." -ForegroundColor Blue

$isDeprecated = $false
$recommendedBinary = ""

try {
    # Test the binary
    $process = Start-Process -FilePath $WhisperBinary -ArgumentList "--help" -Wait -NoNewWindow -PassThru -RedirectStandardOutput "test_output.txt" -RedirectStandardError "test_error.txt"
    
    # Check for deprecation warning
    if (Test-Path "test_error.txt") {
        $errorContent = Get-Content "test_error.txt" -Raw
        if ($errorContent -match "deprecated") {
            $isDeprecated = $true
            Write-Host "⚠️ Found deprecated binary!" -ForegroundColor Yellow
            
            # Extract recommended binary name
            if ($errorContent -match "Please use '([^']+)'") {
                $recommendedBinary = $matches[1]
                Write-Host "🔍 Looking for recommended binary: $recommendedBinary" -ForegroundColor Yellow
                
                # Search for the recommended binary in all possible locations
                $foundRecommended = $false
                foreach ($path in $PossiblePaths) {
                    $dir = Split-Path $path -Parent
                    $recommendedPath = Join-Path $dir $recommendedBinary
                    if (Test-Path $recommendedPath) {
                        $WhisperBinary = $recommendedPath
                        Write-Host "✅ Found recommended binary: $recommendedPath" -ForegroundColor Green
                        $isDeprecated = $false
                        $foundRecommended = $true
                        break
                    }
                }
                
                if (-not $foundRecommended) {
                    Write-Host "❌ Could not find recommended binary: $recommendedBinary" -ForegroundColor Red
                    Write-Host "⚠️ Continuing with deprecated binary..." -ForegroundColor Yellow
                }
            }
        }
    }
    
    if (-not $isDeprecated) {
        if ($process.ExitCode -eq 0 -or (Test-Path "test_output.txt" -and (Get-Content "test_output.txt" -Raw) -match "whisper|usage|transcribe")) {
            Write-Host "✅ Binary test passed" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Binary test failed, but continuing..." -ForegroundColor Yellow
            Write-Host "Exit code: $($process.ExitCode)" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "⚠️ Binary test failed, but continuing..." -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
} finally {
    # Clean up test files
    Remove-Item "test_output.txt" -ErrorAction SilentlyContinue
    Remove-Item "test_error.txt" -ErrorAction SilentlyContinue
}

# ENHANCED: Verify binary size (detect stubs)
Write-Host "Verifying binary size..." -ForegroundColor Blue
$binarySize = (Get-Item $WhisperBinary).Length
Write-Host "📊 Binary size: $binarySize bytes" -ForegroundColor Cyan

if ($binarySize -lt 50000) {
    Write-Host "❌ ERROR: Binary is very small ($binarySize bytes) - this is likely a deprecated stub!" -ForegroundColor Red
    Write-Host "🔍 This will cause runtime failures in your application." -ForegroundColor Red
    
    # Show all executables for debugging
    Write-Host "📋 All executables found in build directories:" -ForegroundColor Yellow
    Get-ChildItem -Recurse -Filter "*.exe" | ForEach-Object {
        $size = $_.Length
        $sizeKB = [math]::Round($size / 1024, 1)
        if ($size -lt 50000) {
            Write-Host "  ⚠️ $($_.FullName) ($sizeKB KB) - STUB" -ForegroundColor Red
        } else {
            Write-Host "  ✅ $($_.FullName) ($sizeKB KB) - GOOD" -ForegroundColor Green
        }
    }
    
    Write-Host "❌ BUILD FAILED: Refusing to copy deprecated stub binary" -ForegroundColor Red
    exit 1
} else {
    $sizeKB = [math]::Round($binarySize / 1024, 1)
    Write-Host "✅ Binary size looks good ($sizeKB KB)" -ForegroundColor Green
}

# Create binaries directory and copy binary
if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Path $BinariesDir -Force | Out-Null
}

$FinalBinary = Join-Path $BinariesDir "whisper.exe"
Copy-Item $WhisperBinary $FinalBinary -Force

# Copy all DLLs from the build directory
Write-Host "Copying DLL dependencies..." -ForegroundColor Blue
$BuildDir = Split-Path $WhisperBinary -Parent
$DllFiles = Get-ChildItem -Path $BuildDir -Filter "*.dll" -ErrorAction SilentlyContinue

if ($DllFiles) {
    foreach ($Dll in $DllFiles) {
        Copy-Item $Dll.FullName $BinariesDir -Force
        Write-Host "✅ Copied DLL: $($Dll.Name)" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️ No DLLs found in build directory" -ForegroundColor Yellow
}

# Download VC++ Redistributable
Write-Host "Downloading VC++ Redistributable..." -ForegroundColor Blue
$VcRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
$VcRedistPath = Join-Path $BinariesDir "vc_redist.x64.exe"

try {
    Invoke-WebRequest -Uri $VcRedistUrl -OutFile $VcRedistPath -UseBasicParsing
    Write-Host "✅ Downloaded VC++ Redistributable" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Failed to download VC++ Redistributable: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ENHANCED: Final verification of copied binary
Write-Host "Performing final verification of copied binary..." -ForegroundColor Blue
if (Test-Path $FinalBinary) {
    $finalSize = (Get-Item $FinalBinary).Length
    $finalSizeKB = [math]::Round($finalSize / 1024, 1)
    
    Write-Host "✅ Binary copied successfully to: $FinalBinary" -ForegroundColor Green
    Write-Host "📊 Final binary size: $finalSizeKB KB" -ForegroundColor Cyan
    
    # Final size check
    if ($finalSize -lt 50000) {
        Write-Host "❌ CRITICAL ERROR: Final binary is still a stub ($finalSizeKB KB)!" -ForegroundColor Red
        Write-Host "❌ This build will NOT work for transcription!" -ForegroundColor Red
        exit 1
    }
    
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

# Show final directory contents with enhanced information
Write-Host ""
Write-Host "📋 Final binaries directory contents:" -ForegroundColor Blue
Get-ChildItem $BinariesDir | ForEach-Object {
    $size = if ($_.PSIsContainer) { "DIR" } else { "$([math]::Round($_.Length / 1024, 1)) KB" }
    Write-Host "  $($_.Name) ($size)" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Blue
Write-Host "  1. Download a model: curl -L -o models/ggml-tiny.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin" -ForegroundColor White
Write-Host "  2. Test transcription: npm run test:native" -ForegroundColor White
Write-Host "  3. Start the application: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "✅ Ready to transcribe! 🎵" -ForegroundColor Green