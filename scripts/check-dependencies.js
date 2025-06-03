#!/usr/bin/env node

// scripts/check-dependencies.js - Detailed dependency analysis
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

class DependencyChecker {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.binaryExt = this.platform === 'win32' ? '.exe' : '';
        this.whisperBinary = path.join(process.cwd(), 'binaries', `whisper-cli${this.binaryExt}`);
    }

    checkBinaryExists() {
        if (!fs.existsSync(this.whisperBinary)) {
            logError(`Binary not found: ${this.whisperBinary}`);
            return false;
        }
        
        const stats = fs.statSync(this.whisperBinary);
        const sizeKB = Math.round(stats.size / 1024);
        logInfo(`Binary: ${path.basename(this.whisperBinary)} (${sizeKB} KB)`);
        
        return stats.size > 50000;
    }

    async checkMacOSDependencies() {
        logInfo('Analyzing macOS dependencies with otool...');
        
        try {
            const output = execSync(`otool -L "${this.whisperBinary}"`, { encoding: 'utf8' });
            const lines = output.split('\n').filter(line => line.trim());
            
            console.log('\nDependency Analysis:');
            console.log('-'.repeat(50));
            
            let hasProblems = false;
            let isStaticLinked = true;
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.includes(this.whisperBinary)) continue;
                
                if (trimmed.includes('@rpath/libwhisper') || 
                    trimmed.includes('@rpath/libggml') ||
                    trimmed.includes('/tmp/whisper-build/') ||
                    trimmed.includes('/private/tmp/')) {
                    
                    logError(`PROBLEM: ${trimmed}`);
                    hasProblems = true;
                    isStaticLinked = false;
                } else if (trimmed.includes('/usr/lib/') || 
                          trimmed.includes('/System/Library/')) {
                    logSuccess(`SYSTEM: ${trimmed}`);
                } else {
                    logWarning(`OTHER: ${trimmed}`);
                    isStaticLinked = false;
                }
            }
            
            console.log('-'.repeat(50));
            
            if (hasProblems) {
                logError('❌ Binary has missing dependencies - needs fixing');
                return { success: false, needsFix: true, type: 'missing-deps' };
            } else if (isStaticLinked) {
                logSuccess('✅ Binary is statically linked - excellent!');
                return { success: true, type: 'static' };
            } else {
                logWarning('⚠️ Binary uses dynamic linking but seems OK');
                return { success: true, type: 'dynamic-ok' };
            }
            
        } catch (error) {
            logError(`otool analysis failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async checkLinuxDependencies() {
        logInfo('Analyzing Linux dependencies with ldd...');
        
        try {
            let output;
            try {
                output = execSync(`ldd "${this.whisperBinary}"`, { encoding: 'utf8' });
            } catch (error) {
                if (error.stderr && error.stderr.includes('not a dynamic executable')) {
                    logSuccess('✅ Binary is statically linked - excellent!');
                    return { success: true, type: 'static' };
                }
                throw error;
            }
            
            const lines = output.split('\n').filter(line => line.trim());
            
            console.log('\nDependency Analysis:');
            console.log('-'.repeat(50));
            
            let hasProblems = false;
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                if (trimmed.includes('not found')) {
                    logError(`MISSING: ${trimmed}`);
                    hasProblems = true;
                } else if (trimmed.includes('=>')) {
                    logSuccess(`FOUND: ${trimmed}`);
                } else {
                    logInfo(`INFO: ${trimmed}`);
                }
            }
            
            console.log('-'.repeat(50));
            
            if (hasProblems) {
                logError('❌ Binary has missing dependencies');
                return { success: false, needsFix: true, type: 'missing-deps' };
            } else {
                logSuccess('✅ All dependencies found');
                return { success: true, type: 'dynamic-ok' };
            }
            
        } catch (error) {
            logError(`ldd analysis failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async checkWindowsDependencies() {
        logInfo('Analyzing Windows dependencies...');
        
        const binariesDir = path.dirname(this.whisperBinary);
        
        // Expected DLLs for Windows whisper.cpp
        const expectedDlls = [
            'whisper.dll',
            'ggml.dll',
            'ggml-cpu.dll'
        ];
        
        const optionalDlls = [
            'msvcp140.dll',
            'vcruntime140.dll',
            'vcruntime140_1.dll'
        ];
        
        console.log('\nDependency Analysis:');
        console.log('-'.repeat(50));
        
        let hasProblems = false;
        let foundDlls = 0;
        
        // Check required DLLs
        for (const dll of expectedDlls) {
            const dllPath = path.join(binariesDir, dll);
            if (fs.existsSync(dllPath)) {
                const stats = fs.statSync(dllPath);
                const sizeKB = Math.round(stats.size / 1024);
                logSuccess(`FOUND: ${dll} (${sizeKB} KB)`);
                foundDlls++;
            } else {
                logError(`MISSING: ${dll}`);
                hasProblems = true;
            }
        }
        
        // Check optional DLLs
        for (const dll of optionalDlls) {
            const dllPath = path.join(binariesDir, dll);
            if (fs.existsSync(dllPath)) {
                const stats = fs.statSync(dllPath);
                const sizeKB = Math.round(stats.size / 1024);
                logInfo(`RUNTIME: ${dll} (${sizeKB} KB)`);
            }
        }
        
        console.log('-'.repeat(50));
        
        if (hasProblems) {
            logError('❌ Missing required DLLs');
            return { success: false, needsFix: true, type: 'missing-dlls' };
        } else if (foundDlls === 0) {
            logWarning('⚠️ No whisper DLLs found - might be statically linked');
            return { success: true, type: 'static-or-unknown' };
        } else {
            logSuccess('✅ Required DLLs found');
            return { success: true, type: 'dynamic-ok' };
        }
    }

    async testBinaryExecution() {
        logInfo('Testing binary execution...');
        
        try {
            // Make executable on Unix
            if (this.platform !== 'win32') {
                fs.chmodSync(this.whisperBinary, 0o755);
            }
            
            // Test with --help
            const output = execSync(`"${this.whisperBinary}" --help`, {
                encoding: 'utf8',
                timeout: 10000,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            const isValid = output.includes('whisper') || 
                           output.includes('transcribe') ||
                           output.includes('--model') ||
                           output.includes('usage');
            
            if (isValid) {
                logSuccess('✅ Binary execution test passed');
                return { success: true };
            } else {
                logError('❌ Binary execution test failed - unexpected output');
                return { success: false, error: 'Unexpected output' };
            }
            
        } catch (error) {
            logError(`❌ Binary execution failed: ${error.message}`);
            
            // Try to provide helpful error interpretation
            if (error.message.includes('dyld') && error.message.includes('Library not loaded')) {
                logError('💡 This is a macOS dynamic linking issue');
                logInfo('Fix with: npm run fix:whisper');
            } else if (error.message.includes('DLL') || error.message.includes('0xc0000135')) {
                logError('💡 This is a Windows DLL missing issue');
                logInfo('Fix with: npm run fix:whisper');
            } else if (error.message.includes('not found') && this.platform === 'linux') {
                logError('💡 This is a Linux shared library issue');
                logInfo('Fix with: npm run fix:whisper');
            }
            
            return { success: false, error: error.message };
        }
    }

    async run() {
        log('🔍 WhisperDesk Dependency Check', 'blue');
        console.log(`Platform: ${this.platform} (${this.arch})`);
        console.log('');

        // Check if binary exists
        if (!this.checkBinaryExists()) {
            logError('Binary not found or corrupted');
            logInfo('Run: npm run build:whisper');
            return false;
        }

        // Platform-specific dependency analysis
        let depResult;
        if (this.platform === 'darwin') {
            depResult = await this.checkMacOSDependencies();
        } else if (this.platform === 'linux') {
            depResult = await this.checkLinuxDependencies();
        } else if (this.platform === 'win32') {
            depResult = await this.checkWindowsDependencies();
        } else {
            logWarning(`Unsupported platform: ${this.platform}`);
            depResult = { success: false, error: 'Unsupported platform' };
        }

        console.log('');

        // Test execution regardless of dependency analysis
        const execResult = await this.testBinaryExecution();

        console.log('');
        console.log('='.repeat(60));
        log('Summary', 'blue');
        console.log('='.repeat(60));

        if (depResult.success && execResult.success) {
            logSuccess('🎉 All dependency checks passed!');
            logInfo(`Linking type: ${depResult.type}`);
            return true;
        } else if (execResult.success && !depResult.success) {
            logWarning('⚠️ Dependencies have issues but binary works');
            logInfo('This might work but could break in different environments');
            return true;
        } else {
            logError('❌ Dependency or execution issues found');
            
            if (depResult.needsFix || !execResult.success) {
                logInfo('💡 Recommended fix: npm run fix:whisper');
            }
            
            return false;
        }
    }
}

// Main execution
if (require.main === module) {
    const checker = new DependencyChecker();
    checker.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Dependency check failed:', error);
        process.exit(1);
    });
}

module.exports = DependencyChecker;