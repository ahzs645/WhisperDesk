// Import advanced analytics functions
import {
  detectInterruptionsAndOverlaps,
  analyzeSentimentAdvanced,
  extractTopicsAdvanced,
  detectFillersAdvanced,
  analyzeSpeakingRate,
  analyzePausesAdvanced
} from './advanced-analytics.js'

// Helper function to calculate analytics from transcription result
export const calculateAnalytics = (transcriptionResult, selectedSpeakerId = null) => {
  if (!transcriptionResult) {
    return null
  }

  const { text, segments = [], metadata = {} } = transcriptionResult
  
  // Filter segments by selected speaker if specified
  const filteredSegments = selectedSpeakerId === 'all' || !selectedSpeakerId 
    ? segments 
    : segments.filter(s => (s.speakerId || s.speaker) === selectedSpeakerId)
  
  // Filter text by selected speaker
  const filteredText = selectedSpeakerId === 'all' || !selectedSpeakerId
    ? text
    : filteredSegments.map(s => s.text).join(' ')
  
  // Basic metrics
  const wordCount = filteredText ? filteredText.split(/\s+/).filter(word => word.length > 0).length : 0
  const duration = selectedSpeakerId === 'all' || !selectedSpeakerId
    ? (metadata.duration || (segments.length > 0 ? Math.max(...segments.map(s => s.end || 0)) : 0))
    : (filteredSegments.length > 0 ? filteredSegments.reduce((sum, s) => sum + ((s.end || 0) - (s.start || 0)), 0) : 0)
  
  const wpm = duration > 0 ? Math.round((wordCount / duration) * 60) : 0
  
  // Speaker analysis
  const speakerStats = calculateSpeakerStats(segments)
  const speakerCount = Object.keys(speakerStats).length
  
  // Confidence calculation
  const confidenceScores = filteredSegments.map(s => s.confidence || 0.9).filter(c => c > 0)
  const avgConfidence = confidenceScores.length > 0 
    ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
    : 0.9
  
  // ENHANCED: Advanced interruption and overlap detection
  const interruptionAnalysis = detectInterruptionsAndOverlaps(filteredSegments)
  
  // ENHANCED: Advanced speech pattern analysis with detailed filler detection
  const advancedFillers = detectFillersAdvanced(filteredSegments)
  const speechPatterns = calculateSpeechPatternsAdvanced(filteredText, filteredSegments, advancedFillers, interruptionAnalysis)
  
  // ENHANCED: Advanced sentiment analysis with context awareness
  const sentiment = analyzeSentimentAdvanced(filteredText, filteredSegments)
  
  // ENHANCED: Advanced topic analysis with TF-IDF
  const topics = extractTopics(filteredText, filteredSegments)
  
  // ENHANCED: Speaking rate analysis
  const speakingRateAnalysis = analyzeSpeakingRate(filteredSegments)
  
  // ENHANCED: Pause analysis
  const pauseAnalysis = analyzePausesAdvanced(filteredSegments)
  
  // Quality metrics
  const qualityMetrics = calculateQualityMetrics(filteredSegments, confidenceScores)
  
  // Emotion distribution (based on text analysis)
  const emotions = calculateEmotions(filteredText)

  return {
    overview: {
      duration: Math.round(duration),
      wordCount,
      speakerCount: selectedSpeakerId === 'all' || !selectedSpeakerId ? speakerCount : 1,
      confidence: Math.round(avgConfidence * 100 * 10) / 10,
      wpm,
      wer: 0.05 // Placeholder - would need reference text for real WER
    },
    speakers: Object.values(speakerStats),
    sentiment,
    speechPattern: speechPatterns,
    topics,
    acoustic: {
      avgPitch: 185, // Placeholder - would need audio analysis
      pitchRange: [120, 280],
      energy: 0.67,
      voiceQuality: avgConfidence
    },
    emotions,
    qualityMetrics,
    // ENHANCED: New advanced analytics
    interruptions: interruptionAnalysis.interruptions,
    overlaps: interruptionAnalysis.overlaps,
    speakingRate: speakingRateAnalysis,
    pauseAnalysis: pauseAnalysis,
    fillerAnalysis: advancedFillers,
    selectedSpeakerId: selectedSpeakerId || 'all'
  }
}

