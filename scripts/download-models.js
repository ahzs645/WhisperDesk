const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const Store = require('electron-store');

const store = new Store();
const MODELS_DIR = path.join(app.getPath('userData'), 'models');

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
}

// Model sizes and their URLs
const MODELS = {
    'tiny': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    'base': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    'small': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    'medium': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    'large': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large.bin'
};

async function downloadModel(modelName) {
    const modelPath = path.join(MODELS_DIR, `ggml-${modelName}.bin`);
    
    // Check if model already exists
    if (fs.existsSync(modelPath)) {
        console.log(`Model ${modelName} already exists`);
        return modelPath;
    }

    console.log(`Downloading ${modelName} model...`);
    
    try {
        const response = await fetch(MODELS[modelName]);
        const fileStream = fs.createWriteStream(modelPath);
        
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            response.body.on('error', reject);
            fileStream.on('finish', resolve);
        });

        console.log(`Downloaded ${modelName} model`);
        return modelPath;
    } catch (error) {
        console.error(`Error downloading ${modelName} model:`, error);
        throw error;
    }
}

// Download base model by default
downloadModel('base').catch(console.error); 