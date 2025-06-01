const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

class AudioService extends EventEmitter {
  constructor() {
    super();
    this.isRecording = false;
    this.recordingProcess = null;
    this.audioDevices = [];
    this.currentDevice = null;
    this.tempDir = path.join(os.tmpdir(), 'whisperdesk-audio');
  }

  async initialize() {
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Get available audio devices
      await this.refreshDevices();
      
      console.log('Audio service initialized');
    } catch (error) {
      console.error('Error initializing audio service:', error);
      throw error;
    }
  }

  async getDevices() {
    await this.refreshDevices();
    return this.audioDevices;
  }

  async refreshDevices() {
    try {
      // Use different methods based on platform
      if (process.platform === 'win32') {
        await this.getWindowsDevices();
      } else if (process.platform === 'darwin') {
        await this.getMacDevices();
      } else {
        await this.getLinuxDevices();
      }
    } catch (error) {
      console.error('Error refreshing audio devices:', error);
      // Fallback to default device
      this.audioDevices = [{
        id: 'default',
        name: 'Default Audio Device',
        type: 'input',
        isDefault: true
      }];
    }
  }

  async getWindowsDevices() {
    // Use PowerShell to get audio devices on Windows
    const script = `
      Get-WmiObject -Class Win32_SoundDevice | 
      Select-Object Name, DeviceID, Status | 
      ConvertTo-Json
    `;

    return new Promise((resolve, reject) => {
      const process = spawn('powershell', ['-Command', script]);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        try {
          const devices = JSON.parse(output);
          this.audioDevices = (Array.isArray(devices) ? devices : [devices])
            .filter(device => device.Status === 'OK')
            .map((device, index) => ({
              id: device.DeviceID || `device-${index}`,
              name: device.Name,
              type: 'input',
              isDefault: index === 0
            }));
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      process.on('error', reject);
    });
  }

  async getMacDevices() {
    // Use system_profiler to get audio devices on macOS
    return new Promise((resolve, reject) => {
      const process = spawn('system_profiler', ['SPAudioDataType', '-json']);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        try {
          const data = JSON.parse(output);
          const audioData = data.SPAudioDataType || [];
          
          this.audioDevices = [];
          audioData.forEach((category, categoryIndex) => {
            if (category._items) {
              category._items.forEach((device, deviceIndex) => {
                this.audioDevices.push({
                  id: `${categoryIndex}-${deviceIndex}`,
                  name: device._name,
                  type: 'input',
                  isDefault: categoryIndex === 0 && deviceIndex === 0
                });
              });
            }
          });

          if (this.audioDevices.length === 0) {
            this.audioDevices.push({
              id: 'default',
              name: 'Default Audio Device',
              type: 'input',
              isDefault: true
            });
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      process.on('error', reject);
    });
  }

  async getLinuxDevices() {
    // Use pactl to get audio devices on Linux
    return new Promise((resolve, reject) => {
      const process = spawn('pactl', ['list', 'sources', 'short']);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        try {
          const lines = output.trim().split('\\n').filter(line => line.length > 0);
          this.audioDevices = lines.map((line, index) => {
            const parts = line.split('\\t');
            return {
              id: parts[1] || `device-${index}`,
              name: parts[1] || `Audio Device ${index + 1}`,
              type: 'input',
              isDefault: index === 0
            };
          });

          if (this.audioDevices.length === 0) {
            this.audioDevices.push({
              id: 'default',
              name: 'Default Audio Device',
              type: 'input',
              isDefault: true
            });
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });

      process.on('error', () => {
        // Fallback if pactl is not available
        this.audioDevices = [{
          id: 'default',
          name: 'Default Audio Device',
          type: 'input',
          isDefault: true
        }];
        resolve();
      });
    });
  }

  async startRecording(deviceId = 'default', options = {}) {
    if (this.isRecording) {
      throw new Error('Already recording');
    }

    try {
      this.currentDevice = deviceId;
      const outputFile = path.join(this.tempDir, `recording-${Date.now()}.wav`);
      
      // Use ffmpeg for cross-platform audio recording
      const ffmpegArgs = this.buildFFmpegArgs(deviceId, outputFile, options);
      
      this.recordingProcess = spawn('ffmpeg', ffmpegArgs);
      this.isRecording = true;

      // Handle process events
      this.recordingProcess.stdout.on('data', (data) => {
        // Parse audio level data if available
        this.parseAudioLevel(data.toString());
      });

      this.recordingProcess.stderr.on('data', (data) => {
        const output = data.toString();
        this.parseAudioLevel(output);
      });

      this.recordingProcess.on('close', (code) => {
        this.isRecording = false;
        this.recordingProcess = null;
        
        if (code === 0) {
          this.emit('recordingComplete', outputFile);
        } else {
          this.emit('recordingError', new Error(`Recording process exited with code ${code}`));
        }
      });

      this.recordingProcess.on('error', (error) => {
        this.isRecording = false;
        this.recordingProcess = null;
        this.emit('recordingError', error);
      });

      this.emit('recordingStarted', { deviceId, outputFile });
      return { success: true, outputFile };

    } catch (error) {
      this.isRecording = false;
      this.recordingProcess = null;
      throw error;
    }
  }

  buildFFmpegArgs(deviceId, outputFile, options = {}) {
    const args = ['-y']; // Overwrite output file
    
    // Input device configuration based on platform
    if (process.platform === 'win32') {
      args.push('-f', 'dshow');
      if (deviceId !== 'default') {
        args.push('-i', `audio="${deviceId}"`);
      } else {
        args.push('-i', 'audio="Default Audio Device"');
      }
    } else if (process.platform === 'darwin') {
      args.push('-f', 'avfoundation');
      if (deviceId !== 'default') {
        args.push('-i', `:${deviceId}`);
      } else {
        args.push('-i', ':0');
      }
    } else {
      args.push('-f', 'pulse');
      if (deviceId !== 'default') {
        args.push('-i', deviceId);
      } else {
        args.push('-i', 'default');
      }
    }

    // Audio encoding options
    args.push(
      '-acodec', 'pcm_s16le',
      '-ar', options.sampleRate || '16000',
      '-ac', options.channels || '1',
      '-af', 'volume=1.0'
    );

    // Add audio level monitoring
    if (options.showLevels !== false) {
      args.push('-af', 'volumedetect');
    }

    // Output file
    args.push(outputFile);

    return args;
  }

  parseAudioLevel(output) {
    // Parse audio level from ffmpeg output
    const levelMatch = output.match(/\\[Parsed_volumedetect.*?\\] mean_volume: (-?\\d+\\.\\d+) dB/);
    if (levelMatch) {
      const level = parseFloat(levelMatch[1]);
      this.emit('audioLevel', { level, timestamp: Date.now() });
    }
  }

  async stopRecording() {
    if (!this.isRecording || !this.recordingProcess) {
      return { success: false, error: 'Not recording' };
    }

    try {
      // Send SIGTERM to gracefully stop ffmpeg
      this.recordingProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise((resolve) => {
        this.recordingProcess.on('close', resolve);
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.recordingProcess) {
            this.recordingProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getWaveform(filePath, options = {}) {
    try {
      const outputFile = path.join(this.tempDir, `waveform-${Date.now()}.json`);
      
      // Use ffmpeg to extract waveform data
      const args = [
        '-i', filePath,
        '-af', `aresample=8000,asetnsamples=n=${options.samples || 1000}`,
        '-f', 'f64le',
        '-'
      ];

      return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', args);
        const chunks = [];

        process.stdout.on('data', (chunk) => {
          chunks.push(chunk);
        });

        process.on('close', (code) => {
          if (code === 0) {
            const buffer = Buffer.concat(chunks);
            const samples = [];
            
            // Convert binary data to float64 array
            for (let i = 0; i < buffer.length; i += 8) {
              if (i + 8 <= buffer.length) {
                samples.push(buffer.readDoubleLE(i));
              }
            }

            resolve({
              samples,
              sampleRate: options.sampleRate || 8000,
              duration: samples.length / (options.sampleRate || 8000)
            });
          } else {
            reject(new Error(`FFmpeg process exited with code ${code}`));
          }
        });

        process.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Error generating waveform: ${error.message}`);
    }
  }

  async convertAudioFormat(inputPath, outputPath, options = {}) {
    const args = [
      '-i', inputPath,
      '-acodec', options.codec || 'pcm_s16le',
      '-ar', options.sampleRate || '16000',
      '-ac', options.channels || '1',
      '-y',
      outputPath
    ];

    return new Promise((resolve, reject) => {
      const process = spawn('ffmpeg', args);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Audio conversion failed with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  async cleanup() {
    try {
      // Stop any ongoing recording
      if (this.isRecording) {
        await this.stopRecording();
      }

      // Clean up temp files
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => 
          fs.unlink(path.join(this.tempDir, file)).catch(() => {})
        )
      );
    } catch (error) {
      console.error('Error during audio service cleanup:', error);
    }
  }
}

module.exports = AudioService;

