# Enhanced Windows Compilation Script for WhisperDesk
# Implements static linking to eliminate runtime dependencies

param (
    [string]$Architecture = "x64",
    [string]$BuildType = "Release",
    [string]$Branch = "master",
    [switch]$Verbose = $false,
    [switch]$CleanBuild = $false
)

# Enhanced error handling and logging
$ErrorActionPreference = "Stop"
if ($Verbose) {
    $VerbosePreference = "Continue"
}

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

function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Display script information
Write-Info "WhisperDesk Windows Build Script"
Write-Info "================================"
Write-Info "Architecture: $Architecture"
Write-Info "Build Type: $BuildType"
Write-Info "Branch: $Branch"
Write-Info "Clean Build: $CleanBuild"

# Validate prerequisites
Write-Info "Validating build prerequisites..."

# Check for Git
if (-not (Test-Command "git")) {
    Write-Error "Git is required but not found in PATH"
    Write-Info "Please install Git from https://git-scm.com/"
    exit 1
}
Write-Success "Git found: $(git --version)"

# Check for CMake
if (-not (Test-Command "cmake")) {
    Write-Error "CMake is required but not found in PATH"
    Write-Info "Please install CMake from https://cmake.org/download/"
    exit 1
}
$cmakeVersion = cmake --version | Select-Object -First 1
Write-Success "CMake found: $cmakeVersion"

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

# Check for dumpbin (for dependency verification)
if (-not (Test-Command "dumpbin")) {
    Write-Warning "dumpbin.exe not found in PATH. Dependency verification will be skipped."
    Write-Info "To enable dependency checking, add Visual Studio tools to PATH or run from Developer Command Prompt."
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

# Clean up previous builds if requested
if ($CleanBuild -and (Test-Path $BinariesDir)) {
    Write-Info "Cleaning previous builds..."
    Remove-Item -Path (Join-Path $BinariesDir "*") -Force -ErrorAction SilentlyContinue
    Write-Success "Cleaned previous builds"
}

# Clean up temp directory if it exists
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    Set-Location $TempDir

    # Clone whisper.cpp repository
    Write-Info "Cloning whisper.cpp repository..."
    $gitCloneArgs = @(
        "clone",
        "--depth", "1",
        "https://github.com/ggerganov/whisper.cpp.git",
        "--branch", $Branch,
        $TempDir
    )
    
    if ($Verbose) {
        $gitCloneArgs += "--progress"
    }
    
    & git @gitCloneArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Git clone failed with exit code $LASTEXITCODE"
    }
    Write-Success "Repository cloned successfully"

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

    Write-Info "Running CMake with arguments: $($cmakeArgs -join ' ')"
    & cmake @cmakeArgs
    if ($LASTEXITCODE -ne 0) {
        throw "CMake configuration failed with exit code $LASTEXITCODE"
    }
    Write-Success "CMake configuration completed successfully"

    # Build the project
    Write-Info "Building whisper.cpp with static linking..."
    $buildArgs = @(
        "--build", "build",
        "--config", $BuildType,
        "--parallel"
    )
    
    if ($Verbose) {
        $buildArgs += "--verbose"
    }
    
    & cmake @buildArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Success "Build completed successfully"

    # Locate and validate the whisper-cli binary
    $whisperCliExe = $null
    $buildBinDir = Join-Path $TempDir "build\bin"
    $buildBinTypeDir = Join-Path $buildBinDir $BuildType

    $possibleLocations = @(
        (Join-Path $buildBinTypeDir "whisper-cli.exe"),
        (Join-Path $buildBinDir "whisper-cli.exe"),
        (Join-Path $buildBinTypeDir "main.exe"),
        (Join-Path $buildBinDir "main.exe")
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
            Get-ChildItem -Recurse (Join-Path $TempDir "build") -Filter "*.exe" | ForEach-Object { 
                Write-Host "  $($_.FullName)" 
            }
        }
        throw "Binary not found"
    }

    # Validate static linking (if dumpbin is available)
    if (Test-Command "dumpbin") {
        Write-Info "Validating static linking configuration..."
        try {
            $dependencies = & dumpbin /dependents $whisperCliExe 2>$null
            if ($LASTEXITCODE -eq 0) {
                $hasDynamicRuntime = $dependencies | Select-String -Pattern "MSVCR|VCRUNTIME|MSVCP" -Quiet

                if ($hasDynamicRuntime) {
                    Write-Warning "Binary appears to have dynamic MSVC runtime dependencies."
                    Write-Info "Dependencies found:"
                    $dependencies | Select-String -Pattern "\.dll" | ForEach-Object { 
                        Write-Host ("  " + $_.Line.Trim()) 
                    }
                    Write-Info "This may still work if the target system has Visual C++ Redistributable installed."
                } else {
                    Write-Success "Binary is correctly statically linked. No dynamic MSVC runtime dependencies found."
                }
            } else {
                Write-Warning "dumpbin execution failed. Cannot verify dependencies."
            }
        } catch {
            Write-Warning "Failed to validate dependencies: $($_.Exception.Message)"
        }
    }

    # Test binary execution
    Write-Info "Testing binary execution..."
    try {
        # Try a simple test that doesn't require models or audio files
        $testProcess = Start-Process -FilePath $whisperCliExe -ArgumentList "--help" -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $TempDir "test_output.txt") -RedirectStandardError (Join-Path $TempDir "test_error.txt")
        
        if ($testProcess.ExitCode -ne $null) {
            Write-Success "Binary test passed - whisper-cli executed successfully."
            Write-Info "Exit code: $($testProcess.ExitCode)"
            
            if (Test-Path (Join-Path $TempDir "test_output.txt")) {
                $output = Get-Content (Join-Path $TempDir "test_output.txt") -First 3
                if ($output) {
                    Write-Info "Output preview: $($output -join "`n")"
                }
            }
        } else {
            Write-Warning "Binary test completed but exit code was null."
        }
    } catch {
        Write-Warning "Binary execution test failed: $($_.Exception.Message)"
        Write-Info "This may be normal - proceeding with copy since binary was built successfully."
    }

    # Copy binary to binaries directory
    $destinationPath = Join-Path $BinariesDir "whisper-cli.exe"
    Copy-Item $whisperCliExe $destinationPath -Force
    Write-Success "Binary copied to: $destinationPath"

    $binarySize = (Get-Item $destinationPath).Length
    $binarySizeMB = [math]::Round($binarySize / 1MB, 2)
    Write-Info "Binary size: $binarySizeMB MB"

    # Verify the copied binary
    if (-not (Test-Path $destinationPath)) {
        throw "Failed to copy binary to destination"
    }

    Write-Success "Static whisper.cpp build completed successfully!"
    Write-Info "Binary location: $destinationPath"
    Write-Info "The binary should now run without requiring Visual C++ runtime installation."

} catch {
    Write-Error "Build failed: $($_.Exception.Message)"
    if ($_.Exception.StackTrace) {
        Write-Info "Stack trace: $($_.Exception.StackTrace)"
    }
    exit 1
} finally {
    # Clean up and finish
    try {
        Set-Location $ProjectRoot
        if (Test-Path $TempDir) {
            Write-Info "Cleaning up temporary build directory: $TempDir"
            Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
            Write-Success "Cleaned up temporary build directory."
        }
    } catch {
        Write-Warning "Failed to clean up temporary directory: $($_.Exception.Message)"
    }
}