const NativeTranscriptionService = require('./src/main/services/transcription-service-native');
const ModelManager = require('./src/main/services/model-manager');
const BinaryManager = require('./src/main/services/binary-manager');

async function testNativeServices() {
  console.log('🧪 Testing Native WhisperDesk Services...\n');
  
  try {
    // Test Binary Manager
    console.log('1. Testing Binary Manager...');
    const binaryManager = new BinaryManager();
    await binaryManager.initialize();
    
    try {
      const version = await binaryManager.getBinaryVersion();
      console.log(`   ✅ whisper.cpp version: ${version}`);
    } catch (error) {
      console.log(`   ⚠️  Could not get version: ${error.message}`);
    }
    
    // Test Model Manager
    console.log('\n2. Testing Model Manager...');
    const modelManager = new ModelManager();
    await modelManager.initialize();
    
    const availableModels = await modelManager.getAvailableModels();
    console.log(`   ✅ Found ${availableModels.length} available models`);
    
    // Test Native Transcription Service
    console.log('\n3. Testing Native Transcription Service...');
    const transcriptionService = new NativeTranscriptionService(modelManager);
    await transcriptionService.initialize();
    
    const providers = transcriptionService.getProviders();
    console.log(`   ✅ Found ${providers.length} providers`);
    
    providers.forEach(provider => {
      const status = provider.isAvailable ? '✅' : '❌';
      console.log(`   ${status} ${provider.name}: ${provider.description}`);
    });
    
    console.log('\n🎉 All native services initialized successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Download a model: node download-tiny-model.js');
    console.log('   2. Test transcription with a sample audio file');
    console.log('   3. Run the full application: npm run dev');
    
  } catch (error) {
    console.error('❌ Error testing native services:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure you ran: npm run prebuild');
    console.log('   2. Check if whisper.cpp binary is available for your platform');
    console.log('   3. Verify models directory permissions');
  }
}

testNativeServices();

