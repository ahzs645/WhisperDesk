# Platform-Specific Setup Summary

## 🌍 Cross-Platform Compatibility

WhisperDesk Native works on all major platforms with some platform-specific considerations:

## 📋 Quick Reference

| Platform | Setup Script | Build Tools | Package Manager | Models Directory |
|----------|-------------|-------------|-----------------|------------------|
| **Linux** | `./setup.sh` | `build-essential`, `cmake` | `apt`, `yum`, etc. | `~/.config/whisperdesk-enhanced/models/` |
| **macOS** | `./setup.sh` | Xcode Command Line Tools | `brew` | `~/Library/Application Support/whisperdesk-enhanced/models/` |
| **Windows** | `.\setup.ps1` | Visual Studio Build Tools | `choco`, `winget` | `%APPDATA%\whisperdesk-enhanced\models\` |

## 🔧 Key Differences

### Build Dependencies

**Linux:**
```bash
sudo apt-get install build-essential cmake
# or
sudo yum install gcc-c++ cmake
```

**macOS:**
```bash
xcode-select --install
brew install cmake
```

**Windows:**
```powershell
# Install Visual Studio Build Tools
choco install visualstudio2022buildtools
# or download from Microsoft
```

### Binary Names

- **Linux/macOS**: `whisper` (no extension)
- **Windows**: `whisper.exe`

### File Paths

**Linux:**
- Config: `~/.config/whisperdesk-enhanced/`
- Models: `~/.config/whisperdesk-enhanced/models/`

**macOS:**
- Config: `~/Library/Application Support/whisperdesk-enhanced/`
- Models: `~/Library/Application Support/whisperdesk-enhanced/models/`

**Windows:**
- Config: `%APPDATA%\whisperdesk-enhanced\`
- Models: `%APPDATA%\whisperdesk-enhanced\models\`

### Package Managers

**Linux:**
- Ubuntu/Debian: `apt-get`
- CentOS/RHEL: `yum` or `dnf`
- Arch: `pacman`

**macOS:**
- Homebrew: `brew` (recommended)
- MacPorts: `port`

**Windows:**
- Chocolatey: `choco` (recommended)
- Winget: `winget`
- Scoop: `scoop`

## 🚀 Running Commands

All platforms support the same npm scripts:

```bash
npm run dev              # Electron app
npm run web              # Web interface
npm run server           # API server only
npm run test:native      # Test native services
```

## 🐛 Common Platform Issues

### Linux
- Missing build tools: Install `build-essential`
- Permission issues: Use `sudo` for system packages
- Audio issues: Install `libasound2-dev`

### macOS
- Xcode not installed: Run `xcode-select --install`
- Homebrew issues: Check PATH in `~/.zshrc`
- Apple Silicon: May need Rosetta for some packages

### Windows
- Build tools missing: Install Visual Studio Build Tools
- PowerShell execution policy: Run `Set-ExecutionPolicy RemoteSigned`
- Long path issues: Enable long paths in Windows
- Antivirus blocking: Add exclusions for project directory

## 📖 Detailed Guides

For complete setup instructions, see:
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Linux (main guide)
- [SETUP_MACOS.md](SETUP_MACOS.md) - macOS specific
- [SETUP_WINDOWS.md](SETUP_WINDOWS.md) - Windows specific

