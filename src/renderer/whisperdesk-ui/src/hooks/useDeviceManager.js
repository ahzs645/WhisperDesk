// src/renderer/whisperdesk-ui/src/hooks/useDeviceManager.js - FIXED
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { appInitializer } from '../utils/AppInitializer';

export const useDeviceManager = () => {
  // 🔴 FIXED: Get state from centralized source instead of managing locally
  const [localState, setLocalState] = useState({
    availableDevices: { screens: [], audio: [] },
    selectedScreen: '',
    selectedAudioInput: '',
    loadingDevices: false,
    devicesInitialized: false
  });

  // 🔴 FIXED: Sync with central state on mount and when central state changes
  useEffect(() => {
    const updateFromCentral = () => {
      const centralState = appInitializer.getCentralState();
      setLocalState({
        availableDevices: centralState.availableDevices || { screens: [], audio: [] },
        selectedScreen: centralState.selectedScreen || '',
        selectedAudioInput: centralState.selectedAudioInput || '',
        loadingDevices: centralState.loadingDevices || false,
        devicesInitialized: centralState.devicesInitialized || false
      });
    };

    // Initial sync
    updateFromCentral();

    // Set up listener for central state changes (if AppInitializer has such mechanism)
    // For now, we'll poll periodically or rely on React re-renders
    const interval = setInterval(updateFromCentral, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 🔴 FIXED: Use centralized device management methods
  const refreshDevices = useCallback(async () => {
    try {
      const deviceManager = appInitializer.getService('deviceManager');
      if (deviceManager?.refreshDevices) {
        await deviceManager.refreshDevices();
        toast.success('🔄 Devices refreshed successfully');
      } else {
        throw new Error('Device manager service not available');
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error);
      toast.error('Failed to refresh devices: ' + error.message);
    }
  }, []);

  const setSelectedScreen = useCallback((screenId) => {
    const deviceManager = appInitializer.getService('deviceManager');
    if (deviceManager?.updateDeviceSelections) {
      deviceManager.updateDeviceSelections(screenId, localState.selectedAudioInput);
    }
  }, [localState.selectedAudioInput]);

  const setSelectedAudioInput = useCallback((audioId) => {
    const deviceManager = appInitializer.getService('deviceManager');
    if (deviceManager?.updateDeviceSelections) {
      deviceManager.updateDeviceSelections(localState.selectedScreen, audioId);
    }
  }, [localState.selectedScreen]);

  const validateAndFixDeviceSelections = useCallback(async () => {
    try {
      const deviceManager = appInitializer.getService('deviceManager');
      if (deviceManager?.validateDevices) {
        return await deviceManager.validateDevices();
      }
      return { valid: true, changed: false, issues: [] };
    } catch (error) {
      console.error('❌ Failed to validate devices:', error);
      return { valid: false, changed: false, issues: [error.message] };
    }
  }, []);

  return {
    // State from centralized source
    availableDevices: localState.availableDevices,
    selectedScreen: localState.selectedScreen,
    selectedAudioInput: localState.selectedAudioInput,
    loadingDevices: localState.loadingDevices,
    devicesInitialized: localState.devicesInitialized,
    
    // Actions that use centralized methods
    setSelectedScreen,
    setSelectedAudioInput,
    refreshDevices,
    validateAndFixDeviceSelections,
    
    // Utility methods (kept for compatibility)
    updateDevices: () => console.warn('updateDevices is deprecated - use centralized device manager'),
    shouldUpdateDevices: () => false,
    cleanup: () => {}, // No cleanup needed since we don't manage state
    setLoadingDevices: () => console.warn('setLoadingDevices is deprecated - managed centrally')
  };
};