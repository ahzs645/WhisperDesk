import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { BarChart3, Clock, Hash, TrendingUp } from 'lucide-react'
import { formatPercentage, getSentimentColor, getSentimentIcon, formatTime } from '../utils/formatters'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function EnhancedTopicAnalysis({ analytics, selectedSpeakerId }) {
  const [selectedTab, setSelectedTab] = useState('topics')
  
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)
  const topics = analytics.topics || []
  
  // Check if we have advanced topic data
  const hasAdvancedTopics = topics.length > 0 && topics[0].startTime !== undefined

  const renderSimpleTopics = () => (
    <div className="space-y-3">
      {topics.map((topic, index) => (
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
          <Progress value={(topic.frequency / Math.max(...topics.map(t => t.frequency))) * 100} className="h-2" />
        </div>
      ))}
    </div>
  )

  const renderAdvancedTopics = () => {
    // Create timeline data for topic visualization
    const timelineData = topics.map(topic => ({
      startTime: topic.startTime,
      endTime: topic.endTime,
      theme: topic.theme,
      intensity: topic.intensity,
      keywords: topic.keywords,
      duration: topic.endTime - topic.startTime
    })).sort((a, b) => a.startTime - b.startTime)

    // Create intensity chart data
    const intensityData = timelineData.map(topic => ({
      time: topic.startTime,
      intensity: (topic.intensity * 100).toFixed(1),
      theme: topic.theme
    }))

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          {/* Topic Timeline */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Topic Timeline
            </h4>
            <div className="space-y-2">
              {timelineData.map((topic, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <span className="w-16">{formatTime(topic.startTime)}</span>
                  <div className="flex-1">
                    <div className="font-medium">{topic.theme}</div>
                    <div className="text-muted-foreground">
                      {topic.keywords?.slice(0, 3).join(', ')}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {topic.duration.toFixed(0)}s
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Progress value={topic.intensity * 100} className="w-12 h-2" />
                    <span className="w-8 text-right">{(topic.intensity * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Intensity Chart */}
          {intensityData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Topic Intensity Over Time
              </h4>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={intensityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{fontSize: 10}}
                      tickFormatter={(time) => formatTime(time)}
                    />
                    <YAxis tick={{fontSize: 10}} />
                    <Tooltip 
                      formatter={(value) => [value + '%', 'Intensity']}
                      labelFormatter={(time) => `Time: ${formatTime(time)}`}
                    />
                    <Bar dataKey="intensity" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderTopicDistribution = () => {
    const distribution = {}
    
    if (hasAdvancedTopics) {
      // Calculate topic distribution by theme
      topics.forEach(topic => {
        distribution[topic.theme] = (distribution[topic.theme] || 0) + topic.intensity
      })
    } else {
      // Simple distribution by frequency
      topics.forEach(topic => {
        distribution[topic.name] = topic.frequency
      })
    }

    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0)
    
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Hash className="w-4 h-4" />
          Topic Distribution
        </h4>
        {Object.entries(distribution).map(([topic, value]) => (
          <div key={topic} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{topic}</span>
              <span className="text-xs text-muted-foreground">
                {hasAdvancedTopics ? `${(value * 100).toFixed(1)}%` : `${value} mentions`}
              </span>
            </div>
            <Progress 
              value={total > 0 ? (value / total) * 100 : 0} 
              className="h-2" 
            />
          </div>
        ))}
      </div>
    )
  }

  const renderKeywords = () => {
    const allKeywords = new Set()
    
    if (hasAdvancedTopics) {
      topics.forEach(topic => {
        topic.keywords?.forEach(keyword => allKeywords.add(keyword))
      })
    } else {
      // Extract keywords from topic names for simple topics
      const simpleKeywords = ['strategy', 'business', 'technology', 'team', 'customer', 'finance']
      simpleKeywords.forEach(keyword => allKeywords.add(keyword))
    }
    
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Key Terms</h4>
        <div className="flex flex-wrap gap-2">
          {Array.from(allKeywords).slice(0, 12).map(keyword => (
            <Badge key={keyword} variant="secondary" className="text-xs">
              {keyword}
            </Badge>
          ))}
        </div>
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Enhanced Topic Analysis
            {selectedSpeakerId !== 'all' && (
              <Badge variant="outline" className="ml-2">
                {selectedSpeakerInfo?.name}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Advanced topic detection and analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No topics detected in the conversation
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Enhanced Topic Analysis
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {hasAdvancedTopics ? 'Advanced TF-IDF based topic detection' : 'Keyword-based topic analysis'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="distribution">Distribution</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
          </TabsList>
          
          <TabsContent value="topics">
            {hasAdvancedTopics ? renderAdvancedTopics() : renderSimpleTopics()}
          </TabsContent>
          
          <TabsContent value="distribution">
            {renderTopicDistribution()}
          </TabsContent>
          
          <TabsContent value="keywords">
            {renderKeywords()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
