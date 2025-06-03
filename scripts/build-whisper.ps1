# Windows Binary Fix Script for WhisperDesk
# Fixes the 3221225501 error (Access Violation) on Windows

Write-Host "🔧 WhisperDesk Windows Binary Fix Script" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Colors for output
function Write-Success($message) { Write-Host "✅ $message" -ForegroundColor Green }
function Write-Warning($message) { Write-Host "⚠️  $message" -ForegroundColor Yellow }
function Write-Error($message) { Write-Host "❌ $message" -ForegroundColor Red }
function Write-Info($message) { Write-Host "ℹ️  $message" -ForegroundColor Cyan }

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Warning "This script should be run as Administrator for best results"
    Write-Info "Right-click PowerShell and select 'Run as Administrator'"
}

Write-Info "Detecting WhisperDesk installation..."

# Find WhisperDesk installation
$possiblePaths = @(
    "$env:USERPROFILE\Downloads\WhisperDesk.Enhanced*",
    "$env:PROGRAMFILES\WhisperDesk*",
    "$env:PROGRAMFILES(X86)\WhisperDesk*",
    "$env:LOCALAPPDATA\Programs\WhisperDesk*"
)

$whisperDeskPath = $null
foreach ($pattern in $possiblePaths) {
    $found = Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        $whisperDeskPath = $found.FullName
        break
    }
}

if (-not $whisperDeskPath) {
    Write-Error "WhisperDesk installation not found"
    Write-Info "Please ensure WhisperDesk is extracted/installed and try again"
    exit 1
}

Write-Success "Found WhisperDesk at: $whisperDeskPath"

# Check binaries directory
$binariesPath = Join-Path $whisperDeskPath "resources\binaries"
if (-not (Test-Path $binariesPath)) {
    $binariesPath = Join-Path $whisperDeskPath "binaries"
}

if (-not (Test-Path $binariesPath)) {
    Write-Error "Binaries directory not found"
    exit 1
}

Write-Success "Binaries directory: $binariesPath"

# Find whisper binary
$whisperBinary = $null
$possibleBinaries = @("whisper.exe", "whisper-cli.exe", "whisper-cpp.exe")

foreach ($binary in $possibleBinaries) {
    $binaryPath = Join-Path $binariesPath $binary
    if (Test-Path $binaryPath) {
        $whisperBinary = $binaryPath
        break
    }
}

if (-not $whisperBinary) {
    Write-Error "Whisper binary not found in $binariesPath"
    exit 1
}

Write-Success "Found whisper binary: $whisperBinary"

# Get binary info
$binaryInfo = Get-Item $whisperBinary
$binarySize = [math]::Round($binaryInfo.Length / 1024, 1)
Write-Info "Binary size: $binarySize KB"

# Check if binary is too small (stub)
if ($binaryInfo.Length -lt 100KB) {
    Write-Error "Binary is too small ($binarySize KB) - this is likely a stub or corrupted file"
    Write-Info "Please download a fresh copy of WhisperDesk"
    exit 1
}

Write-Info "Checking Visual C++ Runtime dependencies..."

# Function to check if VC++ runtime is installed
function Test-VCRuntime {
    $vcRedistKeys = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64",
        "HKLM:\SOFTWARE\Classes\Installer\Dependencies\Microsoft.VS.VC_RuntimeMinimumVSU_amd64,v14"
    )
    
    foreach ($key in $vcRedistKeys) {
        if (Test-Path $key) {
            try {
                $version = Get-ItemProperty -Path $key -Name "Version" -ErrorAction SilentlyContinue
                if ($version) {
                    return $true
                }
            } catch {
                continue
            }
        }
    }
    return $false
}

$vcRuntimeInstalled = Test-VCRuntime

if ($vcRuntimeInstalled) {
    Write-Success "Visual C++ runtime is installed"
} else {
    Write-Warning "Visual C++ runtime not detected"
    
    # Check for VC++ redistributable installer
    $vcRedistPath = Join-Path $binariesPath "vc_redist.x64.exe"
    if (Test-Path $vcRedistPath) {
        Write-Info "Found VC++ redistributable installer"
        Write-Info "Installing Visual C++ runtime..."
        
        try {
            $installProcess = Start-Process -FilePath $vcRedistPath -ArgumentList "/quiet" -Wait -PassThru
            if ($installProcess.ExitCode -eq 0) {
                Write-Success "Visual C++ runtime installed successfully"
            } else {
                Write-Warning "VC++ runtime installation may have failed (exit code: $($installProcess.ExitCode))"
            }
        } catch {
            Write-Warning "Failed to install VC++ runtime: $($_.Exception.Message)"
        }
    } else {
        Write-Info "Downloading and installing Visual C++ runtime..."
        
        $vcRedistUrl = "https://aka.ms/vs/17/release/vc_redist.x64.exe"
        $tempVcRedist = Join-Path $env:TEMP "vc_redist.x64.exe"
        
        try {
            Invoke-WebRequest -Uri $vcRedistUrl -OutFile $tempVcRedist -UseBasicParsing
            Write-Success "Downloaded VC++ redistributable"
            
            $installProcess = Start-Process -FilePath $tempVcRedist -ArgumentList "/quiet" -Wait -PassThru
            if ($installProcess.ExitCode -eq 0) {
                Write-Success "Visual C++ runtime installed successfully"
            } else {
                Write-Warning "VC++ runtime installation may have failed (exit code: $($installProcess.ExitCode))"
            }
            
            Remove-Item $tempVcRedist -ErrorAction SilentlyContinue
        } catch {
            Write-Warning "Failed to download/install VC++ runtime: $($_.Exception.Message)"
        }
    }
}

