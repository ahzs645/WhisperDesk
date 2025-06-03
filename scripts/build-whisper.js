#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) { log(`ℹ️  ${message}`, 'blue'); }
function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }
function logError(message) { log(`❌ ${message}`, 'red'); }

// Parse command line arguments
const args = process.argv.slice(2);
let targetPlatform = process.platform;

args.forEach(arg => {
    if (arg.startsWith('--platform=')) {
        targetPlatform = arg.split('=')[1];
    }
});

// Convert platform names
const platformMap = {
    'win32': 'windows',
    'darwin': 'macos', 
    'linux': 'linux'
};

const platform = platformMap[targetPlatform] || 'linux';
const isWindows = platform === 'windows';
const isMacOS = platform === 'macos';
const binaryExt = isWindows ? '.exe' : '';

logInfo(`Building whisper.cpp for ${platform}...`);

// Check if required tools are available
function checkRequirements() {
    logInfo('Checking build requirements...');
    
    try {
        execSync('cmake --version', { stdio: 'ignore' });
        logSuccess('CMake found');
    } catch (error) {
        logError('CMake not found. Please install CMake from https://cmake.org/');
        process.exit(1);
    }
    
    try {
        execSync('git --version', { stdio: 'ignore' });
        logSuccess('Git found');
    } catch (error) {
        logError('Git not found. Please install Git.');
        process.exit(1);
    }
    
    // Platform-specific checks
    if (isWindows) {
        try {
            // Try to find MSBuild
            execSync('where msbuild', { stdio: 'ignore' });
            logSuccess('MSBuild found');
        } catch (error) {
            logWarning('MSBuild not found in PATH. Make sure Visual Studio Build Tools are installed.');
        }
    } else {
        try {
            const compiler = isMacOS ? 'clang' : 'gcc';
            execSync(`which ${compiler}`, { stdio: 'ignore' });
            logSuccess(`${compiler} found`);
        } catch (error) {
            logError(`${isMacOS ? 'Xcode Command Line Tools' : 'GCC'} not found. Please install build tools.`);
            process.exit(1);
        }
    }
}

// Build whisper.cpp
function buildWhisper() {
    const tempDir = isWindows ? 'C:\\temp\\whisper-build' : '/tmp/whisper-build';
    
    logInfo('Cleaning up previous build...');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    logInfo('Cloning whisper.cpp repository...');
    try {
        execSync(`git clone https://github.com/ggerganov/whisper.cpp.git "${tempDir}"`, { 
            stdio: 'inherit',
            cwd: process.cwd()
        });
    } catch (error) {
        logError('Failed to clone whisper.cpp repository');
        process.exit(1);
    }
    
    process.chdir(tempDir);
    logSuccess('Repository cloned successfully');
    
    // Configure CMake
    logInfo('Configuring CMake...');
    let cmakeCmd;
    let buildDir;
    
    if (isWindows) {
        cmakeCmd = [
            'cmake', '-S', '.', '-B', 'build', '-A', 'x64',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DBUILD_SHARED_LIBS=ON',
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON'
        ];
        buildDir = path.join('build', 'bin', 'Release');
    } else if (isMacOS) {
        const arch = os.arch();
        const archFlags = arch === 'arm64' ? 
            ['-DCMAKE_OSX_ARCHITECTURES=arm64'] : 
            ['-DCMAKE_OSX_ARCHITECTURES=x86_64', '-DGGML_NATIVE=OFF'];
        
        cmakeCmd = [
            'cmake', '-B', 'build',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON',
            ...archFlags
        ];
        buildDir = path.join('build', 'bin');
    } else {
        cmakeCmd = [
            'cmake', '-B', 'build',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON'
        ];
        buildDir = path.join('build', 'bin');
    }
    
    try {
        execSync(cmakeCmd.join(' '), { stdio: 'inherit' });
        logSuccess('CMake configuration completed');
    } catch (error) {
        logError('CMake configuration failed');
        process.exit(1);
    }
    
    // Build
    logInfo('Building whisper.cpp (this may take several minutes)...');
    const buildCmd = isWindows ? 
        'cmake --build build --config Release --parallel 4' :
        `cmake --build build --config Release --parallel ${os.cpus().length}`;
    
    try {
        execSync(buildCmd, { stdio: 'inherit' });
        logSuccess('Build completed successfully');
    } catch (error) {
        logError('Build failed');
        process.exit(1);
    }
    
    // Find and verify binary
    logInfo('Looking for binary...');
    let binaryPath;
    
    const possibleNames = [`whisper-cli${binaryExt}`, `main${binaryExt}`];
    for (const name of possibleNames) {
        const fullPath = path.join(buildDir, name);
        if (fs.existsSync(fullPath)) {
            binaryPath = fullPath;
            break;
        }
    }
    
    if (!binaryPath) {
        logError(`No suitable binary found in ${buildDir}`);
        try {
            const files = fs.readdirSync(buildDir);
            logInfo(`Available files: ${files.join(', ')}`);
        } catch (err) {
            logError(`Could not read directory: ${buildDir}`);
        }
        process.exit(1);
    }
    
    // Verify binary size
    const stats = fs.statSync(binaryPath);
    const sizeKB = Math.round(stats.size / 1024);
    logInfo(`Binary found: ${path.basename(binaryPath)} (${sizeKB} KB)`);
    
    if (stats.size < 50000) {
        logError(`Binary too small (${sizeKB} KB), likely corrupted`);
        process.exit(1);
    }
    
    // Copy to project directory
    const projectRoot = process.env.INIT_CWD || process.cwd().replace(tempDir, '').replace(/whisper-build.*$/, '').trim();
    const binariesDir = path.join(projectRoot, 'binaries');
    
    if (!fs.existsSync(binariesDir)) {
        fs.mkdirSync(binariesDir, { recursive: true });
    }
    
    const targetBinary = path.join(binariesDir, `whisper-cli${binaryExt}`);
    fs.copyFileSync(binaryPath, targetBinary);
    
    // Make executable on Unix systems
    if (!isWindows) {
        fs.chmodSync(targetBinary, 0o755);
    }
    
    logSuccess(`Binary copied to ${targetBinary}`);
    
    // Copy DLLs on Windows
    if (isWindows) {
        logInfo('Copying Windows DLLs...');
        try {
            const dlls = fs.readdirSync(buildDir).filter(file => file.endsWith('.dll'));
            dlls.forEach(dll => {
                const srcPath = path.join(buildDir, dll);
                const dstPath = path.join(binariesDir, dll);
                fs.copyFileSync(srcPath, dstPath);
                const dllSize = Math.round(fs.statSync(srcPath).size / 1024);
                logSuccess(`Copied DLL: ${dll} (${dllSize} KB)`);
            });
        } catch (error) {
            logWarning('Could not copy DLLs');
        }
    }
    
    // Clean up
    process.chdir(projectRoot);
    logInfo('Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    logSuccess('whisper.cpp build completed successfully!');
}

// Main execution
try {
    checkRequirements();
    buildWhisper();
} catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
}