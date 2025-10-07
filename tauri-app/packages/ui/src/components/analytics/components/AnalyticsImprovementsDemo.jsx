import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Code2, Check, TrendingUp, Zap } from 'lucide-react'

export default function AnalyticsImprovementsDemo() {
  const [selectedFeature, setSelectedFeature] = useState('interruptions')

  const improvements = {
    interruptions: {
      title: 'Real Interruption & Overlap Detection',
      description: 'Accurate detection of speech interruptions and overlaps using timing analysis',
      before: 'interruptions: Math.floor(segments.length * 0.05), // Estimated',
      after: `// Real detection based on speaker changes and timing
for (let i = 0; i < segments.length - 1; i++) {
  const current = segments[i]
  const next = segments[i + 1]
  
  // Detect overlaps: different speakers, overlapping time
  if (current.speakerId !== next.speakerId && current.end > next.start) {
    overlaps.push({
      time: next.start,
      duration: current.end - next.start,
      speakers: [current.speakerId, next.speakerId]
    })
  }
  
  // Detect interruptions: short segments + quick transitions
  if (current.speakerId !== next.speakerId && 
      (current.end - current.start) < 2.0 && 
      next.start - current.end < 0.5) {
    interruptions.push({
      time: current.start,
      interruptedSpeaker: current.speakerId,
      interruptingSpeaker: next.speakerId
    })
  }
}`,
      benefits: [
        'Accurate real-time interruption detection',
        'Speaker overlap analysis with duration',
        'Context-aware conversation flow insights',
        'Detailed interruption patterns by speaker'
      ]
    },
    sentiment: {
      title: 'Enhanced Sentiment Analysis',
      description: 'Advanced sentiment analysis with negation handling and context awareness',
      before: `// Simple keyword matching
const positiveWords = ['good', 'great', 'excellent']
const negativeWords = ['bad', 'terrible', 'awful']
const positiveCount = words.filter(word => positiveWords.includes(word)).length`,
      after: `// Enhanced analysis with intensity weights and negation
const sentimentLexicon = {
  positive: {
    'excellent': 0.9, 'amazing': 0.9, 'good': 0.6, 'okay': 0.3
  },
  negative: {
    'terrible': -0.9, 'bad': -0.6, 'disappointing': -0.7
  }
}

// Handle negation and intensifiers
const negationWords = ['not', 'no', 'never']
const intensifiers = ['very', 'really', 'extremely']

// Context-aware scoring with momentum smoothing
const rawSentiment = analyzeWithContext(text, previousSentiment)
return previousSentiment ? 
  (rawSentiment * 0.7 + previousSentiment * 0.3) : rawSentiment`,
      benefits: [
        'Negation-aware sentiment detection',
        'Intensity-weighted scoring system',
        'Context momentum for smoother analysis',
        'Optional Sentiment.js library integration'
      ]
    },
    topics: {
      title: 'Advanced Topic Extraction',
      description: 'TF-IDF based topic extraction with temporal analysis',
      before: `// Simple keyword matching
const topicKeywords = {
  'Business Strategy': ['strategy', 'business', 'market']
}
const mentions = keywords.filter(keyword => 
  words.some(word => word.includes(keyword))).length`,
      after: `// TF-IDF based extraction with temporal chunks
const chunks = createTextChunks(segments, 30) // 30-second chunks
const documents = chunks.map(chunk => chunk.text)
const vocabulary = buildVocabulary(documents)
const tfidfMatrix = calculateTFIDF(documents, vocabulary)

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
})`,
      benefits: [
        'TF-IDF statistical topic modeling',
        'Temporal topic segmentation',
        'Advanced theme classification',
        'Topic intensity and keyword extraction'
      ]
    },
    speech: {
      title: 'Advanced Speech Pattern Analysis',
      description: 'Comprehensive analysis of speech patterns, fillers, and speaking rate',
      before: `// Basic filler counting
const fillerWords = ['um', 'uh', 'er', 'ah']
const fillerCount = words.filter(word => 
  fillerWords.includes(word)).length`,
      after: `// Advanced pattern recognition
const fillerPatterns = {
  hesitations: /\\b(uh|um|er|ah|eh)\\b/gi,
  repetitions: /\\b(\\w+)\\s+\\1\\b/gi,
  false_starts: /\\b\\w+\\s*-\\s*\\w+/gi,
  thinking_sounds: /\\b(hmm|uhh|umm)\\b/gi,
  discourse_markers: /\\b(like|you know|i mean)\\b/gi
}

// Speaking rate analysis with smoothing
const rates = segments.map(segment => ({
  time: segment.start,
  wpm: (segment.text.split(/\\s+/).length / duration) * 60,
  speakerId: segment.speakerId
}))

const smoothedRates = applyMovingAverage(rates, 3)
const rateChanges = detectRateChanges(smoothedRates)`,
      benefits: [
        'Multiple filler pattern detection types',
        'Speaking rate analysis with change detection',
        'Advanced pause categorization',
        'Moving average smoothing for accuracy'
      ]
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
          <TrendingUp className="w-8 h-8 text-green-500" />
          WhisperDesk Analytics Improvements
        </h1>
        <p className="text-muted-foreground text-lg">
          Advanced AI-powered analytics for deeper conversation insights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(improvements).map(([key, feature]) => (
          <Card 
            key={key}
            className={`cursor-pointer transition-all ${
              selectedFeature === key ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedFeature(key)}
          >
            <CardContent className="p-4">
              <div className="text-center">
                <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <h3 className="font-semibold text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {feature.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5" />
            {improvements[selectedFeature].title}
          </CardTitle>
          <CardDescription>
            {improvements[selectedFeature].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="implementation" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="implementation">Implementation</TabsTrigger>
              <TabsTrigger value="benefits">Benefits</TabsTrigger>
            </TabsList>
            
            <TabsContent value="implementation" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Badge variant="destructive">Before</Badge>
                    Simple Implementation
                  </h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    <code>{improvements[selectedFeature].before}</code>
                  </pre>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Badge variant="default" className="bg-green-500">After</Badge>
                    Enhanced Implementation
                  </h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                    <code>{improvements[selectedFeature].after}</code>
                  </pre>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="benefits" className="space-y-3">
              {improvements[selectedFeature].benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{benefit}</span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Guide</CardTitle>
          <CardDescription>
            How to use these enhanced analytics in your WhisperDesk application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Import Enhanced Components</h4>
              <pre className="bg-muted p-3 rounded text-xs">
                <code>{`import EnhancedAnalyticsTab from './components/analytics/EnhancedAnalyticsTab'
import { useEnhancedAnalytics } from './hooks/useEnhancedAnalytics'`}</code>
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">2. Use Enhanced Analytics Hook</h4>
              <pre className="bg-muted p-3 rounded text-xs">
                <code>{`const {
  analytics,
  selectedSpeakerId,
  advancedFeatures,
  handleSpeakerSelection
} = useEnhancedAnalytics(transcriptionResult, true) // true = enhanced mode`}</code>
              </pre>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">3. Toggle Between Modes</h4>
              <pre className="bg-muted p-3 rounded text-xs">
                <code>{`<Switch
  checked={useAdvancedMode}
  onCheckedChange={setUseAdvancedMode}
/>
<Label>Enhanced Analytics Mode</Label>`}</code>
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
