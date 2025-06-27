// Advanced Analytics Utilities for WhisperDesk
// Enhanced implementations for interruption detection, sentiment analysis, 
// topic extraction, and speech pattern analysis

// ===== 1. REAL INTERRUPTION & OVERLAP DETECTION =====

export const detectInterruptionsAndOverlaps = (segments) => {
  const interruptions = []
  const overlaps = []
  
  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i]
    const next = segments[i + 1]
    
    // Detect overlaps: when segments from different speakers overlap in time
    if (current.speakerId !== next.speakerId && current.end > next.start) {
      overlaps.push({
        time: next.start,
        duration: current.end - next.start,
        speakers: [current.speakerId, next.speakerId],
        overlapText: {
          speaker1: current.text.substring(Math.max(0, current.text.length - 50)),
          speaker2: next.text.substring(0, Math.min(50, next.text.length))
        }
      })
    }
    
    // Detect interruptions: short segments followed by different speaker
    if (current.speakerId !== next.speakerId && 
        (current.end - current.start) < 2.0 && // Less than 2 seconds
        next.start - current.end < 0.5) { // Quick transition
      interruptions.push({
        time: current.start,
        interruptedSpeaker: current.speakerId,
        interruptingSpeaker: next.speakerId,
        duration: current.end - current.start,
        context: current.text
      })
    }
  }
  
  return { interruptions, overlaps }
}

// ===== 2. ENHANCED SENTIMENT ANALYSIS =====

// Expanded lexicon with intensity weights
const sentimentLexicon = {
  positive: {
    'excellent': 0.9, 'amazing': 0.9, 'fantastic': 0.9, 'outstanding': 0.9,
    'wonderful': 0.8, 'great': 0.8, 'awesome': 0.8, 'brilliant': 0.8,
    'good': 0.6, 'nice': 0.5, 'pleasant': 0.5, 'okay': 0.3,
    'love': 0.8, 'like': 0.6, 'enjoy': 0.7, 'appreciate': 0.6,
    'happy': 0.7, 'pleased': 0.6, 'satisfied': 0.6, 'thrilled': 0.8,
    'excited': 0.7, 'delighted': 0.7, 'perfect': 0.9
  },
  negative: {
    'terrible': -0.9, 'awful': -0.9, 'horrible': -0.9, 'atrocious': -0.9,
    'bad': -0.6, 'poor': -0.5, 'disappointing': -0.7, 'inadequate': -0.6,
    'hate': -0.8, 'dislike': -0.6, 'frustrated': -0.7, 'annoyed': -0.5,
    'angry': -0.8, 'upset': -0.6, 'sad': -0.6, 'worried': -0.5,
    'concerned': -0.4, 'problem': -0.4, 'issue': -0.3, 'difficult': -0.4
  }
}

// Enhanced sentiment analysis with context awareness and negation handling
export const analyzeSegmentSentiment = (text, previousSentiment = null) => {
  const words = text.toLowerCase().split(/\s+/)
  let score = 0
  let wordCount = 0
  
  // Check for negation words
  const negationWords = ['not', 'no', 'never', 'nothing', 'nobody', 'neither', 'none', 'nowhere']
  const intensifiers = ['very', 'really', 'extremely', 'quite', 'fairly', 'pretty', 'rather']
  
  let negationActive = false
  let intensifierMultiplier = 1.0
  
  words.forEach((word, index) => {
    // Check for negation
    if (negationWords.includes(word)) {
      negationActive = true
      return
    }
    
    // Check for intensifiers
    if (intensifiers.includes(word)) {
      intensifierMultiplier = word === 'very' || word === 'extremely' ? 1.5 : 1.2
      return
    }
    
    // Check sentiment lexicon
    const positiveScore = sentimentLexicon.positive[word]
    const negativeScore = sentimentLexicon.negative[word]
    
    if (positiveScore) {
      const adjustedScore = positiveScore * intensifierMultiplier
      score += negationActive ? -adjustedScore : adjustedScore
      wordCount++
    } else if (negativeScore) {
      const adjustedScore = negativeScore * intensifierMultiplier
      score += negationActive ? -adjustedScore : adjustedScore
      wordCount++
    }
    
    // Reset modifiers after processing sentiment word or after 3 words
    if ((positiveScore || negativeScore) || index % 3 === 0) {
      negationActive = false
      intensifierMultiplier = 1.0
    }
  })
  
  // Calculate raw sentiment and apply momentum smoothing
  const rawSentiment = wordCount > 0 ? Math.max(-1, Math.min(1, score / wordCount)) : 0
  const normalizedSentiment = (rawSentiment + 1) / 2 // Convert to 0-1 scale
  
  // Smooth with previous sentiment (momentum)
  return previousSentiment !== null ? 
    (normalizedSentiment * 0.7 + previousSentiment * 0.3) : normalizedSentiment
}