// ENHANCED: Advanced speech pattern calculation
export const calculateSpeechPatternsAdvanced = (text, segments, fillerAnalysis, interruptionAnalysis) => {
  if (!text) {
    return { 
      fillers: { count: 0, rate: 0, byType: {} }, 
      pauses: { totalCount: 0, avgDuration: 0, longestPause: 0 }, 
      interruptions: 0, 
      overlaps: 0 
    }
  }
  
  // Calculate pause statistics from segments
  const pauses = []
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end || 0
    const currStart = segments[i].start || 0
    const pauseDuration = currStart - prevEnd
    if (pauseDuration > 0.1) { // Only count pauses > 100ms
      pauses.push(pauseDuration)
    }
  }
  
  const avgPauseDuration = pauses.length > 0 ? pauses.reduce((sum, p) => sum + p, 0) / pauses.length : 0
  const longestPause = pauses.length > 0 ? Math.max(...pauses) : 0
  
  const duration = segments.length > 0 ? Math.max(...segments.map(s => s.end || 0)) : 1
  const fillerRate = (fillerAnalysis.total / duration) * 60 // per minute
  
  return {
    fillers: { 
      count: fillerAnalysis.total, 
      rate: Math.round(fillerRate * 10) / 10,
      byType: fillerAnalysis.byType,
      timeline: fillerAnalysis.timeline,
      density: fillerAnalysis.density
    },
    pauses: { 
      totalCount: pauses.length, 
      avgDuration: Math.round(avgPauseDuration * 10) / 10, 
      longestPause: Math.round(longestPause * 10) / 10 
    },
    interruptions: interruptionAnalysis.interruptions.length,
    overlaps: interruptionAnalysis.overlaps.length,
    interruptionDetails: interruptionAnalysis.interruptions,
    overlapDetails: interruptionAnalysis.overlaps
  }
}

export const calculateSpeakerStats = (segments) => {
  const stats = {}
  
  segments.forEach(segment => {
    const speakerId = segment.speakerId || segment.speaker || 'speaker_1'
    const speakerName = segment.speakerLabel || `Speaker ${speakerId.slice(-1)}`
    const duration = (segment.end || 0) - (segment.start || 0)
    
    if (!stats[speakerId]) {
      stats[speakerId] = {
        id: speakerId,
        name: speakerName,
        speakingTime: 0,
        turns: 0,
        avgTurnDuration: 0,
        dominance: 0
      }
    }
    
    stats[speakerId].speakingTime += duration
    stats[speakerId].turns += 1
  })
  
  // Calculate averages and dominance
  const totalSpeakingTime = Object.values(stats).reduce((sum, s) => sum + s.speakingTime, 0)
  
  Object.values(stats).forEach(speaker => {
    speaker.avgTurnDuration = speaker.turns > 0 ? speaker.speakingTime / speaker.turns : 0
    speaker.dominance = totalSpeakingTime > 0 ? (speaker.speakingTime / totalSpeakingTime) * 100 : 0
  })
  
  return stats
}

export const calculateSpeechPatterns = (text, segments) => {
  if (!text) return { fillers: { count: 0, rate: 0 }, pauses: { totalCount: 0, avgDuration: 0, longestPause: 0 }, interruptions: 0, overlaps: 0 }
  
  // Count fillers (um, uh, etc.)
  const fillerWords = ['um', 'uh', 'er', 'ah', 'like', 'you know']
  const words = text.toLowerCase().split(/\s+/)
  const fillerCount = words.filter(word => fillerWords.some(filler => word.includes(filler))).length
  
  // Calculate pause statistics from segments
  const pauses = []
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = segments[i - 1].end || 0
    const currStart = segments[i].start || 0
    const pauseDuration = currStart - prevEnd
    if (pauseDuration > 0.1) { // Only count pauses > 100ms
      pauses.push(pauseDuration)
    }
  }
  
  const avgPauseDuration = pauses.length > 0 ? pauses.reduce((sum, p) => sum + p, 0) / pauses.length : 0
  const longestPause = pauses.length > 0 ? Math.max(...pauses) : 0
  
  const duration = segments.length > 0 ? Math.max(...segments.map(s => s.end || 0)) : 1
  const fillerRate = (fillerCount / duration) * 60 // per minute
  
  return {
    fillers: { 
      count: fillerCount, 
      rate: Math.round(fillerRate * 10) / 10 
    },
    pauses: { 
      totalCount: pauses.length, 
      avgDuration: Math.round(avgPauseDuration * 10) / 10, 
      longestPause: Math.round(longestPause * 10) / 10 
    },
    interruptions: Math.floor(segments.length * 0.05), // Estimated - now replaced with real detection
    overlaps: Math.floor(segments.length * 0.03) // Estimated - now replaced with real detection
  }
}

