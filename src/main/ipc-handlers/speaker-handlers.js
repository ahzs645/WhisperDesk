// src/main/ipc-handlers/speaker-handlers.js
const { ipcMain } = require('electron');

class SpeakerHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up speaker IPC handlers...');

    // Set speaker label
    ipcMain.handle('speaker-service:setSpeakerLabel', async (event, { speakerId, label }) => {
      try {
        const service = this.serviceManager.services.speakerRecognitionService;
        if (!service) {
          throw new Error('Speaker recognition service not available');
        }
        return await service.setSpeakerLabel(speakerId, label);
      } catch (error) {
        console.error('Failed to set speaker label:', error);
        throw error;
      }
    });

    // Get speaker label
    ipcMain.handle('speaker-service:getSpeakerLabel', async (event, { speakerId }) => {
      try {
        const service = this.serviceManager.services.speakerRecognitionService;
        if (!service) {
          throw new Error('Speaker recognition service not available');
        }
        return service.getSpeakerLabel(speakerId);
      } catch (error) {
        console.error('Failed to get speaker label:', error);
        throw error;
      }
    });

    // Get all speakers
    ipcMain.handle('speaker-service:getAllSpeakers', async (event) => {
      try {
        const service = this.serviceManager.services.speakerRecognitionService;
        if (!service) {
          throw new Error('Speaker recognition service not available');
        }
        return await service.getAllSpeakers();
      } catch (error) {
        console.error('Failed to get all speakers:', error);
        throw error;
      }
    });

    // Delete speaker
    ipcMain.handle('speaker-service:deleteSpeaker', async (event, { speakerId }) => {
      try {
        const service = this.serviceManager.services.speakerRecognitionService;
        if (!service) {
          throw new Error('Speaker recognition service not available');
        }
        return await service.deleteSpeaker(speakerId);
      } catch (error) {
        console.error('Failed to delete speaker:', error);
        throw error;
      }
    });

    // Process speaker diarization
    ipcMain.handle('speaker-service:processDiarization', async (event, transcriptionResult) => {
      try {
        const service = this.serviceManager.services.speakerRecognitionService;
        if (!service) {
          throw new Error('Speaker recognition service not available');
        }
        return await service.processSpeakerDiarization(transcriptionResult);
      } catch (error) {
        console.error('Failed to process speaker diarization:', error);
        throw error;
      }
    });

    console.log('✅ Speaker IPC handlers registered');
  }

  cleanup() {
    console.log('🔧 Cleaning up speaker IPC handlers...');
    
    const handlerNames = [
      'speaker-service:setSpeakerLabel',
      'speaker-service:getSpeakerLabel',
      'speaker-service:getAllSpeakers',
      'speaker-service:deleteSpeaker',
      'speaker-service:processDiarization'
    ];

    handlerNames.forEach(handlerName => {
      ipcMain.removeAllListeners(handlerName);
    });

    console.log('✅ Speaker IPC handlers cleaned up');
  }
}

module.exports = SpeakerHandlers;
