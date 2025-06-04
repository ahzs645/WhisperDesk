# scripts/compile-whisper-windows.ps1 - Compiles whisper.cpp on Windows

param (
    [string]$Architecture = "x64",
    [string]$BuildType = "Release",
    [string]$Branch = "master" # Or a specific tag/commit
)

Write-Host "🚀 Starting whisper.cpp compilation for Windows"
Write-Host "Architecture: $Architecture"
Write-Host "Build Type: $BuildType"
Write-Host "Branch/Tag: $Branch"
Write-Host "=================================================="

# Script's directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$BinariesDir = Join-Path $ProjectRoot "binaries"
$TempDir = Join-Path $ProjectRoot "temp_whisper_build_win" # Temporary build directory

# Ensure Binaries directory exists
if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
    Write-Host "✅ Created binaries directory: $BinariesDir"
}

# Clean up previous temporary build directory if it exists
if (Test-Path $TempDir) {
    Write-Host "🧹 Cleaning up existing temporary build directory: $TempDir"
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
Write-Host "✅ Created temporary build directory: $TempDir"

# --- Git Clone ---
Write-Host "🔄 Cloning whisper.cpp repository..."
try {
    git clone https://github.com/ggerganov/whisper.cpp.git --branch $Branch --depth 1 $TempDir -q
    Write-Host "✅ Cloned whisper.cpp repository (branch: $Branch) into $TempDir"
}
catch {
    Write-Error "❌ Failed to clone whisper.cpp: $($_.Exception.Message)"
    exit 1
}

Set-Location $TempDir

# --- CMake Configuration ---
Write-Host "🛠️ Configuring CMake..."
$cmakeArgs = @(
    "-S", ".",
    "-B", "build",
    "-A", $Architecture,
    "-DCMAKE_BUILD_TYPE=$BuildType",
    "-DBUILD_SHARED_LIBS=ON", # Keep ON as per original workflow for DLLs
    "-DWHISPER_BUILD_TESTS=OFF",
    "-DWHISPER_BUILD_EXAMPLES=ON" # To get whisper-cli
)

Write-Host "CMake arguments: $cmakeArgs"
try {
    cmake $cmakeArgs
    Write-Host "✅ CMake configuration complete."
}
catch {
    Write-Error "❌ CMake configuration failed: $($_.Exception.Message)"
    Get-Content "build/CMakeFiles/CMakeOutput.log" -ErrorAction SilentlyContinue
    Get-Content "build/CMakeFiles/CMakeError.log" -ErrorAction SilentlyContinue
    exit 1
}

# --- CMake Build (MSBuild) ---
Write-Host "🏗️ Building with CMake (MSBuild)..."
$buildArgs = @(
    "--build", "build",
    "--config", $BuildType,
    "--parallel", "4" # Adjust parallelism as needed
)
Write-Host "Build arguments: $buildArgs"
try {
    cmake $buildArgs
    Write-Host "✅ Build complete."
}
catch {
    Write-Error "❌ Build failed: $($_.Exception.Message)"
    exit 1
}

# --- Copy Binaries ---
Write-Host "📦 Copying compiled binaries..."
$sourceBuildDir = Join-Path $TempDir "build/bin/$BuildType"

if (-not (Test-Path $sourceBuildDir)) {
    Write-Error "❌ Source build directory not found: $sourceBuildDir"
    exit 1
}

# Find whisper-cli.exe (or main.exe)
$whisperCliExe = $null
if (Test-Path (Join-Path $sourceBuildDir "whisper-cli.exe")) {
    $whisperCliExe = Join-Path $sourceBuildDir "whisper-cli.exe"
}
elseif (Test-Path (Join-Path $sourceBuildDir "main.exe")) {
    $whisperCliExe = Join-Path $sourceBuildDir "main.exe"
    Write-Warning "Found main.exe instead of whisper-cli.exe"
}

if ($null -eq $whisperCliExe) {
    Write-Error "❌ whisper-cli.exe or main.exe not found in $sourceBuildDir"
    Get-ChildItem $sourceBuildDir
    exit 1
}

Write-Host "Found binary: $whisperCliExe"

# Copy whisper-cli.exe
try {
    Copy-Item -Path $whisperCliExe -Destination (Join-Path $BinariesDir "whisper-cli.exe") -Force
    Write-Host "✅ Copied whisper-cli.exe to $BinariesDir"
}
catch {
    Write-Error "❌ Failed to copy whisper-cli.exe: $($_.Exception.Message)"
    exit 1
}

# Copy DLLs
$dlls = Get-ChildItem -Path $sourceBuildDir -Filter "*.dll"
if ($dlls.Count -gt 0) {
    Write-Host "Copying DLLs:"
    foreach ($dll in $dlls) {
        try {
            Copy-Item -Path $dll.FullName -Destination $BinariesDir -Force
            Write-Host "  Copied $($dll.Name)"
        }
        catch {
            Write-Warning "  ❌ Failed to copy $($dll.Name): $($_.Exception.Message)"
        }
    }
    Write-Host "✅ DLLs copied to $BinariesDir"
}
else {
    Write-Warning "No DLLs found in $sourceBuildDir to copy. This might be okay if statically linked."
}

# --- Cleanup ---
Set-Location $ProjectRoot
Write-Host "🧹 Cleaning up temporary build directory: $TempDir"
Remove-Item -Recurse -Force $TempDir
Write-Host "✅ Cleanup complete."

Write-Host "🎉 Successfully compiled whisper.cpp for Windows!"
Write-Host "Binary and DLLs are in: $BinariesDir"
