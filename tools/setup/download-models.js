#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) { log(`ℹ️  ${message}`, 'blue'); }
function logSuccess(message) { log(`✅ ${message}`, 'green'); }
function logWarning(message) { log(`⚠️  ${message}`, 'yellow'); }
function logError(message) { log(`❌ ${message}`, 'red'); }

// Available models
const MODELS = {
    tiny: {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        size: '39 MB',
        description: 'Fastest, lowest quality'
    },
    base: {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        size: '142 MB',
        description: 'Fast, good quality'
    },
    small: {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        size: '466 MB',
        description: 'Balanced speed/quality'
    },
    medium: {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        size: '1.5 GB',
        description: 'High quality, slower'
    },
    large: {
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
        size: '2.9 GB',
        description: 'Highest quality, slowest'
    }
};

// Parse command line arguments
const args = process.argv.slice(2);
let modelsToDownload = ['tiny']; // Default to tiny

args.forEach(arg => {
    if (arg.startsWith('--model=')) {
        const model = arg.split('=')[1];
        if (model === 'all') {
            modelsToDownload = Object.keys(MODELS);
        } else if (MODELS[model]) {
            modelsToDownload = [model];
        } else {
            logError(`Unknown model: ${model}`);
            logInfo(`Available models: ${Object.keys(MODELS).join(', ')}, all`);
            process.exit(1);
        }
    } else if (arg === '--list') {
        logInfo('Available models:');
        Object.entries(MODELS).forEach(([name, info]) => {
            log(`  ${name}: ${info.size} - ${info.description}`);
        });
        process.exit(0);
    } else if (arg === '--help') {
        log('Download Whisper models for local use');
        log('');
        log('Usage: node download-models.js [options]');
        log('');
        log('Options:');
        log('  --model=<name>  Download specific model (tiny, base, small, medium, large, all)');
        log('  --list          List available models');
        log('  --help          Show this help');
        log('');
        log('Examples:');
        log('  node download-models.js --model=tiny');
        log('  node download-models.js --model=all');
        process.exit(0);
    }
});

// Create models directory
const modelsDir = path.join(process.cwd(), 'models');
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
    logSuccess('Created models directory');
}

// Download progress tracking
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function downloadModel(modelName, modelInfo) {
    return new Promise((resolve, reject) => {
        const fileName = `ggml-${modelName === 'large' ? 'large-v3' : modelName}.bin`;
        const filePath = path.join(modelsDir, fileName);
        
        // Check if file already exists
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1000) { // Basic sanity check
                logWarning(`Model ${modelName} already exists (${formatBytes(stats.size)})`);
                resolve();
                return;
            }
        }
        
        logInfo(`Downloading ${modelName} model (${modelInfo.size})...`);
        
        const file = fs.createWriteStream(filePath);
        let downloadedBytes = 0;
        let totalBytes = 0;
        let lastProgressTime = 0;
        
        const request = https.get(modelInfo.url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                file.close();
                fs.unlinkSync(filePath);
                return downloadModel(modelName, { ...modelInfo, url: response.headers.location });
            }
            
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(filePath);
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            totalBytes = parseInt(response.headers['content-length']) || 0;
            
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                
                // Show progress every 2 seconds or at completion
                const now = Date.now();
                if (now - lastProgressTime > 2000 || downloadedBytes === totalBytes) {
                    const progress = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : 'Unknown';
                    const downloaded = formatBytes(downloadedBytes);
                    const total = totalBytes > 0 ? formatBytes(totalBytes) : 'Unknown size';
                    process.stdout.write(`\r  Progress: ${progress}% (${downloaded}/${total})`);
                    lastProgressTime = now;
                }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                process.stdout.write('\n'); // New line after progress
                
                // Verify download
                const stats = fs.statSync(filePath);
                if (stats.size < 1000) {
                    fs.unlinkSync(filePath);
                    reject(new Error('Downloaded file too small, likely corrupted'));
                    return;
                }
                
                logSuccess(`Downloaded ${modelName} model (${formatBytes(stats.size)})`);
                resolve();
            });
            
            file.on('error', (err) => {
                file.close();
                fs.unlinkSync(filePath);
                reject(err);
            });
        });
        
        request.on('error', (err) => {
            file.close();
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            reject(err);
        });
        
        request.setTimeout(30000, () => {
            request.destroy();
            file.close();
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            reject(new Error('Download timeout'));
        });
    });
}

// Main download function
async function downloadModels() {
    logInfo(`Preparing to download ${modelsToDownload.length} model(s)...`);
    
    for (const modelName of modelsToDownload) {
        try {
            await downloadModel(modelName, MODELS[modelName]);
        } catch (error) {
            logError(`Failed to download ${modelName} model: ${error.message}`);
            process.exit(1);
        }
    }
    
    logSuccess('All models downloaded successfully!');
    
    // List downloaded models
    logInfo('Downloaded models:');
    const files = fs.readdirSync(modelsDir).filter(file => file.endsWith('.bin'));
    files.forEach(file => {
        const stats = fs.statSync(path.join(modelsDir, file));
        log(`  ${file}: ${formatBytes(stats.size)}`);
    });
}

// Run the download
downloadModels().catch(error => {
    logError(`Download failed: ${error.message}`);
    process.exit(1);
});