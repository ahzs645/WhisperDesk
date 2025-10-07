// Enhanced Analytics Integration Example
// This shows how to integrate the new advanced analytics into your existing WhisperDesk analytics view

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// Import enhanced components
import EnhancedSpeechPatterns from './EnhancedSpeechPatterns'
import EnhancedSentimentAnalysis from './EnhancedSentimentAnalysis'
import EnhancedTopicAnalysis from './EnhancedTopicAnalysis'

// Import existing components for comparison
import SpeechPatterns from './SpeechPatterns'
import SentimentAnalysis from './SentimentAnalysis'
import TopicAnalysis from './TopicAnalysis'

// Import enhanced analytics
import { analyzeSentimentWithLibrary } from '../utils/sentiment-library'
import { calculateAnalytics } from '../utils/calculations'

export default function EnhancedAnalyticsDashboard({ transcriptionResult, selectedSpeakerId, onSpeakerSelection }) {
  const [useEnhancedMode, setUseEnhancedMode] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (transcriptionResult) {
      setIsLoading(true)
      
      // Calculate analytics with enhanced features
      const calculateEnhancedAnalytics = async () => {
        try {
          // Standard analytics calculation
          const standardAnalytics = calculateAnalytics(transcriptionResult, selectedSpeakerId)
          
          if (useEnhancedMode && transcriptionResult.text && transcriptionResult.segments) {
            // Enhanced sentiment analysis with library
            const enhancedSentiment = await analyzeSentimentWithLibrary(
              transcriptionResult.text, 
              transcriptionResult.segments
            )
            
            // Merge enhanced sentiment into analytics
            const enhancedAnalytics = {
              ...standardAnalytics,
              sentiment: enhancedSentiment
            }
            
            setAnalytics(enhancedAnalytics)
          } else {
            setAnalytics(standardAnalytics)
          }
        } catch (error) {
          console.error('Error calculating enhanced analytics:', error)
          // Fallback to standard analytics
          setAnalytics(calculateAnalytics(transcriptionResult, selectedSpeakerId))
        } finally {
          setIsLoading(false)
        }
      }
      
      calculateEnhancedAnalytics()
    }
  }, [transcriptionResult, selectedSpeakerId, useEnhancedMode])

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground">
          {isLoading ? 'Calculating analytics...' : 'No analytics data available'}
        </div>
      </div>
    )
  }

  const renderAnalyticsOverview = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{analytics.overview.wordCount}</div>
          <div className="text-xs text-muted-foreground">Words</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{analytics.overview.duration}s</div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{analytics.overview.speakerCount}</div>
          <div className="text-xs text-muted-foreground">Speakers</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="text-2xl font-bold">{analytics.overview.wpm}</div>
          <div className="text-xs text-muted-foreground">WPM</div>
        </CardContent>
      </Card>
    </div>
  )

  const renderEnhancedFeatures = () => {
    if (!useEnhancedMode) return null
    
    return (
      <div className="space-y-6">
        {/* Enhanced Features Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-green-500">
            Enhanced Mode Active
          </Badge>
          {analytics.sentiment?.usingLibrary && (
            <Badge variant="outline">
              Sentiment.js Library
            </Badge>
          )}
          {analytics.interruptions?.length > 0 && (
            <Badge variant="outline">
              Real Interruption Detection
            </Badge>
          )}
          {analytics.topics?.length > 0 && analytics.topics[0].startTime && (
            <Badge variant="outline">
              TF-IDF Topic Analysis
            </Badge>
          )}
        </div>

        {/* Advanced Metrics Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advanced Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-red-500">
                  {analytics.interruptions?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Real Interruptions</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-blue-500">
                  {analytics.overlaps?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Speech Overlaps</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-green-500">
                  {analytics.speakingRate?.averageWPM || 0}
                </div>
                <div className="text-xs text-muted-foreground">Avg WPM</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-purple-500">
                  {analytics.fillerAnalysis?.total || 0}
                </div>
                <div className="text-xs text-muted-foreground">Total Fillers</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Enhanced Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            {useEnhancedMode ? 'Advanced analytics with AI-powered insights' : 'Standard analytics view'}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="enhanced-mode"
            checked={useEnhancedMode}
            onCheckedChange={setUseEnhancedMode}
          />
          <Label htmlFor="enhanced-mode">Enhanced Mode</Label>
        </div>
      </div>

      {/* Overview Cards */}
      {renderAnalyticsOverview()}

      {/* Enhanced Features Summary */}
      {renderEnhancedFeatures()}

      {/* Analytics Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speech Patterns */}
        {useEnhancedMode ? (
          <EnhancedSpeechPatterns 
            analytics={analytics} 
            selectedSpeakerId={selectedSpeakerId} 
          />
        ) : (
          <SpeechPatterns 
            analytics={analytics} 
            selectedSpeakerId={selectedSpeakerId} 
          />
        )}

        {/* Sentiment Analysis */}
        {useEnhancedMode ? (
          <EnhancedSentimentAnalysis 
            analytics={analytics} 
            selectedSpeakerId={selectedSpeakerId} 
          />
        ) : (
          <SentimentAnalysis 
            analytics={analytics} 
            selectedSpeakerId={selectedSpeakerId} 
          />
        )}

        {/* Topic Analysis */}
        {useEnhancedMode ? (
          <EnhancedTopicAnalysis 
            analytics={analytics} 
            selectedSpeakerId={selectedSpeakerId} 
          />
        ) : (
          <TopicAnalysis 
            analytics={analytics} 
            selectedSpeakerId={selectedSpeakerId} 
          />
        )}

        {/* Additional enhanced components can be added here */}
      </div>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs">
              <div>Enhanced Mode: {useEnhancedMode ? 'Yes' : 'No'}</div>
              <div>Using Sentiment Library: {analytics.sentiment?.usingLibrary ? 'Yes' : 'No'}</div>
              <div>Interruptions Detected: {analytics.interruptions?.length || 0}</div>
              <div>Overlaps Detected: {analytics.overlaps?.length || 0}</div>
              <div>Advanced Topics: {analytics.topics?.length > 0 && analytics.topics[0].startTime ? 'Yes' : 'No'}</div>
              <div>Filler Analysis Available: {analytics.fillerAnalysis ? 'Yes' : 'No'}</div>
              <div>Speaking Rate Analysis: {analytics.speakingRate ? 'Yes' : 'No'}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Usage example:
/*
import EnhancedAnalyticsDashboard from './components/analytics/EnhancedAnalyticsDashboard'

function MyTranscriptionView() {
  const [transcriptionResult, setTranscriptionResult] = useState(null)
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('all')

  return (
    <div>
      <EnhancedAnalyticsDashboard
        transcriptionResult={transcriptionResult}
        selectedSpeakerId={selectedSpeakerId}
        onSpeakerSelection={setSelectedSpeakerId}
      />
    </div>
  )
}
*/
