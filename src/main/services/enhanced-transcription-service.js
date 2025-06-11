// src/main/services/enhanced-transcription-service.js
class EnhancedTranscriptionService extends NativeTranscriptionService {
  constructor(modelManager) {
    super(modelManager);
    this.diarizationBinaryManager = new DiarizationBinaryManager();
    this.diarizationModelManager = new DiarizationModelManager();
    this.diarizationAvailable = false;
  }

  async initialize() {
    await super.initialize();
    
    // Initialize diarization capabilities
    try {
      const binaryAvailable = await this.diarizationBinaryManager.ensureDiarizationBinary();
      const modelsAvailable = await this.diarizationModelManager.checkRequiredModels();
      
      this.diarizationAvailable = binaryAvailable && modelsAvailable;
      
      if (this.diarizationAvailable) {
        console.log('✅ Speaker diarization capabilities available');
      } else {
        console.warn('⚠️ Speaker diarization not available (optional feature)');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize diarization:', error.message);
      this.diarizationAvailable = false;
    }
  }

  async processFile(filePath, options = {}) {
    const enableDiarization = options.enableSpeakerDiarization && this.diarizationAvailable;
    
    if (!enableDiarization) {
      // Use existing transcription flow
      return super.processFile(filePath, options);
    }

    // Enhanced flow with speaker diarization
    return this.processFileWithDiarization(filePath, options);
  }

  async processFileWithDiarization(filePath, options = {}) {
    const transcriptionId = options.transcriptionId || this.generateTranscriptionId();
    
    try {
      this.emit('progress', { transcriptionId, progress: 0, message: 'Preparing audio...' });
      
      // Step 1: Prepare audio (normalize, extract)
      const tempAudioPath = await this.prepareAudioForDiarization(filePath);
      
      this.emit('progress', { transcriptionId, progress: 10, message: 'Detecting speakers...' });
      
      // Step 2: Perform speaker diarization
      const speakerSegments = await this.performSpeakerDiarization(tempAudioPath, options);
      
      this.emit('progress', { transcriptionId, progress: 30, message: 'Transcribing segments...' });
      
      // Step 3: Transcribe each speaker segment
      const transcribedSegments = await this.transcribeSegments(speakerSegments, options);
      
      this.emit('progress', { transcriptionId, progress: 90, message: 'Finalizing...' });
      
      // Step 4: Combine and format results
      const result = this.combineResults(transcribedSegments, options);
      
      this.emit('progress', { transcriptionId, progress: 100, message: 'Complete!' });
      this.emit('complete', { transcriptionId, result });
      
      return result;
      
    } catch (error) {
      this.emit('error', { transcriptionId, error: error.message });
      throw error;
    }
  }

  async performSpeakerDiarization(audioPath, options = {}) {
    const binaryPath = this.diarizationBinaryManager.getDiarizationBinaryPath();
    const segmentModelPath = await this.diarizationModelManager.getModelPath('pyannote-segmentation-3.0');
    const embeddingModelPath = await this.diarizationModelManager.getModelPath('pyannote-embedding-1.0');
    
    const args = [
      '--audio', audioPath,
      '--segment-model', segmentModelPath,
      '--embedding-model', embeddingModelPath,
      '--max-speakers', (options.maxSpeakers || 10).toString(),
      '--threshold', (options.speakerThreshold || 0.5).toString(),
      '--output-format', 'json'
    ];

    return new Promise((resolve, reject) => {
      const process = spawn(binaryPath, args, {
        cwd: path.dirname(binaryPath) // Run from binaries directory for DLL loading
      });

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
          try {
            const speakerSegments = JSON.parse(stdout);
            resolve(speakerSegments);
          } catch (error) {
            reject(new Error('Failed to parse diarization output'));
          }
        } else {
          reject(new Error(`Diarization failed: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start diarization process: ${error.message}`));
      });
    });
  }

  async transcribeSegments(speakerSegments, options) {
    const segments = [];
    const totalSegments = speakerSegments.length;

    for (let i = 0; i < speakerSegments.length; i++) {
      const segment = speakerSegments[i];
      const progressBase = 30 + (i / totalSegments) * 60; // 30-90% range
      
      this.emit('progress', { 
        transcriptionId: options.transcriptionId, 
        progress: progressBase,
        message: `Transcribing speaker ${segment.speaker_id} (${i + 1}/${totalSegments})`
      });

      // Extract audio segment for this speaker
      const segmentAudioPath = await this.extractAudioSegment(
        segment.audio_path, 
        segment.start_time, 
        segment.end_time
      );

      // Transcribe this segment using existing whisper flow
      const transcription = await this.transcribeAudioSegment(segmentAudioPath, options);

      segments.push({
        id: i,
        start: segment.start_time,
        end: segment.end_time,
        duration: segment.end_time - segment.start_time,
        text: transcription.text,
        speakerId: segment.speaker_id,
        speakerLabel: `Speaker ${segment.speaker_id}`,
        confidence: transcription.confidence || 0.9,
        words: transcription.words || []
      });

      // Clean up temporary segment audio
      await fs.unlink(segmentAudioPath).catch(() => {});
    }

    return segments;
  }

  combineResults(segments, options) {
    // Calculate speaker statistics
    const speakerStats = this.calculateSpeakerStatistics(segments);
    
    // Generate full text
    const fullText = segments.map(s => s.text).join(' ');
    
    // Calculate total duration
    const totalDuration = segments.length > 0 
      ? Math.max(...segments.map(s => s.end)) 
      : 0;

    return {
      text: fullText,
      segments,
      metadata: {
        provider: 'whisper-native-diarized',
        duration: totalDuration,
        speakerCount: speakerStats.length,
        segmentCount: segments.length,
        averageConfidence: segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length,
        createdAt: new Date().toISOString(),
        diarizationEnabled: true,
        speakers: speakerStats,
        quality: {
          diarization: 'pyannote-3.0',
          transcription: 'whisper-local'
        }
      }
    };
  }

  calculateSpeakerStatistics(segments) {
    const speakerMap = new Map();

    segments.forEach(segment => {
      const speakerId = segment.speakerId;
      if (!speakerMap.has(speakerId)) {
        speakerMap.set(speakerId, {
          id: speakerId,
          label: segment.speakerLabel,
          totalDuration: 0,
          segmentCount: 0,
          wordCount: 0,
          averageConfidence: 0,
          confidenceSum: 0
        });
      }

      const stats = speakerMap.get(speakerId);
      stats.totalDuration += segment.duration;
      stats.segmentCount += 1;
      stats.wordCount += segment.text.split(/\s+/).filter(w => w.length > 0).length;
      stats.confidenceSum += segment.confidence;
    });

    return Array.from(speakerMap.values()).map(stats => ({
      ...stats,
      averageConfidence: stats.segmentCount > 0 ? stats.confidenceSum / stats.segmentCount : 0,
      wpm: stats.totalDuration > 0 ? Math.round((stats.wordCount / stats.totalDuration) * 60) : 0
    }));
  }
}