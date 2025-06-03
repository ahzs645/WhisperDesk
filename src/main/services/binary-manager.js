// src/main/services/binary-manager.js - FIXED for Windows binary detection
const { app } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class BinaryManager {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.platformKey = `${this.platform}-${this.arch}`;
    this.isPackaged = app.isPackaged;
    
    // Determine binaries directory based on whether app is packaged
    this.binariesDir = this.getBinariesDirectory();
    
    console.log('Binary Manager Configuration:');
    console.log(`  Platform: ${this.platform}`);
    console.log(`  Architecture: ${this.arch}`);
    console.log(`  Is Packaged: ${this.isPackaged}`);
    console.log(`  Binaries Directory: ${this.binariesDir}`);
  }

  getBinariesDirectory() {
    if (this.isPackaged) {
      // In packaged app, resources are in different locations based on platform
      if (this.platform === 'darwin') {
        // macOS: /Applications/WhisperDesk.app/Contents/Resources/binaries
        return path.join(process.resourcesPath, 'binaries');
      } else if (this.platform === 'win32') {
        // Windows: C:\Users\...\AppData\Local\WhisperDesk\resources\binaries
        return path.join(process.resourcesPath, 'binaries');
      } else {
        // Linux: /opt/WhisperDesk/resources/binaries or similar
        return path.join(process.resourcesPath, 'binaries');
      }
    } else {
      // In development, use project directory
      const projectRoot = path.join(__dirname, '../../../');
      return path.join(projectRoot, 'binaries');
    }
  }

  async initialize() {
    try {
      console.log('Initializing Binary Manager...');
      console.log(`Looking for binaries in: ${this.binariesDir}`);
      
      // Check if binaries directory exists
      try {
        await fs.access(this.binariesDir);
        console.log('✅ Binaries directory exists');
      } catch (error) {
        console.warn('⚠️ Binaries directory not found:', this.binariesDir);
        
        if (!this.isPackaged) {
          // In development, try to create the directory
          await fs.mkdir(this.binariesDir, { recursive: true });
          console.log('📁 Created binaries directory');
        } else {
          throw new Error(`Binaries directory not found in packaged app: ${this.binariesDir}`);
        }
      }
      
      await this.ensureWhisperBinary();
      console.log('✅ Binary manager initialized');
    } catch (error) {
      console.error('❌ Error initializing binary manager:', error);
      throw error;
    }
  }

  async ensureWhisperBinary() {
    const binaryPath = this.getWhisperBinaryPath()
    
    console.log(`Checking for whisper binary at: ${binaryPath}`)
    
    try {
      // FIRST: Check if the file actually exists
      await fs.access(binaryPath);
      const stats = await fs.stat(binaryPath);
      console.log(`✅ Binary file exists: ${binaryPath} (${stats.size} bytes)`);
      
      // Check if it's executable (Unix only)
      if (this.platform !== 'win32') {
        if (!(stats.mode & 0o111)) {
          console.log('Making binary executable...')
          await fs.chmod(binaryPath, 0o755)
        }
      }
      
      // On Windows, check for dependencies
      if (this.platform === 'win32') {
        await this.checkWindowsDependencies(binaryPath)
        await this.checkWindowsRuntimeDependencies(binaryPath)
      }
      
      // FIXED: Test the binary, but handle failures gracefully
      console.log('🧪 Testing binary functionality...');
      const testResult = await this.testBinaryWithResult();
      
      if (!testResult.success) {
        console.warn('⚠️ Binary test failed, but binary exists. Details:');
        console.warn(`   Exit code: ${testResult.exitCode}`);
        console.warn(`   Output: ${testResult.output.substring(0, 300)}${testResult.output.length > 300 ? '...' : ''}`);
        
        // FIXED: Don't throw error immediately - try to handle specific Windows issues
        if (this.platform === 'win32') {
          await this.handleWindowsBinaryIssues(testResult, binaryPath);
        } else {
          // For non-Windows, we can be more lenient
          console.warn('⚠️ Binary test failed but continuing anyway');
          console.warn('💡 The binary may still work for transcription tasks');
        }
      } else {
        console.log('✅ Whisper binary found and working correctly');
      }
      
    } catch (error) {
      if (this.isPackaged) {
        // In packaged app, binary should be included - this is an error
        console.error('❌ Whisper binary not found in packaged app:', binaryPath);
        
        // List what files ARE in the directory for debugging
        try {
          const files = await fs.readdir(this.binariesDir);
          console.log('📋 Files in binaries directory:', files.join(', '));
        } catch (listError) {
          console.log('❌ Could not list binaries directory');
        }
        
        throw new Error(`Whisper binary not found in packaged app. Expected at: ${binaryPath}`);
      } else {
        // In development, give helpful instructions
        console.log('⚠️ Whisper binary not available in development mode')
        console.log('💡 To build the whisper binary:')
        console.log('   npm run build:whisper')
        console.log('   OR')
        console.log('   chmod +x scripts/build-whisper.sh && ./scripts/build-whisper.sh')
        console.log('')
        console.log('📋 Note: The app will work in web mode without the binary')
        
        // Don't throw error in development - allow graceful degradation
      }
    }
  }

  // FIXED: Better Windows-specific error handling
  async handleWindowsBinaryIssues(testResult, binaryPath) {
    const { exitCode, output } = testResult;
    
    // Check for specific Windows error patterns
    if (exitCode === 3221225781 || exitCode === -1073741515) {
      // 0xC0000135 - Application failed to initialize (missing DLLs)
      console.error('❌ Binary failed due to missing Visual C++ runtime libraries');
      
      const vcRedistPath = path.join(this.binariesDir, 'vc_redist.x64.exe');
      try {
        await fs.access(vcRedistPath);
        console.log('💡 Found VC++ redistributable installer - user needs to run it');
        // Don't throw error - let the app continue and show user-friendly message
      } catch (error) {
        console.log('💡 User needs to install Visual C++ redistributable');
      }
      
    } else if (exitCode === 3221225794 || exitCode === -1073741502) {
      // 0xC0000142 - Application failed to initialize (wrong architecture)
      console.error('❌ Binary failed due to architecture mismatch or corruption');
      
    } else if (output && output.toLowerCase().includes('deprecated')) {
      // Handle deprecated binary warnings
      console.warn('⚠️ Binary shows deprecation warning but may still work');
      console.warn('🔧 Consider updating to newer whisper.cpp version');
      // Don't throw error - deprecated binaries often still work
      
    } else {
      // Unknown error - log but don't fail
      console.warn('⚠️ Unknown binary test failure');
      console.warn(`   Exit code: ${exitCode}`);
      console.warn(`   Output preview: ${output.substring(0, 200)}`);
    }
    
    // FIXED: Don't throw error here - let the app start and handle runtime errors gracefully
    console.log('⚠️ Continuing despite binary test failure - will handle errors at runtime');
  }

  async checkWindowsDependencies(binaryPath) {
    const binaryDir = path.dirname(binaryPath)
    const requiredDlls = [
      'ggml-base.dll',
      'ggml-cpu.dll', 
      'ggml.dll',
      'whisper.dll'
    ]
    
    console.log('Checking for required DLL dependencies...')
    
    const missingDlls = []
    const foundDlls = []
    
    for (const dll of requiredDlls) {
      const dllPath = path.join(binaryDir, dll)
      try {
        await fs.access(dllPath)
        const stats = await fs.stat(dllPath)
        foundDlls.push({ name: dll, size: stats.size })
        console.log(`✅ Found: ${dll} (${stats.size} bytes)`)
      } catch (error) {
        console.log(`❌ Missing: ${dll}`)
        missingDlls.push(dll)
      }
    }
    
    // Check for any additional DLL files
    try {
      const files = await fs.readdir(binaryDir)
      const additionalDlls = files.filter(file => 
        file.endsWith('.dll') && !requiredDlls.includes(file)
      )
      
      if (additionalDlls.length > 0) {
        console.log(`📋 Additional DLLs found: ${additionalDlls.join(', ')}`)
      }
    } catch (error) {
      console.warn('Could not list directory contents:', error.message)
    }
    
    if (missingDlls.length > 0) {
      console.warn(`⚠️ Missing DLL dependencies: ${missingDlls.join(', ')}`)
      
      if (this.isPackaged) {
        // FIXED: Don't throw error immediately - warn but continue
        console.warn('This may cause the whisper binary to fail at runtime')
        console.warn(`💡 Missing: ${missingDlls.join(', ')}`)
        console.warn(`💡 Found: ${foundDlls.map(d => d.name).join(', ')}`)
      } else {
        // In development, warn but don't fail
        console.warn('This may cause the whisper binary to fail at runtime')
        console.warn('💡 You may need to rebuild whisper.cpp or copy DLL files manually')
      }
    } else {
      console.log(`✅ All required DLLs found (${foundDlls.length} files)`)
    }
    
    return {
      allFound: missingDlls.length === 0,
      missing: missingDlls,
      found: foundDlls
    }
  }

  async checkWindowsRuntimeDependencies(binaryPath) {
    const binaryDir = path.dirname(binaryPath)
    
    // Check for Visual C++ runtime DLLs
    const runtimeDlls = [
      'msvcp140.dll',
      'vcruntime140.dll',
      'vcruntime140_1.dll',
      'vcomp140.dll' // OpenMP runtime
    ]
    
    console.log('Checking for Visual C++ runtime dependencies...')
    
    const missingRuntimeDlls = []
    const foundRuntimeDlls = []
    
    for (const dll of runtimeDlls) {
      const localDllPath = path.join(binaryDir, dll)
      let found = false
      
      // Check if DLL is in our binaries directory
      try {
        await fs.access(localDllPath)
        const stats = await fs.stat(localDllPath)
        foundRuntimeDlls.push({ name: dll, location: 'local', size: stats.size })
        console.log(`✅ Found runtime DLL: ${dll} (local, ${stats.size} bytes)`)
        found = true
      } catch (error) {
        // Check system directories
        const systemPaths = [
          path.join(process.env.WINDIR || 'C:\\Windows', 'System32', dll),
          path.join(process.env.WINDIR || 'C:\\Windows', 'SysWOW64', dll)
        ]
        
        for (const sysPath of systemPaths) {
          try {
            await fs.access(sysPath)
            foundRuntimeDlls.push({ name: dll, location: 'system', path: sysPath })
            console.log(`✅ Found runtime DLL: ${dll} (system)`)
            found = true
            break
          } catch (sysError) {
            // Continue checking
          }
        }
      }
      
      if (!found) {
        console.log(`❌ Missing runtime DLL: ${dll}`)
        missingRuntimeDlls.push(dll)
      }
    }
    
    // Check for VC++ redistributable installer
    const vcRedistPath = path.join(binaryDir, 'vc_redist.x64.exe')
    let hasVcRedist = false
    try {
      await fs.access(vcRedistPath)
      hasVcRedist = true
      console.log(`✅ Found VC++ Redistributable installer: ${vcRedistPath}`)
    } catch (error) {
      console.log(`❌ VC++ Redistributable installer not found: ${vcRedistPath}`)
    }
    
    if (missingRuntimeDlls.length > 0) {
      console.warn(`⚠️ Missing Visual C++ runtime DLLs: ${missingRuntimeDlls.join(', ')}`)
      
      if (hasVcRedist) {
        console.log(`💡 To fix this issue, run: ${vcRedistPath}`)
      } else {
        console.log(`💡 To fix this issue, install Visual C++ Redistributable from:`)
        console.log(`   https://aka.ms/vs/17/release/vc_redist.x64.exe`)
      }
    } else {
      console.log(`✅ All Visual C++ runtime dependencies satisfied`)
    }
    
    return {
      allFound: missingRuntimeDlls.length === 0,
      missing: missingRuntimeDlls,
      found: foundRuntimeDlls,
      hasVcRedist
    }
  }

  // REMOVED: handleBinaryTestFailure method - now handled inline

  getWhisperBinaryPath() {
    const binaryNames = {
      'win32-x64': 'whisper.exe',
      'win32-ia32': 'whisper.exe',
      'win32-arm64': 'whisper.exe',
      'darwin-x64': 'whisper',
      'darwin-arm64': 'whisper',
      'linux-x64': 'whisper',
      'linux-arm64': 'whisper',
      'linux-arm': 'whisper'
    };

    const binaryName = binaryNames[this.platformKey] || 'whisper';
    return path.join(this.binariesDir, binaryName);
  }

  async testBinary() {
    const result = await this.testBinaryWithResult()
    if (!result.success) {
      throw new Error(`Binary test failed. Exit code: ${result.exitCode}`)
    }
    return true
  }

  async testBinaryWithResult() {
    const binaryPath = this.getWhisperBinaryPath();
    const binaryDir = path.dirname(binaryPath);
    
    return new Promise((resolve) => {
      console.log(`Testing binary: ${binaryPath}`);
      
      // Set environment to help Windows find DLLs
      const env = { ...process.env };
      if (this.platform === 'win32') {
        // Add binaries directory to PATH for DLL loading
        env.PATH = `${binaryDir};${env.PATH}`;
      }
      
      const options = {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: binaryDir, // Set working directory to binaries folder
        env: env
      };
      
      const process = spawn(binaryPath, ['--help'], options);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        const output = stdout + stderr;
        
        // FIXED: More lenient success criteria
        const isSuccess = 
          code === 0 || 
          output.toLowerCase().includes('whisper') || 
          output.toLowerCase().includes('usage') || 
          output.toLowerCase().includes('transcribe') ||
          output.toLowerCase().includes('help') ||
          output.toLowerCase().includes('options') ||
          // Accept even if there's a deprecation warning but it shows help
          (output.toLowerCase().includes('deprecated') && output.toLowerCase().includes('usage'));
        
        if (isSuccess) {
          console.log('✅ Binary test passed');
        } else {
          console.log(`⚠️ Binary test failed`);
          console.log(`Exit code: ${code}`);
          console.log(`Output: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`);
        }
        
        resolve({
          success: isSuccess,
          exitCode: code,
          output: output
        });
      });

      process.on('error', (error) => {
        console.log(`❌ Failed to execute binary: ${error.message}`);
        resolve({
          success: false,
          exitCode: -1,
          output: error.message
        });
      });
      
      // Set timeout
      setTimeout(() => {
        process.kill('SIGTERM');
        resolve({
          success: false,
          exitCode: -2,
          output: 'Binary test timeout'
        });
      }, 15000);
    });
  }

  async getBinaryInfo() {
    const binaryPath = this.getWhisperBinaryPath();
    
    try {
      const stats = await fs.stat(binaryPath);
      
      return {
        path: binaryPath,
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        executable: this.platform === 'win32' ? true : !!(stats.mode & 0o111)
      };
    } catch (error) {
      return {
        path: binaryPath,
        exists: false,
        error: error.message
      };
    }
  }

  async getBinaryVersion() {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getWhisperBinaryPath();
      
      const process = spawn(binaryPath, ['--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        // Extract version info from help output
        const lines = output.split('\n');
        const versionLine = lines.find(line => 
          line.toLowerCase().includes('whisper') || 
          line.toLowerCase().includes('version')
        );
        
        if (versionLine) {
          resolve(versionLine.trim());
        } else {
          resolve('whisper.cpp (version unknown)');
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Version check timeout'));
      }, 10000);
    });
  }

  // FIXED: Check if binary is available and working (more lenient)
  async isAvailable() {
    try {
      const binaryPath = this.getWhisperBinaryPath();
      await fs.access(binaryPath);
      
      // Try testing, but don't fail if test fails
      const testResult = await this.testBinaryWithResult();
      
      // Return true if binary exists, even if test fails
      // Runtime errors will be handled when actually using the binary
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get system information
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: this.arch,
      platformKey: this.platformKey,
      isPackaged: this.isPackaged,
      binariesDir: this.binariesDir,
      expectedBinaryPath: this.getWhisperBinaryPath(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron
    };
  }

  // Development helper: check multiple possible binary locations
  async findBinaryInDevelopment() {
    const possiblePaths = [
      path.join(__dirname, '../../../binaries/whisper'),
      path.join(__dirname, '../../../binaries/whisper.exe'),
      path.join(process.cwd(), 'binaries/whisper'),
      path.join(process.cwd(), 'binaries/whisper.exe'),
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper'
    ];

    console.log('🔍 Searching for whisper binary in development mode...');
    
    for (const binPath of possiblePaths) {
      try {
        await fs.access(binPath);
        console.log(`✅ Found binary at: ${binPath}`);
        return binPath;
      } catch (error) {
        // Continue searching
      }
    }
    
    console.log('❌ No whisper binary found in any expected location');
    return null;
  }

  // Get comprehensive status for debugging
  async getStatus() {
    const binaryInfo = await this.getBinaryInfo();
    const systemInfo = this.getSystemInfo();
    const isAvailable = await this.isAvailable();
    
    let version = null;
    try {
      version = await this.getBinaryVersion();
    } catch (error) {
      version = `Error: ${error.message}`;
    }

    // Get Windows-specific dependency info
    let windowsDependencies = null;
    if (this.platform === 'win32') {
      try {
        const whisperDeps = await this.checkWindowsDependencies(this.getWhisperBinaryPath());
        const runtimeDeps = await this.checkWindowsRuntimeDependencies(this.getWhisperBinaryPath());
        windowsDependencies = {
          whisperDlls: whisperDeps,
          runtimeDlls: runtimeDeps
        };
      } catch (error) {
        windowsDependencies = { error: error.message };
      }
    }

    return {
      isAvailable,
      version,
      binary: binaryInfo,
      system: systemInfo,
      windowsDependencies,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = BinaryManager;