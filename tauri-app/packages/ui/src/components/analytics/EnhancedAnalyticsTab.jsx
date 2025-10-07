import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Download, RotateCcw, Zap, TrendingUp } from 'lucide-react'
import { useAppState } from '@/App'
import { toast } from 'sonner'

// Import existing components
import OverviewCards from './components/OverviewCards'
import SpeakerAnalysis from './components/SpeakerAnalysis'
import SentimentAnalysis from './components/SentimentAnalysis'
import SpeechPatterns from './components/SpeechPatterns'
import EmotionalTone from './components/EmotionalTone'
import TopicAnalysis from './components/TopicAnalysis'
import QualityMetrics from './components/QualityMetrics'

// Import enhanced components
import EnhancedSpeechPatterns from './components/EnhancedSpeechPatterns'
import EnhancedSentimentAnalysis from './components/EnhancedSentimentAnalysis'
import EnhancedTopicAnalysis from './components/EnhancedTopicAnalysis'

// Import enhanced analytics hook
import { useEnhancedAnalytics } from './hooks/useEnhancedAnalytics'

export { EnhancedAnalyticsTab }

export default function EnhancedAnalyticsTab() {
  const { appState } = useAppState()
  const [useAdvancedMode, setUseAdvancedMode] = useState(true)
  
  const {
    analytics,
    selectedSpeakerId,
    isLoading,
    handleExportReport,
    handleSpeakerSelection,
    advancedFeatures
  } = useEnhancedAnalytics(appState.lastTranscriptionResult, useAdvancedMode)

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

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  const renderAdvancedMetrics = () => {
    if (!useAdvancedMode || !advancedFeatures) return null

    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="font-medium">Advanced Insights</span>
              <Badge variant="default" className="bg-green-500">
                Enhanced Mode
              </Badge>
            </div>
            <div className="flex gap-2">
              {advancedFeatures.realInterruptions && (
                <Badge variant="outline">Real Interruption Detection</Badge>
              )}
              {advancedFeatures.advancedSentiment && (
                <Badge variant="outline">Enhanced Sentiment</Badge>
              )}
              {advancedFeatures.tfidfTopics && (
                <Badge variant="outline">TF-IDF Topics</Badge>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">
                {analytics.interruptions?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Real Interruptions</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-500">
                {analytics.overlaps?.length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Speech Overlaps</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-500">
                {analytics.speakingRate?.averageWPM || analytics.overview?.wpm || 0}
              </div>
              <div className="text-xs text-muted-foreground">Speaking Rate</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-500">
                {analytics.fillerAnalysis?.total || analytics.speechPattern?.fillers?.count || 0}
              </div>
              <div className="text-xs text-muted-foreground">Total Fillers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-500">
                {analytics.pauseAnalysis?.statistics?.total || analytics.speechPattern?.pauses?.totalCount || 0}
              </div>
              <div className="text-xs text-muted-foreground">Pauses</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Advanced Mode Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Audio Analytics
            {useAdvancedMode && (
              <TrendingUp className="w-6 h-6 text-green-500" />
            )}
          </h2>
          <p className="text-muted-foreground">
            {selectedSpeakerId === 'all' 
              ? useAdvancedMode 
                ? 'AI-powered comprehensive analysis of your transcribed audio'
                : 'Standard analysis of your transcribed audio'
              : `Analysis for ${selectedSpeakerInfo?.name || 'Selected Speaker'}`
            }
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Advanced Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="advanced-mode"
              checked={useAdvancedMode}
              onCheckedChange={(checked) => {
                setUseAdvancedMode(checked)
                toast.success(`${checked ? 'Enabled' : 'Disabled'} advanced analytics mode`)
              }}
            />
            <Label htmlFor="advanced-mode" className="text-sm">
              Enhanced Mode
            </Label>
          </div>
          
          {/* Existing Controls */}
          {selectedSpeakerId !== 'all' && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleSpeakerSelection('all')}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Show All
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportReport}
            disabled={isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center text-muted-foreground">
              Calculating advanced analytics...
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <OverviewCards analytics={analytics} />

      {/* Advanced Metrics Summary */}
      {renderAdvancedMetrics()}

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpeakerAnalysis 
          analytics={analytics}
          selectedSpeakerId={selectedSpeakerId}
          onSpeakerSelection={handleSpeakerSelection}
        />

        {/* Conditional Sentiment Analysis */}
        {useAdvancedMode ? (
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

        {/* Conditional Speech Patterns */}
        {useAdvancedMode ? (
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

        {/* Keep existing emotional tone component */}
        <EmotionalTone 
          analytics={analytics}
          selectedSpeakerId={selectedSpeakerId}
        />
      </div>

      {/* Topic Analysis - Full Width */}
      {useAdvancedMode ? (
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

      {/* Quality Metrics - Full Width */}
      <QualityMetrics 
        analytics={analytics}
        selectedSpeakerId={selectedSpeakerId}
      />

      {/* Development Debug Panel */}
      {process.env.NODE_ENV === 'development' && useAdvancedMode && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">Debug Information</h3>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="font-medium">Feature Status</div>
                <div>Real Interruptions: {advancedFeatures?.realInterruptions ? '✅' : '❌'}</div>
                <div>Advanced Sentiment: {advancedFeatures?.advancedSentiment ? '✅' : '❌'}</div>
                <div>TF-IDF Topics: {advancedFeatures?.tfidfTopics ? '✅' : '❌'}</div>
              </div>
              <div>
                <div className="font-medium">Data Counts</div>
                <div>Interruptions: {analytics.interruptions?.length || 0}</div>
                <div>Overlaps: {analytics.overlaps?.length || 0}</div>
                <div>Topics: {analytics.topics?.length || 0}</div>
              </div>
              <div>
                <div className="font-medium">Performance</div>
                <div>Using Sentiment Library: {analytics.sentiment?.usingLibrary ? 'Yes' : 'No'}</div>
                <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
                <div>Mode: {useAdvancedMode ? 'Enhanced' : 'Standard'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
