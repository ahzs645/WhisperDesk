import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const EnhancedScreenRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [availableScreens, setAvailableScreens] = useState([]);
    const [availableAudioDevices, setAvailableAudioDevices] = useState([]);
    const [selectedScreen, setSelectedScreen] = useState('');
    const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
    const [includeMicrophone, setIncludeMicrophone] = useState(false);

    const syncStateWithBackend = async () => {
        try {
            const status = await window.screenRecorder.getStatus();
            setIsRecording(status.isRecording);
            setIsPaused(status.isPaused);
            
            if (status.devices) {
                setAvailableScreens(status.devices.screens || []);
                setAvailableAudioDevices(status.devices.audioDevices || []);
                
                // Only set defaults if not already set
                if (!selectedScreen && status.devices.screens?.length > 0) {
                    setSelectedScreen(status.devices.screens[0].id);
                }
                if (!selectedAudioDevice && status.devices.audioDevices?.length > 0) {
                    setSelectedAudioDevice(status.devices.audioDevices[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to sync state:', error);
        }
    };

    useEffect(() => {
        // Initial sync
        syncStateWithBackend();

        // Set up periodic refresh with a more reasonable interval
        const refreshInterval = setInterval(() => {
            syncStateWithBackend();
        }, 5000); // Changed from 1000ms to 5000ms (5 seconds)

        return () => {
            clearInterval(refreshInterval);
        };
    }, []);

    const handleStartRecording = async () => {
        if (!selectedScreen) {
            toast.error('Please select a screen to record');
            return;
        }

        try {
            await window.screenRecorder.startRecording({
                screenId: selectedScreen,
                audioInputId: includeMicrophone ? selectedAudioDevice : null,
                includeMicrophone,
                includeSystemAudio: false
            });
            toast.success('Recording started');
        } catch (error) {
            toast.error(`Failed to start recording: ${error.message}`);
        }
    };

    const handleStopRecording = async () => {
        try {
            await window.screenRecorder.stopRecording();
            toast.success('Recording stopped');
        } catch (error) {
            toast.error(`Failed to stop recording: ${error.message}`);
        }
    };

    const handlePauseRecording = async () => {
        try {
            await window.screenRecorder.pauseRecording();
            toast.success('Recording paused');
        } catch (error) {
            toast.error(`Failed to pause recording: ${error.message}`);
        }
    };

    const handleResumeRecording = async () => {
        try {
            await window.screenRecorder.resumeRecording();
            toast.success('Recording resumed');
        } catch (error) {
            toast.error(`Failed to resume recording: ${error.message}`);
        }
    };

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Screen Recorder</h2>
            
            <div className="mb-4">
                <label className="block mb-2">Select Screen:</label>
                <select 
                    value={selectedScreen}
                    onChange={(e) => setSelectedScreen(e.target.value)}
                    className="w-full p-2 border rounded"
                >
                    <option value="">Select a screen</option>
                    {availableScreens.map(screen => (
                        <option key={screen.id} value={screen.id}>
                            {screen.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mb-4">
                <label className="flex items-center">
                    <input
                        type="checkbox"
                        checked={includeMicrophone}
                        onChange={(e) => setIncludeMicrophone(e.target.checked)}
                        className="mr-2"
                    />
                    Include Microphone
                </label>
            </div>

            {includeMicrophone && (
                <div className="mb-4">
                    <label className="block mb-2">Select Audio Device:</label>
                    <select
                        value={selectedAudioDevice}
                        onChange={(e) => setSelectedAudioDevice(e.target.value)}
                        className="w-full p-2 border rounded"
                    >
                        <option value="">Select an audio device</option>
                        {availableAudioDevices.map(device => (
                            <option key={device.id} value={device.id}>
                                {device.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="flex gap-2">
                {!isRecording ? (
                    <button
                        onClick={handleStartRecording}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Start Recording
                    </button>
                ) : (
                    <>
                        <button
                            onClick={handleStopRecording}
                            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                        >
                            Stop Recording
                        </button>
                        {isPaused ? (
                            <button
                                onClick={handleResumeRecording}
                                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                            >
                                Resume Recording
                            </button>
                        ) : (
                            <button
                                onClick={handlePauseRecording}
                                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
                            >
                                Pause Recording
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default EnhancedScreenRecorder; 