import React from 'react';

const ProgressIndicator = ({ 
  isVisible, 
  progress = 0, 
  stage = '', 
  message = '',
  onCancel 
}) => {
  if (!isVisible) return null;

  return (
    <div className="progress-indicator">
      <div className="progress-content">
        <div className="progress-header">
          <h3>Processing Audio</h3>
          {onCancel && (
            <button onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          )}
        </div>
        
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            ></div>
          </div>
          <span className="progress-text">{Math.round(progress)}%</span>
        </div>
        
        <div className="progress-details">
          {stage && <p className="stage">Stage: {stage}</p>}
          {message && <p className="message">{message}</p>}
        </div>
        
        <div className="progress-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    </div>
  );
};

export default ProgressIndicator;

