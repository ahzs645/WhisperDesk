// Screen Recorder Module - Centralized exports
export { ScreenRecorderProvider, useScreenRecorderContext } from './ScreenRecorderProvider';
export { ScreenRecorderCore } from './ScreenRecorderCore';
export { ScreenRecorderControls } from './ScreenRecorderControls';
export { ScreenRecorderSettings } from './ScreenRecorderSettings';
export { ScreenRecorderDevices } from './ScreenRecorderDevices';
export { ScreenRecorderDebug } from './ScreenRecorderDebug';
export { ScreenRecorderStatus } from './ScreenRecorderStatus';
export { ScreenRecorderService } from './ScreenRecorderService';
export { ScreenRecorder } from './ScreenRecorder';

// Convenience exports for common use cases
export {
  useScreenRecorderActions,
  useScreenRecorderState,
  useScreenRecorderDebug
} from './ScreenRecorderHooks'; 