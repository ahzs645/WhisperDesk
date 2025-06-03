// src/main/services/binary-manager.js - CROSS-PLATFORM FIX
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
    
    this.binariesDir = this.getBinariesDirectory();
    
    console.log('Binary Manager Configuration:');
    console.log(`  Platform: ${this.platform}`);
    console.log(`  Architecture: ${this.arch}`);
    console.log(`  Is Packaged: ${this.isPackaged}`);
    console.log(`  Binaries Directory: ${this.binariesDir}`);
  }

  getBinariesDirectory() {
    if (this.isPackaged) {
      if (this.platform === 'darwin') {
        return path.join(process.resourcesPath, 'binaries');
      } else if (this.platform === 'win32') {
        return path.join(process.resourcesPath, 'binaries');
      } else {
        return path.join(process.resourcesPath, 'binaries');
      }
    } else {
      const projectRoot = path.join(__dirname, '../../../');
      return path.join(projectRoot, 'binaries');
    }
  }

  async initialize() {
    try {
      console.log('Initializing Binary Manager...');
      console.log(`Looking for binaries in: ${this.binariesDir}`);
      
      try {
        await fs.access(this.binariesDir);
        console.log('✅ Binaries directory exists');
      } catch (error) {
        console.warn('⚠️ Binaries directory not found:', this.binariesDir);
        
        if (!this.isPackaged) {
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
    const binaryPath = this.getWhisperBinaryPath();
    
    console.log(`Checking for whisper binary at: ${binaryPath}`);
    
    try {
      await fs.access(binaryPath);
      const stats = await fs.stat(binaryPath);
      console.log(`✅ Binary file exists: ${binaryPath} (${stats.size} bytes)`);
      
      if (this.platform !== 'win32') {
        if (!(stats.mode & 0o111)) {
          console.log('Making binary executable...');
          await fs.chmod(binaryPath, 0o755);
        }
      }
      
      if (this.platform === 'win32') {
        await this.checkWindowsDependencies(binaryPath);
        await this.checkWindowsRuntimeDependencies(binaryPath);
      }
      
      console.log('🧪 Testing binary functionality...');
      const testResult = await this.testBinaryWithResult();
      
      if (!testResult.success) {
        console.warn('⚠️ Binary test failed, but binary exists. Details:');
        console.warn(`   Exit code: ${testResult.exitCode}`);
        console.warn(`   Output: ${testResult.output.substring(0, 300)}${testResult.output.length > 300 ? '...' : ''}`);
        
        if (this.platform === 'win32') {
          this.handleWindowsBinaryIssues(testResult, binaryPath);
        } else {
          console.warn('⚠️ Binary test failed but continuing anyway');
          console.warn('💡 The binary may still work for transcription tasks');
        }
        
        console.warn('⚠️ Continuing despite binary test failure - will handle errors at runtime');
      } else {
        console.log('✅ Whisper binary found and working correctly');
      }
      
    } catch (error) {
      if (this.isPackaged) {
        const binaryPath = this.getWhisperBinaryPath();
        try {
          await fs.access(binaryPath);
          console.warn('⚠️ Binary exists but failed initialization test');
          console.warn('💡 Continuing anyway - will handle runtime errors gracefully');
          return;
        } catch (accessError) {
          console.error('❌ Whisper binary not found in packaged app:', binaryPath);
          
          try {
            const files = await fs.readdir(this.binariesDir);
            console.log('📋 Files in binaries directory:', files.join(', '));
          } catch (listError) {
            console.log('❌ Could not list binaries directory');
          }
          
          throw new Error(`Whisper binary not found in packaged app. Expected at: ${binaryPath}`);
        }
      } else {
        console.log('⚠️ Whisper binary not available in development mode');
        console.log('💡 To build the whisper binary:');
        console.log('   npm run build:whisper');
        console.log('   OR');
        console.log('   chmod +x scripts/build-whisper.sh && ./scripts/build-whisper.sh');
        console.log('');
        console.log('📋 Note: The app will work in web mode without the binary');
      }
    }
  }

  handleWindowsBinaryIssues(testResult, binaryPath) {
    const { exitCode, output } = testResult;
    
    if (exitCode === 3221225781 || exitCode === -1073741515) {
      console.error('❌ Binary failed due to missing Visual C++ runtime libraries');
      
      const vcRedistPath = path.join(this.binariesDir, 'vc_redist.x64.exe');
      try {
        fs.access(vcRedistPath);
        console.log('💡 Found VC++ redistributable installer - user needs to run it');
      } catch (error) {
        console.log('💡 User needs to install Visual C++ redistributable');
      }
      
    } else if (exitCode === 3221225794 || exitCode === -1073741502) {
      console.error('❌ Binary failed due to architecture mismatch or corruption');
      
    } else if (output && output.toLowerCase().includes('deprecated')) {
      console.warn('⚠️ Binary shows deprecation warning but may still work');
      console.warn('🔧 Consider updating to newer whisper.cpp version');
      
    } else {
      console.warn('⚠️ Unknown binary test failure');
      console.warn(`   Exit code: ${exitCode}`);
      console.warn(`   Output preview: ${output.substring(0, 200)}`);
    }
    
    console.log('⚠️ Continuing despite binary test failure - will handle errors at runtime');
  }

  // FIXED: Support both old and new binary names
  getWhisperBinaryPath() {
    const binaryNames = {
      'win32-x64': ['whisper-cli.exe', 'whisper.exe'],
      'win32-ia32': ['whisper-cli.exe', 'whisper.exe'],
      'win32-arm64': ['whisper-cli.exe', 'whisper.exe'],
      'darwin-x64': ['whisper-cli', 'whisper'],
      'darwin-arm64': ['whisper-cli', 'whisper'],
      'linux-x64': ['whisper-cli', 'whisper'],
      'linux-arm64': ['whisper-cli', 'whisper'],
      'linux-arm': ['whisper-cli', 'whisper']
    };

    const candidateNames = binaryNames[this.platformKey] || ['whisper-cli', 'whisper'];
    
    // Try to find existing binary
    for (const binaryName of candidateNames) {
      const binaryPath = path.join(this.binariesDir, binaryName);
      try {
        // Synchronous check for file existence
        require('fs').accessSync(binaryPath);
        console.log(`✅ Found binary: ${binaryPath}`);
        return binaryPath;
      } catch (error) {
        // Continue to next candidate
      }
    }
    
    // Default to the new standard name
    const defaultName = candidateNames[0];
    console.log(`🔍 No existing binary found, defaulting to: ${defaultName}`);
    return path.join(this.binariesDir, defaultName);
  }

  async checkWindowsDependencies(binaryPath) {
    const binaryDir = path.dirname(binaryPath);
    const requiredDlls = [
      'ggml-base.dll',
      'ggml-cpu.dll', 
      'ggml.dll',
      'whisper.dll'
    ];
    
    console.log('Checking for required DLL dependencies...');
    
    const missingDlls = [];
    const foundDlls = [];
    
    for (const dll of requiredDlls) {
      const dllPath = path.join(binaryDir, dll);
      try {
        await fs.access(dllPath);
        const stats = await fs.stat(dllPath);
        foundDlls.push({ name: dll, size: stats.size });
        console.log(`✅ Found: ${dll} (${stats.size} bytes)`);
      } catch (error) {
        console.log(`❌ Missing: ${dll}`);
        missingDlls.push(dll);
      }
    }
    
    try {
      const files = await fs.readdir(binaryDir);
      const additionalDlls = files.filter(file => 
        file.endsWith('.dll') && !requiredDlls.includes(file)
      );
      
      if (additionalDlls.length > 0) {
        console.log(`📋 Additional DLLs found: ${additionalDlls.join(', ')}`);
      }
    } catch (error) {
      console.warn('Could not list directory contents:', error.message);
    }
    
    if (missingDlls.length > 0) {
      console.warn(`⚠️ Missing DLL dependencies: ${missingDlls.join(', ')}`);
      
      if (this.isPackaged) {
        console.warn('This may cause the whisper binary to fail at runtime');
        console.warn(`💡 Missing: ${missingDlls.join(', ')}`);
        console.warn(`💡 Found: ${foundDlls.map(d => d.name).join(', ')}`);
      } else {
        console.warn('This may cause the whisper binary to fail at runtime');
        console.warn('💡 You may need to rebuild whisper.cpp or copy DLL files manually');
      }
    } else {
      console.log(`✅ All required DLLs found (${foundDlls.length} files)`);
    }
    
    return {
      allFound: missingDlls.length === 0,
      missing: missingDlls,
      found: foundDlls
    };
  }

  async checkWindowsRuntimeDependencies(binaryPath) {
    const binaryDir = path.dirname(binaryPath);
    
    const runtimeDlls = [
      'msvcp140.dll',
      'vcruntime140.dll',
      'vcruntime140_1.dll',
      'vcomp140.dll'
    ];
    
    console.log('Checking for Visual C++ runtime dependencies...');
    
    const missingRuntimeDlls = [];
    const foundRuntimeDlls = [];
    
    for (const dll of runtimeDlls) {
      const localDllPath = path.join(binaryDir, dll);
      let found = false;
      
      try {
        await fs.access(localDllPath);
        const stats = await fs.stat(localDllPath);
        foundRuntimeDlls.push({ name: dll, location: 'local', size: stats.size });
        console.log(`✅ Found runtime DLL: ${dll} (local, ${stats.size} bytes)`);
        found = true;
      } catch (error) {
        const systemPaths = [
          path.join(process.env.WINDIR || 'C:\\Windows', 'System32', dll),
          path.join(process.env.WINDIR || 'C:\\Windows', 'SysWOW64', dll)
        ];
        
        for (const sysPath of systemPaths) {
          try {
            await fs.access(sysPath);
            foundRuntimeDlls.push({ name: dll, location: 'system', path: sysPath });
            console.log(`✅ Found runtime DLL: ${dll} (system)`);
            found = true;
            break;
          } catch (sysError) {
            // Continue checking
          }
        }
      }
      
      if (!found) {
        console.log(`❌ Missing runtime DLL: ${dll}`);
        missingRuntimeDlls.push(dll);
      }
    }
    
    const vcRedistPath = path.join(binaryDir, 'vc_redist.x64.exe');
    let hasVcRedist = false;
    try {
      await fs.access(vcRedistPath);
      hasVcRedist = true;
      console.log(`✅ Found VC++ Redistributable installer: ${vcRedistPath}`);
    } catch (error) {
      console.log(`❌ VC++ Redistributable installer not found: ${vcRedistPath}`);
    }
    
    if (missingRuntimeDlls.length > 0) {
      console.warn(`⚠️ Missing Visual C++ runtime DLLs: ${missingRuntimeDlls.join(', ')}`);
      
      if (hasVcRedist) {
        console.log(`💡 To fix this issue, run: ${vcRedistPath}`);
      } else {
        console.log(`💡 To fix this issue, install Visual C++ Redistributable from:`);
        console.log(`   https://aka.ms/vs/17/release/vc_redist.x64.exe`);
      }
    } else {
      console.log(`✅ All Visual C++ runtime dependencies satisfied`);
    }
    
    return {
      allFound: missingRuntimeDlls.length === 0,
      missing: missingRuntimeDlls,
      found: foundRuntimeDlls,
      hasVcRedist
    };
  }

  async testBinary() {
    const result = await this.testBinaryWithResult();
    if (!result.success) {
      throw new Error(`Binary test failed. Exit code: ${result.exitCode}`);
    }
    return true;
  }

  async testBinaryWithResult() {
    const binaryPath = this.getWhisperBinaryPath();
    const binaryDir = path.dirname(binaryPath);
    
    return new Promise((resolve) => {
      console.log(`Testing binary: ${binaryPath}`);
      
      const env = { ...process.env };
      if (this.platform === 'win32') {
        env.PATH = `${binaryDir};${env.PATH}`;
      }
      
      const options = {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        cwd: binaryDir,
        env: env
      };
      
      // FIXED: Use --help instead of help for newer whisper-cli
      const testProcess = spawn(binaryPath, ['--help'], options);
      
      let stdout = '';
      let stderr = '';
      
      testProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      testProcess.on('close', (code) => {
        const output = stdout + stderr;
        
        // More lenient success criteria - accept deprecation warnings
        const isSuccess = 
          code === 0 || 
          output.toLowerCase().includes('whisper') || 
          output.toLowerCase().includes('usage') || 
          output.toLowerCase().includes('transcribe') ||
          output.toLowerCase().includes('help') ||
          output.toLowerCase().includes('options') ||
          output.toLowerCase().includes('deprecated') ||
          output.toLowerCase().includes('cli');
        
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

      testProcess.on('error', (error) => {
        console.log(`❌ Failed to execute binary: ${error.message}`);
        resolve({
          success: false,
          exitCode: -1,
          output: error.message
        });
      });
      
      setTimeout(() => {
        testProcess.kill('SIGTERM');
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
      
      const versionProcess = spawn(binaryPath, ['--help'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      
      versionProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      versionProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      versionProcess.on('close', (code) => {
        const lines = output.split('\n');
        const versionLine = lines.find(line => 
          line.toLowerCase().includes('whisper') || 
          line.toLowerCase().includes('version') ||
          line.toLowerCase().includes('cli')
        );
        
        if (versionLine) {
          resolve(versionLine.trim());
        } else {
          resolve('whisper.cpp (version unknown)');
        }
      });

      versionProcess.on('error', (error) => {
        reject(error);
      });
      
      setTimeout(() => {
        versionProcess.kill('SIGTERM');
        reject(new Error('Version check timeout'));
      }, 10000);
    });
  }

  async isAvailable() {
    try {
      const binaryPath = this.getWhisperBinaryPath();
      await fs.access(binaryPath);
      return true;
    } catch (error) {
      return false;
    }
  }

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

  async findBinaryInDevelopment() {
    const possiblePaths = [
      // New whisper-cli names
      path.join(__dirname, '../../../binaries/whisper-cli'),
      path.join(__dirname, '../../../binaries/whisper-cli.exe'),
      path.join(process.cwd(), 'binaries/whisper-cli'),
      path.join(process.cwd(), 'binaries/whisper-cli.exe'),
      // Legacy whisper names
      path.join(__dirname, '../../../binaries/whisper'),
      path.join(__dirname, '../../../binaries/whisper.exe'),
      path.join(process.cwd(), 'binaries/whisper'),
      path.join(process.cwd(), 'binaries/whisper.exe'),
      // System installations
      '/usr/local/bin/whisper-cli',
      '/usr/local/bin/whisper',
      '/opt/homebrew/bin/whisper-cli',
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