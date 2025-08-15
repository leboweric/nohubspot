"use client"

import { CalendarEvent } from "@/lib/api"
import { 
  Calendar, Clock, Users, TrendingUp, 
  CheckCircle, AlertTriangle, Phone, Zap
} from "lucide-react"

interface CalendarStatsProps {
  events: CalendarEvent[]
  currentDate: Date
}

export default function CalendarStats({ events, currentDate }: CalendarStatsProps) {
  const today = new Date()
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  // Filter events for different time periods
  const thisMonthEvents = events.filter(event => {
    const eventDate = new Date(event.start_time)
    return eventDate >= startOfMonth && eventDate <= endOfMonth
  })

  const todayEvents = events.filter(event => {
    const eventDate = new Date(event.start_time)
    return eventDate >= startOfToday && eventDate < endOfToday
  })

  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.start_time)
      return eventDate > today && event.status === 'scheduled'
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3)

  // Calculate statistics
  const stats = {
    totalThisMonth: thisMonthEvents.length,
    todayEvents: todayEvents.length,
    upcomingCount: upcomingEvents.length,
    completedThisMonth: thisMonthEvents.filter(e => e.status === 'completed').length,
    
    // Event type distribution
    meetings: thisMonthEvents.filter(e => e.event_type === 'meeting').length,
    calls: thisMonthEvents.filter(e => e.event_type === 'call').length,
    tasks: thisMonthEvents.filter(e => e.event_type === 'task').length,
    reminders: thisMonthEvents.filter(e => e.event_type === 'reminder').length,
    
    // Completion rate
    completionRate: thisMonthEvents.length > 0 
      ? Math.round((thisMonthEvents.filter(e => e.status === 'completed').length / thisMonthEvents.length) * 100)
      : 0
  }

  const formatEventTime = (event: CalendarEvent) => {
    const eventDate = new Date(event.start_time)
    const now = new Date()
    const diffDays = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Tomorrow"
    if (diffDays < 7) return `In ${diffDays} days`
    
    return eventDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'meeting': return Users
      case 'call': return Phone
      case 'task': return CheckCircle
      case 'reminder': return AlertTriangle
      default: return Calendar
    }
  }

  const getEventTypeColor = (eventType: string) => {
    // All event types use subtle gray for consistency
    return 'text-gray-600 bg-gray-100'
  }

  const mainStats = [
    {
      title: "Today's Events",
      value: stats.todayEvents,
      subtitle: stats.todayEvents === 1 ? "event scheduled" : "events scheduled",
      icon: Calendar,
      useTheme: 'primary'
    },
    {
      title: "This Month",
      value: stats.totalThisMonth,
      subtitle: `${stats.completionRate}% completion rate`,
      icon: TrendingUp,
      useTheme: 'success'
    },
    {
      title: "Upcoming",
      value: stats.upcomingCount,
      subtitle: stats.upcomingCount === 1 ? "event scheduled" : "events scheduled",
      icon: Clock,
      useTheme: 'warning'
    },
    {
      title: "Completed",
      value: stats.completedThisMonth,
      subtitle: `of ${stats.totalThisMonth} this month`,
      icon: CheckCircle,
      useTheme: 'accent'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat, index) => {
          const Icon = stat.icon
          
          // Professional, subtle design
          const getIconColor = (theme: string) => {
            switch (theme) {
              case 'primary':
                return 'var(--theme-primary)'
              case 'success':
                return 'var(--theme-accent)'
              case 'warning':
                return 'var(--theme-secondary)'
              case 'accent':
                return 'var(--theme-accent)'
              default:
                return 'var(--theme-primary)'
            }
          }
          
          const iconColor = getIconColor(stat.useTheme)
          
          return (
            <div 
              key={index} 
              className="bg-white border border-gray-200 rounded-lg p-5 transition-all hover:shadow-lg hover:border-gray-300"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mb-2">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.subtitle}</p>
                </div>
                <div className="mt-1">
                  <Icon 
                    className="w-5 h-5 opacity-40" 
                    style={{ color: iconColor }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Event Type Distribution & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Type Breakdown */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold">Event Types This Month</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { type: 'Meetings', count: stats.meetings, icon: Users, color: 'var(--theme-primary)' },
              { type: 'Calls', count: stats.calls, icon: Phone, color: 'var(--theme-accent)' },
              { type: 'Tasks', count: stats.tasks, icon: CheckCircle, color: 'var(--theme-secondary)' },
              { type: 'Reminders', count: stats.reminders, icon: AlertTriangle, color: 'var(--theme-accent)' }
            ].map((item, index) => {
              const Icon = item.icon
              const percentage = stats.totalThisMonth > 0 
                ? Math.round((item.count / stats.totalThisMonth) * 100) 
                : 0
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon 
                      className="w-4 h-4" 
                      style={{ color: item.color, opacity: 0.6 }}
                    />
                    <span className="text-sm font-medium text-gray-700">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-600 w-8">{item.count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold">Upcoming Events</h3>
          </div>
          
          {upcomingEvents.length > 0 ? (
            <div className="space-y-3">
              {upcomingEvents.map((event, index) => {
                const EventIcon = getEventIcon(event.event_type)
                return (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className={`p-2 rounded-lg ${getEventTypeColor(event.event_type)}`}>
                      <EventIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{event.title}</div>
                      <div className="text-xs text-gray-600">{formatEventTime(event)}</div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(event.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </div>
                  </div>
                )
              })}
              
              {upcomingEvents.length >= 3 && (
                <div className="text-center pt-2">
                  <span className="text-xs text-gray-500">
                    View calendar for more upcoming events
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No upcoming events scheduled</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}