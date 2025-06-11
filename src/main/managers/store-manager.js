// src/main/managers/store-manager.js
const Store = require('electron-store');

class StoreManager {
  constructor() {
    this.stores = {};
  }

  async initialize() {
    try {
      console.log('🔧 Initializing stores...');
      
      // Main application store
      this.stores.main = new Store({
        name: 'main',
        defaults: {
          theme: 'system',
          windowBounds: {
            width: 1200,
            height: 800
          }
        }
      });

      // Settings store
      this.stores.settings = new Store({
        name: 'settings',
        defaults: {
          transcription: {
            provider: 'whisper',
            language: 'auto',
            model: 'base'
          },
          recording: {
            quality: 'high',
            format: 'mp4'
          }
        }
      });

      // User data store
      this.stores.userData = new Store({
        name: 'user-data',
        defaults: {
          recordings: [],
          transcriptions: [],
          recentFiles: []
        }
      });

      console.log('✅ All stores initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Store initialization failed:', error);
      return false;
    }
  }

  getStore(storeName) {
    return this.stores[storeName];
  }

  getMainStore() {
    return this.stores.main;
  }

  getSettingsStore() {
    return this.stores.settings;
  }

  getUserDataStore() {
    return this.stores.userData;
  }

  // Convenience methods for main store
  get(key) {
    return this.stores.main?.get(key);
  }

  set(key, value) {
    return this.stores.main?.set(key, value);
  }

  // Settings convenience methods
  getSetting(key) {
    return this.stores.settings?.get(key);
  }

  setSetting(key, value) {
    return this.stores.settings?.set(key, value);
  }

  // User data convenience methods
  getUserData(key) {
    return this.stores.userData?.get(key);
  }

  setUserData(key, value) {
    return this.stores.userData?.set(key, value);
  }

  // Clear all stores
  clearAll() {
    Object.values(this.stores).forEach(store => {
      if (store && typeof store.clear === 'function') {
        store.clear();
      }
    });
  }

  // Get all store data (for debugging)
  getAllData() {
    const data = {};
    Object.entries(this.stores).forEach(([name, store]) => {
      if (store && typeof store.store === 'object') {
        data[name] = store.store;
      }
    });
    return data;
  }
}

module.exports = StoreManager;