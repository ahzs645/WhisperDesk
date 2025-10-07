import { useState, useMemo, useEffect } from 'react'
import { calculateAnalytics } from '../utils/calculations'
import { analyzeSentimentWithLibrary } from '../utils/sentiment-library'
import { toast } from 'sonner'

export const useEnhancedAnalytics = (transcriptionResult, useAdvancedMode = true) => {
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('all')
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [advancedFeatures, setAdvancedFeatures] = useState({
    realInterruptions: false,
    advancedSentiment: false,
    tfidfTopics: false,
    speakingRateAnalysis: false,
    advancedFillers: false
  })

  // Calculate analytics with optional advanced features
  useEffect(() => {
    if (!transcriptionResult) {
      setAnalytics(null)
      return
    }

    const calculateAdvancedAnalytics = async () => {
      setIsLoading(true)
      
      try {
        // Always start with standard analytics
        const standardAnalytics = calculateAnalytics(transcriptionResult, selectedSpeakerId)
        
        if (!useAdvancedMode) {
          setAnalytics(standardAnalytics)
          setAdvancedFeatures({
            realInterruptions: false,
            advancedSentiment: false,
            tfidfTopics: false,
            speakingRateAnalysis: false,
            advancedFillers: false
          })
          setIsLoading(false)
          return
        }

        // Enhanced analytics processing
        let enhancedAnalytics = { ...standardAnalytics }
        const features = {
          realInterruptions: false,
          advancedSentiment: false,
          tfidfTopics: false,
          speakingRateAnalysis: false,
          advancedFillers: false
        }

        // Check what advanced features are available
        if (enhancedAnalytics.interruptions && enhancedAnalytics.interruptions.length >= 0) {
          features.realInterruptions = true
        }

        if (enhancedAnalytics.speakingRate) {
          features.speakingRateAnalysis = true
        }

        if (enhancedAnalytics.fillerAnalysis) {
          features.advancedFillers = true
        }

        // Check if topics have advanced TF-IDF data
        if (enhancedAnalytics.topics && enhancedAnalytics.topics.length > 0 && 
            enhancedAnalytics.topics[0].startTime !== undefined) {
          features.tfidfTopics = true
        }

        // Try to enhance sentiment analysis with library
        if (transcriptionResult.text && transcriptionResult.segments) {
          try {
            const enhancedSentiment = await analyzeSentimentWithLibrary(
              transcriptionResult.text, 
              transcriptionResult.segments.filter(s => 
                selectedSpeakerId === 'all' || (s.speakerId || s.speaker) === selectedSpeakerId
              )
            )
            
            if (enhancedSentiment.usingLibrary) {
              enhancedAnalytics.sentiment = enhancedSentiment
              features.advancedSentiment = true
            }
          } catch (error) {
            console.warn('Enhanced sentiment analysis failed, using standard:', error)
          }
        }

        setAnalytics(enhancedAnalytics)
        setAdvancedFeatures(features)
        
      } catch (error) {
        console.error('Error calculating enhanced analytics:', error)
        // Fallback to standard analytics
        const standardAnalytics = calculateAnalytics(transcriptionResult, selectedSpeakerId)
        setAnalytics(standardAnalytics)
        setAdvancedFeatures({
          realInterruptions: false,
          advancedSentiment: false,
          tfidfTopics: false,
          speakingRateAnalysis: false,
          advancedFillers: false
        })
        
        if (useAdvancedMode) {
          toast.error('Advanced analytics failed, using standard mode')
        }
      } finally {
        setIsLoading(false)
      }
    }

    calculateAdvancedAnalytics()
  }, [transcriptionResult, selectedSpeakerId, useAdvancedMode])

  const handleExportReport = async () => {
    if (!analytics) {
      toast.error('No analytics data to export')
      return
    }

    try {
      // Create a comprehensive report with advanced features
      const report = {
        title: 'WhisperDesk Enhanced Analytics Report',
        generatedAt: new Date().toISOString(),
        mode: useAdvancedMode ? 'Enhanced' : 'Standard',
        selectedSpeaker: selectedSpeakerId === 'all' ? 'All Speakers' : analytics.speakers.find(s => s.id === selectedSpeakerId)?.name || 'Unknown',
        featuresUsed: advancedFeatures,
        transcription: {
          duration: analytics.overview.duration,
          wordCount: analytics.overview.wordCount,
          speakerCount: analytics.overview.speakerCount,
          confidence: analytics.overview.confidence
        },
        analytics: {
          ...analytics,
          // Include advanced metrics summary
          advancedMetrics: useAdvancedMode ? {
            totalInterruptions: analytics.interruptions?.length || 0,
            totalOverlaps: analytics.overlaps?.length || 0,
            averageSpeakingRate: analytics.speakingRate?.averageWPM || analytics.overview?.wpm || 0,
            totalFillers: analytics.fillerAnalysis?.total || analytics.speechPattern?.fillers?.count || 0,
            sentimentConfidence: analytics.sentiment?.byTime?.length > 0 ? 
              analytics.sentiment.byTime.reduce((sum, item) => sum + (item.confidence || 0), 0) / analytics.sentiment.byTime.length : null,
            topicAnalysisMethod: advancedFeatures.tfidfTopics ? 'TF-IDF' : 'Keyword-based'
          } : null
        }
      }

      if (window.electronAPI?.export?.text) {
        await window.electronAPI.export.text(report, 'json')
        toast.success('📊 Enhanced analytics report exported successfully')
      } else {
        // Fallback for web
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `enhanced-analytics-report-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('📊 Enhanced analytics report downloaded')
      }
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export report: ' + error.message)
    }
  }

  const handleSpeakerSelection = (speakerId) => {
    setSelectedSpeakerId(speakerId)
    const speakerName = speakerId === 'all' ? 'All Speakers' : 
      analytics?.speakers.find(s => s.id === speakerId)?.name || 'Selected Speaker'
    
    toast.success(`📊 Showing ${useAdvancedMode ? 'enhanced' : 'standard'} analytics for ${speakerName}`)
  }

  return {
    analytics,
    selectedSpeakerId,
    isLoading,
    advancedFeatures,
    handleExportReport,
    handleSpeakerSelection
  }
}
