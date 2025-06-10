// src/renderer/whisperdesk-ui/src/components/DeviceSelection.jsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Mic, RefreshCw } from 'lucide-react';
import { useAppState } from '@/App';

export const DeviceSelection = ({ 
  deviceManager, 
  recordingSettings,
  isRecording = false 
}) => {
  const { appState } = useAppState();
  
  const {
    availableDevices,
    selectedScreen,
    selectedAudioInput,
    loadingDevices,
    setSelectedScreen,
    setSelectedAudioInput,
    refreshDevices
  } = deviceManager;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Device Selection</h4>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshDevices}
          disabled={loadingDevices || isRecording}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingDevices ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="screen-select">Screen/Display</Label>
          <Select 
            value={selectedScreen} 
            onValueChange={setSelectedScreen}
            disabled={isRecording || loadingDevices}
          >
            <SelectTrigger id="screen-select">
              <SelectValue placeholder="Select screen" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.screens.map((screen) => (
                <SelectItem key={screen.id} value={screen.id}>
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4" />
                    <span>{screen.name} (ID: {screen.id})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedScreen && (
            <div className="text-xs text-muted-foreground">
              Selected device ID: {selectedScreen}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="audio-select">Audio Input</Label>
          <Select 
            value={selectedAudioInput} 
            onValueChange={setSelectedAudioInput}
            disabled={isRecording || loadingDevices || !recordingSettings.recordingSettings.includeMicrophone}
          >
            <SelectTrigger id="audio-select">
              <SelectValue placeholder="Select audio input" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.audio.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4" />
                    <span>{device.name} (ID: {device.id})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAudioInput && (
            <div className="text-xs text-muted-foreground">
              Selected device ID: {selectedAudioInput}
            </div>
          )}
        </div>
      </div>

      {/* Device debugging info */}
      {availableDevices.screens.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <h5 className="font-medium text-sm mb-2">Current Device Selection</h5>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <strong>Available Screens:</strong> {availableDevices.screens.map(s => s.id).join(', ')}
            </div>
            <div>
              <strong>Available Audio:</strong> {availableDevices.audio.map(a => a.id).join(', ')}
            </div>
            <div>
              <strong>Selected Screen:</strong> {selectedScreen || 'None'}
            </div>
            <div>
              <strong>Selected Audio:</strong> {selectedAudioInput || 'None'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};