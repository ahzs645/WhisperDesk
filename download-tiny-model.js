const ModelManager = require('./src/main/services/model-manager');

async function downloadTinyModel() {
  console.log('Downloading Whisper Tiny model...\n');
  
  try {
    const modelManager = new ModelManager();
    await modelManager.initialize();
    
    // Check if tiny model is already installed
    const installedModels = await modelManager.getInstalledModels();
    const tinyInstalled = installedModels.find(m => m.id === 'whisper-tiny');
    
    if (tinyInstalled) {
      console.log('✅ Whisper Tiny model is already installed!');
      console.log(`   Path: ${tinyInstalled.path}`);
      console.log(`   Size: ${(tinyInstalled.size / 1024 / 1024).toFixed(2)} MB`);
      return tinyInstalled;
    }
    
    // Set up event listeners for download progress
    modelManager.on('downloadQueued', (info) => {
      console.log(`📥 Download queued: ${info.model.name}`);
    });
    
    modelManager.on('downloadProgress', (info) => {
      const progress = Math.round(info.progress);
      const downloaded = (info.downloadedBytes / 1024 / 1024).toFixed(2);
      const total = (info.totalBytes / 1024 / 1024).toFixed(2);
      process.stdout.write(`\r⬇️  Downloading: ${progress}% (${downloaded}/${total} MB)`);
    });
    
    modelManager.on('downloadComplete', (info) => {
      console.log(`\n✅ Download completed: ${info.installedModel.name}`);
      console.log(`   Path: ${info.installedModel.path}`);
      console.log(`   Size: ${(info.installedModel.size / 1024 / 1024).toFixed(2)} MB`);
    });
    
    modelManager.on('downloadError', (info) => {
      console.log(`\n❌ Download failed: ${info.error}`);
    });
    
    // Start download
    const result = await modelManager.downloadModel('whisper-tiny');
    console.log('Download initiated successfully!');
    
    // Wait for download to complete
    return new Promise((resolve, reject) => {
      modelManager.on('downloadComplete', (info) => {
        if (info.modelId === 'whisper-tiny') {
          resolve(info.installedModel);
        }
      });
      
      modelManager.on('downloadError', (info) => {
        if (info.modelId === 'whisper-tiny') {
          reject(new Error(info.error));
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Error downloading model:', error.message);
    throw error;
  }
}

downloadTinyModel()
  .then((model) => {
    console.log('\n🎉 Tiny model ready for use!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to download model:', error.message);
    process.exit(1);
  });

