// scripts/build-whisper-official.js - Cross-platform build using official method

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 WhisperDesk Official Build Script');
console.log('===================================');

const platform = process.platform;
console.log(`Platform detected: ${platform}`);

function runScript(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const processToRun = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
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
    const scriptsDir = __dirname;
    
    if (platform === 'win32') {
      // Windows - use official DLL-based build
      const psScript = path.join(scriptsDir, 'build-whisper-official-windows.ps1');
      
      if (!fs.existsSync(psScript)) {
        throw new Error(`PowerShell script not found: ${psScript}`);
      }
      
      console.log('🪟 Using official DLL-based build for Windows');
      console.log('📋 This will create: whisper.dll, ggml.dll, ggml-base.dll, ggml-cpu.dll, SDL2.dll, main.exe');
      
      await runScript('powershell', [
        '-ExecutionPolicy', 'Bypass',
        '-File', psScript
      ]);
      
    } else {
      // Unix-like (macOS, Linux) - use existing static build (it works!)
      const bashScript = path.join(scriptsDir, 'build-whisper.sh');
      
      if (!fs.existsSync(bashScript)) {
        throw new Error(`Bash script not found: ${bashScript}`);
      }
      
      console.log('🐧 Using static build for Unix-like systems (proven to work)');
      console.log('📋 This will create: whisper-cli (single static binary)');
      
      // Make script executable
      try {
        fs.chmodSync(bashScript, '755');
      } catch (error) {
        console.warn('Warning: Could not make script executable:', error.message);
      }
      
      await runScript('bash', [bashScript]);
    }
    
    console.log('');
    console.log('✅ 🎉 Whisper build completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Download models: npm run download:model:tiny');
    console.log('   2. Build the app: npm run dist');
    console.log('   3. Test transcription: npm run test:transcription');
    
  } catch (error) {
    console.error('');
    console.error('❌ Build failed:', error.message);
    console.error('');
    console.error('🔧 Platform-specific troubleshooting:');
    
    if (platform === 'win32') {
      console.error('   Windows (DLL method):');
      console.error('   1. Install Visual Studio Build Tools with C++ workload');
      console.error('   2. Install CMake and add to PATH');
      console.error('   3. Make sure PowerShell execution policy allows scripts');
      console.error('   4. Check internet connection for SDL2 download');
      console.error('');
      console.error('   Required tools:');
      console.error('   - Visual Studio Build Tools (MSBuild)');
      console.error('   - CMake 3.15+');
      console.error('   - Git');
      console.error('   - PowerShell');
    } else {
      console.error('   Unix-like systems (Static method):');
      console.error('   1. Install build tools (make, cmake, C++ compiler)');
      console.error('   2. On macOS: xcode-select --install');
      console.error('   3. On Linux: sudo apt install build-essential cmake');
      console.error('   4. Check internet connection for whisper.cpp download');
      console.error('');
      console.error('   Required tools:');
      console.error('   - CMake 3.15+');
      console.error('   - GCC/Clang compiler');
      console.error('   - Git');
      console.error('   - Make');
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

if (platform === 'win32') {
  console.log('');
  console.log('🪟 Windows Build Strategy:');
  console.log('   - Use official whisper.cpp build method');
  console.log('   - Create DLL-based binaries (whisper.dll + dependencies)');
  console.log('   - Include SDL2 for audio support');
  console.log('   - Follow official GitHub Actions workflow');
} else {
  console.log('');
  console.log('🐧 Unix-like Build Strategy:');
  console.log('   - Use proven static build method');
  console.log('   - Create single self-contained binary');
  console.log('   - No external dependencies');
  console.log('   - Maintain existing working approach');
}

console.log('');

buildWhisper();