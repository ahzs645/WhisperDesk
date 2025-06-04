# scripts/compile-whisper-windows.ps1 - Compiles whisper.cpp on Windows (Simplified Output)

param (
    [string]$Architecture = "x64",
    [string]$BuildType = "Release",
    [string]$Branch = "master"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
$BinariesDir = Join-Path $ProjectRoot "binaries"
$TempDir = Join-Path $ProjectRoot "temp_whisper_build_win"

if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
}

if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

try {
    git clone https://github.com/ggerganov/whisper.cpp.git --branch $Branch --depth 1 $TempDir -q --progress
}
catch {
    Write-Error "❌ Failed to clone whisper.cpp: $($_.Exception.Message)"
    exit 1
}

Set-Location $TempDir

$cmakeArgs = @(
    "-S", ".",
    "-B", "build",
    "-A", $Architecture,
    "-DCMAKE_BUILD_TYPE=$BuildType",
    "-DBUILD_SHARED_LIBS=ON",
    "-DWHISPER_BUILD_TESTS=OFF",
    "-DWHISPER_BUILD_EXAMPLES=ON"
)
try {
    cmake $cmakeArgs
}
catch {
    Write-Error "❌ CMake configuration failed: $($_.Exception.Message)"
    if (Test-Path "build/CMakeFiles/CMakeOutput.log") { Write-Error (Get-Content "build/CMakeFiles/CMakeOutput.log" -Raw) }
    if (Test-Path "build/CMakeFiles/CMakeError.log") { Write-Error (Get-Content "build/CMakeFiles/CMakeError.log" -Raw) }
    exit 1
}

$buildArgs = @(
    "--build", "build",
    "--config", $BuildType,
    "--parallel", "4"
)
try {
    cmake $buildArgs
}
catch {
    Write-Error "❌ Build failed: $($_.Exception.Message)"
    exit 1
}

$sourceBuildDir = Join-Path $TempDir "build/bin/$BuildType"
if (-not (Test-Path $sourceBuildDir)) {
    Write-Error "❌ Source build directory not found: $sourceBuildDir"
    exit 1
}

$whisperCliExe = $null
if (Test-Path (Join-Path $sourceBuildDir "whisper-cli.exe")) {
    $whisperCliExe = Join-Path $sourceBuildDir "whisper-cli.exe"
}
elseif (Test-Path (Join-Path $sourceBuildDir "main.exe")) {
    $whisperCliExe = Join-Path $sourceBuildDir "main.exe"
}

if ($null -eq $whisperCliExe) {
    Write-Error "❌ whisper-cli.exe or main.exe not found in $sourceBuildDir. Available files: $( (Get-ChildItem $sourceBuildDir | Select-Object -ExpandProperty Name) -join ', ' )"
    exit 1
}

try {
    Copy-Item -Path $whisperCliExe -Destination (Join-Path $BinariesDir "whisper-cli.exe") -Force
}
catch {
    Write-Error "❌ Failed to copy whisper-cli.exe: $($_.Exception.Message)"
    exit 1
}

$dlls = Get-ChildItem -Path $sourceBuildDir -Filter "*.dll"
if ($dlls.Count -gt 0) {
    foreach ($dll in $dlls) {
        try {
            Copy-Item -Path $dll.FullName -Destination $BinariesDir -Force
        }
        catch {
            # Optional: Could add a Write-Warning here if a non-critical DLL fails
        }
    }
}

Set-Location $ProjectRoot
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}

# Implicit success if script reaches here without exiting
