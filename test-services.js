const ModelManager = require('./src/main/services/model-manager');
const AudioService = require('./src/main/services/audio-service');

async function testServices() {
  console.log('Testing WhisperDesk Services...\n');
  
  try {
    // Test Model Manager
    console.log('1. Testing Model Manager...');
    const modelManager = new ModelManager();
    await modelManager.initialize();
    
    const availableModels = await modelManager.getAvailableModels();
    console.log(`   ✓ Found ${availableModels.length} available models`);
    
    const installedModels = await modelManager.getInstalledModels();
    console.log(`   ✓ Found ${installedModels.length} installed models`);
    
    // Test Audio Service
    console.log('\n2. Testing Audio Service...');
    const audioService = new AudioService();
    await audioService.initialize();
    
    const audioDevices = await audioService.getDevices();
    console.log(`   ✓ Found ${audioDevices.length} audio devices`);
    
    // Show device types
    const systemDevices = audioDevices.filter(d => d.canRecordSystem);
    console.log(`   ✓ Found ${systemDevices.length} system audio capable devices`);
    
    console.log('\n3. Available Models:');
    availableModels.forEach(model => {
      console.log(`   - ${model.name} (${model.size}) - ${model.accuracy} accuracy`);
    });
    
    console.log('\n4. Audio Devices:');
    audioDevices.forEach(device => {
      const systemCapable = device.canRecordSystem ? ' [System Audio]' : '';
      console.log(`   - ${device.name}${systemCapable}`);
    });
    
    console.log('\n✅ All services initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error testing services:', error);
  }
}

testServices();

