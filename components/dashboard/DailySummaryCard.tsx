"use client"

import { useState, useEffect } from "react"
import { dashboardAPI, handleAPIError } from "@/lib/api"
import { getAuthHeaders } from "@/lib/auth"

interface DailySummary {
  generated_at: string
  user_id: number
  ai_insights: string
  quick_stats: {
    overdue_tasks: number
    today_tasks: number
    total_contacts: number
    active_deals: number
    active_companies: number
  }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function DailySummaryCard() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    loadDailySummary()
  }, [])

  const loadDailySummary = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await dashboardAPI.getDailySummary()
      setSummary(data)
    } catch (err) {
      setError(handleAPIError(err))
      console.error('Failed to load daily summary:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (isoString: string) => {
    // Parse the ISO string and convert to local time
    const date = new Date(isoString)
    
    // Debug logging
    console.log('Summary timestamp:', {
      raw: isoString,
      parsed: date.toString(),
      utc: date.toUTCString(),
      local: date.toLocaleString()
    })
    
    // If the date is invalid, return a fallback
    if (isNaN(date.getTime())) {
      return 'Recently'
    }
    
    // Format in user's local timezone
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning! ☀️"
    if (hour < 17) return "Good afternoon! 🌤️"
    return "Good evening! 🌙"
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput("")
    setChatLoading(true)

    try {
      // Call the AI chat endpoint with context
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: 'daily_summary',
          summary_data: summary
        })
      })

      if (!response.ok) throw new Error('Failed to get AI response')

      const data = await response.json()
      
      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setChatMessages(prev => [...prev, aiMessage])
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: 'assistant', 
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }


  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-blue-900">Daily Summary</h2>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
        <div className="text-blue-700">
          <div className="h-4 bg-blue-200 rounded w-3/4 mb-2 animate-pulse"></div>
          <div className="h-4 bg-blue-200 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-red-900">Daily Summary</h2>
          <button
            onClick={loadDailySummary}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            Retry
          </button>
        </div>
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    )
  }

  if (!summary) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold text-blue-900">🤖 AI Daily Summary</h2>
          <p className="text-xs text-blue-600">
            Last updated: {formatTime(summary.generated_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 px-2 py-1 rounded border border-blue-300 hover:bg-blue-100"
          >
            💬 Ask AI
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
          >
            {expanded ? 'Collapse' : 'Expand'}
            <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>
      </div>

      {/* Compact Quick Stats Row */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{summary.quick_stats.overdue_tasks}</div>
          <div className="text-xs text-gray-600">Overdue</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-orange-600">{summary.quick_stats.today_tasks}</div>
          <div className="text-xs text-gray-600">Today</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-700">{summary.quick_stats.total_contacts}</div>
          <div className="text-xs text-gray-600">Contacts</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-700">{summary.quick_stats.active_deals}</div>
          <div className="text-xs text-gray-600">Deals</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-700">{summary.quick_stats.active_companies}</div>
          <div className="text-xs text-gray-600">Customers</div>
        </div>
      </div>

      {/* AI Insights - Compact when collapsed, full when expanded */}
      <div className="bg-white/70 rounded-lg p-3 mb-3">
        <div className={`text-sm text-blue-900 leading-relaxed whitespace-pre-line ${!expanded ? 'overflow-hidden' : ''}`} style={!expanded ? {display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'} : {}}>
          {summary.ai_insights}
        </div>
      </div>

      {/* Chat Interface */}
      {showChat && (
        <div className="mt-3 bg-white/90 rounded-lg border border-blue-300">
          <div className="p-3 border-b border-blue-200">
            <h4 className="font-medium text-blue-900 text-sm">Ask about your summary</h4>
          </div>
          
          {/* Chat Messages */}
          <div className="p-3 max-h-40 overflow-y-auto space-y-2">
            {chatMessages.length === 0 ? (
              <div className="text-xs text-gray-600 italic">
                Ask me anything! Try: "What's Sally's phone number?" or "When is my next meeting?"
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div key={index} className={`text-sm ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block px-3 py-1 rounded-lg max-w-xs ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="text-left">
                <div className="inline-block px-3 py-1 rounded-lg bg-gray-100 text-gray-800">
                  <div className="flex items-center gap-1">
                    <div className="animate-bounce w-1 h-1 bg-gray-600 rounded-full"></div>
                    <div className="animate-bounce w-1 h-1 bg-gray-600 rounded-full" style={{animationDelay: '0.1s'}}></div>
                    <div className="animate-bounce w-1 h-1 bg-gray-600 rounded-full" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="p-3 border-t border-blue-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about tasks, contacts, or anything..."
                disabled={chatLoading}
                className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={loadDailySummary}
          disabled={loading}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          Refresh
        </button>
      </div>
    </div>
  )
}