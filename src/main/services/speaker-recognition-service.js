const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class SpeakerRecognitionService extends EventEmitter {
  constructor() {
    super();
    this.speakers = new Map(); // Store speaker profiles
    this.speakerLabels = new Map(); // Map speaker IDs to custom labels
    this.voicePrints = new Map(); // Store voice characteristics
    this.isInitialized = false;
    this.speakerDataPath = path.join(os.homedir(), '.whisperdesk', 'speakers');
  }

  async initialize() {
    try {
      // Create speakers directory
      await fs.mkdir(this.speakerDataPath, { recursive: true });
      
      // Load existing speaker data
      await this.loadSpeakerData();
      
      this.isInitialized = true;
      console.log('Speaker recognition service initialized');
    } catch (error) {
      console.error('Error initializing speaker recognition service:', error);
      this.isInitialized = false;
    }
  }

  async loadSpeakerData() {
    try {
      const speakersFile = path.join(this.speakerDataPath, 'speakers.json');
      const labelsFile = path.join(this.speakerDataPath, 'labels.json');
      const voicePrintsFile = path.join(this.speakerDataPath, 'voiceprints.json');

      // Load speakers
      try {
        const speakersData = await fs.readFile(speakersFile, 'utf8');
        const speakers = JSON.parse(speakersData);
        this.speakers = new Map(Object.entries(speakers));
      } catch (error) {
        console.log('No existing speakers data found, starting fresh');
      }

      // Load labels
      try {
        const labelsData = await fs.readFile(labelsFile, 'utf8');
        const labels = JSON.parse(labelsData);
        this.speakerLabels = new Map(Object.entries(labels));
      } catch (error) {
        console.log('No existing speaker labels found, starting fresh');
      }

      // Load voice prints
      try {
        const voicePrintsData = await fs.readFile(voicePrintsFile, 'utf8');
        const voicePrints = JSON.parse(voicePrintsData);
        this.voicePrints = new Map(Object.entries(voicePrints));
      } catch (error) {
        console.log('No existing voice prints found, starting fresh');
      }

    } catch (error) {
      console.error('Error loading speaker data:', error);
    }
  }

  async saveSpeakerData() {
    try {
      const speakersFile = path.join(this.speakerDataPath, 'speakers.json');
      const labelsFile = path.join(this.speakerDataPath, 'labels.json');
      const voicePrintsFile = path.join(this.speakerDataPath, 'voiceprints.json');

      // Save speakers
      const speakersObj = Object.fromEntries(this.speakers);
      await fs.writeFile(speakersFile, JSON.stringify(speakersObj, null, 2));

      // Save labels
      const labelsObj = Object.fromEntries(this.speakerLabels);
      await fs.writeFile(labelsFile, JSON.stringify(labelsObj, null, 2));

      // Save voice prints
      const voicePrintsObj = Object.fromEntries(this.voicePrints);
      await fs.writeFile(voicePrintsFile, JSON.stringify(voicePrintsObj, null, 2));

    } catch (error) {
      console.error('Error saving speaker data:', error);
      throw error;
    }
  }

  async processSpeakerDiarization(transcriptionResult) {
    if (!this.isInitialized) {
      throw new Error('Speaker recognition service not initialized');
    }

    try {
      const { segments } = transcriptionResult;
      const processedSegments = [];
      const detectedSpeakers = new Set();

      for (const segment of segments) {
        const processedSegment = await this.processSegment(segment);
        processedSegments.push(processedSegment);
        
        if (processedSegment.speakerId) {
          detectedSpeakers.add(processedSegment.speakerId);
        }
      }

      // Update speaker statistics
      await this.updateSpeakerStatistics(Array.from(detectedSpeakers));

      return {
        ...transcriptionResult,
        segments: processedSegments,
        speakers: await this.getSpeakerSummary(Array.from(detectedSpeakers))
      };

    } catch (error) {
      console.error('Error processing speaker diarization:', error);
      throw error;
    }
  }

  async processSegment(segment) {
    const { speaker, text, start, end, confidence } = segment;
    
    // Generate or retrieve speaker ID
    let speakerId = this.getSpeakerIdFromLabel(speaker);
    
    if (!speakerId) {
      speakerId = this.generateSpeakerId();
      await this.createSpeakerProfile(speakerId, speaker);
    }

    // Extract voice characteristics for future recognition
    const voiceCharacteristics = this.extractVoiceCharacteristics(segment);
    await this.updateVoicePrint(speakerId, voiceCharacteristics);

    return {
      ...segment,
      speakerId,
      speakerLabel: this.getSpeakerLabel(speakerId),
      voiceCharacteristics
    };
  }

  getSpeakerIdFromLabel(speakerLabel) {
    for (const [id, label] of this.speakerLabels) {
      if (label === speakerLabel) {
        return id;
      }
    }
    return null;
  }

  generateSpeakerId() {
    return `speaker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createSpeakerProfile(speakerId, originalLabel) {
    const profile = {
      id: speakerId,
      originalLabel,
      customLabel: originalLabel,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      segmentCount: 0,
      totalDuration: 0,
      averageConfidence: 0,
      voiceCharacteristics: {}
    };

    this.speakers.set(speakerId, profile);
    this.speakerLabels.set(speakerId, originalLabel);
    
    await this.saveSpeakerData();
    
    this.emit('speakerCreated', { speakerId, profile });
    
    return profile;
  }

  extractVoiceCharacteristics(segment) {
    // This is a simplified implementation
    // In a real application, you would use audio analysis libraries
    // to extract features like pitch, formants, spectral characteristics, etc.
    
    const { text, confidence, start, end } = segment;
    const duration = end - start;
    
    return {
      duration,
      confidence,
      wordCount: text.split(' ').length,
      averageWordLength: text.split(' ').reduce((sum, word) => sum + word.length, 0) / text.split(' ').length,
      speechRate: text.split(' ').length / duration, // words per second
      timestamp: Date.now()
    };
  }

  async updateVoicePrint(speakerId, characteristics) {
    let voicePrint = this.voicePrints.get(speakerId);
    
    if (!voicePrint) {
      voicePrint = {
        speakerId,
        samples: [],
        averageCharacteristics: {},
        confidence: 0,
        lastUpdated: new Date().toISOString()
      };
    }

    // Add new sample
    voicePrint.samples.push(characteristics);
    
    // Keep only the last 100 samples to prevent unlimited growth
    if (voicePrint.samples.length > 100) {
      voicePrint.samples = voicePrint.samples.slice(-100);
    }

    // Update average characteristics
    voicePrint.averageCharacteristics = this.calculateAverageCharacteristics(voicePrint.samples);
    voicePrint.confidence = this.calculateVoicePrintConfidence(voicePrint.samples);
    voicePrint.lastUpdated = new Date().toISOString();

    this.voicePrints.set(speakerId, voicePrint);
    await this.saveSpeakerData();
  }

  calculateAverageCharacteristics(samples) {
    if (samples.length === 0) return {};

    const totals = samples.reduce((acc, sample) => {
      Object.keys(sample).forEach(key => {
        if (typeof sample[key] === 'number') {
          acc[key] = (acc[key] || 0) + sample[key];
        }
      });
      return acc;
    }, {});

    const averages = {};
    Object.keys(totals).forEach(key => {
      averages[key] = totals[key] / samples.length;
    });

    return averages;
  }

  calculateVoicePrintConfidence(samples) {
    if (samples.length < 3) return 0.3; // Low confidence with few samples
    if (samples.length < 10) return 0.6; // Medium confidence
    return Math.min(0.95, 0.6 + (samples.length - 10) * 0.01); // High confidence with many samples
  }

  async updateSpeakerStatistics(speakerIds) {
    for (const speakerId of speakerIds) {
      const speaker = this.speakers.get(speakerId);
      if (speaker) {
        speaker.lastSeen = new Date().toISOString();
        speaker.segmentCount += 1;
        this.speakers.set(speakerId, speaker);
      }
    }
    
    await this.saveSpeakerData();
  }

  async getSpeakerSummary(speakerIds) {
    const summary = [];
    
    for (const speakerId of speakerIds) {
      const speaker = this.speakers.get(speakerId);
      const voicePrint = this.voicePrints.get(speakerId);
      
      if (speaker) {
        summary.push({
          id: speakerId,
          label: this.getSpeakerLabel(speakerId),
          originalLabel: speaker.originalLabel,
          segmentCount: speaker.segmentCount,
          totalDuration: speaker.totalDuration,
          confidence: voicePrint ? voicePrint.confidence : 0,
          lastSeen: speaker.lastSeen
        });
      }
    }
    
    return summary;
  }

  getSpeakerLabel(speakerId) {
    return this.speakerLabels.get(speakerId) || `Speaker ${speakerId.slice(-4)}`;
  }

  async setSpeakerLabel(speakerId, label) {
    // If speaker doesn't exist, create a basic profile
    if (!this.speakers.has(speakerId)) {
      console.log(`Creating new speaker profile for ${speakerId}`);
      await this.createSpeakerProfile(speakerId, `Speaker ${speakerId.slice(-4)}`);
    }

    this.speakerLabels.set(speakerId, label);
    
    // Update speaker profile
    const speaker = this.speakers.get(speakerId);
    speaker.customLabel = label;
    this.speakers.set(speakerId, speaker);
    
    await this.saveSpeakerData();
    
    this.emit('speakerLabelUpdated', { speakerId, label });
    
    return { success: true };
  }

  async getAllSpeakers() {
    const speakers = [];
    
    for (const [speakerId, speaker] of this.speakers) {
      const voicePrint = this.voicePrints.get(speakerId);
      
      speakers.push({
        id: speakerId,
        label: this.getSpeakerLabel(speakerId),
        originalLabel: speaker.originalLabel,
        customLabel: speaker.customLabel,
        createdAt: speaker.createdAt,
        lastSeen: speaker.lastSeen,
        segmentCount: speaker.segmentCount,
        totalDuration: speaker.totalDuration,
        confidence: voicePrint ? voicePrint.confidence : 0,
        voiceCharacteristics: voicePrint ? voicePrint.averageCharacteristics : {}
      });
    }
    
    return speakers.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
  }

  async deleteSpeaker(speakerId) {
    if (!this.speakers.has(speakerId)) {
      throw new Error(`Speaker ${speakerId} not found`);
    }

    this.speakers.delete(speakerId);
    this.speakerLabels.delete(speakerId);
    this.voicePrints.delete(speakerId);
    
    await this.saveSpeakerData();
    
    this.emit('speakerDeleted', { speakerId });
    
    return { success: true };
  }

  async mergeSpeakers(primarySpeakerId, secondarySpeakerId) {
    const primarySpeaker = this.speakers.get(primarySpeakerId);
    const secondarySpeaker = this.speakers.get(secondarySpeakerId);
    
    if (!primarySpeaker || !secondarySpeaker) {
      throw new Error('One or both speakers not found');
    }

    // Merge statistics
    primarySpeaker.segmentCount += secondarySpeaker.segmentCount;
    primarySpeaker.totalDuration += secondarySpeaker.totalDuration;
    primarySpeaker.lastSeen = new Date(Math.max(
      new Date(primarySpeaker.lastSeen),
      new Date(secondarySpeaker.lastSeen)
    )).toISOString();

    // Merge voice prints
    const primaryVoicePrint = this.voicePrints.get(primarySpeakerId);
    const secondaryVoicePrint = this.voicePrints.get(secondarySpeakerId);
    
    if (primaryVoicePrint && secondaryVoicePrint) {
      primaryVoicePrint.samples = [
        ...primaryVoicePrint.samples,
        ...secondaryVoicePrint.samples
      ].slice(-100); // Keep only last 100 samples
      
      primaryVoicePrint.averageCharacteristics = this.calculateAverageCharacteristics(primaryVoicePrint.samples);
      primaryVoicePrint.confidence = this.calculateVoicePrintConfidence(primaryVoicePrint.samples);
      primaryVoicePrint.lastUpdated = new Date().toISOString();
    }

    // Update primary speaker
    this.speakers.set(primarySpeakerId, primarySpeaker);
    if (primaryVoicePrint) {
      this.voicePrints.set(primarySpeakerId, primaryVoicePrint);
    }

    // Delete secondary speaker
    await this.deleteSpeaker(secondarySpeakerId);
    
    this.emit('speakersMerged', { primarySpeakerId, secondarySpeakerId });
    
    return { success: true };
  }

  async identifySpeaker(voiceCharacteristics) {
    if (this.voicePrints.size === 0) {
      return null;
    }

    let bestMatch = null;
    let bestScore = 0;

    for (const [speakerId, voicePrint] of this.voicePrints) {
      const score = this.calculateSimilarityScore(voiceCharacteristics, voicePrint.averageCharacteristics);
      
      if (score > bestScore && score > 0.7) { // Threshold for speaker identification
        bestScore = score;
        bestMatch = {
          speakerId,
          confidence: score,
          label: this.getSpeakerLabel(speakerId)
        };
      }
    }

    return bestMatch;
  }

  calculateSimilarityScore(characteristics1, characteristics2) {
    const keys = Object.keys(characteristics1).filter(key => 
      typeof characteristics1[key] === 'number' && 
      typeof characteristics2[key] === 'number'
    );

    if (keys.length === 0) return 0;

    let totalScore = 0;
    let weightSum = 0;

    // Define weights for different characteristics
    const weights = {
      speechRate: 0.3,
      averageWordLength: 0.2,
      confidence: 0.1,
      duration: 0.1,
      wordCount: 0.1
    };

    for (const key of keys) {
      const weight = weights[key] || 0.1;
      const diff = Math.abs(characteristics1[key] - characteristics2[key]);
      const maxVal = Math.max(characteristics1[key], characteristics2[key]);
      
      if (maxVal > 0) {
        const similarity = 1 - (diff / maxVal);
        totalScore += similarity * weight;
        weightSum += weight;
      }
    }

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  async exportSpeakerData() {
    const exportData = {
      speakers: Object.fromEntries(this.speakers),
      labels: Object.fromEntries(this.speakerLabels),
      voicePrints: Object.fromEntries(this.voicePrints),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return exportData;
  }

  async importSpeakerData(importData) {
    try {
      if (importData.speakers) {
        this.speakers = new Map(Object.entries(importData.speakers));
      }
      
      if (importData.labels) {
        this.speakerLabels = new Map(Object.entries(importData.labels));
      }
      
      if (importData.voicePrints) {
        this.voicePrints = new Map(Object.entries(importData.voicePrints));
      }

      await this.saveSpeakerData();
      
      this.emit('speakerDataImported', { 
        speakerCount: this.speakers.size,
        importedAt: new Date().toISOString()
      });

      return { success: true, speakerCount: this.speakers.size };
    } catch (error) {
      console.error('Error importing speaker data:', error);
      throw error;
    }
  }

  async getStatistics() {
    const totalSpeakers = this.speakers.size;
    const totalSegments = Array.from(this.speakers.values())
      .reduce((sum, speaker) => sum + speaker.segmentCount, 0);
    const totalDuration = Array.from(this.speakers.values())
      .reduce((sum, speaker) => sum + speaker.totalDuration, 0);
    
    const averageConfidence = this.voicePrints.size > 0 
      ? Array.from(this.voicePrints.values())
          .reduce((sum, vp) => sum + vp.confidence, 0) / this.voicePrints.size
      : 0;

    return {
      totalSpeakers,
      totalSegments,
      totalDuration,
      averageConfidence,
      lastUpdated: new Date().toISOString()
    };
  }

  async cleanup() {
    try {
      await this.saveSpeakerData();
      this.speakers.clear();
      this.speakerLabels.clear();
      this.voicePrints.clear();
    } catch (error) {
      console.error('Error during speaker recognition service cleanup:', error);
    }
  }
}

module.exports = SpeakerRecognitionService;