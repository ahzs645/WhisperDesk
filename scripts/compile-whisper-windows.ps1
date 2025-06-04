# Enhanced Windows Compilation Script for WhisperDesk
# Implements static linking to eliminate runtime dependencies

param (
    [string]$Architecture = "x64",
    [string]$BuildType = "Release",
    [string]$Branch = "master"
)

# Enhanced error handling and logging
$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "⚠️ $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "ℹ️ $message" -ForegroundColor Cyan
}

# Validate prerequisites
Write-Info "Validating build prerequisites..."

# Check for CMake
try {
    $cmakeVersion = & cmake --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "CMake not found"
    }
    Write-Success "CMake found: $($cmakeVersion[0])"
} catch {
    Write-Error "CMake is required but not found in PATH"
    Write-Info "Please install CMake from https://cmake.org/download/"
    exit 1
}

# Check for Visual Studio Build Tools
try {
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsInstallations = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($vsInstallations) {
            Write-Success "Visual Studio Build Tools found: $vsInstallations"
        } else {
            throw "No suitable Visual Studio installation found"
        }
    } else {
        throw "Visual Studio Installer not found"
    }
} catch {
    Write-Error "Visual Studio Build Tools with C++ support are required"
    Write-Info "Please install Visual Studio 2019 or later with C++ development tools"
    exit 1
}

# Set up directory structure
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$BinariesDir = Join-Path $ProjectRoot "binaries"
$TempDir = Join-Path $env:TEMP "whisper-build-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Info "Project root: $ProjectRoot"
Write-Info "Binaries directory: $BinariesDir"
Write-Info "Temporary build directory: $TempDir"

# Create directories if they don't exist
if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
    Write-Success "Created binaries directory"
}

if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

Set-Location $TempDir

# Clone whisper.cpp repository
Write-Info "Cloning whisper.cpp repository..."
try {
    & git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git --branch $Branch $TempDir --progress
    if ($LASTEXITCODE -ne 0) {
        throw "Git clone failed with exit code $LASTEXITCODE"
    }
    Write-Success "Repository cloned successfully"
} catch {
    Write-Error "Failed to clone whisper.cpp repository: $($_.Exception.Message)"
    Write-Info "Please ensure git is installed and you have internet connectivity"
    exit 1
}

# Configure CMake with static linking
Write-Info "Configuring CMake build with static linking..."

# Determine MSVC Runtime Library string
$msvcRuntimeLib = "MultiThreaded"
if ($BuildType -eq 'Debug') {
    $msvcRuntimeLib += "Debug"
}

$cmakeArgs = @(
    "-S", ".",
    "-B", "build",
    "-A", $Architecture,
    "-DCMAKE_BUILD_TYPE=$BuildType",
    "-DBUILD_SHARED_LIBS=OFF",
    "-DCMAKE_MSVC_RUNTIME_LIBRARY=$msvcRuntimeLib",
    "-DWHISPER_BUILD_TESTS=OFF",
    "-DWHISPER_BUILD_EXAMPLES=ON",
    "-DWHISPER_BUILD_SERVER=OFF",
    "-DCMAKE_POSITION_INDEPENDENT_CODE=OFF"
)

# Add optimization flags for release builds
if ($BuildType -eq "Release") {
    $cmakeArgs += @(
        "-DCMAKE_CXX_FLAGS_RELEASE=/MT /O2 /Ob2 /DNDEBUG /GL",
        "-DCMAKE_EXE_LINKER_FLAGS_RELEASE=/LTCG /OPT:REF /OPT:ICF"
    )
}

try {
    & cmake @cmakeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "CMake configuration failed with exit code $LASTEXITCODE"
    }
    Write-Success "CMake configuration completed successfully"
} catch {
    Write-Error "CMake configuration failed: $($_.Exception.Message)"
    if (Test-Path "build/CMakeFiles/CMakeError.log") {
        Write-Info "CMake error log:"
        Get-Content "build/CMakeFiles/CMakeError.log" | Write-Host
    }
    exit 1
}

# Build the project
Write-Info "Building whisper.cpp with static linking..."
try {
    & cmake --build build --config $BuildType --parallel
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Success "Build completed successfully"
} catch {
    Write-Error "Build failed: $($_.Exception.Message)"
    exit 1
}

