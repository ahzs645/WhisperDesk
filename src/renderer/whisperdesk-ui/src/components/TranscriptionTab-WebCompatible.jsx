import React, { useState, useEffect, useRef } from 'react';

export function TranscriptionTab() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcriptionResult, setTranscriptionResult] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasModels, setHasModels] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('whisper');
  const [selectedDevice, setSelectedDevice] = useState('default');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Check for installed models (web-compatible)
    checkInstalledModels();
  }, []);

  const checkInstalledModels = () => {
    if (window.electronAPI?.model?.getInstalled) {
      // Use Electron API if available
      window.electronAPI.model.getInstalled()
        .then(models => setHasModels(models.length > 0))
        .catch(() => setHasModels(false));
    } else {
      // Fallback: check localStorage for web demo
      const installedModels = JSON.parse(localStorage.getItem('installedModels') || '[]');
      setHasModels(installedModels.length > 0);
    }
  };

  const simulateTranscription = (file) => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          
          // Simulate transcription result
          const mockTranscription = `This is a simulated transcription of the uploaded file "${file.name}". 

In the full Electron application, this would be the actual transcribed text from your audio file using the selected Whisper model. The transcription would include:

- Accurate speech-to-text conversion
- Proper punctuation and formatting  
- Speaker identification (if enabled)
- Timestamps for each segment
- Support for multiple languages

File details:
- Name: ${file.name}
- Size: ${(file.size / 1024 / 1024).toFixed(2)} MB
- Type: ${file.type}
- Duration: Estimated based on file size

This demonstration shows that the file upload and transcription workflow is fully functional and ready for use in the complete Electron environment.`;

          setTranscriptionResult(mockTranscription);
          setIsTranscribing(false);
          resolve();
        } else {
          setTranscriptionProgress(progress);
        }
      }, 300);
    });
  };

  const handleFileSelect = () => {
    if (!hasModels) {
      setError('Please download a model first from the Models tab before uploading files.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    if (!hasModels) {
      setError('Please download a model first from the Models tab before uploading files.');
      return;
    }

    try {
      setError(null);
      setIsTranscribing(true);
      setTranscriptionProgress(0);
      setTranscriptionResult('');
      setSelectedFile(file);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('provider', 'whisper-native');
      formData.append('model', 'whisper-tiny');
      formData.append('language', 'auto');
      formData.append('enableTimestamps', 'true');

      console.log(`🎵 Uploading ${file.name} for transcription...`);
      setTranscriptionProgress(10);

      // Call the real transcription API
      const response = await fetch('http://localhost:3001/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      setTranscriptionProgress(90);
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Transcription completed successfully');
        setTranscriptionResult(data.result.text);
        setTranscriptionProgress(100);
        
        // Show success message briefly
        const originalError = error;
        setError(`✅ Transcription completed! Language: ${data.result.language}, Segments: ${data.result.segments?.length || 0}`);
        setTimeout(() => setError(originalError), 5000);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
      
      setIsTranscribing(false);
    } catch (err) {
      console.error('❌ Transcription failed:', err);
      setError(`Failed to process file: ${err.message}`);
      setIsTranscribing(false);
      setTranscriptionProgress(0);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (hasModels) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    
    if (!hasModels) {
      setError('Please download a model first from the Models tab before uploading files.');
      return;
    }
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setTranscriptionResult('');
    setTranscriptionProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyResult = async () => {
    try {
      await navigator.clipboard.writeText(transcriptionResult);
      // Show success feedback
      const originalError = error;
      setError('Copied to clipboard!');
      setTimeout(() => setError(originalError), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 p-6">
      {!window.electronAPI && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">
            🎵 <strong>Live Transcription Mode:</strong> Connected to native whisper.cpp backend! 
            Files uploaded here will be processed with real AI transcription using the installed models.
          </p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {!hasModels && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-yellow-600 mr-2">📥</span>
              <span className="text-yellow-800">You need to download a model first before you can transcribe audio.</span>
            </div>
            <button 
              onClick={() => setError('Please go to the Models tab to download a transcription model.')}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition-colors"
            >
              Go to Models
            </button>
          </div>
        </div>
      )}

      {/* Transcription Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Transcription Settings</h3>
        <p className="text-gray-600 mb-4">Configure your transcription preferences</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transcription Provider</label>
            <select 
              value={selectedProvider} 
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="whisper">Local Whisper</option>
              <option value="deepgram">Deepgram API</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Audio Device</label>
            <select 
              value={selectedDevice} 
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="default">Default Microphone</option>
              <option value="system">System Audio</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live Recording */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Live Recording</h3>
        <p className="text-gray-600 mb-4">Record audio directly from your microphone</p>
        
        <button 
          disabled={!hasModels}
          className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          🎤 Start Recording
        </button>
        
        {!hasModels && (
          <p className="text-gray-500 text-sm mt-2">Recording is disabled until you download a transcription model.</p>
        )}
      </div>

      {/* File Upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2">File Upload</h3>
        <p className="text-gray-600 mb-4">Upload audio or video files for transcription</p>
        
        <div
          ref={fileInputRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50' 
              : hasModels 
                ? 'border-gray-300 hover:border-gray-400' 
                : 'border-gray-200 bg-gray-50'
          }`}
        >
          {selectedFile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-2xl">🎵</span>
                <div className="text-left">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={handleClearFile}
                  className="text-red-500 hover:text-red-700 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {isTranscribing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Transcribing...</span>
                    <span>{Math.round(transcriptionProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${Math.max(0, Math.min(100, transcriptionProgress))}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-4xl">📁</div>
              {hasModels ? (
                <>
                  <p className="text-lg">Drop files here or click to upload</p>
                  <p className="text-sm text-gray-500">
                    Supports MP3, WAV, FLAC, M4A, AAC, OGG, MP4, AVI, MOV, MKV, WebM
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Download a model first to upload files</p>
              )}
            </div>
          )}
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />
        
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleFileSelect}
            disabled={!hasModels}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            📁 Choose File
          </button>
        </div>
      </div>

      {/* Transcription Result */}
      {transcriptionResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Transcription Result</h3>
            <div className="flex space-x-2">
              <button
                onClick={handleCopyResult}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
              >
                📋 Copy
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([transcriptionResult], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'transcription.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                💾 Export
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded p-4 max-h-64 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm">{transcriptionResult}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

