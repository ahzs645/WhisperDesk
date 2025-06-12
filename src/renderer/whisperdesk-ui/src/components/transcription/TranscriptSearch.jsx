// src/renderer/whisperdesk-ui/src/components/transcription/TranscriptSearch.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

export function TranscriptSearch({ 
  transcriptionResult, 
  onSearchStateChange,
  onNavigateToMatch 
}) {
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  
  const searchInputRef = useRef(null)

  // Focus search input when search is opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  // Process search matches
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { matches: [], totalCount: 0 }

    const query = searchQuery.toLowerCase()
    const segments = transcriptionResult?.segments || []
    const plainText = transcriptionResult?.text || ''
    const matches = []

    if (segments.length > 0) {
      // Search in segments
      segments.forEach((segment, segmentIndex) => {
        const text = segment.text.toLowerCase()
        const speakerName = (segment.speakerLabel || `Speaker ${segment.speakerId || segment.speaker || '1'}`).toLowerCase()
        
        // Search in segment text
        let startIndex = 0
        while (true) {
          const index = text.indexOf(query, startIndex)
          if (index === -1) break
          
          matches.push({
            type: 'segment',
            segmentIndex,
            textIndex: index,
            length: query.length,
            text: segment.text,
            context: segment.text.substring(Math.max(0, index - 20), index + query.length + 20),
            speaker: segment.speakerLabel || `Speaker ${segment.speakerId || segment.speaker || '1'}`,
            timestamp: segment.start
          })
          
          startIndex = index + 1
        }

        // Search in speaker name
        if (speakerName.includes(query)) {
          matches.push({
            type: 'speaker',
            segmentIndex,
            text: segment.speakerLabel || `Speaker ${segment.speakerId || segment.speaker || '1'}`,
            context: segment.text.substring(0, 50) + (segment.text.length > 50 ? '...' : ''),
            speaker: segment.speakerLabel || `Speaker ${segment.speakerId || segment.speaker || '1'}`,
            timestamp: segment.start
          })
        }
      })
    } else if (plainText) {
      // Search in plain text
      const text = plainText.toLowerCase()
      let startIndex = 0
      while (true) {
        const index = text.indexOf(query, startIndex)
        if (index === -1) break
        
        matches.push({
          type: 'plaintext',
          textIndex: index,
          length: query.length,
          text: plainText,
          context: plainText.substring(Math.max(0, index - 30), index + query.length + 30)
        })
        
        startIndex = index + 1
      }
    }

    return { matches, totalCount: matches.length }
  }, [searchQuery, transcriptionResult])

  // Reset current match index when search changes
  useEffect(() => {
    setCurrentMatchIndex(0)
  }, [searchQuery])

  // Notify parent component of search state changes with useCallback to prevent infinite updates
  const notifySearchState = React.useCallback(() => {
    onSearchStateChange({
      isSearching: !!searchQuery.trim(),
      searchQuery,
      searchResults,
      currentMatchIndex,
      showSearch
    })
  }, [searchQuery, searchResults.totalCount, currentMatchIndex, showSearch, onSearchStateChange])

  useEffect(() => {
    notifySearchState()
  }, [notifySearchState])

  // Navigate to specific match
  const navigateToMatch = (index) => {
    if (index < 0 || index >= searchResults.totalCount) return
    
    setCurrentMatchIndex(index)
    
    // Notify parent to scroll to match
    if (onNavigateToMatch && searchResults.matches[index]) {
      onNavigateToMatch(searchResults.matches[index], index)
    }
  }

  // Navigation handlers
  const goToPreviousMatch = () => {
    const newIndex = currentMatchIndex > 0 
      ? currentMatchIndex - 1 
      : searchResults.totalCount - 1
    navigateToMatch(newIndex)
  }

  const goToNextMatch = () => {
    const newIndex = currentMatchIndex < searchResults.totalCount - 1 
      ? currentMatchIndex + 1 
      : 0
    navigateToMatch(newIndex)
  }

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
  }

  // Clear search
  const clearSearch = () => {
    setSearchQuery('')
    setShowSearch(false)
    setCurrentMatchIndex(0)
  }

  // Toggle search
  const toggleSearch = () => {
    if (showSearch && searchQuery) {
      clearSearch()
    } else {
      setShowSearch(!showSearch)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
      
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        clearSearch()
      }
      
      // Enter to go to next match
      if (e.key === 'Enter' && showSearch && searchResults.totalCount > 0) {
        e.preventDefault()
        if (e.shiftKey) {
          goToPreviousMatch()
        } else {
          goToNextMatch()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showSearch, searchResults.totalCount, currentMatchIndex])

  return (
    <div className="space-y-2">
      {/* Search Toggle Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleSearch}
            className={showSearch ? 'bg-primary/10' : ''}
          >
            <Search className="w-4 h-4 mr-1" />
            Search
          </Button>
          
          {/* Match Count Badge */}
          {searchResults.totalCount > 0 && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400">
              {searchResults.totalCount} matches
            </Badge>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search transcript... (Ctrl+F)"
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
            
            {/* Search Navigation */}
            {searchResults.totalCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">
                  {currentMatchIndex + 1} of {searchResults.totalCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousMatch}
                  disabled={searchResults.totalCount === 0}
                  className="h-8 w-8 p-0"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextMatch}
                  disabled={searchResults.totalCount === 0}
                  className="h-8 w-8 p-0"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Search Tips */}
          {showSearch && !searchQuery && (
            <div className="text-xs text-muted-foreground">
              💡 Tip: Use Ctrl+F to open search, Enter to navigate matches, Shift+Enter for previous
            </div>
          )}

          {/* No Results */}
          {searchQuery && searchResults.totalCount === 0 && (
            <div className="text-sm text-muted-foreground">
              No matches found for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Utility function to highlight text (can be used by parent component)
export function highlightSearchText(text, searchQuery, isCurrentMatch = false) {
  if (!searchQuery?.trim()) return text

  const query = searchQuery.toLowerCase()
  const textLower = text.toLowerCase()
  const parts = []
  let lastIndex = 0

  let matchCount = 0
  let startIndex = 0
  while (true) {
    const index = textLower.indexOf(query, startIndex)
    if (index === -1) break

    // Add text before match
    if (index > lastIndex) {
      parts.push(text.substring(lastIndex, index))
    }

    // Add highlighted match
    parts.push(
      <span
        key={`match-${index}-${matchCount}`}
        className={`px-1 py-0.5 rounded text-sm font-medium ${
          isCurrentMatch 
            ? 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-500 dark:bg-yellow-500 dark:text-yellow-100' 
            : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
        }`}
      >
        {text.substring(index, index + query.length)}
      </span>
    )

    lastIndex = index + query.length
    startIndex = index + 1
    matchCount++
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? parts : text
}