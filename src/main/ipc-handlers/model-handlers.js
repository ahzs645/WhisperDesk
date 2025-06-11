// src/main/ipc-handlers/model-handlers.js
const { ipcMain } = require('electron');

class ModelHandlers {
  constructor(serviceManager) {
    this.serviceManager = serviceManager;
  }

  setup() {
    console.log('🔧 Setting up model IPC handlers...');
    
    this.setupModelManagement();
    this.setupDownloadHandlers();
    this.setupModelInfo();
    
    console.log('✅ Model IPC handlers set up');
  }

  setupModelManagement() {
    ipcMain.handle('model:getAvailable', async () => {
      try {
        const modelManager = this.getModelManager();
        if (modelManager?.getAvailableModels) {
          return await modelManager.getAvailableModels();
        }
        return [];
      } catch (error) {
        console.error('❌ Failed to get available models:', error);
        return [];
      }
    });

    ipcMain.handle('model:getInstalled', async () => {
      try {
        const modelManager = this.getModelManager();
        if (modelManager?.getInstalledModels) {
          return await modelManager.getInstalledModels();
        }
        return [];
      } catch (error) {
        console.error('❌ Failed to get installed models:', error);
        return [];
      }
    });

    ipcMain.handle('model:delete', async (event, modelId) => {
      try {
        console.log(`🗑️ [IPC] Delete request for model: ${modelId}`);
        
        const modelManager = this.getModelManager();
        if (modelManager?.deleteModel) {
          const result = await modelManager.deleteModel(modelId);
          console.log(`✅ [IPC] Delete result for ${modelId}:`, result);
          return result;
        }
        
        return { success: false, error: 'Model manager not available' };
      } catch (error) {
        console.error(`❌ [IPC] Delete failed for ${modelId}:`, error);
        return { success: false, error: error.message };
      }
    });
  }

  setupDownloadHandlers() {
    // Enhanced download handler with better error handling
    ipcMain.handle('model:download', async (event, modelId) => {
      try {
        console.log(`📥 [IPC] Download request for model: ${modelId}`);
        
        const modelManager = this.getModelManager();
        if (!modelManager?.downloadModel) {
          throw new Error('Model manager not available');
        }
        
        // Check if already installed
        if (modelManager.isModelInstalled && modelManager.isModelInstalled(modelId)) {
          throw new Error(`Model ${modelId} is already installed`);
        }

        // Check if already downloading
        if (modelManager.getDownloadStatus) {
          const downloadStatus = await modelManager.getDownloadStatus(modelId);
          if (downloadStatus) {
            throw new Error(`Model ${modelId} is already being downloaded`);
          }
        }

        const result = await modelManager.downloadModel(modelId);
        console.log(`✅ [IPC] Download started for ${modelId}:`, result.success);
        return result;
        
      } catch (error) {
        console.error(`❌ [IPC] Download failed for ${modelId}:`, error.message);
        throw error; // Re-throw so renderer gets the specific error
      }
    });

    ipcMain.handle('model:cancelDownload', async (event, modelId) => {
      try {
        console.log(`🚫 [IPC] Cancel download request for model: ${modelId}`);
        
        const modelManager = this.getModelManager();
        if (modelManager?.cancelDownload) {
          const result = await modelManager.cancelDownload(modelId);
          console.log(`✅ [IPC] Cancel result for ${modelId}:`, result);
          return result;
        }
        
        return { success: false, error: 'Model manager not available' };
      } catch (error) {
        console.error(`❌ [IPC] Cancel failed for ${modelId}:`, error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('model:getAllDownloadStates', () => {
      try {
        const modelManager = this.getModelManager();
        if (modelManager?.getAllDownloadStates) {
          const states = modelManager.getAllDownloadStates();
          return Array.from(states.entries()).map(([id, state]) => ({ id, ...state }));
        }
        return [];
      } catch (error) {
        console.error('❌ [IPC] Failed to get download states:', error);
        return [];
      }
    });
  }

  setupModelInfo() {
    ipcMain.handle('model:getInfo', (event, modelId) => {
      try {
        const modelManager = this.getModelManager();
        if (modelManager?.getModelInfo) {
          return modelManager.getModelInfo(modelId);
        }
        return null;
      } catch (error) {
        console.error(`❌ [IPC] Failed to get model info for ${modelId}:`, error);
        return null;
      }
    });

    ipcMain.handle('model:isInstalled', (event, modelId) => {
      try {
        const modelManager = this.getModelManager();
        if (modelManager?.isModelInstalled) {
          return modelManager.isModelInstalled(modelId);
        }
        return false;
      } catch (error) {
        console.error(`❌ [IPC] Failed to check if model installed ${modelId}:`, error);
        return false;
      }
    });

    ipcMain.handle('model:getDownloadStatus', async (event, modelId) => {
      try {
        const modelManager = this.getModelManager();
        if (modelManager?.getDownloadStatus) {
          return await modelManager.getDownloadStatus(modelId);
        }
        return null;
      } catch (error) {
        console.error(`❌ [IPC] Failed to get download status for ${modelId}:`, error);
        return null;
      }
    });
  }

  getModelManager() {
    return this.serviceManager?.getService('modelManager');
  }

  cleanup() {
    console.log('🔧 Cleaning up model handlers');
    // Remove any specific event listeners if needed
  }
}

module.exports = ModelHandlers;