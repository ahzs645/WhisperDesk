import TauriBridge from './TauriBridge';
import VibeBridge from './VibeBridge';

/**
 * BridgeAdapter - Allows switching between TauriBridge and VibeBridge
 * This enables using either WhisperDesk's own Tauri backend or Vibe's backend
 * The backend can be switched dynamically through configuration
 */
class BridgeAdapter {
  constructor() {
    this.backend = 'vibe'; // Default to Vibe backend
    this.tauriBridge = null;
    this.vibeBridge = null;
    this.currentBridge = null;
    this.initialized = false;
  }

  async initialize(backend = 'vibe') {
    if (this.initialized && this.backend === backend) {
      return this.currentBridge;
    }

    this.backend = backend;
    console.log(`🔄 Initializing BridgeAdapter with ${backend} backend`);

    try {
      if (backend === 'vibe') {
        if (!this.vibeBridge) {
          const VibeBridge = (await import('./VibeBridge')).default;
          this.vibeBridge = VibeBridge;
        }
        this.currentBridge = this.vibeBridge;
      } else {
        if (!this.tauriBridge) {
          const TauriBridge = (await import('./TauriBridge')).default;
          this.tauriBridge = new TauriBridge();
        }
        this.currentBridge = this.tauriBridge;
      }

      this.initialized = true;
      console.log(`✅ BridgeAdapter initialized with ${backend} backend`);
      return this.currentBridge;
    } catch (error) {
      console.error(`Failed to initialize ${backend} bridge:`, error);
      // Fallback to TauriBridge if VibeBridge fails
      if (backend === 'vibe' && !this.tauriBridge) {
        console.log('Falling back to TauriBridge...');
        this.backend = 'tauri';
        return this.initialize('tauri');
      }
      throw error;
    }
  }

  async switchBackend(backend) {
    console.log(`Switching backend from ${this.backend} to ${backend}`);
    await this.initialize(backend);
    
    // Save preference
    if (this.currentBridge?.saveSettings) {
      await this.currentBridge.saveSettings('preferredBackend', backend);
    }
  }

  // Proxy all method calls to the current bridge
  async invoke(...args) {
    if (!this.currentBridge) {
      await this.initialize();
    }
    return this.currentBridge.invoke(...args);
  }

  on(...args) {
    if (!this.currentBridge) {
      throw new Error('Bridge not initialized. Call initialize() first.');
    }
    return this.currentBridge.on(...args);
  }

  removeListener(...args) {
    if (!this.currentBridge) {
      throw new Error('Bridge not initialized. Call initialize() first.');
    }
    return this.currentBridge.removeListener(...args);
  }

  async send(...args) {
    if (!this.currentBridge) {
      await this.initialize();
    }
    return this.currentBridge.send(...args);
  }

  async getSettings(...args) {
    if (!this.currentBridge) {
      await this.initialize();
    }
    return this.currentBridge.getSettings(...args);
  }

  async saveSettings(...args) {
    if (!this.currentBridge) {
      await this.initialize();
    }
    return this.currentBridge.saveSettings(...args);
  }

  // Additional helper methods
  getCurrentBackend() {
    return this.backend;
  }

  isUsingVibe() {
    return this.backend === 'vibe';
  }

  async setVibePath(path) {
    if (this.vibeBridge?.setVibePath) {
      await this.vibeBridge.setVibePath(path);
    }
  }

  // Audio recording helpers (delegate to current bridge)
  async startRecording(...args) {
    if (!this.currentBridge) {
      await this.initialize();
    }
    if (this.currentBridge.startRecording) {
      return this.currentBridge.startRecording(...args);
    }
    return this.invoke('start-recording', ...args);
  }

  async stopRecording(...args) {
    if (!this.currentBridge) {
      await this.initialize();
    }
    if (this.currentBridge.stopRecording) {
      return this.currentBridge.stopRecording(...args);
    }
    return this.invoke('stop-recording', ...args);
  }

  getRecordingState() {
    if (this.currentBridge?.getRecordingState) {
      return this.currentBridge.getRecordingState();
    }
    return {
      isRecording: false,
      devices: [],
      currentDevice: null
    };
  }
}

// Export singleton instance
const bridgeAdapter = new BridgeAdapter();

// Auto-initialize with saved preference or default
(async () => {
  try {
    // Try to load saved preference
    const savedBackend = localStorage.getItem('preferredBackend') || 'vibe';
    await bridgeAdapter.initialize(savedBackend);
  } catch (error) {
    console.warn('BridgeAdapter auto-initialization failed:', error);
  }
})();

export default bridgeAdapter;