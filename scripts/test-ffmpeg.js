// scripts/test-ffmpeg.js
const { testFFmpeg } = require('./setup-ffmpeg');

console.log('🧪 Testing FFmpeg installation...');

testFFmpeg()
  .then(() => {
    console.log('✅ FFmpeg test passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ FFmpeg test failed:', error.message);
    process.exit(1);
  });