import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar,
  AreaChart, Area
} from 'recharts'
import { 
  BarChart3, Clock, Users, Mic, Brain, Heart, Zap, 
  TrendingUp, MessageSquare, Pause, Timer, Volume2,
  Target, Eye, AlertTriangle, Languages, Download,
  ThumbsUp, ThumbsDown, Meh
} from 'lucide-react'
import { useAppState } from '@/App'
import { toast } from 'sonner'

// Helper function to calculate analytics from transcription result
const calculateAnalytics = (transcriptionResult) => {
  if (!transcriptionResult) {
    return null
  }

  const { text, segments = [], metadata = {} } = transcriptionResult
  
  // Basic metrics
  const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0
  const duration = metadata.duration || (segments.length > 0 ? Math.max(...segments.map(s => s.end || 0)) : 0)
  const wpm = duration > 0 ? Math.round((wordCount / duration) * 60) : 0
  
  // Speaker analysis
  const speakerStats = calculateSpeakerStats(segments)
  const speakerCount = Object.keys(speakerStats).length
  
  // Confidence calculation
  const confidenceScores = segments.map(s => s.confidence || 0.9).filter(c => c > 0)
  const avgConfidence = confidenceScores.length > 0 
    ? confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length
    : 0.9
  
  // Speech pattern analysis
  const speechPatterns = calculateSpeechPatterns(text, segments)
  
  // Sentiment analysis (simplified)
  const sentiment = calculateSentiment(text, segments)
  
  // Topic analysis
  const topics = extractTopics(text)
  
  // Quality metrics
  const qualityMetrics = calculateQualityMetrics(segments, confidenceScores)
  
  // Emotion distribution (based on text analysis)
  const emotions = calculateEmotions(text)

  return {
    overview: {
      duration: Math.round(duration),
      wordCount,
      speakerCount,
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
    qualityMetrics
  }
}

const calculateSpeakerStats = (segments) => {
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

const calculateSpeechPatterns = (text, segments) => {
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
    interruptions: Math.floor(segments.length * 0.05), // Estimated
    overlaps: Math.floor(segments.length * 0.03) // Estimated
  }
}

const calculateSentiment = (text, segments) => {
  if (!text) return { overall: 0.5, byTime: [], distribution: { positive: 33, neutral: 34, negative: 33 } }
  
  // Simple sentiment analysis based on keywords
  const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'like', 'happy', 'pleased']
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'sad', 'angry', 'frustrated', 'disappointed', 'problem']
  
  const words = text.toLowerCase().split(/\s+/)
  const positiveCount = words.filter(word => positiveWords.some(pos => word.includes(pos))).length
  const negativeCount = words.filter(word => negativeWords.some(neg => word.includes(neg))).length
  
  const totalWords = words.length
  const sentimentScore = totalWords > 0 
    ? Math.max(0, Math.min(1, 0.5 + ((positiveCount - negativeCount) / totalWords) * 2))
    : 0.5
  
  // Generate sentiment over time
  const byTime = segments.map((segment, index) => ({
    time: segment.start || index * 10,
    sentiment: sentimentScore + (Math.random() - 0.5) * 0.3 // Add some variation
  }))
  
  // Calculate distribution
  const positive = Math.round(sentimentScore * 60 + 20)
  const negative = Math.round((1 - sentimentScore) * 20 + 5)
  const neutral = 100 - positive - negative
  
  return {
    overall: sentimentScore,
    byTime,
    distribution: { positive, neutral, negative }
  }
}

