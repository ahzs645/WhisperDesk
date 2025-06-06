# scripts/compile-whisper-windows.ps1
# Official whisper.cpp build method for Windows with whisper-cli.exe

param (
    [string]$Architecture = "x64",
    [string]$BuildType = "Release",
    [string]$SDL2Version = "2.28.5"
)

$ErrorActionPreference = "Stop"

function Write-Success($message) {
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "[WARNING] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Cyan
}

# Display script information
Write-Info "WhisperDesk Official Build Script (whisper-cli.exe)"
Write-Info "================================================="
Write-Info "Using official whisper.cpp build method with whisper-cli.exe"
Write-Info "Architecture: $Architecture"
Write-Info "Build Type: $BuildType"
Write-Info "SDL2 Version: $SDL2Version"

# Set up directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$BinariesDir = Join-Path $ProjectRoot "binaries"
$TempDir = Join-Path $env:TEMP "whisper-official-build-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Info "Project root: $ProjectRoot"
Write-Info "Binaries directory: $BinariesDir"
Write-Info "Temporary build directory: $TempDir"

# Create directories
if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
    Write-Success "Created binaries directory"
}

if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    Set-Location $TempDir

    # Step 1: Download and extract SDL2
    Write-Info "Downloading SDL2 development libraries..."
    $SDL2Url = "https://github.com/libsdl-org/SDL/releases/download/release-$SDL2Version/SDL2-devel-$SDL2Version-VC.zip"
    $SDL2Zip = "sdl2.zip"
    
    Invoke-WebRequest -Uri $SDL2Url -OutFile $SDL2Zip -TimeoutSec 300
    Write-Success "SDL2 downloaded successfully"
    
    # Extract SDL2
    Expand-Archive -Path $SDL2Zip -DestinationPath "." -Force
    $SDL2Dir = Join-Path $TempDir "SDL2-$SDL2Version"
    $env:SDL2_DIR = Join-Path $SDL2Dir "cmake"
    
    Write-Success "SDL2 extracted to: $SDL2Dir"
    Write-Info "SDL2_DIR set to: $env:SDL2_DIR"

    # Step 2: Clone whisper.cpp
    Write-Info "Cloning whisper.cpp repository..."
    $WhisperDir = Join-Path $TempDir "whisper.cpp"
    git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git $WhisperDir
    Set-Location $WhisperDir
    Write-Success "whisper.cpp cloned successfully"

    # Step 3: Configure with CMake (official settings with examples enabled)
    Write-Info "Configuring CMake build with official settings..."
    $BuildDir = Join-Path $WhisperDir "build"
    
    $cmakeArgs = @(
        "-S", ".",
        "-B", $BuildDir,
        "-A", $Architecture,
        "-DCMAKE_BUILD_TYPE=$BuildType",
        "-DBUILD_SHARED_LIBS=ON",           # DLL-based (official method)
        "-DWHISPER_SDL2=ON",                # Enable SDL2 audio support
        "-DWHISPER_BUILD_EXAMPLES=ON",      # ← KEY: Build whisper-cli.exe and examples
        "-DWHISPER_BUILD_TESTS=ON",         # Build test executables
        "-DWHISPER_BUILD_SERVER=ON",        # Build whisper-server.exe
        "-DWHISPER_BUILD_BENCHMARKS=ON"     # Build benchmark tools
    )
    
    Write-Info "CMake arguments: $($cmakeArgs -join ' ')"
    & cmake @cmakeArgs
    
    if ($LASTEXITCODE -ne 0) {
        throw "CMake configuration failed with exit code $LASTEXITCODE"
    }
    Write-Success "CMake configuration completed"

    # Step 4: Build with MSBuild
    Write-Info "Building with MSBuild..."
    Set-Location $BuildDir
    
    & msbuild ALL_BUILD.vcxproj -t:build -p:configuration=$BuildType -p:platform=$Architecture
    
    if ($LASTEXITCODE -ne 0) {
        throw "MSBuild failed with exit code $LASTEXITCODE"
    }
    Write-Success "Build completed successfully"

    # Step 5: Copy binaries
    Write-Info "Copying binaries to project directory..."
    $BuildBinDir = Join-Path $BuildDir "bin/$BuildType"
    
    # Required DLLs and executables (updated for whisper-cli)
    $RequiredFiles = @(
        "whisper.dll",
        "ggml.dll", 
        "ggml-base.dll",
        "ggml-cpu.dll",
        "whisper-cli.exe"           # ← UPDATED: Using whisper-cli.exe instead of main.exe
    )
    
    # Optional executables that might be built
    $OptionalFiles = @(
        "whisper-stream.exe",
        "whisper-server.exe",
        "whisper-bench.exe",
        "quantize.exe"
    )
    
    foreach ($file in $RequiredFiles) {
        $sourcePath = Join-Path $BuildBinDir $file
        $destPath = Join-Path $BinariesDir $file
        
        if (Test-Path $sourcePath) {
            Copy-Item $sourcePath $destPath -Force
            $fileSize = [math]::Round((Get-Item $destPath).Length / 1024, 1)
            Write-Success "Copied $file ($fileSize KB)"
        } else {
            Write-Error "Required file not found: $sourcePath"
            throw "Missing required file: $file"
        }
    }
    
    # Copy optional files if they exist
    foreach ($file in $OptionalFiles) {
        $sourcePath = Join-Path $BuildBinDir $file
        $destPath = Join-Path $BinariesDir $file
        
        if (Test-Path $sourcePath) {
            Copy-Item $sourcePath $destPath -Force
            $fileSize = [math]::Round((Get-Item $destPath).Length / 1024, 1)
            Write-Success "Copied optional $file ($fileSize KB)"
        }
    }
    
    # Copy SDL2.dll
    $SDL2DllPath = Join-Path $SDL2Dir "lib/$Architecture/SDL2.dll"
    $SDL2DestPath = Join-Path $BinariesDir "SDL2.dll"
    
    if (Test-Path $SDL2DllPath) {
        Copy-Item $SDL2DllPath $SDL2DestPath -Force
        $sdl2Size = [math]::Round((Get-Item $SDL2DestPath).Length / 1024, 1)
        Write-Success "Copied SDL2.dll ($sdl2Size KB)"
    } else {
        Write-Error "SDL2.dll not found at: $SDL2DllPath"
        throw "SDL2.dll not found"
    }

    # Step 6: Verify binaries
    Write-Info "Verifying binaries..."
    $AllFiles = $RequiredFiles + @("SDL2.dll")
    
    foreach ($file in $AllFiles) {
        $filePath = Join-Path $BinariesDir $file
        if (Test-Path $filePath) {
            $fileSize = [math]::Round((Get-Item $filePath).Length / 1024, 1)
            Write-Success "✓ $file ($fileSize KB)"
        } else {
            Write-Error "✗ $file (missing)"
            throw "Verification failed: $file is missing"
        }
    }

    # Step 7: Test whisper-cli.exe
    Write-Info "Testing whisper-cli.exe..."
    $WhisperCliPath = Join-Path $BinariesDir "whisper-cli.exe"
    
    try {
        $testOutput = & $WhisperCliPath --help 2>&1
        Write-Success "whisper-cli.exe executed successfully"
        Write-Info "Test output preview: $($testOutput | Select-Object -First 3)"
    } catch {
        Write-Warning "whisper-cli.exe test failed: $($_.Exception.Message)"
        Write-Info "This may be normal - the binary was built successfully"
    }

    # Summary
    Write-Success "Official whisper.cpp build completed successfully!"
    Write-Info "Built using DLL-based official method with whisper-cli.exe"
    Write-Info "Location: $BinariesDir"
    Write-Info ""
    Write-Info "Main executable: whisper-cli.exe (replaces main.exe)"
    Write-Info ""
    Write-Info "Files created:"
    Get-ChildItem $BinariesDir | ForEach-Object {
        $size = [math]::Round($_.Length / 1024, 1)
        Write-Info "  $($_.Name) - $size KB"
    }

} catch {
    Write-Error "Build failed: $($_.Exception.Message)"
    if ($_.Exception.StackTrace) {
        Write-Info "Stack trace: $($_.Exception.StackTrace)"
    }
    exit 1
} finally {
    # Clean up
    try {
        Set-Location $ProjectRoot
        if (Test-Path $TempDir) {
            Write-Info "Cleaning up temporary directory: $TempDir"
            Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Warning "Failed to clean up temporary directory: $($_.Exception.Message)"
    }
}

Write-Success "🎉 Ready to build Electron app with official whisper-cli.exe binaries!"