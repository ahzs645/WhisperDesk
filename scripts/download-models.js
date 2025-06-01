const path = require('path');
const fs = require('fs');
const os = require('os');

// Get models directory - use OS-specific app data path since we're running outside Electron
function getModelsDirectory() {
    let appDataPath;
    
    switch (process.platform) {
        case 'win32':
            appDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'whisperdesk');
            break;
        case 'darwin':
            appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'whisperdesk');
            break;
        default: // Linux and others
            appDataPath = path.join(os.homedir(), '.config', 'whisperdesk');
            break;
    }
    
    return path.join(appDataPath, 'models');
}

const MODELS_DIR = getModelsDirectory();

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
        console.log(`Model ${modelName} already exists at ${modelPath}`);
        return modelPath;
    }

    console.log(`Downloading ${modelName} model to ${modelPath}...`);
    
    try {
        // Use dynamic import for fetch in Node.js
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(MODELS[modelName]);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const fileStream = fs.createWriteStream(modelPath);
        
        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            response.body.on('error', reject);
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });

        console.log(`Successfully downloaded ${modelName} model`);
        return modelPath;
    } catch (error) {
        console.error(`Error downloading ${modelName} model:`, error);
        // Clean up partial download
        if (fs.existsSync(modelPath)) {
            fs.unlinkSync(modelPath);
        }
        throw error;
    }
}

// Download base model by default
async function main() {
    try {
        console.log('Setting up WhisperDesk models...');
        console.log(`Models directory: ${MODELS_DIR}`);
        await downloadModel('base');
        console.log('Model setup complete!');
    } catch (error) {
        console.error('Failed to download models:', error);
        process.exit(1);
    }
}

// Only run if this script is executed directly
if (require.main === module) {
    main();
}