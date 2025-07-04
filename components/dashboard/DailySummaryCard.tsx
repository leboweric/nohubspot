"use client"

import { useState, useEffect } from "react"
import { dashboardAPI, handleAPIError } from "@/lib/api"

interface DailySummary {
  generated_at: string
  user_id: number
  ai_insights: string
  quick_stats: {
    overdue_tasks: number
    today_tasks: number
    total_contacts: number
    contacts_needing_attention: number
    active_companies: number
  }
  recommendations: string[]
}

export default function DailySummaryCard() {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

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
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning! ☀️"
    if (hour < 17) return "Good afternoon! 🌤️"
    return "Good evening! 🌙"
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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-blue-900">Daily Summary</h2>
          <p className="text-xs text-blue-600">
            Generated at {formatTime(summary.generated_at)}
          </p>
        </div>
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

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-red-600">
            {summary.quick_stats.overdue_tasks}
          </div>
          <div className="text-xs text-gray-600">Overdue</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-orange-600">
            {summary.quick_stats.today_tasks}
          </div>
          <div className="text-xs text-gray-600">Due Today</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600">
            {summary.quick_stats.total_contacts}
          </div>
          <div className="text-xs text-gray-600">Contacts</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-purple-600">
            {summary.quick_stats.contacts_needing_attention}
          </div>
          <div className="text-xs text-gray-600">Need Attention</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-600">
            {summary.quick_stats.active_companies}
          </div>
          <div className="text-xs text-gray-600">Active Companies</div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white/70 rounded-lg p-4 mb-4">
        <div className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">
          {summary.ai_insights}
        </div>
      </div>

      {/* Expandable Recommendations */}
      {expanded && summary.recommendations.length > 0 && (
        <div className="bg-white/70 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-3">🎯 Today's Action Items:</h4>
          <ul className="space-y-2">
            {summary.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                <span className="text-blue-600 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-4 flex justify-end">
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