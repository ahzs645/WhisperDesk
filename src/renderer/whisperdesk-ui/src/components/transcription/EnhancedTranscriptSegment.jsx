// src/renderer/whisperdesk-ui/src/components/transcription/EnhancedTranscriptSegment.jsx
import React, { useState, forwardRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Play, Pause } from 'lucide-react'
import { toast } from 'sonner'
import { highlightSearchText } from './TranscriptSearch'

export const EnhancedTranscriptSegment = React.memo(forwardRef(({ 
  segment, 
  speakerColor, 
  speakerInitials,
  speakerName,
  formatTime, 
  isLast, 
  isTranscribing,
  segmentIndex,
  searchState = null, // { searchQuery, currentMatchIndex, matches }
  isCurrentMatch = false // Pass this from parent instead of calculating here
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false)

  const handlePlaySegment = useCallback(() => {
    setIsPlaying(prev => !prev)
    toast.info('Audio playback coming soon!')
  }, [])

  // Memoize the highlighted text to prevent unnecessary recalculations
  const highlightedSpeakerName = useMemo(() => {
    if (!searchState?.searchQuery) return speakerName
    
    // Check if current match is a speaker match for this segment
    const currentMatch = searchState.matches?.[searchState.currentMatchIndex]
    const isCurrentSpeakerMatch = currentMatch && 
      currentMatch.segmentIndex === segmentIndex && 
      currentMatch.type === 'speaker'
    
    return highlightSearchText(speakerName, searchState.searchQuery, isCurrentSpeakerMatch)
  }, [speakerName, searchState?.searchQuery, searchState?.currentMatchIndex, searchState?.matches, segmentIndex])

  const highlightedText = useMemo(() => {
    if (!searchState?.searchQuery) return segment.text
    
    // Check if current match is a text match for this segment
    const currentMatch = searchState.matches?.[searchState.currentMatchIndex]
    const isCurrentTextMatch = currentMatch && 
      currentMatch.segmentIndex === segmentIndex && 
      currentMatch.type === 'segment'
    
    return highlightSearchText(segment.text, searchState.searchQuery, isCurrentTextMatch)
  }, [segment.text, searchState?.searchQuery, searchState?.currentMatchIndex, searchState?.matches, segmentIndex])

  return (
    <div 
      ref={isCurrentMatch ? ref : null}
      className={`group relative ${isLast && isTranscribing ? 'animate-pulse' : ''} ${
        isCurrentMatch ? 'bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2 -m-2' : ''
      }`}
    >
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
              {highlightedSpeakerName}
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

          {/* Text with search highlighting */}
          <div className="text-sm leading-relaxed text-foreground">
            {highlightedText}
          </div>

          {/* Duration indicator */}
          {segment.end != null && segment.start != null && (
            <div className="text-xs text-muted-foreground mt-1">
              Duration: {formatTime(Number(segment.end) - Number(segment.start))}
            </div>
          )}
        </div>
      </div>
      
      {/* Separator (except for last item) */}
      {!isLast && <Separator className="mt-4" />}
    </div>
  )
}))

EnhancedTranscriptSegment.displayName = "EnhancedTranscriptSegment"