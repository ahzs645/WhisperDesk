// src/main/utils/system-audio-helper.js
/**
 * macOS System Audio Capture Helper
 * Handles the complexities of system audio capture on macOS
 */

const { systemPreferences } = require('electron');
const { execAsync } = require('./exec-utils');

class SystemAudioHelper {
  constructor() {
    this.cachedDevices = null;
    this.lastCheck = null;
  }

  /**
   * Check if system audio capture is supported
   */
  async isSystemAudioSupported() {
    try {
      // Check macOS version (ScreenCaptureKit requires 13+)
      const version = await this.getMacOSVersion();
      if (version < 13) {
        return {
          supported: false,
          reason: 'macOS 13+ required for ScreenCaptureKit system audio'
        };
      }

      // Check if we have the required permissions
      const permissions = await this.checkPermissions();
      if (permissions.screen !== 'granted') {
        return {
          supported: false,
          reason: 'Screen recording permission required'
        };
      }

      return { supported: true };
    } catch (error) {
      return {
        supported: false,
        reason: `Error checking support: ${error.message}`
      };
    }
  }

  /**
   * Get macOS version
   */
  async getMacOSVersion() {
    try {
      const { stdout } = await execAsync('sw_vers -productVersion');
      const version = stdout.trim().split('.')[0];
      return parseInt(version);
    } catch (error) {
      console.warn('Could not detect macOS version:', error.message);
      return 0;
    }
  }

  /**
   * Check system permissions
   */
  async checkPermissions() {
    if (process.platform !== 'darwin') {
      return { screen: 'granted', microphone: 'granted' };
    }

    try {
      return {
        screen: systemPreferences.getMediaAccessStatus('screen'),
        microphone: systemPreferences.getMediaAccessStatus('microphone')
      };
    } catch (error) {
      console.warn('Could not check permissions:', error.message);
      return { screen: 'unknown', microphone: 'unknown' };
    }
  }

  /**
   * Request system permissions
   */
  async requestPermissions() {
    if (process.platform !== 'darwin') {
      return { screen: 'granted', microphone: 'granted' };
    }

    try {
      const results = {};
      
      // Request screen recording permission
      results.screen = await systemPreferences.askForMediaAccess('screen') 
        ? 'granted' : 'denied';
      
      // Request microphone permission
      results.microphone = await systemPreferences.askForMediaAccess('microphone')
        ? 'granted' : 'denied';

      return results;
    } catch (error) {
      console.error('Permission request failed:', error);
      return { screen: 'denied', microphone: 'denied' };
    }
  }

  /**
   * Detect virtual audio devices that can capture system audio
   */
  async detectSystemAudioDevices() {
    // Use cached result if recent
    if (this.cachedDevices && this.lastCheck && 
        Date.now() - this.lastCheck < 30000) {
      return this.cachedDevices;
    }

    try {
      // Check for common virtual audio devices using system_profiler
      const { stdout } = await execAsync('system_profiler SPAudioDataType -json', {
        timeout: 10000
      });
      
      const audioData = JSON.parse(stdout);
      const devices = [];

      // Parse audio devices
      if (audioData.SPAudioDataType) {
        for (const item of audioData.SPAudioDataType) {
          if (item._items) {
            for (const device of item._items) {
              const name = device._name || '';
              const hasInputs = device.coreaudio_device_input > 0;
              
              // Detect virtual audio devices
              if (hasInputs && this.isVirtualAudioDevice(name)) {
                devices.push({
                  id: device.coreaudio_device_uid || name,
                  name: name,
                  type: 'virtual-audio',
                  canCaptureSystemAudio: true
                });
              }
            }
          }
        }
      }

      this.cachedDevices = devices;
      this.lastCheck = Date.now();
      
      return devices;
    } catch (error) {
      console.warn('Could not detect virtual audio devices:', error.message);
      return [];
    }
  }

  /**
   * Check if a device name indicates it's a virtual audio device
   */
  isVirtualAudioDevice(name) {
    const virtualDeviceNames = [
      'blackhole',
      'soundflower',
      'loopback',
      'virtual',
      'aggregate',
      'multi-output'
    ];

    return virtualDeviceNames.some(keyword => 
      name.toLowerCase().includes(keyword)
    );
  }

  /**
   * Get optimal configuration for system audio capture
   */
  async getOptimalSystemAudioConfig(userOptions = {}) {
    const support = await this.isSystemAudioSupported();
    if (!support.supported) {
      throw new Error(`System audio not supported: ${support.reason}`);
    }

    const virtualDevices = await this.detectSystemAudioDevices();
    
    // Configuration strategy
    const config = {
      screenId: userOptions.screenId,
      fps: userOptions.fps || 30,
      showCursor: userOptions.showCursor !== false,
      method: 'screencapturekit-native'
    };

    // System audio strategy
    if (userOptions.includeSystemAudio) {
      if (virtualDevices.length > 0) {
        // Use virtual device for most reliable system audio capture
        config.audioDeviceId = virtualDevices[0].id;
        config.audioStrategy = 'virtual-device';
        config.recommendedDevice = virtualDevices[0].name;
      } else {
        // Use ScreenCaptureKit native system audio (requires entitlements)
        // DO NOT set audioDeviceId - this enables system audio capture
        config.audioStrategy = 'screencapturekit-native';
        config.note = 'Using ScreenCaptureKit native system audio - requires app entitlements';
      }
    }

    // Microphone handling
    if (userOptions.includeMicrophone && userOptions.audioInputId) {
      if (config.audioDeviceId) {
        // Already using a device for system audio
        config.microphoneNote = 'Microphone will be mixed with system audio';
      } else {
        // Use microphone device
        config.audioDeviceId = userOptions.audioInputId;
        config.audioStrategy = 'microphone-only';
      }
    }

    return config;
  }

  /**
   * Get setup instructions for the user
   */
  getSetupInstructions() {
    return {
      permissions: [
        'Go to System Settings > Privacy & Security > Screen Recording',
        'Enable screen recording for your app',
        'Also enable Microphone access if you plan to record voice'
      ],
      virtualAudio: [
        'Install BlackHole (free): brew install blackhole-2ch',
        'Or download from: https://github.com/ExistentialAudio/BlackHole',
        'Alternative: SoundFlower or Loopback (paid)',
        'Configure BlackHole as your system audio output during recording'
      ],
      entitlements: [
        'Add com.apple.security.device.screen-capture to entitlements',
        'Add com.apple.security.device.audio-input to entitlements',
        'Sign your app with proper provisioning profile'
      ],
      testing: [
        'Test with built-in screen recording (Cmd+Shift+5) first',
        'Verify system audio works in other recording apps',
        'Check Activity Monitor for audio-related processes'
      ]
    };
  }
}

module.exports = SystemAudioHelper;