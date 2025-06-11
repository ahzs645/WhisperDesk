// scripts/build-diarization.js
const buildDiarization = async () => {
  console.log('🔧 Building speaker diarization binaries...');
  
  // 1. Download ONNX Runtime binaries for current platform
  await downloadONNXRuntime();
  
  // 2. Build diarize-cli executable (C++ wrapper around ONNX Runtime)
  await buildDiarizeCLI();
  
  // 3. Download and convert pyannote models to ONNX format
  await downloadAndConvertModels();
  
  console.log('✅ Speaker diarization build complete');
};