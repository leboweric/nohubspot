"use client"

import { useState, useEffect } from "react"
import { CalendarEvent } from "@/lib/api"

interface CalendarViewProps {
  events: CalendarEvent[]
  currentDate: Date
  onDateClick: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onMonthChange: (date: Date) => void
}

export default function CalendarView({ events, currentDate, onDateClick, onEventClick, onMonthChange }: CalendarViewProps) {

  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  

  // Get first day of month and how many days
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startDayOfWeek = firstDayOfMonth.getDay() // 0 = Sunday

  // Get events for each day - includes multi-day events
  const getEventsForDate = (date: Date) => {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    return events.filter(event => {
      // Get start and end dates without time component
      const eventStartDate = new Date(event.start_time)
      const eventStart = new Date(eventStartDate.getFullYear(), eventStartDate.getMonth(), eventStartDate.getDate())
      
      let eventEnd = eventStart // Default to same day if no end_time
      if (event.end_time) {
        const eventEndDate = new Date(event.end_time)
        eventEnd = new Date(eventEndDate.getFullYear(), eventEndDate.getMonth(), eventEndDate.getDate())
      }
      
      // Check if target date falls within the event's date range (inclusive)
      return targetDate >= eventStart && targetDate <= eventEnd
    })
  }

  // Navigate months
  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 1, 1)
    onMonthChange(newDate)
  }

  const goToNextMonth = () => {
    const newDate = new Date(year, month + 1, 1)
    onMonthChange(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    onMonthChange(today)
  }

  // Create calendar grid
  const calendarDays = []
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day))
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case 'meeting':
        return 'bg-blue-500'
      case 'call':
        return 'bg-green-500'
      case 'task':
        return 'bg-orange-500'
      case 'reminder':
        return 'bg-purple-500'
      case 'out_of_office':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
            title="Previous month"
          >
            ←
          </button>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
            title="Next month"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="bg-muted p-3 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={index} className="bg-card p-3 h-24"></div>
          }

          const isToday = date.toDateString() === today.toDateString()
          const dayEvents = getEventsForDate(date)

          return (
            <div
              key={date.toISOString()}
              className={`bg-card p-2 h-24 border border-transparent hover:border-primary/20 cursor-pointer transition-colors relative ${
                isToday ? 'ring-2 ring-primary ring-inset' : ''
              }`}
              onClick={() => onDateClick(date)}
            >
              <div className={`text-sm font-medium mb-1 ${
                isToday ? 'text-primary' : 'text-foreground'
              }`}>
                {date.getDate()}
              </div>
              
              {/* Events for this day */}
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                    className={`text-xs px-2 py-1 rounded text-white hover:opacity-80 transition-opacity cursor-pointer ${getEventTypeColor(event.event_type)}`}
                    title={`${event.title} - ${formatTime(event.start_time)} to ${formatTime(event.end_time)}`}
                  >
                    {event.is_all_day ? (
                      <div className="font-medium">{event.title}</div>
                    ) : (
                      <div>
                        <div className="font-medium text-xs opacity-90">{formatTime(event.start_time)}</div>
                        <div className="truncate">{event.title}</div>
                      </div>
                    )}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground px-2">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span>Meeting</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span>Call</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span>Task</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded"></div>
          <span>Reminder</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span>Out of Office</span>
        </div>
      </div>
    </div>
  )
}