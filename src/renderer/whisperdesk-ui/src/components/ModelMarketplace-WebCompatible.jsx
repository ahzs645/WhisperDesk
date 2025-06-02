import React, { useState, useEffect } from 'react';

// Mock model data that would normally come from Electron backend
const MOCK_MODELS = [
  {
    id: 'whisper-tiny',
    name: 'Whisper Tiny',
    provider: 'OpenAI',
    size: '39 MB',
    sizeBytes: 39000000,
    languages: ['en'],
    description: 'Fastest model, English only, good for real-time transcription',
    accuracy: 'Basic',
    speed: 'Very Fast',
    requirements: {
      ram: '1 GB',
      disk: '50 MB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    version: '1.0.0',
    isInstalled: false
  },
  {
    id: 'whisper-base',
    name: 'Whisper Base',
    provider: 'OpenAI',
    size: '142 MB',
    sizeBytes: 142000000,
    languages: ['multilingual'],
    description: 'Good balance of speed and accuracy, supports multiple languages',
    accuracy: 'Good',
    speed: 'Fast',
    requirements: {
      ram: '2 GB',
      disk: '200 MB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    version: '1.0.0',
    isInstalled: false
  },
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    provider: 'OpenAI',
    size: '461 MB',
    sizeBytes: 461000000,
    languages: ['multilingual'],
    description: 'Better accuracy than base, still reasonably fast',
    accuracy: 'Very Good',
    speed: 'Medium',
    requirements: {
      ram: '4 GB',
      disk: '500 MB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    version: '1.0.0',
    isInstalled: false
  },
  {
    id: 'whisper-medium',
    name: 'Whisper Medium',
    provider: 'OpenAI',
    size: '1.42 GB',
    sizeBytes: 1420000000,
    languages: ['multilingual'],
    description: 'High accuracy, good for professional transcription',
    accuracy: 'Excellent',
    speed: 'Medium-Slow',
    requirements: {
      ram: '6 GB',
      disk: '1.5 GB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    version: '1.0.0',
    isInstalled: false
  },
  {
    id: 'whisper-large-v2',
    name: 'Whisper Large v2',
    provider: 'OpenAI',
    size: '2.87 GB',
    sizeBytes: 2870000000,
    languages: ['multilingual'],
    description: 'Best accuracy, slower processing, ideal for high-quality transcription',
    accuracy: 'Outstanding',
    speed: 'Slow',
    requirements: {
      ram: '8 GB',
      disk: '3 GB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin',
    version: '1.0.0',
    isInstalled: false
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper Large v3',
    provider: 'OpenAI',
    size: '2.87 GB',
    sizeBytes: 2870000000,
    languages: ['multilingual'],
    description: 'Latest and most accurate model, best quality transcription',
    accuracy: 'Outstanding',
    speed: 'Slow',
    requirements: {
      ram: '8 GB',
      disk: '3 GB'
    },
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    version: '1.0.0',
    isInstalled: false
  }
];

export function ModelMarketplace() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadingModels, setDownloadingModels] = useState(new Set());

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to use Electron API first
      if (window.electronAPI?.model?.getAvailable) {
        console.log('Using Electron API for models');
        const availableModels = await window.electronAPI.model.getAvailable();
        setModels(availableModels);
      } else {
        console.log('Using fallback mock data for models');
        // Fallback to mock data for web browser testing
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
        
        // Check localStorage for installed models
        const installedModels = JSON.parse(localStorage.getItem('installedModels') || '[]');
        const modelsWithInstallStatus = MOCK_MODELS.map(model => ({
          ...model,
          isInstalled: installedModels.includes(model.id)
        }));
        
        setModels(modelsWithInstallStatus);
      }
    } catch (err) {
      console.error('Error loading models:', err);
      // Fallback to mock data even if Electron API fails
      const installedModels = JSON.parse(localStorage.getItem('installedModels') || '[]');
      const modelsWithInstallStatus = MOCK_MODELS.map(model => ({
        ...model,
        isInstalled: installedModels.includes(model.id)
      }));
      setModels(modelsWithInstallStatus);
      setError(null); // Don't show error since we have fallback data
    } finally {
      setLoading(false);
    }
  };

  const simulateDownload = (modelId, model) => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          // Mark as installed in localStorage
          const installedModels = JSON.parse(localStorage.getItem('installedModels') || '[]');
          if (!installedModels.includes(modelId)) {
            installedModels.push(modelId);
            localStorage.setItem('installedModels', JSON.stringify(installedModels));
          }
          
          setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[modelId];
            return newProgress;
          });
          
          setDownloadingModels(prev => {
            const newSet = new Set(prev);
            newSet.delete(modelId);
            return newSet;
          });
          
          // Refresh models to show installed status
          loadModels();
          resolve();
        } else {
          setDownloadProgress(prev => ({
            ...prev,
            [modelId]: {
              progress,
              downloadedBytes: (model.sizeBytes * progress) / 100,
              totalBytes: model.sizeBytes,
              speed: 1024 * 1024 * (2 + Math.random() * 3), // 2-5 MB/s
              status: 'downloading'
            }
          }));
        }
      }, 200);
    });
  };

  const handleDownload = async (modelId) => {
    try {
      setError(null);
      setDownloadingModels(prev => new Set(prev).add(modelId));
      
      const model = models.find(m => m.id === modelId);
      
      if (window.electronAPI?.model?.download) {
        // Use real Electron API
        await window.electronAPI.model.download(modelId);
      } else {
        // Simulate download for web browser
        console.log(`Simulating download of ${model.name} from ${model.downloadUrl}`);
        await simulateDownload(modelId, model);
      }
    } catch (err) {
      setError(`Failed to start download: ${err.message}`);
      setDownloadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  const handleDelete = async (modelId) => {
    try {
      setError(null);
      
      if (window.electronAPI?.model?.delete) {
        // Use real Electron API
        await window.electronAPI.model.delete(modelId);
      } else {
        // Simulate deletion for web browser
        const installedModels = JSON.parse(localStorage.getItem('installedModels') || '[]');
        const updatedModels = installedModels.filter(id => id !== modelId);
        localStorage.setItem('installedModels', JSON.stringify(updatedModels));
      }
      
      await loadModels(); // Refresh the models list
    } catch (err) {
      setError(`Failed to delete model: ${err.message}`);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond) => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  const getAccuracyColor = (accuracy) => {
    switch (accuracy?.toLowerCase()) {
      case 'basic': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'good': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'very good': return 'bg-green-100 text-green-800 border-green-200';
      case 'excellent': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'outstanding': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSpeedColor = (speed) => {
    switch (speed?.toLowerCase()) {
      case 'very fast': return 'bg-green-100 text-green-800 border-green-200';
      case 'fast': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'medium-slow': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'slow': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="spinner"></div>
        <span className="ml-2">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Model Marketplace</h2>
        <p className="text-gray-600">Download and manage transcription models</p>
        {!window.electronAPI && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              🌐 <strong>Web Demo Mode:</strong> This is a demonstration of the model marketplace. 
              In the full Electron app, models would be downloaded to your local system.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {models.map((model) => {
          const isDownloading = downloadingModels.has(model.id);
          const progress = downloadProgress[model.id];
          
          return (
            <div key={model.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{model.name}</h3>
                    {model.isInstalled && (
                      <span className="text-green-600 text-sm font-medium bg-green-50 px-2 py-1 rounded border border-green-200">
                        ✓ Installed
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600">{model.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>by {model.provider}</span>
                    <span>•</span>
                    <span>v{model.version}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {model.isInstalled ? (
                    <button
                      onClick={() => handleDelete(model.id)}
                      className="px-4 py-2 text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDownload(model.id)}
                      disabled={isDownloading}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isDownloading ? (
                        <>
                          <span className="spinner-small inline-block mr-2"></span>
                          Downloading
                        </>
                      ) : (
                        <>
                          📥 Download
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Download Progress */}
              {isDownloading && progress && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>
                      {progress.status === 'queued' ? 'Queued for download...' : 'Downloading...'}
                    </span>
                    <span className="font-medium">{Math.round(progress.progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.max(0, Math.min(100, progress.progress))}%` }}
                    ></div>
                  </div>
                  {progress.status === 'downloading' && progress.totalBytes > 0 && (
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>
                        {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                      </span>
                      <span>{formatSpeed(progress.speed)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Model Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">💾 Size</div>
                  <div className="text-sm text-gray-600">{model.size}</div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">⭐ Accuracy</div>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getAccuracyColor(model.accuracy)}`}>
                    {model.accuracy}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">⚡ Speed</div>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getSpeedColor(model.speed)}`}>
                    {model.speed}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-700">🌐 Languages</div>
                  <div className="text-sm text-gray-600">
                    {Array.isArray(model.languages) 
                      ? model.languages.includes('multilingual') 
                        ? '80+ languages' 
                        : model.languages.join(', ')
                      : model.languages}
                  </div>
                </div>
              </div>

              {/* Requirements */}
              {model.requirements && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-sm font-medium text-gray-700 mb-2">💻 System Requirements</div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>RAM: {model.requirements.ram}</div>
                    <div>Disk: {model.requirements.disk}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {models.length === 0 && !loading && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No models available</p>
          <button 
            onClick={loadModels} 
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      )}
    </div>
  );
}

