"use client"

import { useState, useEffect } from "react"
import { CalendarEvent } from "@/lib/api"
import { ChevronLeft, ChevronRight, Clock, MapPin, Users, Phone, CheckCircle, AlertTriangle, Calendar as CalendarIcon } from "lucide-react"

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
        return 'bg-blue-500 border-blue-600'
      case 'call':
        return 'bg-green-500 border-green-600'
      case 'task':
        return 'bg-orange-500 border-orange-600'
      case 'reminder':
        return 'bg-purple-500 border-purple-600'
      case 'out_of_office':
        return 'bg-red-500 border-red-600'
      default:
        return 'bg-gray-500 border-gray-600'
    }
  }

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'meeting': return Users
      case 'call': return Phone
      case 'task': return CheckCircle
      case 'reminder': return AlertTriangle
      default: return CalendarIcon
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
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            <Clock className="w-3 h-3" />
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="flex items-center justify-center p-2 hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextMonth}
            className="flex items-center justify-center p-2 hover:bg-gray-100 border border-gray-300 rounded-md transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="bg-gray-100 p-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {calendarDays.map((date, index) => {
          if (!date) {
            return <div key={index} className="bg-gray-50 p-3 h-28 border border-gray-200"></div>
          }

          const isToday = date.toDateString() === today.toDateString()
          const dayEvents = getEventsForDate(date)

          return (
            <div
              key={date.toISOString()}
              className={`bg-white p-3 h-28 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all duration-200 relative group ${
                isToday ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''
              }`}
              onClick={() => onDateClick(date)}
            >
              <div className={`text-sm font-semibold mb-2 ${
                isToday ? 'text-blue-600' : 'text-gray-900'
              }`}>
                {date.getDate()}
              </div>
              
              {/* Events for this day */}
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => {
                  const EventIcon = getEventTypeIcon(event.event_type)
                  return (
                    <div
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(event)
                      }}
                      className={`text-xs px-2 py-1 rounded-md text-white hover:shadow-sm transition-all cursor-pointer border ${getEventTypeColor(event.event_type)} group-hover:scale-105`}
                      title={`${event.title} - ${formatTime(event.start_time)}${event.end_time ? ` to ${formatTime(event.end_time)}` : ''}${event.location ? ` at ${event.location}` : ''}`}
                    >
                      {event.is_all_day ? (
                        <div className="flex items-center gap-1">
                          <EventIcon className="w-3 h-3" />
                          <span className="font-medium truncate">{event.title}</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1 mb-0.5">
                            <EventIcon className="w-3 h-3" />
                            <span className="font-medium text-xs opacity-90">{formatTime(event.start_time)}</span>
                          </div>
                          <div className="truncate font-medium">{event.title}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-md">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-6 mt-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 bg-blue-500 rounded">
            <Users className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">Meeting</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 bg-green-500 rounded">
            <Phone className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">Call</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 bg-orange-500 rounded">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">Task</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 bg-purple-500 rounded">
            <AlertTriangle className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">Reminder</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 bg-red-500 rounded">
            <CalendarIcon className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-medium">Out of Office</span>
        </div>
      </div>
    </div>
  )
}