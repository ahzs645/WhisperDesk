import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Clock, User, Copy, Play, Pause, Download, Mic, Square } from 'lucide-react'
import { toast } from 'sonner'
import { EnhancedTranscriptDisplay } from './EnhancedTranscriptDisplay'

// Enhanced Transcript Display Component for real-time transcription
export function EnhancedTranscriptDisplay({ 
  transcriptionResult, 
  isTranscribing = false, 
  progress = 0,
  progressMessage = '',
  onCopy,
  onExport,
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
      'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
      'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'
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
    if (speakerLabel) {
      return speakerLabel.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase()
    }
    if (!speakerId) return 'U'
    if (speakerId.includes('Speaker') || speakerId.includes('speaker')) {
      const num = speakerId.match(/\d+/)
      return num ? `S${num[0]}` : 'S'
    }
    return speakerId.substring(0, 2).toUpperCase()
  }

  // Get speaker display name
  const getSpeakerName = (speakerId, speakerLabel) => {
    if (speakerLabel) return speakerLabel
    if (!speakerId) return 'Unknown Speaker'
    if (speakerId.includes('Speaker') || speakerId.includes('speaker')) {
      const num = speakerId.match(/\d+/)
      return num ? `Speaker ${num[0]}` : 'Speaker'
    }
    return speakerId
  }

  const handleCopyAll = () => {
    if (!transcriptionResult?.text && !transcriptionResult?.segments) {
      toast.error('No text to copy')
      return
    }
    
    const textToCopy = transcriptionResult.text || 
      transcriptionResult.segments?.map(s => s.text).join(' ') || ''
    
    if (onCopy) {
      onCopy(textToCopy)
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => toast.success('📋 Text copied to clipboard'))
        .catch(() => toast.error('Failed to copy text'))
    }
  }

  const segments = transcriptionResult?.segments || []
  const hasContent = segments.length > 0 || transcriptionResult?.text

  return (
    <Card className={`h-[600px] flex flex-col ${className}`}>
      <CardHeader className="pb-3">
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
                  ? 'Waiting for transcription...'
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
            {onExport && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onExport}
                disabled={!hasContent}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            )}
          </div>
        </div>
        
        {isTranscribing && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{progressMessage || 'Processing...'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea ref={scrollAreaRef} className="h-full px-6">
          {segments.length === 0 && !transcriptionResult?.text ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Waiting for transcript...</p>
                {isTranscribing && <p className="text-sm mt-1">Processing audio...</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
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
                  <p className="text-sm leading-relaxed">{transcriptionResult.text}</p>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Individual transcript segment component
function TranscriptSegment({ 
  segment, 
  speakerColor, 
  speakerInitials,
  speakerName,
  formatTime, 
  isLast, 
  isTranscribing 
}) {
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlaySegment = () => {
    setIsPlaying(!isPlaying)
    // This would integrate with audio playback in the future
    toast.info('Audio playback coming soon!')
  }

  return (
    <div className={`group relative ${isLast && isTranscribing ? 'animate-pulse' : ''}`}>
      <div className="flex gap-3">
        {/* Speaker Avatar */}
        <div className="flex-shrink-0">
          <Avatar className="w-8 h-8">
            <AvatarFallback className={`text-xs font-medium ${speakerColor}`}>
              {speakerInitials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs ${speakerColor}`}>
              {speakerName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTime(segment.start)}
              {segment.end && segment.end !== segment.start && (
                <> → {formatTime(segment.end)}</>
              )}
            </span>
            {segment.confidence && (
              <span className="text-xs text-muted-foreground">
                {Math.round(segment.confidence * 100)}%
              </span>
            )}
            
            {/* Play button (appears on hover) */}
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
              onClick={handlePlaySegment}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
          </div>

          {/* Text */}
          <div className="text-sm leading-relaxed text-foreground">
            {segment.text}
          </div>

          {/* Duration indicator */}
          {segment.end && segment.start && (
            <div className="text-xs text-muted-foreground mt-1">
              Duration: {formatTime(segment.end - segment.start)}
            </div>
          )}
        </div>
      </div>
      
      {/* Separator (except for last item) */}
      {!isLast && <Separator className="mt-4" />}
    </div>
  )
}

// Demo Component showing different use cases
export default function TranscriptDemo() {
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [progress, setProgress] = useState(0)
  
  // Sample transcript data with multiple speakers
  const sampleTranscript = {
    text: "Hello everyone, welcome to today's quarterly business review meeting. I'm excited to share our progress and discuss the path forward. Thank you, John. Let's start with the quarterly review and dive into our performance metrics.",
    segments: [
      {
        id: 0,
        start: 0,
        end: 4.8,
        text: "Good morning everyone, and welcome to today's quarterly business review meeting. I'm excited to share our progress and discuss the path forward.",
        speakerId: "speaker_1",
        speakerLabel: "John Smith",
        confidence: 0.95
      },
      {
        id: 1,
        start: 5.2,
        end: 8.7,
        text: "Thank you, John. Let's start with the quarterly review and dive into our performance metrics. Sarah, could you begin with the financial overview?",
        speakerId: "speaker_2", 
        speakerLabel: "Sarah Johnson",
        confidence: 0.92
      },
      {
        id: 2,
        start: 9.1,
        end: 16.8,
        text: "Absolutely. I've prepared comprehensive financial reports that show significant growth in Q3. Our revenue increased by twenty-eight percent compared to the same quarter last year, reaching four point two million dollars.",
        speakerId: "speaker_3",
        speakerLabel: "Sarah Williams", 
        confidence: 0.88
      },
      {
        id: 3,
        start: 17.2,
        end: 22.5,
        text: "That's excellent news, Sarah. Can you break down the revenue by product line? I'm particularly interested in how our new software products performed.",
        speakerId: "speaker_2",
        speakerLabel: "Sarah Johnson",
        confidence: 0.91
      },
      {
        id: 4,
        start: 23.1,
        end: 31.4,
        text: "Certainly. Our software division led the growth with a forty-two percent increase, generating one point eight million in revenue. The hardware division grew by fifteen percent, and our services division maintained steady growth at twelve percent.",
        speakerId: "speaker_3",
        speakerLabel: "Sarah Williams",
        confidence: 0.93
      }
    ],
    metadata: {
      duration: 31.4,
      createdAt: new Date().toISOString()
    }
  }

  const toggleTranscribing = () => {
    setIsTranscribing(!isTranscribing)
    if (!isTranscribing) {
      // Simulate progress
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += Math.random() * 10
        if (currentProgress >= 100) {
          currentProgress = 100
          clearInterval(interval)
          setIsTranscribing(false)
        }
        setProgress(currentProgress)
      }, 500)
    } else {
      setProgress(0)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('📋 Text copied to clipboard')
  }

  const handleExport = () => {
    toast.success('💾 Export functionality would be implemented here')
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enhanced Transcript Display</h2>
          <p className="text-muted-foreground">Real-time transcription with speaker identification</p>
        </div>
        <Button 
          variant="outline"
          onClick={toggleTranscribing}
        >
          {isTranscribing ? (
            <>
              <Square className="w-4 h-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 mr-2" />
              Simulate
            </>
          )}
        </Button>
      </div>

      <EnhancedTranscriptDisplay 
        transcriptionResult={sampleTranscript}
        isTranscribing={isTranscribing}
        progress={progress}
        progressMessage={isTranscribing ? "Processing audio..." : ""}
        onCopy={handleCopy}
        onExport={handleExport}
      />
      
      {/* Additional Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Real-time progress tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span>Speaker identification with colors</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span>Timestamp display</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span>Confidence scores</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-500 rounded-full" />
              <span>Auto-scroll functionality</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-500 rounded-full" />
              <span>Copy and export options</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Speaker Colors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {['John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez'].map((name, index) => {
              const colors = [
                'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
                'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400',
                'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
                'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
              ]
              return (
                <div key={name} className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className={`text-xs ${colors[index]}`}>
                      {name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant="outline" className={`text-xs ${colors[index]}`}>
                    {name}
                  </Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}