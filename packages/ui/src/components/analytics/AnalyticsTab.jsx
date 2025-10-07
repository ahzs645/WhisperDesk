import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Download, RotateCcw } from 'lucide-react'
import { useAppState } from '@/App'

// Import components
import OverviewCards from './components/OverviewCards'
import SpeakerAnalysis from './components/SpeakerAnalysis'
import SentimentAnalysis from './components/SentimentAnalysis'
import SpeechPatterns from './components/SpeechPatterns'
import EmotionalTone from './components/EmotionalTone'
import TopicAnalysis from './components/TopicAnalysis'
import QualityMetrics from './components/QualityMetrics'

// Import custom hook
import { useAnalytics } from './hooks/useAnalytics'

export { AnalyticsTab }

export default function AnalyticsTab() {
  const { appState } = useAppState()
  
  const {
    analytics,
    selectedSpeakerId,
    handleExportReport,
    handleSpeakerSelection
  } = useAnalytics(appState.lastTranscriptionResult)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audio Analytics</h2>
          <p className="text-muted-foreground">
            {selectedSpeakerId === 'all' 
              ? 'Comprehensive analysis of your transcribed audio' 
              : `Analysis for ${selectedSpeakerInfo?.name || 'Selected Speaker'}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={handleExportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <OverviewCards analytics={analytics} />

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpeakerAnalysis 
          analytics={analytics}
          selectedSpeakerId={selectedSpeakerId}
          onSpeakerSelection={handleSpeakerSelection}
        />

        <SentimentAnalysis 
          analytics={analytics}
          selectedSpeakerId={selectedSpeakerId}
        />

        <SpeechPatterns 
          analytics={analytics}
          selectedSpeakerId={selectedSpeakerId}
        />

        <EmotionalTone 
          analytics={analytics}
          selectedSpeakerId={selectedSpeakerId}
        />
      </div>

      {/* Topic Analysis - Full Width */}
      <TopicAnalysis 
        analytics={analytics}
        selectedSpeakerId={selectedSpeakerId}
      />

      {/* Quality Metrics - Full Width */}
      <QualityMetrics 
        analytics={analytics}
        selectedSpeakerId={selectedSpeakerId}
      />
    </div>
  )
}