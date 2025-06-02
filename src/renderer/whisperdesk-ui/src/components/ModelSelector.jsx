import React, { useState, useEffect } from 'react';

const ModelSelector = ({ selectedModel, onModelChange, disabled = false }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Loading models...');
      
      // Check if electronAPI is available
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      // Get available models
      const availableModels = await window.electronAPI.model.getAvailable();
      console.log('Available models:', availableModels);
      
      // Get installed models
      const installedModels = await window.electronAPI.model.getInstalled();
      console.log('Installed models:', installedModels);

      // Merge data
      const enrichedModels = availableModels.map(model => ({
        ...model,
        isInstalled: installedModels.some(installed => installed.id === model.id)
      }));

      setModels(enrichedModels);
      
      // Set default model if none selected
      if (!selectedModel && enrichedModels.length > 0) {
        const defaultModel = enrichedModels.find(m => m.isInstalled) || enrichedModels[0];
        onModelChange(defaultModel.id);
      }
      
    } catch (error) {
      console.error('Failed to load models:', error);
      setError(error.message);
      
      // Fallback models for display
      setModels([
        { id: 'whisper-tiny', name: 'Whisper Tiny', size: '39 MB', isInstalled: false },
        { id: 'whisper-base', name: 'Whisper Base', size: '142 MB', isInstalled: false },
        { id: 'whisper-small', name: 'Whisper Small', size: '461 MB', isInstalled: false }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (modelId) => {
    try {
      console.log('Downloading model:', modelId);
      await window.electronAPI.model.download(modelId);
      
      // Refresh models list
      await loadModels();
    } catch (error) {
      console.error('Model download failed:', error);
      alert(`Failed to download model: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="model-selector loading">
        <div className="spinner"></div>
        <span>Loading models...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="model-selector error">
        <p>Error loading models: {error}</p>
        <button onClick={loadModels} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="model-selector">
      <label htmlFor="model-select">Transcription Model:</label>
      <select
        id="model-select"
        value={selectedModel || ''}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled}
        className="model-select"
      >
        <option value="">Select a model...</option>
        {models.map(model => (
          <option 
            key={model.id} 
            value={model.id}
            disabled={!model.isInstalled}
          >
            {model.name} ({model.size}) {model.isInstalled ? '✓' : '○'}
          </option>
        ))}
      </select>
      
      {/* Model details */}
      {selectedModel && (
        <div className="model-details">
          {(() => {
            const model = models.find(m => m.id === selectedModel);
            if (!model) return null;
            
            return (
              <div className="model-info">
                <p><strong>{model.name}</strong></p>
                <p>Size: {model.size}</p>
                <p>Accuracy: {model.accuracy || 'Unknown'}</p>
                <p>Speed: {model.speed || 'Unknown'}</p>
                {!model.isInstalled && (
                  <button 
                    onClick={() => handleDownload(model.id)}
                    className="download-btn"
                  >
                    Download Model
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Available models list */}
      <div className="available-models">
        <h4>Available Models:</h4>
        {models.map(model => (
          <div key={model.id} className="model-item">
            <span className={`status ${model.isInstalled ? 'installed' : 'available'}`}>
              {model.isInstalled ? '✓' : '○'}
            </span>
            <span className="name">{model.name}</span>
            <span className="size">({model.size})</span>
            {!model.isInstalled && (
              <button 
                onClick={() => handleDownload(model.id)}
                className="download-btn-small"
              >
                Download
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModelSelector;

