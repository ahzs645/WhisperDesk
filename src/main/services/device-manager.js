const { desktopCapturer } = require('electron');
const { EventEmitter } = require('events');

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.screens = [];
    this.audioDevices = [];
  }

  async initialize() {
    await this.refreshScreens();
  }

  async refreshScreens() {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      this.screens = sources.map((source, index) => ({
        id: source.id,
        name: source.name || `Screen ${index + 1}`,
        type: 'screen'
      }));
    } catch (error) {
      this.screens = [{ id: 'screen:0', name: 'Primary Display', type: 'screen' }];
    }
  }

  async getAvailableScreens() {
    if (!this.screens.length) {
      await this.refreshScreens();
    }
    return this.screens;
  }

  updateAudioDevices(devices = []) {
    this.audioDevices = Array.isArray(devices) ? devices : [];
  }

  validateDeviceSelection(screenId, audioId) {
    const issues = [];
    if (screenId && !this.screens.find(d => d.id === screenId)) {
      issues.push(`Screen device '${screenId}' not available`);
    }
    if (audioId && !this.audioDevices.find(d => d.id === audioId)) {
      issues.push(`Audio device '${audioId}' not available`);
    }
    return { valid: issues.length === 0, issues };
  }

  async checkPermissions() {
    return { screen: 'unknown', microphone: 'unknown' };
  }

  async requestPermissions() {
    return { screen: 'granted', microphone: 'granted' };
  }

  getFormattedDevices() {
    return {
      screens: this.screens.map(d => d.id),
      audio: this.audioDevices.map(d => d.id),
      deviceNames: {
        screens: Object.fromEntries(this.screens.map(d => [d.id, d.name])),
        audio: Object.fromEntries(this.audioDevices.map(d => [d.id, d.name]))
      }
    };
  }
}

module.exports = DeviceManager;
