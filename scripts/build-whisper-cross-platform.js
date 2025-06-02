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
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function buildWhisper() {
  try {
    const scriptsDir = path.join(__dirname);
    
    if (platform === 'win32') {
      // Windows - use PowerShell script
      const psScript = path.join(scriptsDir, 'build-whisper.ps1');
      
      if (!fs.existsSync(psScript)) {
        throw new Error(`PowerShell script not found: ${psScript}`);
      }
      
      console.log('🪟 Using PowerShell script for Windows');
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
      
      console.log('🐧 Using bash script for Unix-like systems');
      
      // Make script executable
      try {
        fs.chmodSync(bashScript, '755');
      } catch (error) {
        console.warn('Warning: Could not make script executable:', error.message);
      }
      
      await runScript('bash', [bashScript]);
    }
    
    console.log('');
    console.log('✅ 🎉 Whisper.cpp build completed successfully!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Build failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting:');
    
    if (platform === 'win32') {
      console.error('   1. Make sure PowerShell is available');
      console.error('   2. Install Visual Studio Build Tools');
      console.error('   3. Install CMake: winget install Kitware.CMake');
    } else {
      console.error('   1. Make sure bash is available');
      console.error('   2. Install build tools (make, cmake)');
      console.error('   3. On macOS: xcode-select --install');
      console.error('   4. On Ubuntu: sudo apt-get install build-essential cmake');
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
console.log('');

buildWhisper();