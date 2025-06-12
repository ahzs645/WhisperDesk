// run-build.js - Simple script to run the build
const { buildEnhancedDiarization } = require('./enhanced-diarization-builder');

async function main() {
  try {
    await buildEnhancedDiarization();
    process.exit(0);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main(); 