// Enhanced sentiment analysis for full transcription
export const analyzeSentimentAdvanced = (text, segments) => {
  if (!text || !segments.length) {
    return { overall: 0.5, byTime: [], distribution: { positive: 33, neutral: 34, negative: 33 } }
  }
  
  let previousSentiment = null
  const byTime = segments.map(segment => {
    const sentiment = analyzeSegmentSentiment(segment.text, previousSentiment)
    previousSentiment = sentiment
    
    return {
      time: segment.start,
      sentiment: sentiment,
      confidence: Math.abs(sentiment - 0.5) * 2, // Higher confidence for extreme sentiments
      speakerId: segment.speakerId
    }
  })
  
  // Calculate overall sentiment
  const overall = byTime.length > 0 
    ? byTime.reduce((sum, item) => sum + item.sentiment, 0) / byTime.length 
    : 0.5
  
  // Calculate distribution
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
    }
  }
}

// ===== 3. ADVANCED TOPIC EXTRACTION =====

// Helper functions for TF-IDF calculation
const createTextChunks = (segments, chunkDurationSeconds) => {
  const chunks = []
  let currentChunk = { text: '', startTime: 0, endTime: 0, segments: [] }
  
  segments.forEach(segment => {
    if (segment.start - currentChunk.startTime >= chunkDurationSeconds && currentChunk.text) {
      chunks.push(currentChunk)
      currentChunk = { text: '', startTime: segment.start, endTime: segment.end, segments: [] }
    }
    
    if (!currentChunk.startTime) currentChunk.startTime = segment.start
    currentChunk.endTime = segment.end
    currentChunk.text += ' ' + segment.text
    currentChunk.segments.push(segment)
  })
  
  if (currentChunk.text) {
    chunks.push(currentChunk)
  }
  
  return chunks
}

const buildVocabulary = (documents) => {
  const wordSet = new Set()
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'])
  
  documents.forEach(doc => {
    const words = doc.toLowerCase().split(/\s+/).filter(word => 
      word.length > 2 && !stopWords.has(word) && /^[a-zA-Z]+$/.test(word)
    )
    words.forEach(word => wordSet.add(word))
  })
  
  return Array.from(wordSet)
}

const calculateTermFrequency = (document, vocabulary) => {
  const words = document.toLowerCase().split(/\s+/)
  const wordCount = {}
  
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1
  })
  
  return vocabulary.map(term => (wordCount[term] || 0) / words.length)
}

const calculateInverseDocumentFrequency = (documents, vocabulary) => {
  const docCount = documents.length
  
  return vocabulary.map(term => {
    const docsContainingTerm = documents.filter(doc => 
      doc.toLowerCase().includes(term)
    ).length
    
    return docsContainingTerm > 0 ? Math.log(docCount / docsContainingTerm) : 0
  })
}

const calculateTFIDF = (documents, vocabulary) => {
  const tf = documents.map(doc => calculateTermFrequency(doc, vocabulary))
  const idf = calculateInverseDocumentFrequency(documents, vocabulary)
  
  return tf.map(docTF => 
    vocabulary.map((term, i) => docTF[i] * idf[i])
  )
}

const getTopTerms = (tfidfVector, vocabulary, count = 5) => {
  const termScores = vocabulary.map((term, index) => ({
    term,
    score: tfidfVector[index]
  }))
  
  return termScores
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(item => item.term)
}

// Enhanced topic classification
const themeClassifier = {
  'Technical Discussion': ['system', 'code', 'development', 'software', 'api', 'technology', 'programming', 'database', 'server', 'application'],
  'Business Strategy': ['market', 'revenue', 'growth', 'strategy', 'business', 'plan', 'goals', 'objectives', 'competition', 'opportunity'],
  'Team Coordination': ['team', 'meeting', 'deadline', 'project', 'task', 'schedule', 'assignment', 'coordination', 'collaboration', 'workflow'],
  'Customer Focus': ['customer', 'user', 'client', 'feedback', 'experience', 'satisfaction', 'service', 'support', 'requirements', 'needs'],
  'Problem Solving': ['issue', 'problem', 'solution', 'fix', 'resolve', 'bug', 'error', 'troubleshoot', 'debug', 'investigate'],
  'Financial Discussion': ['budget', 'cost', 'price', 'investment', 'profit', 'expense', 'financial', 'money', 'funding', 'revenue'],
  'Process Improvement': ['process', 'improve', 'optimize', 'efficiency', 'workflow', 'procedure', 'best', 'practice', 'standard', 'quality']
}

