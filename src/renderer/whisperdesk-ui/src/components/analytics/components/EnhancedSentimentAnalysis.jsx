import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Heart, TrendingUp, Users, Clock } from 'lucide-react'
import { formatPercentage, getSentimentColor, getSentimentIcon, formatTime } from '../utils/formatters'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'

export default function EnhancedSentimentAnalysis({ analytics, selectedSpeakerId }) {
  const [selectedTab, setSelectedTab] = useState('overview')
  
  if (!analytics) return null

  const selectedSpeakerInfo = analytics.speakers.find(s => s.id === selectedSpeakerId)
  const sentiment = analytics.sentiment || {}
  const { overall = 0.5, byTime = [], distribution = { positive: 33, neutral: 34, negative: 33 } } = sentiment

  // Check if we have enhanced sentiment data
  const hasEnhancedData = byTime.length > 0 && byTime[0].confidence !== undefined

  const pieData = [
    { name: 'Positive', value: distribution.positive, color: '#10b981' },
    { name: 'Neutral', value: distribution.neutral, color: '#6b7280' },
    { name: 'Negative', value: distribution.negative, color: '#ef4444' }
  ]

  const renderSentimentOverview = () => (
    <div className="space-y-4">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          {getSentimentIcon(overall)}
          <span className={`text-2xl font-bold ${getSentimentColor(overall)}`}>
            {formatPercentage(overall * 100)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Overall Sentiment</p>
        {sentiment.usingLibrary && (
          <Badge variant="outline" className="mt-2 text-xs">
            Enhanced Analysis
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
            <span className="text-xl font-medium">{distribution.positive}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Positive</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400">
            <span className="text-xl font-medium">{distribution.neutral}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Neutral</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
            <span className="text-xl font-medium">{distribution.negative}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Negative</p>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )

  const renderSentimentTimeline = () => (
    <div className="space-y-4">
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={byTime}>
            <defs>
              <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              tick={{fontSize: 10}}
              tickFormatter={(time) => formatTime(time)}
            />
            <YAxis 
              domain={[0, 1]} 
              tick={{fontSize: 10}}
              tickFormatter={(value) => formatPercentage(value * 100)}
            />
            <Tooltip 
              formatter={(value) => [formatPercentage(value * 100), 'Sentiment']}
              labelFormatter={(time) => `Time: ${formatTime(time)}`}
            />
            <Area 
              type="monotone" 
              dataKey="sentiment" 
              stroke="#10b981" 
              fillOpacity={1} 
              fill="url(#sentimentGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Sentiment Peaks and Valleys */}
      {byTime.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Sentiment Highlights</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
              <div className="text-xs font-medium text-green-700 dark:text-green-400">Most Positive</div>
              <div className="text-xs text-muted-foreground">
                {formatTime(byTime.reduce((max, item) => item.sentiment > max.sentiment ? item : max, byTime[0]).time)}
              </div>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
              <div className="text-xs font-medium text-red-700 dark:text-red-400">Most Negative</div>
              <div className="text-xs text-muted-foreground">
                {formatTime(byTime.reduce((min, item) => item.sentiment < min.sentiment ? item : min, byTime[0]).time)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderSentimentByTopic = () => {
    const topics = analytics.topics || []
    
    if (topics.length === 0) {
      return (
        <div className="text-center text-muted-foreground">
          No topic data available for sentiment analysis
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {topics.map((topic, index) => (
          <div key={topic.name || index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{topic.name || topic.theme}</span>
              <div className="flex items-center gap-2">
                {getSentimentIcon(topic.sentiment)}
                <span className={`text-sm ${getSentimentColor(topic.sentiment)}`}>
                  {formatPercentage((topic.sentiment || 0.5) * 100)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderConfidenceAnalysis = () => {
    if (!hasEnhancedData) {
      return (
        <div className="text-center text-muted-foreground">
          Confidence data not available with current analysis method
        </div>
      )
    }

    const avgConfidence = byTime.reduce((sum, item) => sum + (item.confidence || 0), 0) / byTime.length
    const highConfidenceSegments = byTime.filter(item => (item.confidence || 0) > 0.7).length
    const lowConfidenceSegments = byTime.filter(item => (item.confidence || 0) < 0.3).length

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">
              {formatPercentage(avgConfidence * 100)}
            </div>
            <div className="text-xs text-muted-foreground">Avg Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{highConfidenceSegments}</div>
            <div className="text-xs text-muted-foreground">High Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{lowConfidenceSegments}</div>
            <div className="text-xs text-muted-foreground">Low Confidence</div>
          </div>
        </div>

        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byTime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="time" 
                tick={{fontSize: 10}}
                tickFormatter={(time) => formatTime(time)}
              />
              <YAxis 
                domain={[0, 1]} 
                tick={{fontSize: 10}}
                tickFormatter={(value) => formatPercentage(value * 100)}
              />
              <Tooltip 
                formatter={(value) => [formatPercentage(value * 100), 'Confidence']}
                labelFormatter={(time) => `Time: ${formatTime(time)}`}
              />
              <Line 
                type="monotone" 
                dataKey="confidence" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5" />
          Enhanced Sentiment Analysis
          {selectedSpeakerId !== 'all' && (
            <Badge variant="outline" className="ml-2">
              {selectedSpeakerInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Advanced emotional tone analysis with confidence scoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="topics">By Topic</TabsTrigger>
            <TabsTrigger value="confidence">Confidence</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            {renderSentimentOverview()}
          </TabsContent>
          
          <TabsContent value="timeline">
            {renderSentimentTimeline()}
          </TabsContent>
          
          <TabsContent value="topics">
            {renderSentimentByTopic()}
          </TabsContent>
          
          <TabsContent value="confidence">
            {renderConfidenceAnalysis()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
