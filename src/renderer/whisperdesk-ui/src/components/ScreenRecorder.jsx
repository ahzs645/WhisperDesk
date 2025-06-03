import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Mic, Square, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAppState } from '@/App';
import { toast } from 'sonner';

export function ScreenRecorder() {
    const { appState, updateAppState } = useAppState();
    const [error, setError] = useState(null);
    const [apiStatus, setApiStatus] = useState('checking');

    useEffect(() => {
        // Check API availability
        console.log('🔍 ScreenRecorder: Checking API availability...');
        console.log('window.electronAPI:', !!window.electronAPI);
        console.log('screenRecorder API:', !!window.electronAPI?.screenRecorder);
        
        if (window.electronAPI?.screenRecorder) {
            setApiStatus('available');
            console.log('✅ ScreenRecorder: APIs available');
        } else {
            setApiStatus('unavailable');
            console.log('❌ ScreenRecorder: APIs not available');
        }
    }, []);

    const handleStartRecording = async () => {
        if (!window.electronAPI?.screenRecorder) {
            setError('Screen recording API not available - are you running in Electron?');
            toast.error('Screen recording only available in Electron app');
            return;
        }

        try {
            setError(null);
            console.log('🎬 Starting screen recording...');
            
            const result = await window.electronAPI.screenRecorder.startRecording({
                includeMicrophone: appState.recordingSettings?.includeMicrophone ?? true,
                includeSystemAudio: appState.recordingSettings?.includeSystemAudio ?? true
            });
            
            console.log('✅ Recording started:', result);
            
            if (result.success) {
                updateAppState({ isRecording: true });
                toast.success('🎬 Recording started successfully!');
            }
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            setError(error.message || 'Failed to start recording');
            toast.error('Failed to start recording: ' + error.message);
        }
    };

    const handleStopRecording = async () => {
        if (!window.electronAPI?.screenRecorder) {
            setError('Screen recording API not available');
            return;
        }

        try {
            setError(null);
            console.log('⏹️ Stopping screen recording...');
            
            const result = await window.electronAPI.screenRecorder.stopRecording();
            console.log('✅ Recording stopped:', result);
            
            updateAppState({ isRecording: false });
            
            if (result.success) {
                // Create a file-like object for the recorded file
                const fileInfo = {
                    path: result.outputPath,
                    name: result.outputPath.split('/').pop() || result.outputPath.split('\\').pop(),
                    size: 0
                };
                updateAppState({ selectedFile: fileInfo });
                toast.success('🎬 Recording saved successfully!');
            }
        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
            setError(error.message || 'Failed to stop recording');
            toast.error('Failed to stop recording: ' + error.message);
        }
    };

    // ALWAYS render the component, but show status
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Mic className="w-5 h-5" />
                    <span>Screen Recording</span>
                    {appState.isRecording && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full animate-pulse">
                            Recording...
                        </span>
                    )}
                </CardTitle>
                <CardDescription>
                    Record your screen with audio for transcription
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Error display */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 inline mr-2" />
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h4 className="font-medium">Audio Options</h4>
                            <p className="text-sm text-muted-foreground">
                                Choose which audio sources to include
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="include-microphone" className="text-sm">Microphone</Label>
                                <Switch
                                    id="include-microphone"
                                    checked={appState.recordingSettings?.includeMicrophone ?? true}
                                    onCheckedChange={(checked) => {
                                        updateAppState({
                                            recordingSettings: {
                                                ...appState.recordingSettings,
                                                includeMicrophone: checked
                                            }
                                        });
                                    }}
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor="include-system-audio" className="text-sm">System Audio</Label>
                                <Switch
                                    id="include-system-audio"
                                    checked={appState.recordingSettings?.includeSystemAudio ?? true}
                                    onCheckedChange={(checked) => {
                                        updateAppState({
                                            recordingSettings: {
                                                ...appState.recordingSettings,
                                                includeSystemAudio: checked
                                            }
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        variant={appState.isRecording ? "destructive" : "default"}
                        onClick={appState.isRecording ? handleStopRecording : handleStartRecording}
                        disabled={apiStatus !== 'available'}
                        className="w-full"
                    >
                        {appState.isRecording ? (
                            <>
                                <Square className="w-4 h-4 mr-2" />
                                Stop Recording
                            </>
                        ) : (
                            <>
                                <Mic className="w-4 h-4 mr-2" />
                                Start Recording
                            </>
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
} 