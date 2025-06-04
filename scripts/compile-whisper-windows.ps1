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
} # Ensure this closing brace is present and correct

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
    $vsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsInstallations = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($vsInstallations) {
            Write-Success "Visual Studio Build Tools found: $vsInstallations"
        } else {
            throw "No suitable Visual Studio installation found"
        }
    } else {
        throw "Visual Studio Installer (vswhere.exe) not found at $vsWhere"
    }
} catch {
    Write-Error "Visual Studio Build Tools with C++ support are required."
    Write-Info "Details: $($_.Exception.Message)"
    Write-Info "Please install Visual Studio 2019 or later with C++ development tools."
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

if ($BuildType -eq "Release") {
    $cmakeArgs += @(
        "-DCMAKE_CXX_FLAGS_RELEASE=/MT /O2 /Ob2 /DNDEBUG /GL",
        "-DCMAKE_EXE_LINKER_FLAGS_RELEASE=/LTCG /OPT:REF /OPT:ICF"
    )
}

try {
    Write-Info "Running CMake with arguments: $($cmakeArgs -join ' ')"
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
$whisperCliExe = $null
$buildBinDir = Join-Path $TempDir "build\bin" # Corrected path variable name
$buildBinTypeDir = Join-Path $buildBinDir $BuildType

# Check common locations for the executable
$possibleLocations = @(
    Join-Path $buildBinTypeDir "whisper-cli.exe" # build/bin/Release/whisper-cli.exe
    Join-Path $buildBinDir "whisper-cli.exe"     # build/bin/whisper-cli.exe
)

foreach ($loc in $possibleLocations) {
    if (Test-Path $loc -PathType Leaf) {
        $whisperCliExe = $loc
        Write-Success "Found whisper-cli binary: $whisperCliExe"
        break
    }
}

if (-not $whisperCliExe) {
    Write-Error "whisper-cli.exe not found in expected locations."
    Write-Info "Searched in: $($possibleLocations -join ', ')"
    if (Test-Path (Join-Path $TempDir "build")) {
        Write-Info "Available files in build directory structure:"
        Get-ChildItem -Recurse (Join-Path $TempDir "build") -Filter "*.exe" | ForEach-Object { Write-Host $_.FullName }
    }
    exit 1
}

# Validate static linking
Write-Info "Validating static linking configuration..."
try {
    if (Get-Command dumpbin -ErrorAction SilentlyContinue) {
        $dependencies = & dumpbin /dependents $whisperCliExe 2>$null
        $hasDynamicRuntime = $dependencies | Select-String -Pattern "MSVCR|VCRUNTIME|MSVCP" -Quiet

        if ($hasDynamicRuntime) {
            Write-Warning "Binary may still have dynamic runtime dependencies."
            Write-Info "Dependencies found:"
            $dependencies | Select-String -Pattern "\.dll" | ForEach-Object { Write-Host ("  " + $_.Line.Trim()) }
        } else {
            Write-Success "Binary appears to be statically linked."
        }
    } else {
        Write-Warning "Could not validate dependencies (dumpbin.exe not found in PATH)."
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
        Write-Success "Binary test passed - whisper-cli executed successfully."
    } elseif ($testExitCode -eq 3221225501) { # 0xC0000005 Access Violation
        Write-Error "Access violation error (0xC0000005) detected during test execution. Static linking may have failed or other runtime issues exist."
        exit 1
    } else {
        Write-Warning "Binary test with --help returned exit code $testExitCode."
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

    $binarySize = (Get-Item $destinationPath).Length
    $binarySizeMB = [math]::Round($binarySize / 1MB, 2)
    Write-Info "Binary size: $binarySizeMB MB"

} catch {
    Write-Error "Failed to copy binary: $($_.Exception.Message)"
    exit 1
}

# Copy additional DLLs (though BUILD_SHARED_LIBS=OFF should make these less likely for whisper.cpp itself)
$additionalFiles = @("ggml.dll", "whisper.dll")
$cliDirectory = Split-Path $whisperCliExe
foreach ($file in $additionalFiles) {
    $sourceFile = Join-Path $cliDirectory $file
    if (Test-Path $sourceFile) {
        $destFile = Join-Path $BinariesDir $file
        Copy-Item $sourceFile $destFile -Force
        Write-Info "Copied additional file: $file"
    }
}

# Cleanup
Set-Location $ProjectRoot # Return to original directory
if (Test-Path $TempDir) {
    Write-Info "Cleaning up temporary build directory: $TempDir"
    Remove-Item -Recurse -Force $TempDir
    Write-Success "Cleaned up temporary build directory."
}

Write-Success "Static whisper.cpp build completed successfully!"
Write-Info "Binary location: $destinationPath"
Write-Info "The binary should now run without requiring Visual C++ runtime installation." # Final line, ensure quote is here.
```
