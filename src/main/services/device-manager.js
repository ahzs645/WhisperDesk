// src/main/services/device-manager.js - NEW SERVICE for proper device management
const { EventEmitter } = require('events');
const { desktopCapturer, systemPreferences } = require('electron');

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.availableScreens = [];
    this.availableAudioDevices = [];
    this.lastRefresh = null;
    this.refreshInterval = null;
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Device Manager...');
      
      // Initial device refresh
      await this.refreshDevices();
      
      // Set up periodic refresh (every 30 seconds)
      this.refreshInterval = setInterval(() => {
        this.refreshDevices().catch(error => {
          console.warn('⚠️ Periodic device refresh failed:', error);
        });
      }, 30000);
      
      console.log('✅ Device Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Device Manager:', error);
      throw error;
    }
  }

  async refreshDevices() {
    try {
      console.log('🔄 Refreshing available devices...');
      
      // Get screen sources using desktopCapturer
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }, // Skip thumbnails for performance
        fetchWindowIcons: false
      });
      
      // Process screen sources
      const screens = sources.filter(source => source.id.startsWith('screen:'));
      const windows = sources.filter(source => source.id.startsWith('window:'));
      
      this.availableScreens = [
        // Add screens first
        ...screens.map((screen, index) => ({
          id: screen.id,
          name: screen.name || `Display ${index + 1}`,
          type: 'screen',
          displayId: screen.display_id,
          size: screen.thumbnail ? { 
            width: screen.thumbnail.getSize().width, 
            height: screen.thumbnail.getSize().height 
          } : null
        })),
        
        // Add windows (limit to top 5 for performance)
        ...windows.slice(0, 5).map((window, index) => ({
          id: window.id,
          name: window.name || `Window: ${window.id}`,
          type: 'window',
          appName: this.extractAppName(window.name)
        }))
      ];
      
      // Audio devices will be enumerated in renderer process
      // We provide a placeholder here and update via IPC
      this.availableAudioDevices = [
        { id: 'default', name: 'Default Audio Input', type: 'audioinput' },
        { id: 'system', name: 'System Audio', type: 'audiooutput' }
      ];
      
      this.lastRefresh = new Date();
      
      console.log(`✅ Device refresh complete: ${screens.length} screens, ${windows.length} windows`);
      
      // Emit refresh event
      this.emit('devicesRefreshed', {
        screens: this.availableScreens,
        audio: this.availableAudioDevices,
        timestamp: this.lastRefresh
      });
      
      return {
        screens: this.availableScreens,
        audio: this.availableAudioDevices
      };
      
    } catch (error) {
      console.error('❌ Failed to refresh devices:', error);
      throw error;
    }
  }

  extractAppName(windowName) {
    // Extract app name from window title
    // Common patterns: "Document - AppName", "AppName - Document", etc.
    if (!windowName) return 'Unknown App';
    
    const separators = [' - ', ' — ', ' | '];
    for (const sep of separators) {
      if (windowName.includes(sep)) {
        const parts = windowName.split(sep);
        return parts[parts.length - 1].trim(); // Usually app name is last
      }
    }
    
    return windowName.length > 30 ? windowName.substring(0, 30) + '...' : windowName;
  }

  async getAvailableScreens() {
    if (!this.lastRefresh || Date.now() - this.lastRefresh.getTime() > 60000) {
      await this.refreshDevices();
    }
    
    return this.availableScreens.map(screen => ({
      id: screen.id,
      name: screen.name,
      type: screen.type,
      displayId: screen.displayId
    }));
  }

  async getAvailableAudioDevices() {
    return this.availableAudioDevices;
  }

  // Update audio devices from renderer process
  updateAudioDevices(audioDevices) {
    console.log('🔄 Updating audio devices from renderer:', audioDevices.length);
    this.availableAudioDevices = audioDevices;
    
    this.emit('audioDevicesUpdated', {
      audio: this.availableAudioDevices,
      timestamp: new Date()
    });
  }

  async checkPermissions() {
    const permissions = {
      screen: 'unknown',
      microphone: 'unknown',
      camera: 'unknown'
    };

    if (process.platform === 'darwin') {
      try {
        permissions.screen = systemPreferences.getMediaAccessStatus('screen');
        permissions.microphone = systemPreferences.getMediaAccessStatus('microphone');
        permissions.camera = systemPreferences.getMediaAccessStatus('camera');
      } catch (error) {
        console.warn('⚠️ Failed to check permissions:', error);
      }
    } else {
      // On Windows/Linux, assume permissions are granted
      permissions.screen = 'granted';
      permissions.microphone = 'granted';
      permissions.camera = 'granted';
    }

    return permissions;
  }

  async requestPermissions() {
    if (process.platform === 'darwin') {
      try {
        // Request screen recording permission
        const screenPermission = await systemPreferences.askForMediaAccess('screen');
        console.log('📱 Screen permission result:', screenPermission);
        
        // Request microphone permission
        const micPermission = await systemPreferences.askForMediaAccess('microphone');
        console.log('🎤 Microphone permission result:', micPermission);
        
        return {
          screen: screenPermission ? 'granted' : 'denied',
          microphone: micPermission ? 'granted' : 'denied'
        };
      } catch (error) {
        console.error('❌ Failed to request permissions:', error);
        return {
          screen: 'unknown',
          microphone: 'unknown'
        };
      }
    }
    
    return {
      screen: 'granted',
      microphone: 'granted'
    };
  }

  getFormattedDevices() {
    return {
      screens: this.availableScreens.map(s => s.id),
      audio: this.availableAudioDevices.map(a => a.id),
      deviceNames: {
        screens: Object.fromEntries(this.availableScreens.map(s => [s.id, s.name])),
        audio: Object.fromEntries(this.availableAudioDevices.map(a => [a.id, a.name]))
      }
    };
  }

  getDeviceInfo(deviceId) {
    const screen = this.availableScreens.find(s => s.id === deviceId);
    if (screen) return screen;
    
    const audio = this.availableAudioDevices.find(a => a.id === deviceId);
    if (audio) return audio;
    
    return null;
  }

  validateDeviceSelection(screenId, audioId) {
    const issues = [];
    
    if (screenId) {
      const screen = this.availableScreens.find(s => s.id === screenId);
      if (!screen) {
        issues.push(`Screen device '${screenId}' not found`);
      }
    }
    
    if (audioId && audioId !== 'none') {
      const audio = this.availableAudioDevices.find(a => a.id === audioId);
      if (!audio) {
        issues.push(`Audio device '${audioId}' not found`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  cleanup() {
    console.log('🧹 Device Manager cleanup');
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    this.availableScreens = [];
    this.availableAudioDevices = [];
    this.lastRefresh = null;
  }
}

module.exports = DeviceManager;