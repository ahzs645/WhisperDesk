@echo off
setlocal enabledelayedexpansion

REM WhisperDesk Enhanced - Windows Build Script
REM This script builds the application for Windows

echo 🚀 Starting WhisperDesk Enhanced build process...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18 or later.
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm.
    exit /b 1
)

REM Get Node.js version
for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js version: %NODE_VERSION% ✓

REM Install dependencies
echo [INFO] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    exit /b 1
)

REM Build renderer process
echo [INFO] Building renderer process...
cd src\renderer\whisperdesk-ui

REM Check if pnpm is installed
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] pnpm not found, installing...
    call npm install -g pnpm
)

call pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install renderer dependencies
    exit /b 1
)

call pnpm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build renderer
    exit /b 1
)

cd ..\..\..
echo [SUCCESS] Renderer build complete

REM Create dist directory
if not exist dist mkdir dist

REM Build for platform
set PLATFORM=%1
if "%PLATFORM%"=="" set PLATFORM=win

if "%PLATFORM%"=="win" (
    echo [INFO] Building for Windows...
    call npm run dist:win
    if %errorlevel% neq 0 (
        echo [ERROR] Windows build failed
        exit /b 1
    )
    echo [SUCCESS] Windows build complete
) else if "%PLATFORM%"=="all" (
    echo [INFO] Building for all platforms...
    call npm run dist:all
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed
        exit /b 1
    )
    echo [SUCCESS] All platform builds complete
) else (
    echo [ERROR] Unknown platform: %PLATFORM%
    echo Usage: %0 [win^|all]
    exit /b 1
)

REM Display build results
echo [INFO] Build artifacts:
dir dist\

echo [SUCCESS] 🎉 Build process completed successfully!
echo [INFO] 📦 Installers are available in the 'dist' directory
echo.
echo 🚀 WhisperDesk Enhanced is ready for distribution!
echo    Windows: dist\*.exe

pause

