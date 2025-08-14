"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import CalendarView from "@/components/calendar/CalendarView"
import EventFormModal from "@/components/calendar/EventFormModal"
import CalendarStats from "@/components/calendar/CalendarStats"
import { calendarAPI, CalendarEvent, CalendarEventCreate, handleAPIError } from "@/lib/api"
import { Calendar, Plus } from "lucide-react"

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [currentDate, setCurrentDate] = useState(() => {
    // Only restore saved month if this is a true page refresh/reload
    if (typeof window !== 'undefined') {
      // Check if this is a fresh session (no session storage flag)
      const hasNavigatedInSession = sessionStorage.getItem('has-navigated')
      
      if (!hasNavigatedInSession) {
        // First visit in this session - restore saved month if exists
        const savedDate = localStorage.getItem('calendar-current-date')
        if (savedDate) {
          return new Date(savedDate)
        }
      }
      
      // Mark that we've navigated in this session
      sessionStorage.setItem('has-navigated', 'true')
    }
    return new Date()
  })

  // Load events for current month
  const loadEvents = async (startDate?: Date, endDate?: Date) => {
    try {
      setLoading(true)
      setError(null)
      
      const params: any = { limit: 1000 }
      if (startDate) {
        params.start_date = startDate.toISOString()
      }
      if (endDate) {
        params.end_date = endDate.toISOString()
      }
      
      const data = await calendarAPI.getAll(params)
      setEvents(data)
    } catch (err) {
      setError(handleAPIError(err))
      // Debug: console.error('Failed to load calendar events:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load events for current month on mount
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    loadEvents(startOfMonth, endOfMonth)
  }, [])

  const handleCreateEvent = () => {
    setSelectedEvent(null)
    setShowEventModal(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedEvent(null)
    setShowEventModal(true)
  }

  const handleEventSave = async (eventData: CalendarEventCreate) => {
    try {
      if (selectedEvent) {
        // Update existing event
        await calendarAPI.update(selectedEvent.id, eventData)
      } else {
        // Create new event
        await calendarAPI.create(eventData)
      }
      
      // Refresh events for the currently viewed month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      await loadEvents(startOfMonth, endOfMonth)
      
      setShowEventModal(false)
      setSelectedEvent(null)
      setSelectedDate(null)
    } catch (err) {
      // Debug: console.error('Failed to save event:', err)
      alert(`Failed to save event: ${handleAPIError(err)}`)
    }
  }

  const handleEventDelete = async (eventId: number) => {
    // Debug: console.log('handleEventDelete called with eventId:', eventId)
    
    try {
      // Debug: console.log('Starting delete process...')
      await calendarAPI.delete(eventId)
      // Debug: console.log('API delete successful, refreshing events...')
      
      // Refresh events for the currently viewed month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      await loadEvents(startOfMonth, endOfMonth)
      
      // Debug: console.log('Events refreshed, closing modal...')
      setShowEventModal(false)
      setSelectedEvent(null)
      // Debug: console.log('Delete process completed')
    } catch (err) {
      // Debug: console.error('Failed to delete event:', err)
      alert(`Failed to delete event: ${handleAPIError(err)}`)
    }
  }

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date)
    // Save the current month to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('calendar-current-date', date.toISOString())
    }
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    loadEvents(startOfMonth, endOfMonth)
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold flex items-center gap-3">
                  <Calendar className="w-6 h-6" />
                  Calendar
                </h1>
                <p className="text-muted-foreground mt-1">Manage your meetings, events, and schedule</p>
              </div>
              <button
                onClick={handleCreateEvent}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Event
              </button>
            </div>
            
            {/* Calendar Statistics */}
            <CalendarStats events={events} currentDate={currentDate} />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
              <button 
                onClick={() => loadEvents()}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          <div className="bg-white border rounded-lg shadow-sm overflow-hidden mt-8">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading calendar...</p>
                </div>
              </div>
            ) : (
              <CalendarView
                events={events}
                currentDate={currentDate}
                onDateClick={handleDateClick}
                onEventClick={handleEditEvent}
                onMonthChange={handleMonthChange}
              />
            )}
          </div>

          {/* Event Form Modal */}
          <EventFormModal
            isOpen={showEventModal}
            onClose={() => {
              setShowEventModal(false)
              setSelectedEvent(null)
              setSelectedDate(null)
            }}
            onSave={handleEventSave}
            onDelete={selectedEvent ? () => handleEventDelete(selectedEvent.id) : undefined}
            event={selectedEvent}
            selectedDate={selectedDate}
          />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}