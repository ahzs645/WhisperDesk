#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) { log(`ℹ️  ${message}`, 'blue'); }
function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }
function logError(message) { log(`❌ ${message}`, 'red'); }
function logBold(message) { log(message, 'bold'); }

const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

function checkCommand(command, name, required = true) {
    try {
        const output = execSync(`${command}`, { encoding: 'utf8', stdio: 'pipe' });
        const version = output.split('\n')[0].trim();
        logSuccess(`${name}: ${version}`);
        return true;
    } catch (error) {
        if (required) {
            logError(`${name}: Not found`);
        } else {
            logWarning(`${name}: Not found (optional)`);
        }
        return false;
    }
}

function checkSetup() {
    logBold('\n🔍 WhisperDesk Development Environment Check\n');
    
    let allRequired = true;
    let hasOptional = true;
    
    // Essential tools
    logInfo('Checking essential tools...');
    
    if (!checkCommand('node --version', 'Node.js')) allRequired = false;
    if (!checkCommand('npm --version', 'npm')) allRequired = false;
    if (!checkCommand('git --version', 'Git')) allRequired = false;
    if (!checkCommand('cmake --version', 'CMake')) allRequired = false;
    
    // Optional but recommended
    logInfo('\nChecking optional tools...');
    
    if (!checkCommand('pnpm --version', 'pnpm', false)) hasOptional = false;
    
    // Platform-specific tools
    logInfo('\nChecking platform-specific build tools...');
    
    if (isWindows) {
        // Check for Visual Studio Build Tools
        let hasMSBuild = false;
        try {
            execSync('where msbuild', { stdio: 'ignore' });
            logSuccess('MSBuild: Found in PATH');
            hasMSBuild = true;
        } catch (error) {
            // Try common installation paths
            const msbuildPaths = [
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\MSBuild\\Current\\Bin\\MSBuild.exe',
                'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional\\MSBuild\\Current\\Bin\\MSBuild.exe',
                'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Enterprise\\MSBuild\\Current\\Bin\\MSBuild.exe'
            ];
            
            for (const msbuildPath of msbuildPaths) {
                if (fs.existsSync(msbuildPath)) {
                    logSuccess(`MSBuild: Found at ${msbuildPath}`);
                    hasMSBuild = true;
                    break;
                }
            }
        }
        
        if (!hasMSBuild) {
            logError('MSBuild: Not found');
            allRequired = false;
        }
        
    } else if (isMacOS) {
        try {
            execSync('xcode-select -p', { stdio: 'ignore' });
            const xcodeVersion = execSync('xcode-select --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
            logSuccess(`Xcode Command Line Tools: ${xcodeVersion}`);
        } catch (error) {
            logError('Xcode Command Line Tools: Not found');
            allRequired = false;
        }
        
    } else if (isLinux) {
        if (!checkCommand('gcc --version', 'GCC')) allRequired = false;
        if (!checkCommand('make --version', 'Make')) allRequired = false;
    }
    
    // Check project structure
    logInfo('\nChecking project structure...');
    
    const requiredDirs = ['src', 'src/main'];
    const optionalDirs = ['src/renderer', 'resources', 'scripts'];
    
    requiredDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            logSuccess(`Directory: ${dir}/`);
        } else {
            logWarning(`Directory: ${dir}/ (missing)`);
        }
    });
    
    optionalDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            logSuccess(`Directory: ${dir}/`);
        } else {
            logInfo(`Directory: ${dir}/ (optional, not found)`);
        }
    });
    
    // Check if scripts directory exists for our build scripts
    const scriptsDir = path.join(process.cwd(), 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        logWarning('Scripts directory not found, creating...');
        try {
            fs.mkdirSync(scriptsDir, { recursive: true });
            logSuccess('Created scripts directory');
        } catch (error) {
            logError('Could not create scripts directory');
        }
    }
    
    // Show summary
    log('\n' + '='.repeat(60), 'cyan');
    logBold('📋 Setup Summary');
    log('='.repeat(60), 'cyan');
    
    if (allRequired) {
        logSuccess('✅ All required tools are available!');
    } else {
        logError('❌ Some required tools are missing');
    }
    
    if (!hasOptional) {
        logWarning('⚠️  Some optional tools are missing (recommended for better experience)');
    }
    
    // Show available npm scripts
    log('\n📜 Available npm scripts:', 'cyan');
    log('');
    log('🔧 Build Components:');
    log('  npm run build:deps        - Install all dependencies');
    log('  npm run build:whisper     - Build whisper.cpp for current platform');
    log('  npm run build:models:tiny - Download tiny model for testing');
    log('  npm run build:renderer    - Build React renderer');
    log('');
    log('🚀 Full Workflows:');
    log('  npm run workflow:local    - Complete build for current platform');
    log('  npm run workflow:windows  - Build for Windows');
    log('  npm run workflow:macos    - Build for macOS');
    log('  npm run workflow:linux    - Build for Linux');
    log('');
    log('🧪 Testing:');
    log('  npm run test:binary       - Test built whisper binary');
    log('  npm start                 - Run the app in development mode');
    log('');
    log('🧹 Cleanup:');
    log('  npm run clean             - Clean all generated files');
    log('  npm run clean:build       - Clean build artifacts only');
    
    // Installation recommendations
    if (!allRequired) {
        log('\n🛠️  Installation Recommendations:', 'yellow');
        log('');
        
        if (isWindows) {
            log('For Windows:');
            log('• Install Visual Studio Community 2022 (free): https://visualstudio.microsoft.com/vs/community/');
            log('• Or install "Build Tools for Visual Studio 2022": https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022');
            log('• Make sure to include "C++ build tools" workload');
        } else if (isMacOS) {
            log('For macOS:');
            log('• Install Xcode Command Line Tools: xcode-select --install');
            log('• Or install full Xcode from the App Store');
        } else if (isLinux) {
            log('For Linux (Ubuntu/Debian):');
            log('• sudo apt-get update');
            log('• sudo apt-get install build-essential cmake');
            log('');
            log('For Linux (CentOS/RHEL/Fedora):');
            log('• sudo yum groupinstall "Development Tools"');
            log('• sudo yum install cmake');
        }
        
        log('');
        log('For CMake:');
        log('• Download from: https://cmake.org/download/');
        log('• Or use package manager (brew install cmake, choco install cmake, etc.)');
    }
    
    log('\n🎯 Quick Start:', 'cyan');
    log('1. Run: npm run workflow:local');
    log('2. This will build whisper.cpp, download a model, and create your app');
    log('3. Check the dist/ folder for your built application');
    
    log('\n' + '='.repeat(60), 'cyan');
    
    if (!allRequired) {
        process.exit(1);
    }
}

// Only run if this script is executed directly (not required)
if (require.main === module) {
    checkSetup();
}