
// ============================================================================

// src/main/screen-recorder/services/FFmpegMerger.js
/**
 * FFmpeg-based audio/video stream merger
 * Combines multiple audio sources with video
 */

const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class FFmpegMerger extends EventEmitter {
  constructor() {
    super();
    this.isProcessing = false;
    this.ffmpegProcess = null;
  }

  /**
   * Initialize FFmpeg merger
   */
  async initialize() {
    try {
      // Check FFmpeg availability
      const { execAsync } = require('../../utils/exec-utils');
      await execAsync('ffmpeg -version', { timeout: 5000 });
      
      console.log('✅ FFmpeg merger initialized');
      return true;
    } catch (error) {
      console.error('❌ FFmpeg not available:', error);
      throw new Error('FFmpeg is required for advanced audio merging');
    }
  }

  /**
   * Merge multiple audio streams with video
   */
  async mergeStreams(inputs, outputPath, options = {}) {
    if (this.isProcessing) {
      throw new Error('Already processing');
    }

    try {
      this.isProcessing = true;
      
      console.log('🔄 Starting FFmpeg merge:', {
        inputs: inputs.map(i => ({ type: i.type, path: path.basename(i.path) })),
        output: path.basename(outputPath)
      });
      
      // Build FFmpeg command
      const ffmpegArgs = this.buildFFmpegCommand(inputs, outputPath, options);
      
      // Execute FFmpeg
      await this.runFFmpeg(ffmpegArgs);
      
      // Verify output
      const stats = await fs.stat(outputPath);
      
      console.log(`✅ FFmpeg merge completed: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);
      
      this.emit('completed', {
        outputPath,
        size: stats.size,
        inputs: inputs.length
      });
      
      return {
        success: true,
        outputPath,
        size: stats.size
      };
      
    } catch (error) {
      console.error('❌ FFmpeg merge failed:', error);
      this.emit('error', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Build FFmpeg command for merging
   */
  buildFFmpegCommand(inputs, outputPath, options) {
    const args = ['-y']; // Overwrite output file
    
    // Add input files
    inputs.forEach(input => {
      args.push('-i', input.path);
    });
    
    // Build filter complex for audio mixing
    const audioInputs = inputs.filter(i => i.type === 'audio' || i.type === 'microphone');
    const videoInputs = inputs.filter(i => i.type === 'video' || i.type === 'screen');
    
    if (audioInputs.length > 1) {
      // Mix multiple audio sources
      const audioMixFilter = this.buildAudioMixFilter(audioInputs);
      args.push('-filter_complex', audioMixFilter);
      args.push('-map', '0:v'); // Map video from first input
      args.push('-map', '[mixed_audio]'); // Map mixed audio
    } else if (audioInputs.length === 1 && videoInputs.length === 1) {
      // Simple video + audio combination
      args.push('-c:v', 'copy'); // Copy video without re-encoding
      args.push('-c:a', 'aac'); // Re-encode audio to AAC
    } else {
      // Default mapping
      args.push('-map', '0');
    }
    
    // Output settings
    args.push('-c:v', options.videoCodec || 'libx264');
    args.push('-c:a', options.audioCodec || 'aac');
    args.push('-b:a', options.audioBitrate || '128k');
    args.push('-movflags', '+faststart'); // Optimize for streaming
    
    // Output file
    args.push(outputPath);
    
    return args;
  }

  /**
   * Build audio mix filter for multiple sources
   */
  buildAudioMixFilter(audioInputs) {
    if (audioInputs.length === 2) {
      // Simple mix of two audio sources
      return '[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=3[mixed_audio]';
    } else if (audioInputs.length > 2) {
      // Complex mix for multiple sources
      const inputRefs = audioInputs.map((_, index) => `[${index + 1}:a]`).join('');
      return `${inputRefs}amix=inputs=${audioInputs.length}:duration=first[mixed_audio]`;
    } else {
      // Single audio source
      return '[1:a]copy[mixed_audio]';
    }
  }

  /**
   * Run FFmpeg process
   */
  async runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      console.log('🎬 FFmpeg command:', 'ffmpeg', args.join(' '));
      
      this.ffmpegProcess = spawn('ffmpeg', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stderr = '';
      
      this.ffmpegProcess.stdout.on('data', (data) => {
        // FFmpeg progress could be parsed here
        const output = data.toString();
        if (output.includes('frame=')) {
          this.emit('progress', this.parseFFmpegProgress(output));
        }
      });
      
      this.ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // FFmpeg writes progress to stderr
        if (stderr.includes('frame=')) {
          this.emit('progress', this.parseFFmpegProgress(stderr));
        }
      });
      
      this.ffmpegProcess.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });
      
      this.ffmpegProcess.on('exit', (code) => {
        this.ffmpegProcess = null;
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed with exit code ${code}\nStderr: ${stderr}`));
        }
      });
    });
  }

  /**
   * Parse FFmpeg progress output
   */
  parseFFmpegProgress(output) {
    const lines = output.split('\n');
    const progressLine = lines.find(line => line.includes('frame='));
    
    if (progressLine) {
      const frameMatch = progressLine.match(/frame=\s*(\d+)/);
      const timeMatch = progressLine.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      
      return {
        frame: frameMatch ? parseInt(frameMatch[1]) : 0,
        time: timeMatch ? timeMatch[0] : '00:00:00.00'
      };
    }
    
    return null;
  }

  /**
   * Stop processing
   */
  async stopProcessing() {
    if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
      console.log('🛑 Stopping FFmpeg process...');
      this.ffmpegProcess.kill('SIGTERM');
      
      // Wait for graceful exit
      await new Promise(resolve => {
        this.ffmpegProcess.on('exit', resolve);
        setTimeout(() => {
          if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
            this.ffmpegProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });
    }
    
    this.isProcessing = false;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
      this.ffmpegProcess.kill('SIGKILL');
    }
    
    this.isProcessing = false;
    this.ffmpegProcess = null;
  }

  /**
   * Destroy service
   */
  destroy() {
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = FFmpegMerger;