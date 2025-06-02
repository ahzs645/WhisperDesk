const NativeTranscriptionService = require('./src/main/services/transcription-service-native');
const ModelManager = require('./src/main/services/model-manager');
const path = require('path');

async function testTranscription() {
  console.log('🎵 Testing Native Whisper Transcription...\n');
  
  try {
    // Initialize services
    console.log('1. Initializing services...');
    const modelManager = new ModelManager();
    await modelManager.initialize();
    
    const transcriptionService = new NativeTranscriptionService(modelManager);
    await transcriptionService.initialize();
    
    // Check if native whisper is available
    const providers = transcriptionService.getProviders();
    const nativeProvider = providers.find(p => p.name === 'Native Whisper');
    
    if (!nativeProvider || !nativeProvider.isAvailable) {
      console.log('❌ Native Whisper provider not available');
      return;
    }
    
    console.log('✅ Native Whisper provider is ready');
    
    // Test with the provided audio file
    const audioFile = '/home/ubuntu/upload/test.mp3';
    console.log(`\n2. Testing transcription with: ${audioFile}`);
    
    // Set up progress listener
    transcriptionService.on('progress', (data) => {
      console.log(`   Progress: ${data.progress}% - ${data.message || data.stage}`);
    });
    
    transcriptionService.on('error', (data) => {
      console.log(`   Error: ${data.error}`);
    });
    
    // Start transcription
    const startTime = Date.now();
    const result = await transcriptionService.processFile(audioFile, {
      provider: 'whisper-native',
      model: 'whisper-tiny',
      language: 'auto',
      enableTimestamps: true
    });
    
    const duration = Date.now() - startTime;
    
    console.log('\n🎉 Transcription completed!');
    console.log(`⏱️  Processing time: ${duration}ms`);
    console.log(`📝 Transcribed text: "${result.text}"`);
    console.log(`🌍 Detected language: ${result.language}`);
    console.log(`📊 Segments: ${result.segments?.length || 0}`);
    
    if (result.segments && result.segments.length > 0) {
      console.log('\n📋 Segments:');
      result.segments.forEach((segment, i) => {
        console.log(`   ${i + 1}. [${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s]: "${segment.text}"`);
      });
    }
    
    console.log('\n✅ Native whisper.cpp transcription test successful!');
    
  } catch (error) {
    console.error('❌ Transcription test failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the whisper binary is built and available');
    console.log('   2. Check if the tiny model is downloaded');
    console.log('   3. Verify the audio file exists and is readable');
  }
}

testTranscription();

