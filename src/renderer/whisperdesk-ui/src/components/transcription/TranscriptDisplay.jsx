// src/renderer/whisperdesk-ui/src/components/transcription/TranscriptDisplay.jsx
// Updated to use the separate search component
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Mic, Clock, Copy, Users, List } from 'lucide-react'
import { TranscriptSearch, highlightSearchText } from './TranscriptSearch'
import { EnhancedTranscriptSegment } from './EnhancedTranscriptSegment'
import { GroupedSpeakerTranscript } from './GroupedSpeakerTranscript'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function TranscriptDisplay({ 
  transcriptionResult, 
  isTranscribing = false, 
  progress = 0,
  progressMessage = '',
  onCopy,
  onTranscriptionUpdate, // Add callback for transcription updates
  settings, // Add settings prop to get persistent view mode
  className = "" 
}) {
  const [autoScroll, setAutoScroll] = useState(true)
  const [viewMode, setViewMode] = useState(settings?.transcriptViewMode || 'grouped') // Use settings or default to 'grouped'
  const [searchState, setSearchState] = useState({
    isSearching: false,
    searchQuery: '',
    searchResults: { matches: [], totalCount: 0 },
    currentMatchIndex: 0,
    showSearch: false
  })
  
  const scrollAreaRef = useRef(null)
  const bottomRef = useRef(null)
  const currentMatchRef = useRef(null)

  // Auto-scroll to bottom when new content arrives (only if actively transcribing and not searching)
  useEffect(() => {
    if (autoScroll && bottomRef.current && transcriptionResult?.segments?.length > 0 && !searchState.isSearching && isTranscribing) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcriptionResult?.segments?.length, autoScroll, searchState.isSearching, isTranscribing])

  // Sync local viewMode state with settings
  useEffect(() => {
    if (settings?.transcriptViewMode && settings.transcriptViewMode !== viewMode) {
      setViewMode(settings.transcriptViewMode)
    }
  }, [settings?.transcriptViewMode, viewMode])

  // Add useEffect to listen for speaker label updates
  useEffect(() => {
    // Check if we're in an Electron environment
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.speaker) {
      // Listen for speaker label updates
      const handleSpeakerLabelUpdate = (data) => {
        const { speakerId, label } = data;
        console.log('[TranscriptDisplay] Speaker label updated:', { speakerId, label });
        
        // Update the transcript data with new speaker labels
        if (onTranscriptionUpdate && transcriptionResult?.segments) {
          const updatedTranscript = {
            ...transcriptionResult,
            segments: transcriptionResult.segments.map(segment => {
              if ((segment.speakerId || segment.speaker) === speakerId) {
                return {
                  ...segment,
                  speakerLabel: label
                };
              }
              return segment;
            })
          };
          onTranscriptionUpdate(updatedTranscript);
          console.log('[TranscriptDisplay] Transcript updated successfully');
        } else {
          console.warn('[TranscriptDisplay] Cannot update transcript - missing callback or segments');
        }
      };
      
      const cleanup = window.electronAPI.speaker.onSpeakerLabelUpdated(handleSpeakerLabelUpdate);
      
      // Cleanup
      return cleanup;
    } else {
      console.warn('[TranscriptDisplay] Speaker API not available');
    }
  }, [onTranscriptionUpdate, transcriptionResult])

  // Handle search state changes with useCallback to prevent infinite updates
  const handleSearchStateChange = useCallback((newSearchState) => {
    setSearchState(prev => {
      // Only update if the state actually changed
      if (
        prev.isSearching === newSearchState.isSearching &&
        prev.searchQuery === newSearchState.searchQuery &&
        prev.currentMatchIndex === newSearchState.currentMatchIndex &&
        prev.showSearch === newSearchState.showSearch &&
        prev.searchResults.totalCount === newSearchState.searchResults.totalCount
      ) {
        return prev
      }
      return newSearchState
    })
  }, [])

  // Handle navigation to search match with useCallback
  const handleNavigateToMatch = useCallback((match, matchIndex) => {
    // Scroll to the match after a brief delay to ensure ref is set
    setTimeout(() => {
      if (currentMatchRef.current) {
        currentMatchRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        })
      }
    }, 100)
  }, [])

  // Memoize speaker utility functions to prevent unnecessary recalculations
  const speakerUtils = useMemo(() => ({
    getSpeakerColor: (speakerId) => {
      const colors = [
        'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
        'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
        'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
        'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
        'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800',
        'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800'
      ]
      
      if (!speakerId) return colors[0]
      
      const hash = speakerId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
      }, 0)
      
      return colors[Math.abs(hash) % colors.length]
    },

    getSpeakerInitials: (speakerId, speakerLabel) => {
      if (speakerLabel) return speakerLabel.slice(0, 2).toUpperCase()
      if (!speakerId) return '??'
      return speakerId.slice(0, 2).toUpperCase()
    },

    getSpeakerName: (speakerId, speakerLabel) => {
      if (speakerLabel) return speakerLabel
      if (!speakerId) return 'Unknown Speaker'
      return `Speaker ${speakerId}`
    }
  }), [])

  // Format timestamp with useCallback
  const formatTime = useCallback((seconds) => {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '0:00'
    
    // Handle zero duration specifically
    if (seconds === 0) return '0:00'
    
    // Round to avoid floating point precision issues
    const totalSeconds = Math.round(Math.abs(seconds))
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Handle copy all text with useCallback
  const handleCopyAll = useCallback(() => {
    if (onCopy) {
      onCopy()
    }
  }, [onCopy])

  // Add this function to handle speaker renaming (integrate with your speaker service)
  const handleSpeakerRename = useCallback(async (speakerId, newLabel) => {
    console.log('TranscriptDisplay: Starting speaker rename:', { speakerId, newLabel });
    
    try {
      // Check if we're in an Electron environment
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.speaker) {
        const result = await window.electronAPI.speaker.setSpeakerLabel({
          speakerId,
          label: newLabel
        });
        
        if (result.success) {
          console.log('[TranscriptDisplay] Speaker renamed successfully');
          // The speaker service will emit an event that will update the UI automatically
        } else {
          console.warn('[TranscriptDisplay] Speaker service returned error:', result);
        }
      } else {
        console.warn('[TranscriptDisplay] Speaker API not available - using fallback');
        // Fallback: update locally
        if (onTranscriptionUpdate && transcriptionResult?.segments) {
          const updatedTranscript = {
            ...transcriptionResult,
            segments: transcriptionResult.segments.map(segment => {
              if ((segment.speakerId || segment.speaker) === speakerId) {
                return {
                  ...segment,
                  speakerLabel: newLabel
                };
              }
              return segment;
            })
          };
          onTranscriptionUpdate(updatedTranscript);
          console.log('[TranscriptDisplay] Local update completed');
        }
      }
    } catch (error) {
      console.error('[TranscriptDisplay] Failed to rename speaker:', error);
      // Fallback: update locally even if remote update fails
      if (onTranscriptionUpdate && transcriptionResult?.segments) {
        const updatedTranscript = {
          ...transcriptionResult,
          segments: transcriptionResult.segments.map(segment => {
            if ((segment.speakerId || segment.speaker) === speakerId) {
              return {
                ...segment,
                speakerLabel: newLabel
              };
            }
            return segment;
          })
        };
        onTranscriptionUpdate(updatedTranscript);
        console.log('[TranscriptDisplay] Error fallback completed');
      }
      throw error;
    }
  }, [onTranscriptionUpdate, transcriptionResult])

  // Memoize segments and content checks
  const segments = useMemo(() => {
    return transcriptionResult?.segments || [];
  }, [transcriptionResult?.segments])
  
  const hasContent = useMemo(() => segments.length > 0 || transcriptionResult?.text, [segments.length, transcriptionResult?.text])

  // Determine current match segment index
  const currentMatchSegmentIndex = useMemo(() => {
    const currentMatch = searchState.searchResults.matches[searchState.currentMatchIndex]
    return currentMatch?.segmentIndex
  }, [searchState.searchResults.matches, searchState.currentMatchIndex])

  return (
    <Card className={`w-full flex flex-col ${className}`}>
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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
            
            {/* Add View Mode Toggle */}
            {segments.length > 0 && (
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={setViewMode}
                className="ml-4"
              >
                <ToggleGroupItem value="grouped" aria-label="Grouped by speaker" size="sm">
                  <Users className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="individual" aria-label="Individual segments" size="sm">
                  <List className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAutoScroll(!autoScroll)}
              className={autoScroll ? 'bg-primary/10' : ''}
              disabled={searchState.isSearching}
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
        
        <CardDescription>
          {segments.length > 0 
            ? `${segments.length} segments • ${transcriptionResult?.metadata?.duration ? formatTime(transcriptionResult.metadata.duration) : 'Processing...'}`
            : isTranscribing 
              ? progressMessage || 'Waiting for transcription...'
              : 'Ready to transcribe'
          }
        </CardDescription>

        {/* Search Component */}
        <TranscriptSearch
          transcriptionResult={transcriptionResult}
          onSearchStateChange={handleSearchStateChange}
          onNavigateToMatch={handleNavigateToMatch}
        />
      </CardHeader>

      {/* Content with proper scroll container */}
      <CardContent className="flex-1 p-0 min-h-0">
        <div className="h-[500px] relative">
          <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
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
                    viewMode === 'grouped' ? (
                      <GroupedSpeakerTranscript
                        segments={segments}
                        speakerUtils={speakerUtils}
                        formatTime={formatTime}
                        onSpeakerRename={handleSpeakerRename}
                        searchState={searchState}
                        isTranscribing={isTranscribing}
                      />
                    ) : (
                      // Your existing individual segment rendering
                      segments.map((segment, index) => {
                        const isCurrentMatchSegment = currentMatchSegmentIndex === index
                        
                        return (
                          <EnhancedTranscriptSegment 
                            key={segment.id || index}
                            ref={isCurrentMatchSegment ? currentMatchRef : null}
                            segment={segment}
                            segmentIndex={index}
                            speakerColor={speakerUtils.getSpeakerColor(segment.speakerId || segment.speaker)}
                            speakerInitials={speakerUtils.getSpeakerInitials(segment.speakerId || segment.speaker, segment.speakerLabel)}
                            speakerName={speakerUtils.getSpeakerName(segment.speakerId || segment.speaker, segment.speakerLabel)}
                            formatTime={formatTime}
                            isLast={index === segments.length - 1}
                            isTranscribing={isTranscribing}
                            searchState={searchState}
                            isCurrentMatch={isCurrentMatchSegment}
                          />
                        )
                      })
                    )
                  ) : transcriptionResult?.text ? (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {highlightSearchText(transcriptionResult.text, searchState.searchQuery)}
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