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
    switch (eventType) {
      case 'meeting': return 'text-blue-600 bg-blue-100'
      case 'call': return 'text-green-600 bg-green-100'
      case 'task': return 'text-orange-600 bg-orange-100'
      case 'reminder': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const mainStats = [
    {
      title: "Today's Events",
      value: stats.todayEvents,
      subtitle: stats.todayEvents === 1 ? "event scheduled" : "events scheduled",
      icon: Calendar,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      title: "This Month",
      value: stats.totalThisMonth,
      subtitle: `${stats.completionRate}% completion rate`,
      icon: TrendingUp,
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    },
    {
      title: "Upcoming",
      value: stats.upcomingCount,
      subtitle: stats.upcomingCount === 1 ? "event scheduled" : "events scheduled",
      icon: Clock,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50'
    },
    {
      title: "Completed",
      value: stats.completedThisMonth,
      subtitle: `of ${stats.totalThisMonth} this month`,
      icon: CheckCircle,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className={`${stat.bgColor} border rounded-lg p-4 transition-all hover:shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{stat.value}</div>
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-800 mb-1">{stat.title}</p>
                <p className="text-sm text-gray-600">{stat.subtitle}</p>
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
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">Event Types This Month</h3>
          </div>
          
          <div className="space-y-3">
            {[
              { type: 'Meetings', count: stats.meetings, icon: Users, color: 'bg-blue-500' },
              { type: 'Calls', count: stats.calls, icon: Phone, color: 'bg-green-500' },
              { type: 'Tasks', count: stats.tasks, icon: CheckCircle, color: 'bg-orange-500' },
              { type: 'Reminders', count: stats.reminders, icon: AlertTriangle, color: 'bg-purple-500' }
            ].map((item, index) => {
              const Icon = item.icon
              const percentage = stats.totalThisMonth > 0 
                ? Math.round((item.count / stats.totalThisMonth) * 100) 
                : 0
              
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1 rounded ${item.color}`}>
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium">{item.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${percentage}%` }}
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
            <Clock className="w-5 h-5 text-green-600" />
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