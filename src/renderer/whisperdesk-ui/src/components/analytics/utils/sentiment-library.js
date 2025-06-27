// Enhanced sentiment analysis with optional sentiment.js library support
import { analyzeSentimentAdvanced } from './advanced-analytics.js'

let Sentiment = null

// Try to import sentiment library, fallback gracefully if not available
try {
  const sentimentModule = await import('sentiment')
  Sentiment = sentimentModule.default
} catch (error) {
  console.warn('Sentiment library not available, using built-in analysis')
}

export const analyzeSentimentWithLibrary = (text, segments) => {
  if (!text || !segments.length) {
    return { overall: 0.5, byTime: [], distribution: { positive: 33, neutral: 34, negative: 33 } }
  }

  // If sentiment library is available, use it
  if (Sentiment) {
    try {
      const sentiment = new Sentiment()
      const overallResult = sentiment.analyze(text)
      
      const byTime = segments.map(segment => {
        const segmentResult = sentiment.analyze(segment.text)
        return {
          time: segment.start,
          sentiment: Math.max(0, Math.min(1, (segmentResult.score + 5) / 10)), // Normalize to 0-1
          confidence: Math.abs(segmentResult.score) / Math.max(1, segmentResult.words.length),
          speakerId: segment.speakerId,
          rawScore: segmentResult.score
        }
      })
      
      const overall = Math.max(0, Math.min(1, (overallResult.score + 5) / 10))
      
      // Calculate distribution based on normalized scores
      const positive = byTime.filter(item => item.sentiment > 0.6).length
      const negative = byTime.filter(item => item.sentiment < 0.4).length
      const neutral = byTime.length - positive - negative
      
      const total = byTime.length || 1
      
      return {
        overall,
        byTime,
        distribution: {
          positive: Math.round((positive / total) * 100),
          negative: Math.round((negative / total) * 100),
          neutral: Math.round((neutral / total) * 100)
        },
        rawScore: overallResult.score,
        comparative: overallResult.comparative,
        usingLibrary: true
      }
    } catch (error) {
      console.warn('Error using sentiment library, falling back to built-in analysis:', error)
    }
  }
  
  // Fallback to built-in advanced sentiment analysis
  const result = analyzeSentimentAdvanced(text, segments)
  return {
    ...result,
    usingLibrary: false
  }
}
