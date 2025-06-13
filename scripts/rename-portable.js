#!/usr/bin/env node

/**
 * Post-build script to rename ZIP files to "Portable" versions
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const fullVersion = process.env.VERSION || require('../package.json').version;
const fileVersion = process.env.FILE_VERSION || fullVersion;

function renamePortableFiles() {
  console.log('🔧 Renaming ZIP files to Portable versions...');
  console.log(`📦 Full version: ${fullVersion}`);
  console.log(`📁 File version: ${fileVersion}`);

  if (!fs.existsSync(distDir)) {
    console.log(`❌ Distribution directory not found: ${distDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(distDir);
  const zipFiles = files.filter(file => file.endsWith('.zip'));

  if (zipFiles.length === 0) {
    console.log('ℹ️ No ZIP files found to rename');
    return;
  }

  let renamedCount = 0;

  zipFiles.forEach(file => {
    const oldPath = path.join(distDir, file);
    let platform = '';
    let arch = '';

    if (file.includes('mac')) {
      platform = 'mac';
      arch = file.includes('arm64') ? 'arm64' : file.includes('x64') ? 'x64' : '';
    } else if (file.includes('win')) {
      platform = 'win';
      arch = file.includes('x64') ? 'x64' : '';
    } else if (file.includes('linux')) {
      platform = 'linux';
      arch = file.includes('x64') ? 'x64' : '';
    }

    if (platform && arch) {
      const newFilename = `WhisperDesk-Portable-${fileVersion}-${platform}-${arch}.zip`;
      const newPath = path.join(distDir, newFilename);

      if (oldPath !== newPath) {
        try {
          fs.renameSync(oldPath, newPath);
          console.log(`✅ Renamed: ${file} → ${newFilename}`);
          renamedCount++;
        } catch (err) {
          console.error(`❌ Failed to rename ${file}: ${err.message}`);
        }
      } else {
        console.log(`ℹ️ No rename needed: ${file}`);
      }
    } else {
      console.log(`⚠️ Could not determine platform/arch for: ${file}`);
    }
  });

  console.log(`🎉 Finished. ${renamedCount} file(s) renamed.`);
}

// Run if executed directly
if (require.main === module) {
  renamePortableFiles();
}

module.exports = { renamePortableFiles };
