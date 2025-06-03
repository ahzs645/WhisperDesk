#!/usr/bin/env node

// scripts/fix-whisper-dependencies.js - FIXED VERSION
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

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

class WhisperDependencyFixer {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.isWindows = this.platform === 'win32';
        this.isMacOS = this.platform === 'darwin';
        this.isLinux = this.platform === 'linux';
        this.projectRoot = process.cwd();
        this.binariesDir = path.join(this.projectRoot, 'binaries');
        this.binaryExt = this.isWindows ? '.exe' : '';
        this.whisperBinary = path.join(this.binariesDir, `whisper-cli${this.binaryExt}`);
    }

    async initialize() {
        logInfo(`WhisperDesk Dependency Fixer for ${this.platform} (${this.arch})`);
        
        // Ensure binaries directory exists
        if (!fs.existsSync(this.binariesDir)) {
            fs.mkdirSync(this.binariesDir, { recursive: true });
            logInfo('Created binaries directory');
        }

        return true;
    }

    async checkBinaryExists() {
        if (!fs.existsSync(this.whisperBinary)) {
            logError(`Whisper binary not found: ${this.whisperBinary}`);
            return false;
        }

        const stats = fs.statSync(this.whisperBinary);
        const sizeKB = Math.round(stats.size / 1024);
        logInfo(`Found binary: ${path.basename(this.whisperBinary)} (${sizeKB} KB)`);

        if (stats.size < 50000) {
            logError(`Binary too small (${sizeKB} KB), likely corrupted`);
            return false;
        }

        return true;
    }

    async checkMacOSDependencies() {
        try {
            const output = execSync(`otool -L "${this.whisperBinary}"`, { encoding: 'utf8' });
            const lines = output.split('\n');

            // Look for problematic dependencies
            const problematicDeps = lines.filter(line => 
                line.includes('@rpath/libwhisper') || 
                line.includes('@rpath/libggml') ||
                line.includes('/tmp/whisper-build/') ||
                line.includes('/private/tmp/')
            );

            if (problematicDeps.length > 0) {
                logError('Found problematic dynamic dependencies:');
                problematicDeps.forEach(dep => logError(`  ${dep.trim()}`));
                return { 
                    success: false, 
                    error: 'Dynamic linking with missing libraries',
                    problematicDeps,
                    needsFix: true
                };
            }

            logSuccess('Binary dependencies look good');
            return { success: true, method: 'static-linking' };

        } catch (error) {
            return { success: false, error: `Dependency check failed: ${error.message}` };
        }
    }

    async testBinary() {
        try {
            // Make binary executable on Unix systems
            if (!this.isWindows) {
                fs.chmodSync(this.whisperBinary, 0o755);
            }

            // Test with --help flag - using the project root as working directory
            const output = execSync(`"${this.whisperBinary}" --help`, { 
                encoding: 'utf8',
                timeout: 10000,
                cwd: this.projectRoot,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            if (output.includes('whisper') || 
                output.includes('transcribe') ||
                output.includes('--model') ||
                output.includes('usage')) {
                
                logSuccess('Binary test passed');
                return { success: true };
            } else {
                logError('Binary test failed - unexpected output');
                return { success: false, error: 'Unexpected output from binary' };
            }

        } catch (error) {
            logError(`Binary test failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async downloadStaticBinary() {
        logInfo('Downloading pre-built static binary...');

        try {
            // Determine the correct asset name
            let assetName;
            if (this.isMacOS) {
                assetName = this.arch === 'arm64' ? 
                    'whisper-blas-bin-macos-arm64.zip' : 
                    'whisper-blas-bin-macos-x64.zip';
            } else if (this.isLinux) {
                assetName = 'whisper-blas-bin-linux-x64.zip';
            } else if (this.isWindows) {
                assetName = 'whisper-blas-bin-win-x64.zip';
            } else {
                throw new Error(`No pre-built binary available for ${this.platform}`);
            }

            // Get latest release info with better error handling
            const releaseUrl = 'https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest';
            const releaseData = await this.fetchJSON(releaseUrl);
            
            // FIXED: Better error handling for API response
            if (!releaseData || !releaseData.assets || !Array.isArray(releaseData.assets)) {
                throw new Error('Invalid GitHub API response - no assets found');
            }
            
            const asset = releaseData.assets.find(a => a && a.name === assetName);
            if (!asset) {
                logWarning(`Asset ${assetName} not found in latest release`);
                // List available assets for debugging
                const availableAssets = releaseData.assets.map(a => a.name).join(', ');
                logInfo(`Available assets: ${availableAssets}`);
                throw new Error(`Asset ${assetName} not found`);
            }

            // Download and extract
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-download-'));
            const zipPath = path.join(tempDir, assetName);

            logInfo(`Downloading from: ${asset.browser_download_url}`);
            await this.downloadFile(asset.browser_download_url, zipPath);
            
            logInfo('Extracting archive...');
            await this.extractZip(zipPath, tempDir);

            // Find the binary with better detection
            const extractedFiles = fs.readdirSync(tempDir);
            logInfo(`Extracted files: ${extractedFiles.join(', ')}`);
            
            const binaryFile = extractedFiles.find(f => 
                f === 'main' || f === 'whisper-cli' || 
                f === 'main.exe' || f === 'whisper-cli.exe'
            );

            if (!binaryFile) {
                throw new Error('Binary not found in downloaded archive');
            }

            const extractedBinaryPath = path.join(tempDir, binaryFile);
            const stats = fs.statSync(extractedBinaryPath);
            logInfo(`Found binary: ${binaryFile} (${Math.round(stats.size / 1024)} KB)`);
            
            // Verify the extracted binary is reasonable size
            if (stats.size < 100000) {
                throw new Error(`Downloaded binary too small (${Math.round(stats.size / 1024)} KB)`);
            }

            // Backup existing binary
            if (fs.existsSync(this.whisperBinary)) {
                const backupPath = `${this.whisperBinary}.backup-${Date.now()}`;
                fs.copyFileSync(this.whisperBinary, backupPath);
                logInfo(`Backed up existing binary to: ${backupPath}`);
            }

            // Copy new binary
            fs.copyFileSync(extractedBinaryPath, this.whisperBinary);
            
            // Make executable on Unix systems
            if (!this.isWindows) {
                fs.chmodSync(this.whisperBinary, 0o755);
            }

            // Cleanup
            this.cleanupDirectory(tempDir);

            logSuccess('Downloaded and installed pre-built static binary');
            return { success: true, method: 'download' };

        } catch (error) {
            logError(`Download failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async buildStaticBinary() {
        logInfo('Building static binary from source...');

        // Check build requirements
        const missing = [];
        
        try { execSync('cmake --version', { stdio: 'ignore' }); } 
        catch { missing.push('cmake'); }
        
        try { execSync('git --version', { stdio: 'ignore' }); } 
        catch { missing.push('git'); }

        if (this.isMacOS) {
            try { execSync('clang --version', { stdio: 'ignore' }); } 
            catch { missing.push('clang (Xcode Command Line Tools)'); }
        } else if (this.isLinux) {
            try { execSync('gcc --version', { stdio: 'ignore' }); } 
            catch { missing.push('gcc'); }
        } else if (this.isWindows) {
            try { execSync('where msbuild', { stdio: 'ignore' }); } 
            catch { missing.push('MSBuild (Visual Studio Build Tools)'); }
        }

        if (missing.length > 0) {
            throw new Error(`Missing build tools: ${missing.join(', ')}`);
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-build-'));
        const originalCwd = process.cwd();
        
        try {
            // Clone repository
            logInfo('Cloning whisper.cpp repository...');
            execSync(`git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git "${tempDir}"`, {
                stdio: 'inherit',
                cwd: originalCwd
            });

            // Change to build directory
            process.chdir(tempDir);
            logInfo(`Changed to build directory: ${tempDir}`);

            // Configure CMake with static linking
            logInfo('Configuring CMake...');
            const cmakeArgs = [
                'cmake', '-B', 'build',
                '-DCMAKE_BUILD_TYPE=Release',
                '-DWHISPER_BUILD_TESTS=OFF',
                '-DWHISPER_BUILD_EXAMPLES=ON',
                '-DBUILD_SHARED_LIBS=OFF'  // Force static linking
            ];

            if (this.isMacOS) {
                cmakeArgs.push(`-DCMAKE_OSX_ARCHITECTURES=${this.arch}`);
                if (this.arch === 'x86_64') {
                    cmakeArgs.push('-DGGML_NATIVE=OFF');
                }
            } else if (this.isWindows) {
                cmakeArgs.push('-A', 'x64');
            }

            execSync(cmakeArgs.join(' '), { stdio: 'inherit' });

            // Build
            logInfo('Building binary...');
            const cpuCount = os.cpus().length;
            execSync(`cmake --build build --config Release --parallel ${cpuCount}`, {
                stdio: 'inherit'
            });

            // Find binary with better logic
            const buildDir = this.isWindows ? 
                path.join(tempDir, 'build', 'bin', 'Release') : 
                path.join(tempDir, 'build', 'bin');
                
            logInfo(`Looking for binary in: ${buildDir}`);
            
            if (!fs.existsSync(buildDir)) {
                throw new Error(`Build directory not found: ${buildDir}`);
            }
            
            const files = fs.readdirSync(buildDir);
            logInfo(`Build directory contents: ${files.join(', ')}`);
            
            // Look for binary files with size check
            const potentialBinaries = files.filter(f => 
                f === `main${this.binaryExt}` || 
                f === `whisper-cli${this.binaryExt}` ||
                (f.endsWith(this.binaryExt) && !f.includes('test'))
            );

            let builtBinaryPath = null;
            let binaryFile = null;

            for (const file of potentialBinaries) {
                const filePath = path.join(buildDir, file);
                try {
                    const stats = fs.statSync(filePath);
                    logInfo(`Checking ${file}: ${Math.round(stats.size / 1024)} KB`);
                    
                    if (stats.size > 1000000) { // At least 1MB
                        builtBinaryPath = filePath;
                        binaryFile = file;
                        break;
                    }
                } catch (e) {
                    logWarning(`Could not check ${file}: ${e.message}`);
                }
            }

            if (!builtBinaryPath) {
                throw new Error('No suitable binary found in build output');
            }

            logInfo(`Found binary: ${binaryFile} (${Math.round(fs.statSync(builtBinaryPath).size / 1024)} KB)`);

            // Change back to original directory BEFORE copying
            process.chdir(originalCwd);
            logInfo(`Changed back to project directory: ${originalCwd}`);

            // Backup existing binary
            if (fs.existsSync(this.whisperBinary)) {
                const backupPath = `${this.whisperBinary}.backup-${Date.now()}`;
                fs.copyFileSync(this.whisperBinary, backupPath);
                logInfo(`Backed up existing binary to: ${backupPath}`);
            }

            // Copy new binary
            fs.copyFileSync(builtBinaryPath, this.whisperBinary);
            
            // Make executable on Unix systems
            if (!this.isWindows) {
                fs.chmodSync(this.whisperBinary, 0o755);
            }

            logInfo(`Copied binary to: ${this.whisperBinary}`);

            // Verify the copied binary
            const finalStats = fs.statSync(this.whisperBinary);
            logInfo(`Final binary size: ${Math.round(finalStats.size / 1024)} KB`);

            if (finalStats.size < 100000) {
                throw new Error(`Final binary too small: ${Math.round(finalStats.size / 1024)} KB`);
            }

            // Cleanup
            this.cleanupDirectory(tempDir);

            logSuccess('Built and installed static binary from source');
            return { success: true, method: 'build' };

        } catch (error) {
            // Make sure we're back in the original directory
            try {
                process.chdir(originalCwd);
            } catch (e) {
                logError(`Could not change back to original directory: ${e.message}`);
            }
            
            logError(`Build failed: ${error.message}`);
            
            // Cleanup
            this.cleanupDirectory(tempDir);
            
            return { success: false, error: error.message };
        }
    }

    async run() {
        try {
            await this.initialize();

            // Check current status
            if (await this.checkBinaryExists()) {
                const depCheck = await this.checkMacOSDependencies();
                
                if (depCheck.success) {
                    const testResult = await this.testBinary();
                    if (testResult.success) {
                        logSuccess('Binary is working correctly! No fixes needed.');
                        return true;
                    }
                }

                if (!depCheck.needsFix) {
                    logInfo('Binary seems OK, but testing...');
                    const testResult = await this.testBinary();
                    if (testResult.success) {
                        logSuccess('Binary is working correctly!');
                        return true;
                    }
                }
            }

            logInfo('Binary needs fixing. Attempting repair...');

            // Strategy 1: Download pre-built static binary
            logInfo('Strategy 1: Downloading pre-built static binary...');
            const downloadResult = await this.downloadStaticBinary();
            
            if (downloadResult.success) {
                const testResult = await this.testBinary();
                if (testResult.success) {
                    logSuccess('Successfully fixed with downloaded binary!');
                    return true;
                } else {
                    logWarning('Downloaded binary failed test, trying build...');
                }
            }

            // Strategy 2: Build from source
            logInfo('Strategy 2: Building static binary from source...');
            const buildResult = await this.buildStaticBinary();
            
            if (buildResult.success) {
                const testResult = await this.testBinary();
                if (testResult.success) {
                    logSuccess('Successfully fixed with built binary!');
                    return true;
                } else {
                    logError('Built binary failed test - there may be a deeper issue');
                }
            }

            logError('All repair strategies failed.');
            logInfo('💡 You may need to:');
            logInfo('  1. Install Xcode Command Line Tools: xcode-select --install');
            logInfo('  2. Manually download a working binary');
            logInfo('  3. Check the GitHub Issues for known problems');
            
            return false;

        } catch (error) {
            logError(`Fix process failed: ${error.message}`);
            return false;
        }
    }

    // Helper methods with better error handling
    async fetchJSON(url) {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { 
                headers: { 'User-Agent': 'WhisperDesk' },
                timeout: 30000
            }, (res) => {
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (e) {
                        reject(new Error(`JSON parse error: ${e.message}`));
                    }
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.on('error', reject);
        });
    }

    async downloadFile(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            
            const req = https.get(url, { timeout: 60000 }, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    file.close();
                    fs.unlinkSync(filePath);
                    return this.downloadFile(response.headers.location, filePath)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(filePath);
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                file.close();
                fs.unlinkSync(filePath);
                reject(new Error('Download timeout'));
            });
            
            req.on('error', (error) => {
                file.close();
                fs.unlinkSync(filePath);
                reject(error);
            });
        });
    }

    async extractZip(zipPath, extractDir) {
        try {
            if (this.isWindows) {
                execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, {
                    stdio: 'inherit'
                });
            } else {
                execSync(`cd "${extractDir}" && unzip -o "${zipPath}"`, {
                    stdio: 'inherit'
                });
            }
        } catch (error) {
            throw new Error(`Failed to extract ${zipPath}: ${error.message}`);
        }
    }

    cleanupDirectory(dir) {
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
                logInfo(`Cleaned up: ${dir}`);
            }
        } catch (error) {
            logWarning(`Could not clean up ${dir}: ${error.message}`);
        }
    }
}

// Main execution
if (require.main === module) {
    const fixer = new WhisperDependencyFixer();
    fixer.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        logError(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = WhisperDependencyFixer;