"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { CalendarEvent, calendarAPI, handleAPIError } from "@/lib/api"

export default function TodayCalendarCard() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTodayEvents = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get today's date range
        const today = new Date()
        const startOfDay = new Date(today)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999)

        const todayEvents = await calendarAPI.getAll({
          start_date: startOfDay.toISOString(),
          end_date: endOfDay.toISOString(),
          limit: 50
        })
        
        setEvents(todayEvents)
      } catch (err) {
        setError(handleAPIError(err))
        console.error('Failed to load today events:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTodayEvents()
  }, [])

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Chicago' // Central Time
    })
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'meeting':
        return 'bg-gray-600'
      case 'call':
        return 'bg-gray-500'
      case 'task':
        return 'bg-gray-400'
      case 'reminder':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'meeting':
        return '👥'
      case 'call':
        return '📞'
      case 'task':
        return '✅'
      case 'reminder':
        return '⏰'
      default:
        return '📅'
    }
  }

  // Sort events by start time
  const sortedEvents = events.sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  return (
    <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center">
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
          Today's Schedule
        </h2>
        <Link 
          href="/calendar" 
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          View Calendar
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading schedule...</p>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-sm text-red-600 mb-2">Failed to load schedule</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : sortedEvents.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {sortedEvents.map((event) => (
            <div 
              key={event.id} 
              className="flex items-start space-x-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                <span className="text-sm">{getEventTypeIcon(event.event_type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium truncate">{event.title}</h3>
                  <span className={`inline-block w-2 h-2 rounded-full ${getEventTypeColor(event.event_type)}`}></span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <span>🕒</span>
                    <span>
                      {event.is_all_day 
                        ? 'All day' 
                        : `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`
                      }
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span className="truncate">{event.location}</span>
                    </div>
                  )}
                  {(event.contact_name || event.company_name) && (
                    <div className="flex items-center gap-2">
                      <span>👤</span>
                      <span className="truncate">
                        {event.contact_name && event.company_name 
                          ? `${event.contact_name} (${event.company_name})`
                          : event.contact_name || event.company_name
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">📅</div>
          <p className="text-sm text-muted-foreground mb-2">No events scheduled for today</p>
          <Link 
            href="/calendar" 
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Schedule something
          </Link>
        </div>
      )}
    </div>
  )
}