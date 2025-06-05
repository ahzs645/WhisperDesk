#!/usr/bin/env node

/**
 * Post-build script to rename ZIP files as "Portable" versions
 * This script runs after electron-builder to rename ZIP files
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function renamePortableFiles() {
  console.log('🔧 Renaming ZIP files to Portable versions...');
  
  if (!fs.existsSync(distDir)) {
    console.log('❌ Dist directory not found');
    return;
  }

  const files = fs.readdirSync(distDir);
  let renamedCount = 0;

  files.forEach(file => {
    if (file.endsWith('.zip') && !file.includes('Portable')) {
      const oldPath = path.join(distDir, file);
      
      // Replace the pattern to add "Portable"
      // WhisperDesk-2.1.0-win-x64.zip -> WhisperDesk-Portable-2.1.0-win-x64.zip
      // WhisperDesk-2.1.0-mac-x64.zip -> WhisperDesk-Portable-2.1.0-mac-x64.zip
      const newFileName = file.replace(
        /^(WhisperDesk)-(\d+\.\d+\.\d+(?:-\w+)?)-/,
        '$1-Portable-$2-'
      );
      
      const newPath = path.join(distDir, newFileName);
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`✅ Renamed: ${file} -> ${newFileName}`);
        renamedCount++;
      } catch (error) {
        console.error(`❌ Failed to rename ${file}: ${error.message}`);
      }
    }
  });

  if (renamedCount === 0) {
    console.log('ℹ️  No ZIP files found to rename');
  } else {
    console.log(`🎉 Successfully renamed ${renamedCount} file(s) to Portable versions`);
  }
}

// Run the script
if (require.main === module) {
  renamePortableFiles();
}

module.exports = { renamePortableFiles };