# Locate and validate the whisper-cli binary
$sourceBuildDir = Join-Path $TempDir "build\bin\$BuildType" # Corrected path
$whisperCliExe = Join-Path $sourceBuildDir "whisper-cli.exe"

if (-not (Test-Path $whisperCliExe)) {
    # Try alternative location (e.g. if build type is not in path)
    $altSourceBuildDir = Join-Path $TempDir "build\bin"
    $whisperCliExe = Join-Path $altSourceBuildDir "whisper-cli.exe"
}

if (-not (Test-Path $whisperCliExe)) {
    Write-Error "whisper-cli.exe not found in expected locations: `"$sourceBuildDir`" or `"$altSourceBuildDir`""
    Write-Info "Available files in build directory:"
    Get-ChildItem -Recurse "$TempDir\build" -Filter "*.exe" | ForEach-Object { Write-Host $_.FullName }
    exit 1
}

Write-Success "Found whisper-cli binary: $whisperCliExe"

# Validate static linking
Write-Info "Validating static linking configuration..."
try {
    # Check if dumpbin is available
    if (Get-Command dumpbin -ErrorAction SilentlyContinue) {
        $dependencies = & dumpbin /dependents $whisperCliExe 2>$null
        $hasDynamicRuntime = $dependencies | Select-String -Pattern "MSVCR|VCRUNTIME|MSVCP" -Quiet

        if ($hasDynamicRuntime) {
            Write-Warning "Binary may still have dynamic runtime dependencies"
            Write-Info "Dependencies found:"
            $dependencies | Select-String -Pattern "\.dll" | ForEach-Object { Write-Host "  $($_.Line.Trim())" }
        } else {
            Write-Success "Binary appears to be statically linked"
        }
    } else {
        Write-Warning "Could not validate dependencies (dumpbin not available)"
    }
} catch {
    Write-Warning "Could not validate dependencies: $($_.Exception.Message)"
}

# Test binary execution
Write-Info "Testing binary execution..."
try {
    $testOutput = & $whisperCliExe --help 2>&1
    $testExitCode = $LASTEXITCODE

    if ($testExitCode -eq 0) {
        Write-Success "Binary test passed - whisper-cli executed successfully"
    } elseif ($testExitCode -eq 3221225501) { # 0xC0000005 Access Violation
        Write-Error "Access violation error detected during test execution - static linking may have failed or other runtime issues exist."
        exit 1
    } else {
        Write-Warning "Binary test returned exit code $testExitCode"
        Write-Info "This may be normal for --help command, or indicate an issue."
        Write-Info "Output: $testOutput"
    }
} catch {
    Write-Error "Failed to test binary execution: $($_.Exception.Message)"
    exit 1
}

# Copy binary to binaries directory
$destinationPath = Join-Path $BinariesDir "whisper-cli.exe"
try {
    Copy-Item $whisperCliExe $destinationPath -Force
    Write-Success "Binary copied to: $destinationPath"

    # Verify copied binary
    $binarySize = (Get-Item $destinationPath).Length
    $binarySizeMB = [math]::Round($binarySize / 1MB, 2)
    Write-Info "Binary size: $binarySizeMB MB"

} catch {
    Write-Error "Failed to copy binary: $($_.Exception.Message)"
    exit 1
}

# Copy additional DLLs if they exist and are needed (though with static linking, this should be less common)
$additionalFiles = @("ggml.dll", "whisper.dll")
foreach ($file in $additionalFiles) {
    # Determine the actual directory of whisperCliExe for sourcing additional files
    $actualSourceDir = Split-Path $whisperCliExe
    $sourceFile = Join-Path $actualSourceDir $file
    if (Test-Path $sourceFile) {
        $destFile = Join-Path $BinariesDir $file
        Copy-Item $sourceFile $destFile -Force
        Write-Info "Copied additional file: $file"
    }
}

# Cleanup
Set-Location $ProjectRoot
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
    Write-Success "Cleaned up temporary build directory"
}

Write-Success "Static whisper.cpp build completed successfully!"
Write-Info "Binary location: $destinationPath"
Write-Info "The binary should now run without requiring Visual C++ runtime installation."
```
