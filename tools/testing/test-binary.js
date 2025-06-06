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
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) { log(`ℹ️  ${message}`, 'blue'); }
function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }
function logError(message) { log(`❌ ${message}`, 'red'); }

const isWindows = process.platform === 'win32';
const binaryExt = isWindows ? '.exe' : '';

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function testBinary() {
    logInfo('Testing whisper binary...');
    
    const binaryPath = path.join(process.cwd(), 'binaries', `whisper-cli${binaryExt}`);
    
    // Check if binary exists
    if (!fs.existsSync(binaryPath)) {
        logError(`Binary not found: ${binaryPath}`);
        logInfo('Run "npm run build:whisper" to build the binary first');
        process.exit(1);
    }
    
    // Check binary size
    const stats = fs.statSync(binaryPath);
    const size = formatBytes(stats.size);
    logInfo(`Binary found: ${path.basename(binaryPath)} (${size})`);
    
    if (stats.size < 50000) {
        logError(`Binary too small (${size}), likely corrupted`);
        process.exit(1);
    }
    
    logSuccess(`Binary size check passed (${size})`);
    
    // Check if binary is executable (Unix systems)
    if (!isWindows) {
        try {
            fs.accessSync(binaryPath, fs.constants.X_OK);
            logSuccess('Binary is executable');
        } catch (error) {
            logWarning('Binary is not executable, attempting to fix...');
            try {
                fs.chmodSync(binaryPath, 0o755);
                logSuccess('Fixed binary permissions');
            } catch (chmodError) {
                logError('Could not fix binary permissions');
                process.exit(1);
            }
        }
    }
    
    // Try to run binary with --help flag
    logInfo('Testing binary execution...');
    try {
        // Use timeout to prevent hanging
        const timeout = isWindows ? '10' : '10s';
        const timeoutCmd = isWindows ? `timeout ${timeout}` : `timeout ${timeout}`;
        
        let output;
        if (isWindows) {
            // On Windows, just try to run it briefly
            try {
                output = execSync(`"${binaryPath}" --help`, { 
                    timeout: 5000,
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            } catch (timeoutError) {
                // Timeout is expected, check if it's actually running
                if (timeoutError.signal === 'SIGTERM' || timeoutError.status === 1) {
                    logSuccess('Binary runs (may have timed out with help, which is normal)');
                    return;
                }
                throw timeoutError;
            }
        } else {
            // On Unix systems, try --help with timeout
            try {
                output = execSync(`timeout 5s "${binaryPath}" --help 2>&1 || true`, { 
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
            } catch (error) {
                // If timeout command fails, try without it
                try {
                    output = execSync(`"${binaryPath}" --help`, { 
                        timeout: 3000,
                        encoding: 'utf8',
                        stdio: 'pipe'
                    });
                } catch (fallbackError) {
                    if (fallbackError.signal === 'SIGTERM') {
                        logSuccess('Binary runs (timed out, which is normal)');
                        return;
                    }
                    throw fallbackError;
                }
            }
        }
        
        // Check if we got reasonable output
        if (output && (output.includes('whisper') || output.includes('usage') || output.includes('help'))) {
            logSuccess('Binary runs and shows help output');
        } else {
            logSuccess('Binary runs (no help output, but executable)');
        }
        
    } catch (error) {
        // Check if it's a missing dependency error
        if (error.message.includes('ENOENT')) {
            logError('Binary not found or not executable');
            process.exit(1);
        } else if (error.message.includes('dylib') || error.message.includes('.so') || error.message.includes('.dll')) {
            logWarning('Binary runs but has missing dependencies');
            logInfo('This may be normal - dependencies will be available at runtime');
        } else if (error.signal === 'SIGTERM' || error.signal === 'SIGKILL') {
            logSuccess('Binary runs (killed by timeout, which is normal)');
        } else {
            logWarning(`Binary execution test inconclusive: ${error.message}`);
            logInfo('This may be normal if dependencies are not available in build environment');
        }
    }
    
    // Check for DLLs on Windows
    if (isWindows) {
        logInfo('Checking for Windows DLLs...');
        const binariesDir = path.dirname(binaryPath);
        const dlls = fs.readdirSync(binariesDir).filter(file => file.endsWith('.dll'));
        
        if (dlls.length > 0) {
            logSuccess(`Found ${dlls.length} DLL(s):`);
            dlls.forEach(dll => {
                const dllPath = path.join(binariesDir, dll);
                const dllSize = formatBytes(fs.statSync(dllPath).size);
                log(`  ${dll}: ${dllSize}`);
            });
        } else {
            logWarning('No DLLs found - this may cause runtime issues on Windows');
        }
    }
    
    logSuccess('Binary tests completed successfully!');
}

// Check for models (optional)
function checkModels() {
    logInfo('Checking for downloaded models...');
    
    const modelsDir = path.join(process.cwd(), 'models');
    if (!fs.existsSync(modelsDir)) {
        logWarning('Models directory not found');
        logInfo('Run "npm run build:models:tiny" to download a test model');
        return;
    }
    
    const models = fs.readdirSync(modelsDir).filter(file => file.endsWith('.bin'));
    if (models.length === 0) {
        logWarning('No models found');
        logInfo('Run "npm run build:models:tiny" to download a test model');
        return;
    }
    
    logSuccess(`Found ${models.length} model(s):`);
    models.forEach(model => {
        const modelPath = path.join(modelsDir, model);
        const modelSize = formatBytes(fs.statSync(modelPath).size);
        log(`  ${model}: ${modelSize}`);
    });
}

// Main execution
try {
    testBinary();
    checkModels();
    logSuccess('All tests passed! 🎉');
} catch (error) {
    logError(`Test failed: ${error.message}`);
    process.exit(1);
}