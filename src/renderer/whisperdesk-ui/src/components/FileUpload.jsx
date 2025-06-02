import React, { useState, useEffect } from 'react';
import ProgressIndicator from './ProgressIndicator';

const FileUpload = ({ onFileSelect, disabled = false, selectedModel }) => {
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Set up progress listeners
    if (!window.electronAPI) return;

    const progressCleanup = window.electronAPI.transcription.onProgress((data) => {
      console.log('Transcription progress:', data);
      setProgress(data.progress || 0);
      setStage(data.stage || '');
      setMessage(data.message || '');
    });

    const completeCleanup = window.electronAPI.transcription.onComplete((data) => {
      console.log('Transcription complete:', data);
      setProcessing(false);
      setProgress(100);
      setStage('complete');
      setMessage('Transcription completed successfully');
      setResult(data.result);
    });

    const errorCleanup = window.electronAPI.transcription.onError((data) => {
      console.error('Transcription error:', data);
      setProcessing(false);
      setProgress(0);
      setStage('error');
      setMessage(`Error: ${data.error}`);
    });

    return () => {
      progressCleanup();
      completeCleanup();
      errorCleanup();
    };
  }, []);

  const handleFileSelect = async (file) => {
    if (!file || !selectedModel) {
      alert('Please select a model first');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setStage('starting');
    setMessage('Preparing transcription...');
    setResult(null);

    try {
      console.log('Processing file:', file.path);
      console.log('Using model:', selectedModel);

      const options = {
        model: selectedModel,
        language: 'auto',
        enableSpeakerDiarization: true,
        enableTimestamps: true
      };

      const result = await window.electronAPI.transcription.processFile(file.path, options);
      
      console.log('Transcription result:', result);
      onFileSelect(file, result);
      
    } catch (error) {
      console.error('Transcription failed:', error);
      setStage('error');
      setMessage(`Transcription failed: ${error.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const openFileDialog = async () => {
    try {
      const result = await window.electronAPI.file.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg'] },
          { name: 'Video Files', extensions: ['mp4', 'webm', 'avi', 'mov'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        handleFileSelect({ path: filePath, name: filePath.split('/').pop() });
      }
    } catch (error) {
      console.error('File dialog error:', error);
      alert(`Failed to open file dialog: ${error.message}`);
    }
  };

  return (
    <div className="file-upload">
      <div 
        className={`drop-zone ${dragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="drop-content">
          <div className="upload-icon">📁</div>
          <p>Drop audio/video files here or</p>
          <button 
            onClick={openFileDialog}
            disabled={disabled || processing}
            className="upload-btn"
          >
            Choose File
          </button>
          <input
            type="file"
            onChange={handleFileInput}
            accept="audio/*,video/*"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <ProgressIndicator
        isVisible={processing}
        progress={progress}
        stage={stage}
        message={message}
        onCancel={() => {
          setProcessing(false);
          setProgress(0);
          setStage('');
          setMessage('');
        }}
      />

      {result && (
        <div className="transcription-result">
          <h3>Transcription Result</h3>
          <div className="result-content">
            <p><strong>Language:</strong> {result.language || 'Unknown'}</p>
            <p><strong>Duration:</strong> {result.metadata?.duration || 'Unknown'}</p>
            <div className="transcript-text">
              <h4>Transcript:</h4>
              <p>{result.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;