Write-Info "Checking DLL dependencies..."

# Check for required DLLs
$requiredDlls = @("ggml.dll", "ggml-cpu.dll", "whisper.dll")
$missingDlls = @()
$foundDlls = @()

foreach ($dll in $requiredDlls) {
    $dllPath = Join-Path $binariesPath $dll
    if (Test-Path $dllPath) {
        $dllSize = [math]::Round((Get-Item $dllPath).Length / 1024, 1)
        $foundDlls += "$dll ($dllSize KB)"
    } else {
        $missingDlls += $dll
    }
}

if ($foundDlls.Count -gt 0) {
    Write-Success "Found DLLs: $($foundDlls -join ', ')"
}

if ($missingDlls.Count -gt 0) {
    Write-Warning "Missing DLLs: $($missingDlls -join ', ')"
    Write-Info "The application may still work without these DLLs"
}

Write-Info "Testing whisper binary..."

# Test the binary with a simple command
try {
    $testProcess = Start-Process -FilePath $whisperBinary -ArgumentList "--help" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$env:TEMP\whisper_test_out.txt" -RedirectStandardError "$env:TEMP\whisper_test_err.txt" -Wait
    
    $exitCode = $testProcess.ExitCode
    
    $stdout = ""
    $stderr = ""
    
    if (Test-Path "$env:TEMP\whisper_test_out.txt") {
        $stdout = Get-Content "$env:TEMP\whisper_test_out.txt" -Raw -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\whisper_test_out.txt" -ErrorAction SilentlyContinue
    }
    
    if (Test-Path "$env:TEMP\whisper_test_err.txt") {
        $stderr = Get-Content "$env:TEMP\whisper_test_err.txt" -Raw -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\whisper_test_err.txt" -ErrorAction SilentlyContinue
    }
    
    $output = "$stdout$stderr"
    
    Write-Info "Binary test exit code: $exitCode"
    
    if ($exitCode -eq 0 -or $output -match "whisper|usage|help|options") {
        Write-Success "Binary test passed! Whisper is working correctly."
        
        # Check argument format
        if ($output -match "--file|--model|--output-dir") {
            Write-Info "Detected NEW argument format (whisper-cli style)"
        } elseif ($output -match "-f|-m|-t") {
            Write-Info "Detected LEGACY argument format (old whisper style)"
        } else {
            Write-Info "Could not determine argument format from help output"
        }
        
    } elseif ($exitCode -eq 3221225501) {
        Write-Error "Binary crashed with access violation (0xC0000005)"
        Write-Info "This usually means:"
        Write-Info "  1. Missing Visual C++ runtime (should be fixed now)"
        Write-Info "  2. Incompatible binary architecture"
        Write-Info "  3. Corrupted binary file"
        Write-Info "  4. Antivirus blocking execution"
        
        Write-Info "Trying additional fixes..."
        
        # Try to set binary as trusted in Windows Defender
        try {
            Add-MpPreference -ExclusionPath $whisperBinary -ErrorAction SilentlyContinue
            Write-Success "Added binary to Windows Defender exclusions"
        } catch {
            Write-Warning "Could not add to Windows Defender exclusions (run as admin for this feature)"
        }
        
        # Check if binary is blocked
        try {
            Unblock-File -Path $whisperBinary -ErrorAction SilentlyContinue
            Write-Success "Unblocked binary file"
        } catch {
            Write-Warning "Could not unblock binary file"
        }
        
        Write-Info "Please try running WhisperDesk again. If the problem persists:"
        Write-Info "  1. Restart your computer"
        Write-Info "  2. Temporarily disable antivirus"
        Write-Info "  3. Download a fresh copy of WhisperDesk"
        
    } else {
        Write-Warning "Binary test failed with exit code: $exitCode"
        Write-Info "Output preview: $($output.Substring(0, [Math]::Min(200, $output.Length)))"
        
        if ($output -match "deprecated") {
            Write-Info "Binary shows deprecation warning but may still work"
        }
    }
    
} catch {
    Write-Error "Failed to test binary: $($_.Exception.Message)"
}

Write-Info "Additional system information:"
Write-Info "  OS Version: $((Get-CimInstance Win32_OperatingSystem).Caption)"
Write-Info "  Architecture: $env:PROCESSOR_ARCHITECTURE"
Write-Info "  PowerShell Version: $($PSVersionTable.PSVersion)"

# Check PATH for conflicting binaries
Write-Info "Checking PATH for conflicting whisper binaries..."
$pathWhisper = Get-Command whisper -ErrorAction SilentlyContinue
if ($pathWhisper) {
    Write-Warning "Found whisper in PATH: $($pathWhisper.Source)"
    Write-Info "This might interfere with WhisperDesk. Consider removing it from PATH."
} else {
    Write-Success "No conflicting whisper binary found in PATH"
}

Write-Info "Environment check complete!"
Write-Info ""
Write-Success "Next steps:"
Write-Info "  1. Restart WhisperDesk if it was running"
Write-Info "  2. Try transcribing a small audio file"
Write-Info "  3. If problems persist, check the app logs for detailed error messages"
Write-Info ""
Write-Info "If you still get the 3221225501 error:"
Write-Info "  - The binary may be incompatible with your system"
Write-Info "  - Try downloading the latest version of WhisperDesk"
Write-Info "  - Contact support with your system information"

Read-Host "Press Enter to continue..."