export const calculateSentiment = (text, segments) => {
  // Fallback to advanced sentiment analysis
  return analyzeSentimentAdvanced(text, segments)
}

export const extractTopics = (text, segments) => {
  // Try advanced topic extraction first, fallback to simple version
  if (segments && segments.length > 0) {
    const advancedTopics = extractTopicsAdvanced(text, segments)
    if (advancedTopics.length > 0) {
      // Convert advanced topic format to simple format for compatibility
      return advancedTopics.map(topic => ({
        name: topic.theme,
        frequency: Math.round(topic.intensity * 10),
        sentiment: 0.5 + (Math.random() - 0.5) * 0.6 // Random sentiment between 0.2-0.8
      }))
    }
  }
  
  // Fallback to simple keyword-based topic extraction
  if (!text) return []
  
  const topicKeywords = {
    'Business Strategy': ['strategy', 'business', 'market', 'revenue', 'growth', 'profit'],
    'Technology': ['technology', 'software', 'digital', 'app', 'system', 'platform'],
    'Team Management': ['team', 'management', 'leadership', 'staff', 'employee', 'meeting'],
    'Customer Experience': ['customer', 'client', 'user', 'service', 'experience', 'feedback'],
    'Finance': ['budget', 'finance', 'cost', 'investment', 'financial', 'money']
  }
  
  const words = text.toLowerCase().split(/\s+/)
  const topics = []
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    const mentions = keywords.filter(keyword => words.some(word => word.includes(keyword))).length
    if (mentions > 0) {
      topics.push({
        name: topic,
        frequency: mentions,
        sentiment: 0.5 + (Math.random() - 0.5) * 0.6 // Random sentiment between 0.2-0.8
      })
    }
  })
  
  return topics.sort((a, b) => b.frequency - a.frequency).slice(0, 5)
}

export const calculateQualityMetrics = (segments, confidenceScores) => {
  const confidenceRanges = [
    { range: '90-100%', count: 0, percentage: 0 },
    { range: '80-89%', count: 0, percentage: 0 },
    { range: '70-79%', count: 0, percentage: 0 },
    { range: '60-69%', count: 0, percentage: 0 }
  ]
  
  confidenceScores.forEach(confidence => {
    const percentage = confidence * 100
    if (percentage >= 90) confidenceRanges[0].count++
    else if (percentage >= 80) confidenceRanges[1].count++
    else if (percentage >= 70) confidenceRanges[2].count++
    else confidenceRanges[3].count++
  })
  
  const total = confidenceScores.length
  confidenceRanges.forEach(range => {
    range.percentage = total > 0 ? (range.count / total) * 100 : 0
  })
  
  return {
    rtf: 0.25, // Real-time factor (placeholder)
    confidence: confidenceRanges
  }
}

export const calculateEmotions = (text) => {
  if (!text) return []
  
  // Simple emotion detection based on text patterns
  const emotionKeywords = {
    'Professional': ['meeting', 'discuss', 'analyze', 'review', 'plan', 'strategy'],
    'Enthusiastic': ['excited', 'great', 'amazing', 'fantastic', 'wonderful', 'love'],
    'Concerned': ['worried', 'concern', 'issue', 'problem', 'challenge', 'difficult'],
    'Frustrated': ['frustrated', 'annoying', 'stuck', 'blocked', 'hate', 'terrible'],
    'Excited': ['excited', 'thrilled', 'pumped', 'eager', 'looking forward', "can't wait"]
  }
  
  const words = text.toLowerCase().split(/\s+/)
  const emotions = []
  
  Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
    const matches = keywords.filter(keyword => words.some(word => word.includes(keyword))).length
    emotions.push({
      name: emotion,
      value: Math.max(5, matches * 8 + Math.random() * 15), // Ensure some value
      color: getEmotionColor(emotion)
    })
  })
  
  // Normalize to 100%
  const total = emotions.reduce((sum, e) => sum + e.value, 0)
  emotions.forEach(emotion => {
    emotion.value = Math.round((emotion.value / total) * 100)
  })
  
  return emotions
}

const getEmotionColor = (emotion) => {
  const colors = {
    'Professional': '#3b82f6',
    'Enthusiastic': '#10b981',
    'Concerned': '#f59e0b',
    'Frustrated': '#ef4444',
    'Excited': '#8b5cf6'
  }
  return colors[emotion] || '#6b7280'
}