// src/renderer/whisperdesk-ui/src/components/transcription/GroupedSpeakerTranscript.jsx
import React, { useState, useMemo } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { toast } from 'sonner'

export function GroupedSpeakerTranscript({ 
  segments, 
  speakerUtils, 
  formatTime,
  onSpeakerRename,
  searchState,
  isTranscribing 
}) {
  const [renamingStates, setRenamingStates] = useState({}) // Track rename input for each speaker

  // Group consecutive segments by speaker
  const groupedSegments = useMemo(() => {
    if (!segments || segments.length === 0) return []

    const groups = []
    let currentGroup = null

    segments.forEach((segment, index) => {
      const speakerId = segment.speakerId || segment.speaker || 'unknown'
      
      if (!currentGroup || currentGroup.speakerId !== speakerId) {
        // Start new group
        currentGroup = {
          id: groups.length,
          speakerId,
          speakerLabel: segment.speakerLabel || speakerUtils.getSpeakerName(speakerId),
          segments: [segment],
          startTime: segment.start,
          endTime: segment.end
        }
        groups.push(currentGroup)
      } else {
        // Add to existing group
        currentGroup.segments.push(segment)
        currentGroup.endTime = segment.end
      }
    })

    return groups
  }, [segments, speakerUtils])

  // Handle speaker rename
  const handleSpeakerRename = async (speakerId, currentLabel) => {
    const newName = renamingStates[speakerId]?.trim()
    if (!newName || newName === currentLabel) return

    try {
      // Call your existing speaker service
      if (onSpeakerRename) {
        await onSpeakerRename(speakerId, newName)
        toast.success(`Speaker renamed to "${newName}"`)
      }
      
      // Clear the rename state
      setRenamingStates(prev => ({
        ...prev,
        [speakerId]: ''
      }))
    } catch (error) {
      toast.error('Failed to rename speaker')
      console.error('Speaker rename error:', error)
    }
  }

  // Update rename input
  const updateRenameInput = (speakerId, value) => {
    setRenamingStates(prev => ({
      ...prev,
      [speakerId]: value
    }))
  }

  // Get speaker colors using your existing utility
  const getSpeakerColors = (speakerId) => {
    const colorClass = speakerUtils.getSpeakerColor(speakerId)
    
    // Extract colors from your existing class string for different elements
    if (colorClass.includes('blue')) {
      return { border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' }
    } else if (colorClass.includes('green')) {
      return { border: 'border-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' }
    } else if (colorClass.includes('purple')) {
      return { border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' }
    } else if (colorClass.includes('orange')) {
      return { border: 'border-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' }
    } else if (colorClass.includes('pink')) {
      return { border: 'border-pink-500', text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30' }
    } else if (colorClass.includes('cyan')) {
      return { border: 'border-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/30' }
    }
    
    // Default to blue
    return { border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' }
  }

  // Format segment metrics (like your existing format)
  const formatMetrics = (segment) => (
    <div className="flex gap-4 text-xs text-muted-foreground font-mono">
      <span>{formatTime(segment.start)}</span>
      {segment.confidence && (
        <span className="text-orange-500">▲{Math.round(segment.confidence * 100)}%</span>
      )}
      {segment.end && segment.start && (
        <span>{formatTime(segment.end - segment.start)} duration</span>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {groupedSegments.map((group) => {
        const speakerColors = getSpeakerColors(group.speakerId)
        const renameValue = renamingStates[group.speakerId] || ''
        
        return (
          <div key={group.id} className={`border-l-2 ${speakerColors.border} pl-4`}>
            {/* Speaker Header with Rename Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={`flex items-center gap-2 mb-3 ${speakerColors.text} hover:opacity-75 transition-opacity`}>
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{group.speakerLabel}</span>
                </button>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent align="start" className="bg-card border-border p-4 min-w-[320px]">
                <div className="text-muted-foreground text-sm mb-4">Change or Rename Speaker...</div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className={`w-4 h-4 ${speakerColors.text}`} />
                      <span className={speakerColors.text}>{group.speakerLabel}</span>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded">current</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => updateRenameInput(group.speakerId, e.target.value)}
                      placeholder="Rename Speaker..."
                      className="bg-background border-border text-foreground text-sm flex-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSpeakerRename(group.speakerId, group.speakerLabel)
                        }
                      }}
                    />
                    <Button 
                      onClick={() => handleSpeakerRename(group.speakerId, group.speakerLabel)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm px-4"
                      disabled={!renameValue.trim()}
                    >
                      Rename
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Speaker Segments */}
            <div className="space-y-4">
              {group.segments.map((segment, index) => (
                <div key={segment.id || index} className="space-y-1">
                  <p className="text-foreground leading-relaxed">{segment.text}</p>
                  {formatMetrics(segment)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
      
      {/* Live indicator */}
      {isTranscribing && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span>Live transcription in progress...</span>
        </div>
      )}
    </div>
  )
}