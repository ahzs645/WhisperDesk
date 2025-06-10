import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Play, Pause } from 'lucide-react'
import { toast } from 'sonner'

export function TranscriptSegment({ 
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