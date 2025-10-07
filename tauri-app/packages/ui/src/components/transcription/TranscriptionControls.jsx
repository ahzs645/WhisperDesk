import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Square, Play, Pause, Copy, Download, RefreshCw, Mic } from 'lucide-react'

export function TranscriptionControls({
  selectedFile,
  selectedProvider,
  selectedModel,
  isTranscribing,
  progress,
  progressMessage,
  activeTranscriptionId,
  lastTranscriptionResult,
  onStartTranscription,
  onStopTranscription,
  onCopyText,
  onExport,
  onNewTranscription
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transcription Control</CardTitle>
            <CardDescription>
              Process your audio file with enhanced progress tracking
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {lastTranscriptionResult && (
              <Badge variant="outline" className="text-green-600">
                <Download className="w-3 h-3 mr-1" />
                Ready to export
              </Badge>
            )}
            {isTranscribing && (
              <Badge variant="default" className="animate-pulse">
                <Mic className="w-3 h-3 mr-1" />
                Processing...
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isTranscribing && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onStopTranscription}
                  disabled={!activeTranscriptionId}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
              <Button
                onClick={() => onStartTranscription(false)}
                disabled={!selectedFile || isTranscribing || !selectedProvider || !selectedModel}
              >
                {isTranscribing ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Transcription
                  </>
                )}
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              {lastTranscriptionResult && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopyText}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onExport}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onNewTranscription}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                New
              </Button>
            </div>
          </div>

          {/* Progress Info */}
          {isTranscribing && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm mb-2">
                <span>{progressMessage || 'Processing...'}</span>
                <span>{Math.round(progress || 0)}%</span>
              </div>
              <Progress value={progress || 0} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}