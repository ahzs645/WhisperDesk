import React from 'react';
import { ScreenRecorderProvider } from './ScreenRecorderProvider';
import { ScreenRecorderCore } from './ScreenRecorderCore';

// Simple wrapper component that can be used as a drop-in replacement
export const ScreenRecorder = () => {
  return (
    <ScreenRecorderProvider>
      <ScreenRecorderCore />
    </ScreenRecorderProvider>
  );
}; 