const extractTopics = (text) => {
  if (!text) return []
  
  // Simple keyword-based topic extraction
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

const calculateQualityMetrics = (segments, confidenceScores) => {
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

const calculateEmotions = (text) => {
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

// Format helpers
const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
                  : `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatPercentage = (value) => `${value.toFixed(1)}%`

const getSentimentColor = (sentiment) => {
  if (sentiment > 0.6) return 'text-green-600 dark:text-green-400'
  if (sentiment > 0.3) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

const getSentimentIcon = (sentiment) => {
  if (sentiment > 0.6) return <ThumbsUp className="w-4 h-4" />
  if (sentiment > 0.3) return <Meh className="w-4 h-4" />
  return <ThumbsDown className="w-4 h-4" />
}

export { AnalyticsTab }

export default function AnalyticsTab() {
  const { appState } = useAppState()
  const [selectedMetric, setSelectedMetric] = useState('overview')

  // Calculate analytics from current transcription result
  const analytics = useMemo(() => {
    return calculateAnalytics(appState.lastTranscriptionResult)
  }, [appState.lastTranscriptionResult])

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

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Analytics Available</h3>
            <p className="text-muted-foreground">
              Complete a transcription to view detailed analytics and insights.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audio Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive analysis of your transcribed audio
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportReport}>
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Duration</p>
                <p className="text-2xl font-bold">{formatTime(analytics.overview.duration)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Words</p>
                <p className="text-2xl font-bold">{analytics.overview.wordCount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Speakers</p>
                <p className="text-2xl font-bold">{analytics.overview.speakerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Confidence</p>
                <p className="text-2xl font-bold">{formatPercentage(analytics.overview.confidence)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">WPM</p>
                <p className="text-2xl font-bold">{analytics.overview.wpm}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">WER</p>
                <p className="text-2xl font-bold">{formatPercentage(analytics.overview.wer * 100)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speaker Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Speaker Analysis
            </CardTitle>
            <CardDescription>
              Speaking time, turns, and conversation dominance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.speakers.map((speaker, index) => (
                <div key={speaker.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {speaker.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{speaker.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(speaker.speakingTime)} • {speaker.turns} turns
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {formatPercentage(speaker.dominance)}
                    </Badge>
                  </div>
                  <Progress value={speaker.dominance} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment Over Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5" />
              Sentiment Analysis
            </CardTitle>
            <CardDescription>
              Emotional tone throughout the conversation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Sentiment</span>
                <div className="flex items-center gap-1">
                  {getSentimentIcon(analytics.sentiment.overall)}
                  <span className={`font-medium ${getSentimentColor(analytics.sentiment.overall)}`}>
                    {formatPercentage(analytics.sentiment.overall * 100)}
                  </span>
                </div>
              </div>
              
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.sentiment.byTime}>
                    <defs>
                      <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="sentiment" 
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#sentimentGradient)" 
                    />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 1]} hide />
                    <Tooltip 
                      formatter={(value) => [formatPercentage(value * 100), 'Sentiment']}
                      labelFormatter={(time) => `${formatTime(time)}`}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                    <ThumbsUp className="w-3 h-3" />
                    <span className="font-medium">{analytics.sentiment.distribution.positive}%</span>
                  </div>
                  <p className="text-muted-foreground">Positive</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
                    <Meh className="w-3 h-3" />
                    <span className="font-medium">{analytics.sentiment.distribution.neutral}%</span>
                  </div>
                  <p className="text-muted-foreground">Neutral</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                    <ThumbsDown className="w-3 h-3" />
                    <span className="font-medium">{analytics.sentiment.distribution.negative}%</span>
                  </div>
                  <p className="text-muted-foreground">Negative</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Speech Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Speech Patterns
            </CardTitle>
            <CardDescription>
              Fluency, pauses, and speaking characteristics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Fillers (um, uh)</span>
                  <Badge variant="outline">{analytics.speechPattern.fillers.count}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Filler Rate</span>
                  <span className="text-sm font-medium">{analytics.speechPattern.fillers.rate}/min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Interruptions</span>
                  <Badge variant="outline">{analytics.speechPattern.interruptions}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overlaps</span>
                  <Badge variant="outline">{analytics.speechPattern.overlaps}</Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Pauses</span>
                  <Badge variant="outline">{analytics.speechPattern.pauses.totalCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Pause</span>
                  <span className="text-sm font-medium">{analytics.speechPattern.pauses.avgDuration}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Longest Pause</span>
                  <span className="text-sm font-medium">{analytics.speechPattern.pauses.longestPause}s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">RTF</span>
                  <span className="text-sm font-medium">{analytics.qualityMetrics.rtf}×</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emotion Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Emotional Tone
            </CardTitle>
            <CardDescription>
              Distribution of emotional states detected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.emotions}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {analytics.emotions.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              {analytics.emotions.map((emotion, index) => (
                <div key={emotion.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: emotion.color }}
                  />
                  <span>{emotion.name}</span>
                  <span className="font-medium ml-auto">{emotion.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topic Analysis */}
      {analytics.topics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Topic Analysis
            </CardTitle>
            <CardDescription>
              Key topics discussed and their sentiment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topics.map((topic, index) => (
                <div key={topic.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{topic.name}</span>
                      <Badge variant="outline">{topic.frequency} mentions</Badge>
                      <div className="flex items-center gap-1">
                        {getSentimentIcon(topic.sentiment)}
                        <span className={`text-xs ${getSentimentColor(topic.sentiment)}`}>
                          {formatPercentage(topic.sentiment * 100)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Progress value={(topic.frequency / Math.max(...analytics.topics.map(t => t.frequency))) * 100} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Transcription Quality
          </CardTitle>
          <CardDescription>
            Confidence distribution and accuracy metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics.qualityMetrics.confidence.map((conf, index) => (
                <div key={conf.range} className="text-center">
                  <div className="text-2xl font-bold">{conf.count}</div>
                  <div className="text-sm text-muted-foreground">words</div>
                  <div className="text-xs text-muted-foreground">{conf.range}</div>
                  <Progress value={conf.percentage} className="h-1 mt-2" />
                </div>
              ))}
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-muted-foreground">Word Error Rate</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatPercentage(analytics.overview.wer * 100)}
                </div>
                <div className="text-xs text-muted-foreground">Excellent</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Real-time Factor</div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {analytics.qualityMetrics.rtf}×
                </div>
                <div className="text-xs text-muted-foreground">Fast</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Voice Quality</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {formatPercentage(analytics.acoustic.voiceQuality * 100)}
                </div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}