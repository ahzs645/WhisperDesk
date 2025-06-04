// Enhanced build-whisper.js for Node.js integration
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class StaticWhisperBuilder {
    constructor(options = {}) {
        this.architecture = options.architecture || 'x64';
        this.buildType = options.buildType || 'Release';
        this.sourceDir = options.sourceDir || path.join(__dirname, '..', 'temp', 'whisper-cpp');
        this.outputDir = options.outputDir || path.join(__dirname, '..', 'binaries');
        // The issue mentions using the whisperdesk-static.cmake file.
        // However, the provided JavaScript code directly sets the CMake arguments
        // for static linking, similar to what the PowerShell script does.
        // For now, I will stick to the provided JS code.
        // If direct CMake file initialization is preferred, this.configFile would be used.
        // this.configFile = path.join(__dirname, 'whisperdesk-static.cmake');
    }

    async validatePrerequisites() {
        console.log('🔧 Validating build prerequisites...');

        // Check for CMake
        try {
            execSync('cmake --version', { stdio: 'pipe' });
            console.log('✅ CMake found');
        } catch (error) {
            throw new Error('CMake is required but not found in PATH');
        }

        // Check for Visual Studio on Windows
        if (os.platform() === 'win32') {
            try {
                const vsWherePath = path.join(
                    process.env['ProgramFiles(x86)'] || 'C:\Program Files (x86)',
                    'Microsoft Visual Studio',
                    'Installer',
                    'vswhere.exe'
                );
                
                if (fs.existsSync(vsWherePath)) {
                    const vsInstallations = execSync(
                        `"${vsWherePath}" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`,
                        { encoding: 'utf8', stdio: 'pipe' }
                    ).trim();

                    if (vsInstallations) {
                        console.log('✅ Visual Studio Build Tools found');
                    } else {
                        throw new Error('No suitable Visual Studio installation found');
                    }
                } else {
                    throw new Error('Visual Studio Installer not found');
                }
            } catch (error) {
                console.error(`Error details: ${error.message}`);
                throw new Error('Visual Studio Build Tools with C++ support are required. Please ensure Visual Studio 2019 or later with C++ Desktop Development workload is installed.');
            }
        }
    }

    async cloneRepository() {
        console.log('📥 Cloning whisper.cpp repository...');
        
        // Clean existing directory
        if (fs.existsSync(this.sourceDir)) {
            console.log(`Removing existing source directory: ${this.sourceDir}`);
            fs.rmSync(this.sourceDir, { recursive: true, force: true });
        }
        
        fs.mkdirSync(this.sourceDir, { recursive: true });
        
        return new Promise((resolve, reject) => {
            const gitProcess = spawn('git', [
                'clone',
                '--depth', '1',
                'https://github.com/ggerganov/whisper.cpp.git',
                this.sourceDir
            ], {
                stdio: 'inherit'
            });

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Repository cloned successfully');
                    resolve();
                } else {
                    reject(new Error(`Git clone failed with exit code ${code}`));
                }
            });

            gitProcess.on('error', (error) => {
                reject(new Error(`Git clone failed: ${error.message}`));
            });
        });
    }

    async configureBuild() {
        console.log('⚙️ Configuring CMake build with static linking...');
        
        const buildDir = path.join(this.sourceDir, 'build');
        
        // Ensure build directory exists
        if (!fs.existsSync(buildDir)) {
            fs.mkdirSync(buildDir, { recursive: true });
        }
        
        const cmakeArgs = [
            '-S', this.sourceDir,
            '-B', buildDir,
            '-A', this.architecture,
            `-DCMAKE_BUILD_TYPE=${this.buildType}`,
            // CMake options for static linking from the PowerShell script / whisperdesk-static.cmake
            '-DBUILD_SHARED_LIBS=OFF',
            `-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded${this.buildType === 'Debug' ? 'Debug' : ''}`,
            '-DWHISPER_BUILD_TESTS=OFF',
            '-DWHISPER_BUILD_EXAMPLES=ON', // Ensure whisper-cli is built
            '-DWHISPER_BUILD_SERVER=OFF',
            '-DCMAKE_POSITION_INDEPENDENT_CODE=OFF', // From whisperdesk-static.cmake

            // Optional dependencies disabled for minimal static build (from whisperdesk-static.cmake)
            '-DWHISPER_SDL2=OFF',
            '-DWHISPER_COREML=OFF',
            '-DWHISPER_OPENVINO=OFF',
            '-DWHISPER_CUDA=OFF',
            '-DWHISPER_VULKAN=OFF',
            '-DWHISPER_METAL=OFF'
        ];
        
        // Add optimization flags for release builds (from PowerShell and whisperdesk-static.cmake)
        // Note: The original JS example had slightly different flags.
        // Using a combination that aligns with both PS script and .cmake file for MSVC.
        if (this.buildType === 'Release' && os.platform() === 'win32') {
            cmakeArgs.push(
                '-DCMAKE_CXX_FLAGS_RELEASE=/MT /O2 /Ob2 /DNDEBUG /GL /Gy', // /Gy from .cmake
                '-DCMAKE_EXE_LINKER_FLAGS_RELEASE=/LTCG /OPT:REF /OPT:ICF'
            );
        } else if (this.buildType === 'Debug' && os.platform() === 'win32') {
             cmakeArgs.push('-DCMAKE_CXX_FLAGS_DEBUG=/MTd'); // from .cmake
        }
        
        // If this.configFile was defined and exists, could use:
        // cmakeArgs.push(`-DCMAKE_PROJECT_INCLUDE="${this.configFile}"`);

        console.log(`CMake arguments: ${cmakeArgs.join(' ')}`);

        return new Promise((resolve, reject) => {
            const cmakeProcess = spawn('cmake', cmakeArgs, {
                stdio: 'inherit',
                cwd: this.sourceDir // Should be this.sourceDir, not buildDir for -S . -B build
            });

            cmakeProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ CMake configuration completed successfully');
                    resolve();
                } else {
                    // Log CMake error files if they exist
                    const errorLogPath = path.join(buildDir, 'CMakeFiles', 'CMakeError.log');
                    const outputLogPath = path.join(buildDir, 'CMakeFiles', 'CMakeOutput.log');
                    if (fs.existsSync(errorLogPath)) {
                        console.error(`CMake Error Log (${errorLogPath}):
${fs.readFileSync(errorLogPath, 'utf8')}`);
                    }
                    if (fs.existsSync(outputLogPath)) {
                        console.error(`CMake Output Log (${outputLogPath}):
${fs.readFileSync(outputLogPath, 'utf8')}`);
                    }
                    reject(new Error(`CMake configuration failed with exit code ${code}`));
                }
            });

            cmakeProcess.on('error', (error) => {
                reject(new Error(`CMake configuration failed: ${error.message}`));
            });
        });
    }

    async buildProject() {
        console.log('🔨 Building whisper.cpp with static linking...');
        
        const buildDir = path.join(this.sourceDir, 'build');
        
        return new Promise((resolve, reject) => {
            const buildProcess = spawn('cmake', [
                '--build', buildDir,
                '--config', this.buildType,
                '--parallel' // Use available cores
            ], {
                stdio: 'inherit'
            });

            buildProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Build completed successfully');
                    resolve();
                } else {
                    reject(new Error(`Build failed with exit code ${code}`));
                }
            });
            
            buildProcess.on('error', (error) => {
                reject(new Error(`Build failed: ${error.message}`));
            });
        });
    }

    async validateAndCopyBinary() {
        console.log('🔍 Validating and copying binary...');

        const buildDir = path.join(this.sourceDir, 'build');
        // Adjusted paths based on common CMake output structures and the PowerShell script
        const binaryDirForRelease = path.join(buildDir, 'bin', this.buildType); // e.g., build/bin/Release/whisper-cli.exe
        const binaryDirSimple = path.join(buildDir, 'bin'); // e.g., build/bin/whisper-cli.exe

        const binaryName = os.platform() === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';

        const binaryPaths = [
            path.join(binaryDirForRelease, binaryName),
            path.join(binaryDirSimple, binaryName)
        ];

        let sourceBinary = null;
        for (const binaryPath of binaryPaths) {
            if (fs.existsSync(binaryPath)) {
                sourceBinary = binaryPath;
                break;
            }
        }

        if (!sourceBinary) {
            console.error(`Looked in: ${binaryPaths.join(', ')}`);
            // Try to list contents of bin directories to help debug
            if (fs.existsSync(binaryDirForRelease)) {
                console.log(`Contents of ${binaryDirForRelease}:`, fs.readdirSync(binaryDirForRelease));
            }
            if (fs.existsSync(binaryDirSimple)) {
                console.log(`Contents of ${binaryDirSimple}:`, fs.readdirSync(binaryDirSimple));
            }
            throw new Error(`${binaryName} not found in expected locations after build.`);
        }

        console.log(`✅ Found ${binaryName} binary: ${sourceBinary}`);

        // Test binary execution (especially for Windows access violation)
        if (os.platform() === 'win32') {
            console.log('🧪 Testing binary execution on Windows...');
            try {
                // The --help command might return a non-zero exit code, but should not crash.
                execSync(`"${sourceBinary}" --help`, { stdio: 'pipe', timeout: 15000 });
                console.log('✅ Binary test passed - whisper-cli executed successfully (checked --help)');
            } catch (error) {
                // error.status is the exit code on Windows
                if (error.status === 3221225501) { // 0xC0000005 Access Violation
                    throw new Error('Access violation error (0xC0000005) detected during binary test - static linking may have failed or there is another runtime issue.');
                }
                // Other non-zero exit codes for --help can be normal.
                console.log(`⚠️ Binary test for --help completed with exit code ${error.status} (this might be normal). Error output (if any): ${error.stderr?.toString()}`);
            }
        }

        // Copy to output directory
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }

        const destinationPath = path.join(this.outputDir, binaryName);
        fs.copyFileSync(sourceBinary, destinationPath);

        const stats = fs.statSync(destinationPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

        console.log(`✅ Binary copied to: ${destinationPath}`);
        console.log(`📊 Binary size: ${sizeMB} MB`);

        // Copy additional DLLs if they exist (as per PowerShell script)
        // This is more relevant if BUILD_SHARED_LIBS was ON, but good to keep.
        if (os.platform() === 'win32') {
            const additionalFiles = ["ggml.dll", "whisper.dll"];
            const sourceDllDir = path.dirname(sourceBinary); // DLLs are usually alongside the EXE
            additionalFiles.forEach(file => {
                const sourceFile = path.join(sourceDllDir, file);
                if (fs.existsSync(sourceFile)) {
                    const destFile = path.join(this.outputDir, file);
                    fs.copyFileSync(sourceFile, destFile);
                    console.log(`Copied additional file: ${file} to ${this.outputDir}`);
                }
            });
        }

        return destinationPath;
    }
    
    async cleanup() {
        console.log('🧹 Cleaning up temporary build directory...');
        if (fs.existsSync(this.sourceDir)) {
            fs.rmSync(this.sourceDir, { recursive: true, force: true });
            console.log(`✅ Temporary build directory ${this.sourceDir} removed.`);
        }
    }

    async build() {
        try {
            await this.validatePrerequisites();
            await this.cloneRepository();
            await this.configureBuild();
            await this.buildProject();
            const binaryPath = await this.validateAndCopyBinary();

            console.log('🎉 Static whisper.cpp build completed successfully!');
            console.log(`📍 Binary location: ${binaryPath}`);
            if (os.platform() === 'win32') {
                console.log('🔒 The binary should now run without requiring Visual C++ runtime installation.');
            }

            return binaryPath;
        } catch (error) {
            console.error(`❌ Build failed: ${error.message}`);
            // Log full error object for more details if available
            if (error.stack) {
                console.error(error.stack);
            }
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Export the class
module.exports = StaticWhisperBuilder;

// Example usage: To run this script directly for testing
if (require.main === module) {
    const options = {};
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--architecture' && i + 1 < args.length) {
            options.architecture = args[++i];
        } else if (args[i] === '--buildType' && i + 1 < args.length) {
            options.buildType = args[++i];
        } else if (args[i] === '--sourceDir' && i + 1 < args.length) {
            options.sourceDir = path.resolve(args[++i]);
        } else if (args[i] === '--outputDir' && i + 1 < args.length) {
            options.outputDir = path.resolve(args[++i]);
        }
    }
    
    const builder = new StaticWhisperBuilder(options);
    
    builder.build().catch(error => {
        // Error is already logged in the build method
        process.exit(1);
    });
}
```
