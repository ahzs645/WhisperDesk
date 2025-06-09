// src/renderer/whisperdesk-ui/src/hooks/useDeviceManager.js
import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { formatDevices, createDeviceHash } from '../utils/recordingUtils';

export const useDeviceManager = () => {
  const [availableDevices, setAvailableDevices] = useState({ screens: [], audio: [] });
  const [selectedScreen, setSelectedScreen] = useState('');
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [devicesInitialized, setDevicesInitialized] = useState(false);
  
  const lastDeviceHash = useRef('');
  const isComponentMounted = useRef(true);

  const updateDevices = useCallback((devices, preserveSelections = true) => {
    const formattedDevices = formatDevices(devices);
    console.log('📱 Device list updated:', formattedDevices);
    
    setAvailableDevices(formattedDevices);
    
    // 🔴 FIXED: Only set defaults on first initialization OR if no valid selection exists
    if (!devicesInitialized) {
      if (formattedDevices.screens.length > 0 && !selectedScreen) {
        const defaultScreen = formattedDevices.screens[0].id;
        console.log(`🎯 Setting initial default screen: ${defaultScreen}`);
        setSelectedScreen(defaultScreen);
      }
      
      if (formattedDevices.audio.length > 0 && !selectedAudioInput) {
        const defaultAudio = formattedDevices.audio[0].id;
        console.log(`🎵 Setting initial default audio: ${defaultAudio}`);
        setSelectedAudioInput(defaultAudio);
      }
      
      setDevicesInitialized(true);
    } else if (preserveSelections) {
      // 🔴 FIXED: Only change selection if current one is invalid AND warn user
      const currentScreenValid = selectedScreen && formattedDevices.screens.find(s => s.id === selectedScreen);
      const currentAudioValid = selectedAudioInput && formattedDevices.audio.find(a => a.id === selectedAudioInput);
      
      if (!currentScreenValid && formattedDevices.screens.length > 0 && selectedScreen) {
        console.warn(`⚠️ Previously selected screen ${selectedScreen} no longer available, selecting:`, formattedDevices.screens[0].id);
        setSelectedScreen(formattedDevices.screens[0].id);
        
        // 🔴 NEW: Show warning to user about device change
        if (window.toast) {
          window.toast.warning(`Screen device changed: ${selectedScreen} → ${formattedDevices.screens[0].id}`, {
            description: 'Your selected screen is no longer available'
          });
        }
      }
      
      if (!currentAudioValid && formattedDevices.audio.length > 0 && selectedAudioInput) {
        console.warn(`⚠️ Previously selected audio ${selectedAudioInput} no longer available, selecting:`, formattedDevices.audio[0].id);
        
        // 🔴 CRITICAL FIX: Don't auto-change audio device - let user choose
        // This was causing the constant switching between device 3 and 0
        console.log(`🚫 NOT auto-selecting audio device. User should manually select from available: ${formattedDevices.audio.map(a => a.id).join(', ')}`);
        
        // Clear the invalid selection but don't auto-select
        setSelectedAudioInput('');
        
        // 🔴 NEW: Show warning to user about audio device issue
        if (window.toast) {
          window.toast.warning(`Audio device '${selectedAudioInput}' is no longer available`, {
            description: 'Please select a new audio device from the dropdown'
          });
        }
      }
      
      // 🔴 NEW: Don't change valid selections - this was causing the dropdown to clear
      if (currentScreenValid && currentAudioValid) {
        console.log(`✅ Preserving valid selections - Screen: ${selectedScreen}, Audio: ${selectedAudioInput}`);
      }
    }
    
    // Update hash to prevent unnecessary syncs
    lastDeviceHash.current = createDeviceHash({
      screens: devices.screens || [],
      audio: devices.audio || []
    });
  }, [devicesInitialized, selectedScreen, selectedAudioInput]);

  const shouldUpdateDevices = useCallback((devices) => {
    const newHash = createDeviceHash({
      screens: devices.screens || [],
      audio: devices.audio || []
    });
    return newHash !== lastDeviceHash.current;
  }, []);

  const validateAndFixDeviceSelections = useCallback(async () => {
    try {
      console.log('🔍 Validating current device selections...');
      
      // Get fresh device list
      const status = await window.electronAPI.screenRecorder.getStatus?.() || {};
      const devices = status.availableDevices || { screens: [], audio: [] };
      const formattedDevices = formatDevices(devices);
      
      console.log('📋 Current selections:', { screen: selectedScreen, audio: selectedAudioInput });
      console.log('📋 Available devices:', formattedDevices);
      
      let changed = false;
      
      // Check screen selection
      const screenValid = selectedScreen && formattedDevices.screens.find(s => s.id === selectedScreen);
      if (!screenValid && formattedDevices.screens.length > 0 && selectedScreen) {
        const newScreen = formattedDevices.screens[0].id;
        console.log(`🔧 Fixing invalid screen selection: ${selectedScreen} → ${newScreen}`);
        setSelectedScreen(newScreen);
        changed = true;
      }
      
      // Check audio selection but don't auto-fix (let user choose)
      const audioValid = selectedAudioInput && formattedDevices.audio.find(a => a.id === selectedAudioInput);
      
      // Update available devices
      setAvailableDevices(formattedDevices);
      
      return {
        valid: screenValid && (audioValid || !selectedAudioInput),
        changed,
        issues: [
          ...(screenValid ? [] : [`Screen device '${selectedScreen}' not available`]),
          ...(audioValid || !selectedAudioInput ? [] : [`Audio device '${selectedAudioInput}' not available`])
        ]
      };
      
    } catch (error) {
      console.error('❌ Failed to validate devices:', error);
      return { valid: false, changed: false, issues: [error.message] };
    }
  }, [selectedScreen, selectedAudioInput]);

  const refreshDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      
      const status = await window.electronAPI.screenRecorder.getStatus?.() || {};
      const devices = status.availableDevices || { screens: [], audio: [] };
      
      updateDevices(devices);
      toast.success('🔄 Devices refreshed successfully');
      
    } catch (error) {
      console.error('Failed to refresh devices:', error);
      toast.error('Failed to refresh devices: ' + error.message);
    } finally {
      setLoadingDevices(false);
    }
  }, [updateDevices]);

  const cleanup = useCallback(() => {
    isComponentMounted.current = false;
  }, []);

  return {
    // State
    availableDevices,
    selectedScreen,
    selectedAudioInput,
    loadingDevices,
    devicesInitialized,
    
    // Actions
    setSelectedScreen,
    setSelectedAudioInput,
    updateDevices,
    shouldUpdateDevices,
    refreshDevices,
    validateAndFixDeviceSelections, // 🔴 FIXED: Now properly defined and exported
    cleanup,
    
    // Utilities
    setLoadingDevices
  };
};