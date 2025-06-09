// src/renderer/whisperdesk-ui/src/components/ConfigurationSummary.jsx
import React from 'react';

export const ConfigurationSummary = ({ 
  deviceManager,
  recordingSettings 
}) => {
  const { availableDevices, selectedScreen, selectedAudioInput } = deviceManager;
  const { recordingSettings: settings } = recordingSettings;

  const selectedScreenDevice = availableDevices.screens.find(s => s.id === selectedScreen);
  
  return (
    <div className="p-3 bg-muted/50 rounded-lg">
      <h5 className="font-medium text-sm mb-2">Current Configuration</h5>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          Screen: {selectedScreenDevice?.name || 'Not selected'}
        </div>
        <div>
          Audio: {settings.includeMicrophone ? 'Enabled' : 'Disabled'}
        </div>
        <div>
          System Audio: {settings.includeSystemAudio ? 'Enabled' : 'Disabled'}
        </div>
        <div>
          Auto-transcribe: {settings.autoTranscribe ? 'Enabled' : 'Disabled'}
        </div>
      </div>
    </div>
  );
};