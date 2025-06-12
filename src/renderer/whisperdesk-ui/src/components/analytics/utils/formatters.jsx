import { ThumbsUp, ThumbsDown, Meh } from 'lucide-react'

// Enhanced format helpers
export const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '0:00'
  
  // Round to avoid floating point precision issues
  const totalSeconds = Math.round(seconds)
  const hrs = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
}

export const formatPercentage = (value) => `${value.toFixed(1)}%`

export const getSentimentColor = (sentiment) => {
  if (sentiment > 0.6) return 'text-green-600 dark:text-green-400'
  if (sentiment > 0.3) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

export const getSentimentIcon = (sentiment) => {
  if (sentiment > 0.6) return <ThumbsUp className="w-4 h-4" />
  if (sentiment > 0.3) return <Meh className="w-4 h-4" />
  return <ThumbsDown className="w-4 h-4" />
} 