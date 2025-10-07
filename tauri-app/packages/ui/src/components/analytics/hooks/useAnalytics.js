import { useState, useMemo } from 'react'
import { calculateAnalytics } from '../utils/calculations'
import { toast } from 'sonner'

export const useAnalytics = (transcriptionResult) => {
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('all')

  // Calculate analytics from current transcription result with speaker filter
  const analytics = useMemo(() => {
    return calculateAnalytics(transcriptionResult, selectedSpeakerId)
  }, [transcriptionResult, selectedSpeakerId])

  const handleExportReport = async () => {
    if (!analytics) {
      toast.error('No analytics data to export')
      return
    }

    try {
      // Create a comprehensive report
      const report = {
        title: 'WhisperDesk Analytics Report',
        generatedAt: new Date().toISOString(),
        selectedSpeaker: selectedSpeakerId === 'all' ? 'All Speakers' : analytics.speakers.find(s => s.id === selectedSpeakerId)?.name || 'Unknown',
        transcription: {
          duration: analytics.overview.duration,
          wordCount: analytics.overview.wordCount,
          speakerCount: analytics.overview.speakerCount
        },
        analytics
      }

      if (window.electronAPI?.export?.text) {
        await window.electronAPI.export.text(report, 'json')
        toast.success('📊 Analytics report exported successfully')
      } else {
        // Fallback for web
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics-report-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('📊 Analytics report downloaded')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export report: ' + error.message)
    }
  }

  const handleSpeakerSelection = (speakerId) => {
    setSelectedSpeakerId(speakerId)
    toast.success(`📊 Showing analytics for ${speakerId === 'all' ? 'All Speakers' : analytics.speakers.find(s => s.id === speakerId)?.name || 'Selected Speaker'}`)
  }

  return {
    analytics,
    selectedSpeakerId,
    handleExportReport,
    handleSpeakerSelection
  }
}