const classifyTheme = (topTerms) => {
  let bestTheme = 'General Discussion'
  let bestScore = 0
  
  Object.entries(themeClassifier).forEach(([theme, keywords]) => {
    const score = topTerms.filter(term => 
      keywords.some(keyword => term.includes(keyword) || keyword.includes(term))
    ).length
    
    if (score > bestScore) {
      bestScore = score
      bestTheme = theme
    }
  })
  
  return bestTheme
}

const calculateTopicIntensity = (topTerms, tfidfVector) => {
  return topTerms.reduce((sum, term, index) => sum + (tfidfVector[index] || 0), 0) / topTerms.length
}

const mergeAdjacentTopics = (topics) => {
  const merged = []
  let current = null
  
  topics.forEach(topic => {
    if (current && current.theme === topic.theme && 
        topic.startTime - current.endTime < 60) { // Merge if within 60 seconds
      current.endTime = topic.endTime
      current.keywords = [...new Set([...current.keywords, ...topic.keywords])]
      current.intensity = (current.intensity + topic.intensity) / 2
    } else {
      if (current) merged.push(current)
      current = { ...topic }
    }
  })
  
  if (current) merged.push(current)
  return merged
}

// Main topic extraction function
export const extractTopicsAdvanced = (text, segments) => {
  if (!text || !segments.length) return []
  
  // Split into chunks for better topic segmentation
  const chunks = createTextChunks(segments, 30) // 30-second chunks
  
  if (chunks.length === 0) return []
  
  // Calculate TF-IDF for each chunk
  const documents = chunks.map(chunk => chunk.text)
  const vocabulary = buildVocabulary(documents)
  
  if (vocabulary.length === 0) return []
  
  const tfidfMatrix = calculateTFIDF(documents, vocabulary)
  
  // Extract top terms per chunk
  const topics = chunks.map((chunk, index) => {
    const topTerms = getTopTerms(tfidfMatrix[index], vocabulary, 5)
    const theme = classifyTheme(topTerms)
    
    return {
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      theme: theme,
      keywords: topTerms,
      intensity: calculateTopicIntensity(topTerms, tfidfMatrix[index])
    }
  })
  
  // Merge similar adjacent topics
  return mergeAdjacentTopics(topics)
}

// ===== 4. ENHANCED SPEECH PATTERN ANALYSIS =====

// Advanced filler detection with pattern recognition
export const detectFillersAdvanced = (segments) => {
  const fillerPatterns = {
    hesitations: /\b(uh|um|er|ah|eh|uhh|umm|err)\b/gi,
    repetitions: /\b(\w+)\s+\1\b/gi,
    false_starts: /\b\w+\s*[-–—]\s*\w+/gi,
    thinking_sounds: /\b(hmm|hmmm|uhh|umm|err|oh)\b/gi,
    discourse_markers: /\b(like|you know|i mean|sort of|kind of)\b/gi
  }
  
  const results = {
    total: 0,
    byType: {
      hesitations: 0,
      repetitions: 0,
      false_starts: 0,
      thinking_sounds: 0,
      discourse_markers: 0
    },
    timeline: [],
    density: []
  }
  
  segments.forEach(segment => {
    const fillers = {}
    let segmentTotal = 0
    
    Object.entries(fillerPatterns).forEach(([type, pattern]) => {
      const matches = segment.text.match(pattern) || []
      fillers[type] = matches.length
      segmentTotal += matches.length
      results.byType[type] += matches.length
    })
    
    if (segmentTotal > 0) {
      results.timeline.push({
        time: segment.start,
        count: segmentTotal,
        types: fillers,
        speakerId: segment.speakerId,
        text: segment.text
      })
    }
    
    results.total += segmentTotal
  })
  
  // Calculate density windows (30-second intervals)
  results.density = calculateDensityWindows(results.timeline, segments, 30)
  
  return results
}

// Helper function for density calculation
const calculateDensityWindows = (timeline, segments, windowSize) => {
  if (segments.length === 0) return []
  
  const totalDuration = Math.max(...segments.map(s => s.end || 0))
  const windows = []
  
  for (let start = 0; start < totalDuration; start += windowSize) {
    const end = start + windowSize
    const windowFillers = timeline.filter(item => 
      item.time >= start && item.time < end
    )
    
    const totalCount = windowFillers.reduce((sum, item) => sum + item.count, 0)
    
    windows.push({
      startTime: start,
      endTime: end,
      fillerCount: totalCount,
      density: totalCount / windowSize // fillers per second
    })
  }
  
  return windows
}

