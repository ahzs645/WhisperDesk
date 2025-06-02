const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const NativeTranscriptionService = require('./src/main/services/transcription-service-native');
const ModelManager = require('./src/main/services/model-manager');

const app = express();
const port = 3001;

// Configure multer for file uploads
const upload = multer({ 
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

app.use(cors());
app.use(express.json());

let transcriptionService;
let modelManager;

// Initialize services
async function initializeServices() {
  try {
    console.log('🚀 Initializing transcription services...');
    
    modelManager = new ModelManager();
    await modelManager.initialize();
    
    transcriptionService = new NativeTranscriptionService(modelManager);
    await transcriptionService.initialize();
    
    console.log('✅ Services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    services: {
      transcription: !!transcriptionService,
      models: !!modelManager
    }
  });
});

// Get available providers
app.get('/api/providers', (req, res) => {
  if (!transcriptionService) {
    return res.status(503).json({ error: 'Transcription service not initialized' });
  }
  
  const providers = transcriptionService.getProviders();
  res.json(providers);
});

// Get installed models
app.get('/api/models', async (req, res) => {
  if (!modelManager) {
    return res.status(503).json({ error: 'Model manager not initialized' });
  }
  
  try {
    const models = await modelManager.getInstalledModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transcribe audio file
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!transcriptionService) {
    return res.status(503).json({ error: 'Transcription service not initialized' });
  }
  
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }
  
  try {
    console.log(`📁 Processing file: ${req.file.originalname} (${req.file.size} bytes)`);
    
    const options = {
      provider: req.body.provider || 'whisper-native',
      model: req.body.model || 'whisper-tiny',
      language: req.body.language || 'auto',
      enableTimestamps: req.body.enableTimestamps !== 'false'
    };
    
    console.log('🎵 Starting transcription with options:', options);
    
    // Set up progress tracking
    const transcriptionId = Date.now().toString();
    let lastProgress = 0;
    
    transcriptionService.on('progress', (data) => {
      if (data.transcriptionId === transcriptionId) {
        lastProgress = data.progress;
        console.log(`📊 Progress: ${data.progress}% - ${data.message || data.stage}`);
      }
    });
    
    // Process the file
    const result = await transcriptionService.processFile(req.file.path, {
      ...options,
      transcriptionId
    });
    
    console.log('✅ Transcription completed successfully');
    console.log(`📝 Text length: ${result.text.length} characters`);
    console.log(`📊 Segments: ${result.segments?.length || 0}`);
    
    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up uploaded file:', cleanupError.message);
    }
    
    res.json({
      success: true,
      result: {
        text: result.text,
        language: result.language,
        segments: result.segments,
        metadata: result.metadata,
        processingTime: result.processingTime
      }
    });
    
  } catch (error) {
    console.error('❌ Transcription failed:', error);
    
    // Clean up uploaded file on error
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to clean up uploaded file:', cleanupError.message);
    }
    
    res.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

// Start server
async function startServer() {
  await initializeServices();
  
  app.listen(port, () => {
    console.log(`🌐 Transcription API server running on http://localhost:${port}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /api/providers - Get available transcription providers`);
    console.log(`   GET  /api/models - Get installed models`);
    console.log(`   POST /api/transcribe - Transcribe audio file`);
  });
}

startServer().catch(console.error);

