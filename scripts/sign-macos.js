#!/usr/bin/env node
// scripts/sign-macos.js - Custom macOS signing script for electron-builder

const { execSync } = require('child_process');
const path = require('path');

async function signMacOS(appPath) {
  console.log('🔐 Ad-hoc signing macOS app:', path.basename(appPath));
  
  try {
    // Ad-hoc sign the app and all nested executables
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    
    // Sign specific binaries if they exist
    const binaries = ['whisper-cli', 'diarize-cli'];
    for (const binary of binaries) {
      const binaryPath = path.join(appPath, 'Contents', 'Resources', 'binaries', binary);
      try {
        execSync(`codesign --force --sign - "${binaryPath}"`, { stdio: 'pipe' });
        console.log(`✅ Signed binary: ${binary}`);
      } catch (e) {
        console.log(`ℹ️ Binary not found or already signed: ${binary}`);
      }
    }
    
    console.log('✅ macOS app ad-hoc signed successfully');
  } catch (error) {
    console.warn('⚠️ macOS signing failed (non-critical):', error.message);
  }
}

// CLI usage
if (require.main === module) {
  const appPath = process.argv[2];
  if (appPath) {
    signMacOS(appPath);
  } else {
    console.error('Usage: node sign-macos.js <app-path>');
    process.exit(1);
  }
}

module.exports = signMacOS;