import React, { useState, useEffect } from 'react';
import bridgeAdapter from '../utils/BridgeAdapter';

/**
 * BackendSettings Component
 * Allows users to configure which backend to use (WhisperDesk Tauri or Vibe)
 * and update the Vibe installation path
 */
const BackendSettings = () => {
  const [currentBackend, setCurrentBackend] = useState('vibe');
  const [vibePath, setVibePath] = useState('/Users/ahzs645/Github/WhisperDesk/vibe-main');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    // Load current settings
    const loadSettings = async () => {
      try {
        const backend = bridgeAdapter.getCurrentBackend();
        setCurrentBackend(backend);
        
        const savedPath = await bridgeAdapter.getSettings('vibePath');
        if (savedPath) {
          setVibePath(savedPath);
        }
      } catch (error) {
        console.error('Failed to load backend settings:', error);
      }
    };
    
    loadSettings();
  }, []);

  const handleBackendSwitch = async (backend) => {
    try {
      setIsSaving(true);
      setStatusMessage('Switching backend...');
      
      await bridgeAdapter.switchBackend(backend);
      setCurrentBackend(backend);
      
      setStatusMessage(`Switched to ${backend === 'vibe' ? 'Vibe' : 'WhisperDesk'} backend`);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error('Failed to switch backend:', error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVibePathUpdate = async () => {
    try {
      setIsSaving(true);
      setStatusMessage('Updating Vibe path...');
      
      await bridgeAdapter.setVibePath(vibePath);
      await bridgeAdapter.saveSettings('vibePath', vibePath);
      
      setStatusMessage('Vibe path updated successfully');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update Vibe path:', error);
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    try {
      setStatusMessage('Testing connection...');
      
      // Try to get audio devices as a test
      const devices = await bridgeAdapter.invoke('get-audio-devices');
      
      if (devices && devices.length > 0) {
        setStatusMessage(`✅ Connection successful! Found ${devices.length} audio devices`);
      } else {
        setStatusMessage('✅ Connection successful!');
      }
      
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (error) {
      console.error('Connection test failed:', error);
      setStatusMessage(`❌ Connection failed: ${error.message}`);
    }
  };

  return (
    <div className="backend-settings">
      <h3>Backend Configuration</h3>
      
      <div className="setting-group">
        <label>Backend Selection</label>
        <div className="backend-options">
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="vibe"
                checked={currentBackend === 'vibe'}
                onChange={() => handleBackendSwitch('vibe')}
                disabled={isSaving}
              />
              <span>Vibe Backend (Recommended)</span>
              <small>Use Vibe's high-performance Rust backend</small>
            </label>
            
            <label>
              <input
                type="radio"
                value="tauri"
                checked={currentBackend === 'tauri'}
                onChange={() => handleBackendSwitch('tauri')}
                disabled={isSaving}
              />
              <span>WhisperDesk Tauri Backend</span>
              <small>Use WhisperDesk's built-in Tauri backend</small>
            </label>
          </div>
        </div>
      </div>

      {currentBackend === 'vibe' && (
        <div className="setting-group">
          <label htmlFor="vibe-path">Vibe Installation Path</label>
          <div className="path-input-group">
            <input
              id="vibe-path"
              type="text"
              value={vibePath}
              onChange={(e) => setVibePath(e.target.value)}
              placeholder="/path/to/vibe-main"
              disabled={isSaving}
            />
            <button 
              onClick={handleVibePathUpdate}
              disabled={isSaving || !vibePath}
              className="btn-primary"
            >
              Update Path
            </button>
          </div>
          <small className="help-text">
            Path to the vibe-main directory. This allows WhisperDesk to use Vibe's backend directly.
          </small>
        </div>
      )}

      <div className="setting-actions">
        <button 
          onClick={testConnection}
          disabled={isSaving}
          className="btn-secondary"
        >
          Test Connection
        </button>
      </div>

      {statusMessage && (
        <div className={`status-message ${statusMessage.includes('Error') || statusMessage.includes('❌') ? 'error' : 'success'}`}>
          {statusMessage}
        </div>
      )}

      <style jsx>{`
        .backend-settings {
          padding: 20px;
          max-width: 600px;
        }

        .backend-settings h3 {
          margin-bottom: 20px;
          font-size: 1.2em;
          font-weight: 600;
        }

        .setting-group {
          margin-bottom: 25px;
        }

        .setting-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .radio-group label {
          display: flex;
          align-items: flex-start;
          padding: 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .radio-group label:hover {
          background-color: var(--hover-bg, #f5f5f5);
        }

        .radio-group input[type="radio"] {
          margin-right: 12px;
          margin-top: 2px;
        }

        .radio-group span {
          display: block;
          font-weight: 500;
        }

        .radio-group small {
          display: block;
          color: var(--text-secondary, #666);
          font-size: 0.85em;
          margin-top: 4px;
        }

        .path-input-group {
          display: flex;
          gap: 10px;
        }

        .path-input-group input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
        }

        .help-text {
          display: block;
          margin-top: 6px;
          color: var(--text-secondary, #666);
          font-size: 0.85em;
        }

        .setting-actions {
          margin-top: 20px;
        }

        .btn-primary, .btn-secondary {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background-color: var(--primary-color, #007bff);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--primary-hover, #0056b3);
        }

        .btn-secondary {
          background-color: var(--secondary-color, #6c757d);
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: var(--secondary-hover, #545b62);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .status-message {
          margin-top: 15px;
          padding: 10px 15px;
          border-radius: 6px;
          font-size: 14px;
        }

        .status-message.success {
          background-color: var(--success-bg, #d4edda);
          color: var(--success-text, #155724);
          border: 1px solid var(--success-border, #c3e6cb);
        }

        .status-message.error {
          background-color: var(--error-bg, #f8d7da);
          color: var(--error-text, #721c24);
          border: 1px solid var(--error-border, #f5c6cb);
        }
      `}</style>
    </div>
  );
};

export default BackendSettings;