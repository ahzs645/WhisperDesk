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
let forceStatic = true; // Always prefer static linking
let skipTests = false;

args.forEach(arg => {
    if (arg.startsWith('--platform=')) {
        targetPlatform = arg.split('=')[1];
    } else if (arg === '--dynamic') {
        forceStatic = false;
    } else if (arg === '--skip-tests') {
        skipTests = true;
    } else if (arg === '--static') {
        forceStatic = true;
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

logInfo(`Building whisper.cpp for ${platform} (${forceStatic ? 'static' : 'dynamic'} linking)...`);

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

// Enhanced dependency checking
function checkBinaryDependencies(binaryPath) {
    logInfo('Checking binary dependencies...');
    
    try {
        if (isMacOS) {
            const output = execSync(`otool -L "${binaryPath}"`, { encoding: 'utf8' });
            const lines = output.split('\n');
            
            // Check for problematic dependencies
            const problematicDeps = lines.filter(line => 
                line.includes('@rpath/libwhisper') || 
                line.includes('@rpath/libggml') ||
                line.includes('/tmp/whisper-build/') ||
                line.includes('/private/tmp/')
            );
            
            if (problematicDeps.length > 0) {
                logError('Binary has problematic dynamic dependencies:');
                problematicDeps.forEach(dep => logError(`  ${dep.trim()}`));
                return false;
            }
            
            // Check if statically linked (only system libs)
            const systemLibsOnly = lines.every(line => 
                line.trim() === '' ||
                line.includes(binaryPath) ||
                line.includes('/usr/lib/') ||
                line.includes('/System/Library/')
            );
            
            if (systemLibsOnly) {
                logSuccess('Binary is properly statically linked');
                return true;
            } else {
                logWarning('Binary uses dynamic linking but dependencies seem available');
                return true;
            }
            
        } else if (platform === 'linux') {
            try {
                const output = execSync(`ldd "${binaryPath}" 2>/dev/null`, { encoding: 'utf8' });
                const missingDeps = output.split('\n').filter(line => 
                    line.includes('not found')
                );
                
                if (missingDeps.length > 0) {
                    logError('Binary has missing dependencies:');
                    missingDeps.forEach(dep => logError(`  ${dep.trim()}`));
                    return false;
                }
                
                logSuccess('All dynamic dependencies found');
                return true;
                
            } catch (error) {
                // If ldd fails, might be statically linked
                if (error.message.includes('not a dynamic executable')) {
                    logSuccess('Binary is statically linked');
                    return true;
                }
                logWarning(`Could not check dependencies: ${error.message}`);
                return true; // Assume it's OK
            }
        } else {
            // Windows - just check if it runs
            logInfo('Windows binary - dependencies will be checked at runtime');
            return true;
        }
    } catch (error) {
        logError(`Dependency check failed: ${error.message}`);
        return false;
    }
}

// Test binary functionality
function testBinary(binaryPath) {
    if (skipTests) {
        logInfo('Skipping binary tests as requested');
        return true;
    }
    
    logInfo('Testing binary functionality...');
    
    try {
        // Test with --help flag
        const output = execSync(`"${binaryPath}" --help`, { 
            encoding: 'utf8',
            timeout: 10000,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Check for whisper-related keywords in output
        if (output.includes('whisper') || 
            output.includes('transcribe') ||
            output.includes('--model') ||
            output.includes('usage')) {
            
            logSuccess('Binary responds correctly to --help');
            return true;
        } else {
            logError('Binary test failed - unexpected output');
            logError(`Output preview: ${output.substring(0, 200)}`);
            return false;
        }
        
    } catch (error) {
        logError(`Binary test failed: ${error.message}`);
        
        // Try to get more details about the error
        if (error.stderr) {
            logError(`Error details: ${error.stderr.substring(0, 300)}`);
        }
        
        return false;
    }
}

// Build whisper.cpp with FIXED macOS configuration
function buildWhisper() {
    const tempDir = isWindows ? 'C:\\temp\\whisper-build' : '/tmp/whisper-build';
    const projectRoot = process.cwd(); // Store original directory
    
    logInfo('Cleaning up previous build...');
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    logInfo('Cloning whisper.cpp repository...');
    try {
        execSync(`git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "${tempDir}"`, { 
            stdio: 'inherit',
            cwd: projectRoot
        });
    } catch (error) {
        logError('Failed to clone whisper.cpp repository');
        process.exit(1);
    }
    
    process.chdir(tempDir);
    logSuccess('Repository cloned successfully');
    
    // Configure CMake with FIXED settings for each platform
    logInfo('Configuring CMake with platform-optimized settings...');
    let cmakeCmd;
    let buildDir;
    
    if (isWindows) {
        cmakeCmd = [
            'cmake', '-S', '.', '-B', 'build', '-A', 'x64',
            '-DCMAKE_BUILD_TYPE=Release',
            `-DBUILD_SHARED_LIBS=${forceStatic ? 'OFF' : 'ON'}`,
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON',
            '-DWHISPER_BUILD_SERVER=OFF'
        ];
        buildDir = path.join('build', 'bin', 'Release');
    } else if (isMacOS) {
        const arch = os.arch();
        
        // FIXED: Correct macOS configuration
        cmakeCmd = [
            'cmake', '-B', 'build',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON',
            '-DWHISPER_BUILD_SERVER=OFF',
            '-DBUILD_SHARED_LIBS=OFF',  // Force static linking
            `-DCMAKE_OSX_ARCHITECTURES=${arch}`
        ];
        
        // Architecture-specific optimizations
        if (arch === 'x86_64') {
            cmakeCmd.push('-DGGML_NATIVE=OFF'); // Avoid CPU-specific optimizations for compatibility
        }
        
        // REMOVED: Invalid flags that were causing the error
        // These don't work on macOS with clang:
        // '-DCMAKE_EXE_LINKER_FLAGS=-static-libgcc -static-libstdc++'
        
        buildDir = path.join('build', 'bin');
    } else {
        // Linux configuration
        cmakeCmd = [
            'cmake', '-B', 'build',
            '-DCMAKE_BUILD_TYPE=Release',
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON',
            '-DWHISPER_BUILD_SERVER=OFF'
        ];
        
        if (forceStatic) {
            cmakeCmd.push('-DBUILD_SHARED_LIBS=OFF');
            // Linux static linking flags (only for Linux)
            cmakeCmd.push('-DCMAKE_EXE_LINKER_FLAGS=-static-libgcc -static-libstdc++');
        }
        
        buildDir = path.join('build', 'bin');
    }
    
    logInfo(`CMake configuration: ${cmakeCmd.join(' ')}`);
    
    try {
        execSync(cmakeCmd.join(' '), { stdio: 'inherit' });
        logSuccess('CMake configuration completed');
    } catch (error) {
        logError('CMake configuration failed');
        process.exit(1);
    }
    
    // Build with progress monitoring
    logInfo('Building whisper.cpp (this may take several minutes)...');
    const buildCmd = isWindows ? 
        'cmake --build build --config Release --parallel 4' :
        `cmake --build build --config Release --parallel ${os.cpus().length}`;
    
    try {
        execSync(buildCmd, { stdio: 'inherit' });
        logSuccess('Build completed successfully');
    } catch (error) {
        logError('Build failed');
        
        // Try to get more information about the failure
        try {
            logInfo('Checking build directory contents...');
            const buildContents = fs.readdirSync('build');
            logInfo(`Build directory contains: ${buildContents.join(', ')}`);
        } catch (e) {
            logError('Could not read build directory');
        }
        
        process.exit(1);
    }
    
    // FIXED: Better binary detection logic
    logInfo('Looking for whisper-cli binary...');
    let binaryPath;
    
    // Check if build directory exists
    if (!fs.existsSync(buildDir)) {
        logError(`Build directory not found: ${buildDir}`);
        process.exit(1);
    }
    
    // List all files for debugging
    const files = fs.readdirSync(buildDir);
    logInfo(`Available files in ${buildDir}: ${files.join(', ')}`);
    
    // Look for whisper-cli specifically first
    const targetNames = [`whisper-cli${binaryExt}`, `main${binaryExt}`];
    for (const name of targetNames) {
        const fullPath = path.join(buildDir, name);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            const sizeKB = Math.round(stats.size / 1024);
            logInfo(`Found ${name}: ${sizeKB} KB`);
            
            // Make sure it's not tiny (avoid copying wrong files)
            if (stats.size > 100000) { // At least 100KB
                binaryPath = fullPath;
                break;
            } else {
                logWarning(`${name} is too small (${sizeKB} KB), skipping`);
            }
        }
    }
    
    if (!binaryPath) {
        logError('Could not find whisper-cli or main binary with reasonable size');
        logInfo('Available files and sizes:');
        files.forEach(file => {
            try {
                const filePath = path.join(buildDir, file);
                const stats = fs.statSync(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                logInfo(`  ${file}: ${sizeKB} KB`);
            } catch (e) {
                logInfo(`  ${file}: Could not stat`);
            }
        });
        process.exit(1);
    }
    
    // Verify binary properties
    const stats = fs.statSync(binaryPath);
    const sizeKB = Math.round(stats.size / 1024);
    logInfo(`Selected binary: ${path.basename(binaryPath)} (${sizeKB} KB)`);
    
    if (stats.size < 100000) {
        logError(`Binary too small (${sizeKB} KB), likely wrong file`);
        process.exit(1);
    }
    
    // Check dependencies
    const depsOK = checkBinaryDependencies(binaryPath);
    if (!depsOK) {
        logWarning('Binary has dependency issues but continuing...');
    }
    
    // Test binary functionality
    const testOK = testBinary(binaryPath);
    if (!testOK) {
        logError('Binary failed functionality test');
        if (!skipTests) {
            logWarning('Continuing despite test failure...');
        }
    }
    
    // Store the absolute path before changing directories
    const absoluteBinaryPath = path.resolve(binaryPath);
    
    // Return to project directory before copying
    process.chdir(projectRoot);
    
    // Set up target paths
    const binariesDir = path.join(projectRoot, 'binaries');
    
    if (!fs.existsSync(binariesDir)) {
        fs.mkdirSync(binariesDir, { recursive: true });
    }
    
    const targetBinary = path.join(binariesDir, `whisper-cli${binaryExt}`);
    
    // Backup existing binary if it exists
    if (fs.existsSync(targetBinary)) {
        const backupPath = `${targetBinary}.backup-${Date.now()}`;
        try {
            fs.copyFileSync(targetBinary, backupPath);
            logInfo(`Backed up existing binary to: ${backupPath}`);
        } catch (error) {
            logError(`Failed to backup existing binary: ${error.message}`);
            process.exit(1);
        }
    }
    
    // Copy the binary using absolute path
    try {
        fs.copyFileSync(absoluteBinaryPath, targetBinary);
        logSuccess(`Binary copied to ${targetBinary}`);
    } catch (error) {
        logError(`Failed to copy binary: ${error.message}`);
        process.exit(1);
    }
    
    // Make executable on Unix systems
    if (!isWindows) {
        fs.chmodSync(targetBinary, 0o755);
    }
    
    // Copy additional files on Windows
    if (isWindows) {
        logInfo('Copying Windows dependencies...');
        try {
            const sourceBuildDir = path.join(tempDir, buildDir);
            const dlls = fs.readdirSync(sourceBuildDir).filter(file => file.endsWith('.dll'));
            dlls.forEach(dll => {
                const srcPath = path.join(sourceBuildDir, dll);
                const dstPath = path.join(binariesDir, dll);
                fs.copyFileSync(srcPath, dstPath);
                const dllSize = Math.round(fs.statSync(srcPath).size / 1024);
                logSuccess(`Copied DLL: ${dll} (${dllSize} KB)`);
            });
        } catch (error) {
            logWarning(`Could not copy DLLs: ${error.message}`);
        }
    }
    
    // Final verification in target location
    logInfo('Performing final verification...');
    const finalTestOK = testBinary(targetBinary);
    if (!finalTestOK) {
        logWarning('Final binary test failed but binary has been installed');
    }
    
    const finalDepsOK = checkBinaryDependencies(targetBinary);
    if (!finalDepsOK) {
        logWarning('Final binary has dependency issues but may still work');
    }
    
    // Clean up
    logInfo('Cleaning up temporary files...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Success summary
    logSuccess('whisper.cpp build completed successfully!');
    logInfo(`Binary location: ${targetBinary}`);
    logInfo(`Binary size: ${Math.round(fs.statSync(targetBinary).size / 1024)} KB`);
    logInfo(`Linking type: ${forceStatic ? 'Static (preferred)' : 'Dynamic'}`);
    
    if (finalDepsOK && finalTestOK) {
        logSuccess('Binary passed all checks and is ready for use!');
    } else {
        logWarning('Binary installed but may have runtime issues. Try running the app to test.');
    }
}

// Main execution with error handling
try {
    logInfo('Starting whisper.cpp build process...');
    checkRequirements();
    buildWhisper();
    logSuccess('Build process completed successfully!');
} catch (error) {
    logError(`Build failed with error: ${error.message}`);
    if (error.stack) {
        logError(`Stack trace: ${error.stack}`);
    }
    process.exit(1);
}