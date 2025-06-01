const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');
const { spawn } = require('child_process');

class WhisperService {
    constructor() {
        this.currentModel = null;
        this.isProcessing = false;
        this.pythonPath = null;
        this.whisperInstalled = false;
    }

    getModelsDirectory() {
        // Try to use Electron's app.getPath first, fall back to manual path if not available
        try {
            return path.join(app.getPath('userData'), 'models');
        } catch (error) {
            // Fallback to manual path resolution
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
    }

    async findPython() {
        const pythonCommands = ['python3', 'python'];
        
        for (const cmd of pythonCommands) {
            try {
                const result = await this.runCommand(cmd, ['--version']);
                if (result.success) {
                    console.log(`Found Python: ${cmd} - ${result.stdout.trim()}`);
                    return cmd;
                }
            } catch (error) {
                continue;
            }
        }
        
        throw new Error('Python not found. Please install Python 3.8 or later.');
    }

    async checkWhisperInstallation() {
        try {
            const result = await this.runCommand(this.pythonPath, ['-c', 'import whisper; print("Whisper installed")']);
            return result.success;
        } catch (error) {
            return false;
        }
    }

    async runCommand(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, stdout, stderr });
                } else {
                    reject({ success: false, stdout, stderr, code });
                }
            });

            process.on('error', (error) => {
                reject({ success: false, error: error.message });
            });
        });
    }

    async initialize(modelSize = 'base') {
        try {
            // Find Python
            this.pythonPath = await this.findPython();
            
            // Check if Whisper is installed
            this.whisperInstalled = await this.checkWhisperInstallation();
            
            if (!this.whisperInstalled) {
                throw new Error('OpenAI Whisper not installed. Please run: pip install openai-whisper');
            }

            this.currentModel = modelSize;
            console.log(`Initialized Whisper with ${modelSize} model using Python`);
            return true;
        } catch (error) {
            console.error('Failed to initialize Whisper:', error);
            throw error;
        }
    }

    async transcribeAudio(audioBuffer, options = {}) {
        if (!this.currentModel) {
            throw new Error('Whisper service not initialized');
        }

        if (this.isProcessing) {
            throw new Error('Already processing audio');
        }

        this.isProcessing = true;

        try {
            // Create temp directory
            const tempDir = path.join(os.tmpdir(), 'whisperdesk');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempFile = path.join(tempDir, `temp-${Date.now()}.wav`);
            fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

            // Build Python script for transcription
            const pythonScript = `
import whisper
import json
import sys

try:
    model = whisper.load_model("${this.currentModel}")
    result = model.transcribe("${tempFile.replace(/\\/g, '\\\\')}", 
                            language="${options.language || 'en'}", 
                            word_timestamps=${options.word_timestamps || false})
    
    # Extract just the text and segments we need
    output = {
        "text": result["text"],
        "segments": []
    }
    
    if "segments" in result:
        for segment in result["segments"]:
            output["segments"].append({
                "start": segment.get("start", 0),
                "end": segment.get("end", 0),
                "text": segment.get("text", "")
            })
    
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

            const scriptPath = path.join(tempDir, `transcribe-${Date.now()}.py`);
            fs.writeFileSync(scriptPath, pythonScript);

            console.log('Running transcription...');
            const result = await this.runCommand(this.pythonPath, [scriptPath]);
            
            // Clean up temporary files
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }

            if (result.success) {
                const transcriptionResult = JSON.parse(result.stdout.trim());
                if (transcriptionResult.error) {
                    throw new Error(transcriptionResult.error);
                }
                return transcriptionResult;
            } else {
                throw new Error(`Transcription failed: ${result.stderr}`);
            }

        } catch (error) {
            console.error('Transcription error:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    async processAudioChunk(chunk, options = {}) {
        // Convert audio chunk to the format expected by Whisper
        const processedChunk = await this.preprocessAudio(chunk);
        return this.transcribeAudio(processedChunk, options);
    }

    async preprocessAudio(audioData) {
        // Convert audio data to WAV format if needed
        // This is a placeholder - you might need to implement actual conversion
        return audioData;
    }

    async getStatus() {
        return {
            pythonPath: this.pythonPath,
            whisperInstalled: this.whisperInstalled,
            currentModel: this.currentModel,
            isProcessing: this.isProcessing
        };
    }
}

module.exports = new WhisperService();