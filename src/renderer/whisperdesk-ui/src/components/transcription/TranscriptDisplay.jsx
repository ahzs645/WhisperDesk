import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Mic, Clock, Copy } from 'lucide-react'
import { TranscriptSegment } from './TranscriptSegment'

export function TranscriptDisplay({ 
  transcriptionResult, 
  isTranscribing = false, 
  progress = 0,
  progressMessage = '',
  onCopy,
  className = "" 
}) {
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollAreaRef = useRef(null)
  const bottomRef = useRef(null)

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && bottomRef.current && transcriptionResult?.segments?.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcriptionResult?.segments?.length, autoScroll])

  // Speaker color mapping for consistent colors per speaker
  const getSpeakerColor = (speakerId) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
      'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
      'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800',
      'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800'
    ]
    
    if (!speakerId) return colors[0]
    
    // Generate consistent color based on speaker ID
    const hash = speakerId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0)
      return a & a
    }, 0)
    
    return colors[Math.abs(hash) % colors.length]
  }

  // Format timestamp
  const formatTime = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get speaker initials for avatar
  const getSpeakerInitials = (speakerId, speakerLabel) => {
    if (speakerLabel) return speakerLabel.slice(0, 2).toUpperCase()
    if (!speakerId) return '??'
    return speakerId.slice(0, 2).toUpperCase()
  }

  // Get speaker name for display
  const getSpeakerName = (speakerId, speakerLabel) => {
    if (speakerLabel) return speakerLabel
    if (!speakerId) return 'Unknown Speaker'
    return `Speaker ${speakerId}`
  }

  // Handle copy all text
  const handleCopyAll = () => {
    if (onCopy) {
      onCopy()
    }
  }

  // Get segments from result
  const segments = transcriptionResult?.segments || []
  const hasContent = segments.length > 0 || transcriptionResult?.text

  return (
    <Card className={`w-full flex flex-col ${className}`}>
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Live Transcript
              {isTranscribing && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-pulse">
                  <Mic className="w-3 h-3 mr-1" />
                  Transcribing
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {segments.length > 0 
                ? `${segments.length} segments • ${transcriptionResult?.metadata?.duration ? formatTime(transcriptionResult.metadata.duration) : 'Processing...'}`
                : isTranscribing 
                  ? progressMessage || 'Waiting for transcription...'
                  : 'Ready to transcribe'
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAutoScroll(!autoScroll)}
              className={autoScroll ? 'bg-primary/10' : ''}
            >
              Auto-scroll
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCopyAll}
              disabled={!hasContent}
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy All
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* FIXED: Proper scroll container with explicit height constraint */}
      <CardContent className="flex-1 p-0 min-h-0">
        <div className="h-[500px] relative">
          <ScrollArea className="h-full w-full">
            <div className="px-6 py-4">
              {segments.length === 0 && !transcriptionResult?.text ? (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Waiting for transcript...</p>
                    {isTranscribing && <p className="text-sm mt-1">{progressMessage || 'Processing audio...'}</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Show segments if available, otherwise show plain text */}
                  {segments.length > 0 ? (
                    segments.map((segment, index) => (
                      <TranscriptSegment 
                        key={segment.id || index}
                        segment={segment}
                        speakerColor={getSpeakerColor(segment.speakerId || segment.speaker)}
                        speakerInitials={getSpeakerInitials(segment.speakerId || segment.speaker, segment.speakerLabel)}
                        speakerName={getSpeakerName(segment.speakerId || segment.speaker, segment.speakerLabel)}
                        formatTime={formatTime}
                        isLast={index === segments.length - 1}
                        isTranscribing={isTranscribing}
                      />
                    ))
                  ) : transcriptionResult?.text ? (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {transcriptionResult.text}
                      </p>
                    </div>
                  ) : null}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}