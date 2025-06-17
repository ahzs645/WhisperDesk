/**
 * @fileoverview Device manager for screen recording - handles device discovery and validation
 */

const { EventEmitter } = require('events');
const { desktopCapturer, systemPreferences } = require('electron');
const { RECORDING_EVENTS, ERROR_TYPES } = require('../types');

/**
 * Device manager for screen recording
 * Handles discovery, validation, and management of recording devices
 */
class DeviceManager extends EventEmitter {
  constructor() {
    super();
    
    // Device lists
    this.availableScreens = [];
    this.availableAudioDevices = [];
    
    // Refresh tracking
    this.lastRefresh = null;
    this.refreshInterval = null;
    this.isRefreshing = false;
    
    // Configuration
    this.config = {
      refreshIntervalMs: 30000, // 30 seconds
      maxWindows: 10, // Limit windows for performance
      cacheTimeoutMs: 60000 // 1 minute cache timeout
    };
  }

  /**
   * Initialize the device manager
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Screen Recorder Device Manager...');
      
      // Initial device refresh
      await this.refreshDevices();
      
      // Set up periodic refresh
      this.startPeriodicRefresh();
      
      console.log('✅ Screen Recorder Device Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Screen Recorder Device Manager:', error);
      throw error;
    }
  }

  /**
   * Refresh available devices
   * @param {boolean} force - Force refresh even if cache is valid
   * @returns {Promise<{screens: Array, audio: Array}>}
   */
  async refreshDevices(force = false) {
    // Prevent concurrent refreshes
    if (this.isRefreshing && !force) {
      console.log('🔄 Device refresh already in progress, skipping...');
      return {
        screens: this.availableScreens,
        audio: this.availableAudioDevices
      };
    }

    // Check cache validity
    if (!force && this.isCacheValid()) {
      console.log('📋 Using cached device list');
      return {
        screens: this.availableScreens,
        audio: this.availableAudioDevices
      };
    }

    this.isRefreshing = true;

    try {
      console.log('🔄 Refreshing available devices...');
      
      // Get screen and window sources
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }, // Skip thumbnails for performance
        fetchWindowIcons: false
      });
      
      // Process screen sources
      const screens = sources.filter(source => source.id.startsWith('screen:'));
      const windows = sources.filter(source => source.id.startsWith('window:'));
      
      // Build screen list
      this.availableScreens = [
        // Add screens first
        ...screens.map((screen, index) => ({
          id: screen.id,
          name: screen.name || `Display ${index + 1}`,
          type: 'screen',
          displayId: screen.display_id,
          primary: index === 0 // Assume first screen is primary
        })),
        
        // Add windows (limited for performance)
        ...windows
          .slice(0, this.config.maxWindows)
          .map((window, index) => ({
            id: window.id,
            name: this.sanitizeWindowName(window.name),
            type: 'window',
            appName: this.extractAppName(window.name),
            windowId: window.id
          }))
      ];
      
      // Audio devices are managed by renderer process
      // We provide placeholders that will be updated via IPC
      if (this.availableAudioDevices.length === 0) {
        this.availableAudioDevices = [
          { id: 'default', name: 'Default Audio Input', type: 'audioinput' },
          { id: 'system', name: 'System Audio', type: 'audiooutput' }
        ];
      }
      
      this.lastRefresh = new Date();
      
      console.log(`✅ Device refresh complete: ${screens.length} screens, ${windows.length} windows`);
      
      // Emit refresh event
      this.emit(RECORDING_EVENTS.DEVICES_REFRESHED, {
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
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get available screen sources
   * @param {boolean} refresh - Whether to refresh the device list
   * @returns {Promise<Array<import('../types').ScreenSource>>}
   */
  async getAvailableScreens(refresh = false) {
    if (refresh || !this.isCacheValid()) {
      await this.refreshDevices();
    }
    
    return this.availableScreens.map(screen => ({
      id: screen.id,
      name: screen.name,
      type: screen.type,
      displayId: screen.displayId,
      primary: screen.primary
    }));
  }

  /**
   * Get available audio devices
   * @returns {Promise<Array<import('../types').AudioDevice>>}
   */
  async getAvailableAudioDevices() {
    return [...this.availableAudioDevices];
  }

  /**
   * Update audio devices from renderer process
   * @param {Array<import('../types').AudioDevice>} audioDevices - Audio devices from renderer
   */
  updateAudioDevices(audioDevices) {
    console.log('🔄 Updating audio devices from renderer:', audioDevices.length);
    
    this.availableAudioDevices = audioDevices.map(device => ({
      id: device.deviceId || device.id,
      name: device.label || device.name || 'Unknown Device',
      type: device.kind || device.type || 'audioinput',
      groupId: device.groupId
    }));
    
    this.emit(RECORDING_EVENTS.AUDIO_DEVICES_UPDATED, {
      audio: this.availableAudioDevices,
      timestamp: new Date()
    });
  }

  /**
   * Validate device selection
   * @param {string} screenId - Selected screen ID
   * @param {string} audioId - Selected audio device ID
   * @returns {import('../types').DeviceValidation}
   */
  validateDeviceSelection(screenId, audioId) {
    const issues = [];
    const suggestions = {};

    // Validate screen source
    if (!screenId) {
      issues.push('No screen source selected');
      suggestions.screen = 'Please select a screen or window to record';
    } else {
      const screenSource = this.availableScreens.find(screen => screen.id === screenId);
      if (!screenSource) {
        issues.push(`Screen source '${screenId}' not found`);
        suggestions.screen = 'Please refresh devices and select a valid screen source';
      }
    }

    // Validate audio device (optional)
    if (audioId && audioId !== 'none') {
      const audioDevice = this.availableAudioDevices.find(device => device.id === audioId);
      if (!audioDevice) {
        issues.push(`Audio device '${audioId}' not found`);
        suggestions.audio = 'Please refresh devices and select a valid audio device';
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions: Object.keys(suggestions).length > 0 ? suggestions : undefined
    };
  }

  /**
   * Get device information by ID
   * @param {string} deviceId - Device ID to look up
   * @returns {import('../types').ScreenSource|import('../types').AudioDevice|null}
   */
  getDeviceInfo(deviceId) {
    // Check screens first
    const screenDevice = this.availableScreens.find(screen => screen.id === deviceId);
    if (screenDevice) {
      return screenDevice;
    }

    // Check audio devices
    const audioDevice = this.availableAudioDevices.find(device => device.id === deviceId);
    if (audioDevice) {
      return audioDevice;
    }

    return null;
  }

  /**
   * Get formatted device information for UI
   * @returns {Object}
   */
  getFormattedDevices() {
    return {
      screens: this.availableScreens.map(screen => ({
        id: screen.id,
        name: screen.name,
        type: screen.type
      })),
      audio: this.availableAudioDevices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type
      })),
      deviceNames: {
        screens: Object.fromEntries(
          this.availableScreens.map(screen => [screen.id, screen.name])
        ),
        audio: Object.fromEntries(
          this.availableAudioDevices.map(device => [device.id, device.name])
        )
      }
    };
  }

  /**
   * Check system permissions
   * @returns {Promise<import('../types').PermissionStatus>}
   */
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

  /**
   * Request system permissions
   * @returns {Promise<import('../types').PermissionStatus>}
   */
  async requestPermissions() {
    if (process.platform === 'darwin') {
      try {
        const screenPermission = await systemPreferences.askForMediaAccess('screen');
        const micPermission = await systemPreferences.askForMediaAccess('microphone');
        
        console.log('📱 Permission results - Screen:', screenPermission, 'Microphone:', micPermission);
        
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

  /**
   * Extract app name from window title
   * @param {string} windowName - Window title
   * @returns {string} Extracted app name
   */
  extractAppName(windowName) {
    if (!windowName) return 'Unknown App';
    
    const separators = [' - ', ' — ', ' | ', ' – '];
    for (const sep of separators) {
      if (windowName.includes(sep)) {
        const parts = windowName.split(sep);
        return parts[parts.length - 1].trim();
      }
    }
    
    return windowName.length > 30 ? windowName.substring(0, 30) + '...' : windowName;
  }

  /**
   * Sanitize window name for display
   * @param {string} windowName - Raw window name
   * @returns {string} Sanitized name
   */
  sanitizeWindowName(windowName) {
    if (!windowName) return 'Unnamed Window';
    
    // Remove common prefixes/suffixes
    let sanitized = windowName
      .replace(/^(Window|App)\s*-?\s*/i, '')
      .replace(/\s*-\s*(Window|App)$/i, '')
      .trim();
    
    // Limit length
    if (sanitized.length > 50) {
      sanitized = sanitized.substring(0, 47) + '...';
    }
    
    return sanitized || 'Unnamed Window';
  }

  /**
   * Check if device cache is still valid
   * @returns {boolean}
   */
  isCacheValid() {
    if (!this.lastRefresh) return false;
    
    const cacheAge = Date.now() - this.lastRefresh.getTime();
    return cacheAge < this.config.cacheTimeoutMs;
  }

  /**
   * Start periodic device refresh
   */
  startPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      this.refreshDevices().catch(error => {
        console.warn('⚠️ Periodic device refresh failed:', error);
      });
    }, this.config.refreshIntervalMs);
    
    console.log(`🔄 Started periodic device refresh (${this.config.refreshIntervalMs}ms)`);
  }

  /**
   * Stop periodic device refresh
   */
  stopPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ Stopped periodic device refresh');
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    console.log('🧹 Cleaning up Screen Recorder Device Manager');
    
    this.stopPeriodicRefresh();
    this.availableScreens = [];
    this.availableAudioDevices = [];
    this.lastRefresh = null;
    this.isRefreshing = false;
  }

  /**
   * Destroy the device manager
   */
  destroy() {
    console.log('🗑️ Destroying Screen Recorder Device Manager');
    
    this.cleanup();
    this.removeAllListeners();
  }
}

module.exports = DeviceManager; 