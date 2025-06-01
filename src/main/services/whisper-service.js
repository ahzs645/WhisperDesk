const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const whisper = require('whisper-node');
const ffmpeg = require('ffmpeg-static');

class WhisperService {
    constructor() {
        this.modelsDir = path.join(app.getPath('userData'), 'models');
        this.currentModel = null;
        this.isProcessing = false;
    }

    async initialize(modelSize = 'base') {
        const modelPath = path.join(this.modelsDir, `ggml-${modelSize}.bin`);
        
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Model ${modelSize} not found. Please run npm install first.`);
        }

        this.currentModel = modelSize;
        return true;
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
            // Save the audio buffer to a temporary file
            const tempDir = path.join(app.getPath('temp'), 'whisperdesk');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempFile = path.join(tempDir, `temp-${Date.now()}.wav`);
            fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

            const whisperOptions = {
                modelName: this.currentModel,
                whisperOptions: {
                    language: options.language || 'en',
                    word_timestamps: true,
                    output_txt: false,
                    output_vtt: false,
                    output_srt: false,
                    ...options
                }
            };

            const result = await whisper(tempFile, whisperOptions);
            
            // Clean up temporary file
            fs.unlinkSync(tempFile);

            return result;
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
}

module.exports = new WhisperService(); 