// Enhanced speaking rate analysis
export const analyzeSpeakingRate = (segments) => {
  if (!segments.length) return { timeline: [], changes: [], averageWPM: 0, peakWPM: 0, variability: 0 }
  
  const rates = segments.map(segment => {
    const duration = segment.end - segment.start
    const wordCount = segment.text.split(/\s+/).filter(word => word.length > 0).length
    return {
      time: segment.start,
      wpm: duration > 0 ? (wordCount / duration) * 60 : 0,
      speakerId: segment.speakerId,
      wordCount,
      duration
    }
  }).filter(rate => rate.wpm > 0) // Filter out invalid rates
  
  if (rates.length === 0) return { timeline: [], changes: [], averageWPM: 0, peakWPM: 0, variability: 0 }
  
  // Apply moving average smoothing
  const smoothedRates = applyMovingAverage(rates, 3)
  
  // Detect significant rate changes
  const rateChanges = detectRateChanges(smoothedRates)
  
  // Calculate statistics
  const wpmValues = rates.map(r => r.wpm)
  const averageWPM = wpmValues.reduce((sum, wpm) => sum + wpm, 0) / wpmValues.length
  const peakWPM = Math.max(...wpmValues)
  const variability = calculateVariability(wpmValues)
  
  return {
    timeline: smoothedRates,
    changes: rateChanges,
    averageWPM: Math.round(averageWPM),
    peakWPM: Math.round(peakWPM),
    variability: Math.round(variability * 100) / 100
  }
}

// Helper function for moving average
const applyMovingAverage = (data, windowSize) => {
  return data.map((item, index) => {
    const start = Math.max(0, index - Math.floor(windowSize / 2))
    const end = Math.min(data.length, index + Math.floor(windowSize / 2) + 1)
    const window = data.slice(start, end)
    
    const avgWPM = window.reduce((sum, w) => sum + w.wpm, 0) / window.length
    
    return {
      ...item,
      wpm: avgWPM,
      smoothed: true
    }
  })
}

// Helper function to detect rate changes
const detectRateChanges = (rates) => {
  const changes = []
  const threshold = 0.3 // 30% change threshold
  
  for (let i = 1; i < rates.length; i++) {
    const previous = rates[i - 1]
    const current = rates[i]
    
    const percentageChange = Math.abs(current.wpm - previous.wpm) / previous.wpm
    
    if (percentageChange > threshold) {
      changes.push({
        time: current.time,
        previousWPM: Math.round(previous.wpm),
        currentWPM: Math.round(current.wpm),
        changeType: current.wpm > previous.wpm ? 'increase' : 'decrease',
        magnitude: Math.round(percentageChange * 100),
        speakerId: current.speakerId
      })
    }
  }
  
  return changes
}

// Helper function to calculate variability (coefficient of variation)
const calculateVariability = (values) => {
  if (values.length === 0) return 0
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const standardDeviation = Math.sqrt(variance)
  
  return mean > 0 ? standardDeviation / mean : 0
}

// ===== ENHANCED PAUSE ANALYSIS =====

export const analyzePausesAdvanced = (segments) => {
  if (segments.length < 2) return { pauses: [], statistics: {} }
  
  const pauses = []
  const pausesByType = {
    micro: [], // < 0.5s
    short: [], // 0.5s - 2s
    medium: [], // 2s - 5s
    long: []   // > 5s
  }
  
  for (let i = 1; i < segments.length; i++) {
    const prevSegment = segments[i - 1]
    const currentSegment = segments[i]
    const pauseDuration = currentSegment.start - prevSegment.end
    
    if (pauseDuration > 0.1) { // Only count pauses > 100ms
      const pause = {
        startTime: prevSegment.end,
        endTime: currentSegment.start,
        duration: pauseDuration,
        beforeSpeaker: prevSegment.speakerId,
        afterSpeaker: currentSegment.speakerId,
        isSpeakerChange: prevSegment.speakerId !== currentSegment.speakerId,
        context: {
          beforeText: prevSegment.text.slice(-30),
          afterText: currentSegment.text.slice(0, 30)
        }
      }
      
      pauses.push(pause)
      
      // Categorize pause
      if (pauseDuration < 0.5) pausesByType.micro.push(pause)
      else if (pauseDuration < 2.0) pausesByType.short.push(pause)
      else if (pauseDuration < 5.0) pausesByType.medium.push(pause)
      else pausesByType.long.push(pause)
    }
  }
  
  // Calculate statistics
  const statistics = {
    total: pauses.length,
    byType: {
      micro: pausesByType.micro.length,
      short: pausesByType.short.length,
      medium: pausesByType.medium.length,
      long: pausesByType.long.length
    },
    averageDuration: pauses.length > 0 ? 
      pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length : 0,
    longestPause: pauses.length > 0 ? 
      Math.max(...pauses.map(p => p.duration)) : 0,
    speakerChangePauses: pauses.filter(p => p.isSpeakerChange).length,
    sameSpeakerPauses: pauses.filter(p => !p.isSpeakerChange).length
  }
  
  return { pauses, statistics, pausesByType }
}
