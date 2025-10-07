import React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Monitor, Mic, RefreshCw } from 'lucide-react';
import { useScreenRecorderContext } from './ScreenRecorderProvider';

export const ScreenRecorderDevices = () => {
  const {
    availableDevices,
    selectedScreen,
    selectedAudioInput,
    loadingDevices,
    isRecording,
    recordingSettings,
    selectScreen,
    selectAudioInput,
    refreshDevices
  } = useScreenRecorderContext();

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
            onValueChange={selectScreen}
            disabled={isRecording || loadingDevices}
          >
            <SelectTrigger id="screen-select">
              <SelectValue placeholder="Select screen" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.screens.map((screen, index) => (
                <SelectItem key={`screen-${screen.id}-${index}`} value={screen.id}>
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4" />
                    <span>{screen.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="audio-select">Audio Input</Label>
          <Select 
            value={selectedAudioInput} 
            onValueChange={selectAudioInput}
            disabled={isRecording || loadingDevices || !recordingSettings.includeMicrophone}
          >
            <SelectTrigger id="audio-select">
              <SelectValue placeholder="Select audio input" />
            </SelectTrigger>
            <SelectContent>
              {availableDevices.audio.map((device, index) => (
                <SelectItem key={`audio-${device.id}-${index}`} value={device.id}>
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4" />
                    <span>{device.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!recordingSettings.includeMicrophone && (
            <div className="text-xs text-amber-600">
              Audio input disabled - enable microphone in settings
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 