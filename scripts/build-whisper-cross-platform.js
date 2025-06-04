// scripts/build-whisper-cross-platform.js - Cross-platform whisper.cpp build script

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Cross-platform whisper.cpp build script');
console.log('===========================================');

const platform = process.platform;
console.log(`Platform detected: ${platform}`);

function runScript(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const processToRun = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    processToRun.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    processToRun.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildWhisper() {
  try {
    const scriptsDir = __dirname; // Correctly refers to the 'scripts' directory
    
    if (platform === 'win32') {
      // Windows - use new PowerShell compilation script
      const psScript = path.join(scriptsDir, 'compile-whisper-windows.ps1');
      
      if (!fs.existsSync(psScript)) {
        throw new Error(`PowerShell compilation script not found: ${psScript}`);
      }
      
      console.log('🪟 Using PowerShell script for Windows compilation: compile-whisper-windows.ps1');
      await runScript('powershell', [
        '-ExecutionPolicy', 'Bypass',
        '-File', psScript
      ]);
      
    } else {
      // Unix-like (macOS, Linux) - use bash script
      const bashScript = path.join(scriptsDir, 'build-whisper.sh');
      
      if (!fs.existsSync(bashScript)) {
        throw new Error(`Bash script not found: ${bashScript}`);
      }
      
      console.log('🐧 Using bash script for Unix-like systems: build-whisper.sh');
      
      // Make script executable (already in original script, good to keep)
      try {
        fs.chmodSync(bashScript, '755'); // Changed from '0755' to '755' (string format for mode)
      } catch (error) {
        console.warn('Warning: Could not make script executable:', error.message);
      }
      
      await runScript('bash', [bashScript]);
    }
    
    console.log('');
    console.log('✅ 🎉 Whisper.cpp build completed successfully via cross-platform script!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Build failed via cross-platform script:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    
    if (platform === 'win32') {
      console.error('   1. Make sure PowerShell is available.');
      console.error('   2. Ensure Visual Studio Build Tools (with C++ workload) and CMake are installed and in PATH.');
      console.error('   3. Check logs from compile-whisper-windows.ps1 for specific errors.');
    } else {
      console.error('   1. Make sure bash is available.');
      console.error('   2. Install build tools (make, cmake, C++ compiler like gcc/clang).');
      console.error('   3. On macOS: Ensure Xcode Command Line Tools are installed (xcode-select --install).');
      console.error('   4. On Linux: Ensure build-essential and cmake are installed.');
      console.error('   5. Check logs from build-whisper.sh for specific errors.');
    }
    
    process.exit(1);
  }
}

// Show environment info
console.log('');
console.log('Environment Information:');
console.log(`  Node.js: ${process.version}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  Architecture: ${process.arch}`);
console.log(`  Working Directory: ${process.cwd()}`);
console.log(`  Scripts Directory: ${__dirname}`);
console.log('');

buildWhisper();