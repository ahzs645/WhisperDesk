import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Mic, TrendingUp, Clock, Users, AlertTriangle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { formatTime } from '../utils/formatters'

export default function EnhancedSpeechPatterns({ analytics, selectedSpeakerId }) {
  const [selectedTab, setSelectedTab] = useState('overview')
  
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)

  // Enhanced data from new analytics
  const fillerAnalysis = analytics.fillerAnalysis || {}
  const speakingRate = analytics.speakingRate || {}
  const pauseAnalysis = analytics.pauseAnalysis || {}
  const interruptions = analytics.interruptions || []
  const overlaps = analytics.overlaps || []

  const renderFillerAnalysis = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Total Fillers</span>
            <Badge variant="outline">{fillerAnalysis.total || 0}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Filler Rate</span>
            <span className="text-sm font-medium">{analytics.speechPattern?.fillers?.rate || 0}/min</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Hesitations</span>
            <Badge variant="secondary">{fillerAnalysis.byType?.hesitations || 0}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Repetitions</span>
            <Badge variant="secondary">{fillerAnalysis.byType?.repetitions || 0}</Badge>
          </div>
        </div>
      </div>
      
      {fillerAnalysis.byType && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Filler Types Breakdown</h4>
          {Object.entries(fillerAnalysis.byType).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-xs capitalize">{type.replace('_', ' ')}</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(count / (fillerAnalysis.total || 1)) * 100} 
                  className="w-16 h-2" 
                />
                <span className="text-xs w-6">{count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderSpeakingRate = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{speakingRate.averageWPM || 0}</div>
          <div className="text-xs text-muted-foreground">Avg WPM</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{speakingRate.peakWPM || 0}</div>
          <div className="text-xs text-muted-foreground">Peak WPM</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{speakingRate.variability || 0}</div>
          <div className="text-xs text-muted-foreground">Variability</div>
        </div>
      </div>
      
      {speakingRate.timeline && speakingRate.timeline.length > 0 && (
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speakingRate.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tick={{fontSize: 10}}
                tickFormatter={(time) => formatTime(time)}
              />
              <YAxis tick={{fontSize: 10}} />
              <Tooltip 
                formatter={(value) => [Math.round(value), 'WPM']}
                labelFormatter={(time) => `Time: ${formatTime(time)}`}
              />
              <Line type="monotone" dataKey="wpm" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {speakingRate.changes && speakingRate.changes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Significant Rate Changes</h4>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {speakingRate.changes.slice(0, 3).map((change, index) => (
              <div key={index} className="text-xs flex items-center justify-between p-2 bg-muted rounded">
                <span>{formatTime(change.time)}</span>
                <span className={change.changeType === 'increase' ? 'text-green-600' : 'text-red-600'}>
                  {change.previousWPM} → {change.currentWPM} WPM
                </span>
                <Badge variant="outline" className="text-xs">
                  {change.magnitude}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderInterruptionsAndOverlaps = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">Interruptions</span>
            <Badge variant="destructive">{interruptions.length}</Badge>
          </div>
          {interruptions.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {interruptions.slice(0, 3).map((interruption, index) => (
                <div key={index} className="text-xs p-2 bg-red-50 dark:bg-red-950 rounded">
                  <div className="flex justify-between">
                    <span>{formatTime(interruption.time)}</span>
                    <span>{interruption.duration.toFixed(1)}s</span>
                  </div>
                  <div className="text-muted-foreground truncate">
                    "{interruption.context?.substring(0, 40)}..."
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Overlaps</span>
            <Badge variant="secondary">{overlaps.length}</Badge>
          </div>
          {overlaps.length > 0 && (
            <div className="max-h-24 overflow-y-auto space-y-1">
              {overlaps.slice(0, 3).map((overlap, index) => (
                <div key={index} className="text-xs p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="flex justify-between">
                    <span>{formatTime(overlap.time)}</span>
                    <span>{overlap.duration.toFixed(1)}s</span>
                  </div>
                  <div className="text-muted-foreground">
                    {overlap.speakers?.join(' & ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderPauseAnalysis = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{pauseAnalysis.statistics?.total || 0}</div>
          <div className="text-xs text-muted-foreground">Total Pauses</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {pauseAnalysis.statistics?.averageDuration?.toFixed(1) || 0}s
          </div>
          <div className="text-xs text-muted-foreground">Avg Duration</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">
            {pauseAnalysis.statistics?.longestPause?.toFixed(1) || 0}s
          </div>
          <div className="text-xs text-muted-foreground">Longest</div>
        </div>
      </div>
      
      {pauseAnalysis.statistics?.byType && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Pause Categories</h4>
          {Object.entries(pauseAnalysis.statistics.byType).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between">
              <span className="text-xs capitalize">{type}</span>
              <div className="flex items-center gap-2">
                <Progress 
                  value={(count / (pauseAnalysis.statistics?.total || 1)) * 100} 
                  className="w-16 h-2" 
                />
                <span className="text-xs w-6">{count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Enhanced Speech Patterns
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Advanced analysis of speech fluency, rate, and patterns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fillers">Fillers</TabsTrigger>
            <TabsTrigger value="rate">Speaking Rate</TabsTrigger>
            <TabsTrigger value="pauses">Pauses</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Fillers</span>
                  <Badge variant="outline">{analytics.speechPattern?.fillers?.count || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Interruptions</span>
                  <Badge variant="destructive">{interruptions.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Speaking Rate</span>
                  <span className="text-sm font-medium">{speakingRate.averageWPM || 0} WPM</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pauses</span>
                  <Badge variant="outline">{analytics.speechPattern?.pauses?.totalCount || 0}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Overlaps</span>
                  <Badge variant="secondary">{overlaps.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Pause</span>
                  <span className="text-sm font-medium">{analytics.speechPattern?.pauses?.avgDuration || 0}s</span>
                </div>
              </div>
            </div>
            
            {renderInterruptionsAndOverlaps()}
          </TabsContent>
          
          <TabsContent value="fillers">
            {renderFillerAnalysis()}
          </TabsContent>
          
          <TabsContent value="rate">
            {renderSpeakingRate()}
          </TabsContent>
          
          <TabsContent value="pauses">
            {renderPauseAnalysis()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
