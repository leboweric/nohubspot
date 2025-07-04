"use client"

import { useState, useEffect } from "react"
import { CalendarEvent, CalendarEventCreate, contactAPI, companyAPI, calendarAPI, Contact, Company, handleAPIError } from "@/lib/api"

interface EventFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (event: CalendarEventCreate) => void
  onDelete?: () => void
  event?: CalendarEvent | null
  selectedDate?: Date | null
  preselectedContactId?: number
  preselectedCompanyId?: number
}

export default function EventFormModal({ isOpen, onClose, onSave, onDelete, event, selectedDate, preselectedContactId, preselectedCompanyId }: EventFormModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    location: "",
    event_type: "meeting",
    contact_id: "",
    company_id: "",
    is_all_day: false,
    reminder_minutes: 15,
    status: "scheduled",
    attendee_ids: [] as number[]
  })

  const [contacts, setContacts] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(false)
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([])
  const [showAttendeeSelection, setShowAttendeeSelection] = useState(false)
  const [sendingInvites, setSendingInvites] = useState(false)

  // Load contacts and companies for selection
  useEffect(() => {
    const loadData = async () => {
      try {
        const [contactsData, companiesData] = await Promise.all([
          contactAPI.getAll({ limit: 1000 }),
          companyAPI.getAll({ limit: 1000 })
        ])
        setContacts(contactsData)
        setCompanies(companiesData)
      } catch (err) {
        console.error('Failed to load contacts/companies:', err)
      }
    }

    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (event) {
        // Editing existing event
        const startTime = new Date(event.start_time)
        const endTime = new Date(event.end_time)
        
        setFormData({
          title: event.title,
          description: event.description || "",
          start_time: startTime.toISOString().slice(0, 16), // Format for datetime-local input
          end_time: endTime.toISOString().slice(0, 16),
          location: event.location || "",
          event_type: event.event_type,
          contact_id: event.contact_id?.toString() || "",
          company_id: event.company_id?.toString() || "",
          is_all_day: event.is_all_day,
          reminder_minutes: event.reminder_minutes,
          status: event.status,
          attendee_ids: [] // TODO: Load existing attendees when editing
        })
      } else if (selectedDate) {
        // Creating new event for selected date
        const startTime = new Date(selectedDate)
        startTime.setHours(9, 0) // Default to 9 AM
        const endTime = new Date(selectedDate)
        endTime.setHours(10, 0) // Default to 10 AM (1 hour duration)
        
        setFormData({
          title: "",
          description: "",
          start_time: startTime.toISOString().slice(0, 16),
          end_time: endTime.toISOString().slice(0, 16),
          location: "",
          event_type: "meeting",
          contact_id: "",
          company_id: "",
          is_all_day: false,
          reminder_minutes: 15,
          status: "scheduled",
          attendee_ids: []
        })
      } else {
        // Creating new event
        const now = new Date()
        const start = new Date(now)
        start.setMinutes(0, 0, 0) // Round to nearest hour
        const end = new Date(start)
        end.setHours(end.getHours() + 1)
        
        setFormData({
          title: "",
          description: "",
          start_time: start.toISOString().slice(0, 16),
          end_time: end.toISOString().slice(0, 16),
          location: "",
          event_type: "meeting",
          contact_id: preselectedContactId?.toString() || "",
          company_id: preselectedCompanyId?.toString() || "",
          is_all_day: false,
          reminder_minutes: 15,
          status: "scheduled",
          attendee_ids: []
        })
      }
    }
  }, [isOpen, event, selectedDate, preselectedContactId, preselectedCompanyId])

  // Load company contacts when company is selected
  useEffect(() => {
    if (formData.company_id) {
      const companyId = parseInt(formData.company_id)
      const selectedCompanyContacts = contacts.filter(contact => contact.company_id === companyId)
      setCompanyContacts(selectedCompanyContacts)
      setShowAttendeeSelection(selectedCompanyContacts.length > 0)
    } else {
      setCompanyContacts([])
      setShowAttendeeSelection(false)
      setFormData(prev => ({ ...prev, attendee_ids: [] }))
    }
  }, [formData.company_id, contacts])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const eventData: CalendarEventCreate = {
        title: formData.title,
        description: formData.description || undefined,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        location: formData.location || undefined,
        event_type: formData.event_type,
        contact_id: formData.contact_id ? parseInt(formData.contact_id) : undefined,
        company_id: formData.company_id ? parseInt(formData.company_id) : undefined,
        is_all_day: formData.is_all_day,
        reminder_minutes: formData.reminder_minutes,
        status: formData.status,
        attendee_ids: formData.attendee_ids
      }

      await onSave(eventData)
    } catch (err) {
      console.error('Failed to save event:', err)
      alert(`Failed to save event: ${handleAPIError(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleAttendeeToggle = (contactId: number) => {
    setFormData(prev => ({
      ...prev,
      attendee_ids: prev.attendee_ids.includes(contactId)
        ? prev.attendee_ids.filter(id => id !== contactId)
        : [...prev.attendee_ids, contactId]
    }))
  }

  const handleSelectAllAttendees = () => {
    const allContactIds = companyContacts.map(contact => contact.id)
    const allSelected = allContactIds.every(id => formData.attendee_ids.includes(id))
    
    setFormData(prev => ({
      ...prev,
      attendee_ids: allSelected ? [] : allContactIds
    }))
  }

  const handleDelete = () => {
    if (onDelete && confirm('Are you sure you want to delete this event?')) {
      onDelete()
    }
  }

  const handleSendInvites = async () => {
    if (!event?.id) return
    
    setSendingInvites(true)
    try {
      const result = await calendarAPI.sendInvite(event.id)
      alert(`✅ ${result.message}\n\nInvites sent to:\n${result.attendees_notified.join('\n')}`)
    } catch (err) {
      console.error('Failed to send calendar invites:', err)
      alert(`❌ Failed to send calendar invites: ${handleAPIError(err)}`)
    } finally {
      setSendingInvites(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">
            {event ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Event Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Meeting with client"
            />
          </div>

          <div>
            <label htmlFor="event_type" className="block text-sm font-medium mb-2">
              Event Type
            </label>
            <select
              id="event_type"
              name="event_type"
              value={formData.event_type}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="meeting">Meeting</option>
              <option value="call">Call</option>
              <option value="task">Task</option>
              <option value="reminder">Reminder</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium mb-2">
                Start Time *
              </label>
              <input
                type="datetime-local"
                id="start_time"
                name="start_time"
                required
                value={formData.start_time}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="end_time" className="block text-sm font-medium mb-2">
                End Time *
              </label>
              <input
                type="datetime-local"
                id="end_time"
                name="end_time"
                required
                value={formData.end_time}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_all_day"
                checked={formData.is_all_day}
                onChange={handleChange}
                className="rounded"
              />
              <span className="text-sm font-medium">All day event</span>
            </label>
          </div>

          <div>
            <label htmlFor="company_id" className="block text-sm font-medium mb-2">
              Related Company *
            </label>
            <select
              id="company_id"
              name="company_id"
              value={formData.company_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          {/* Attendee Selection */}
          {showAttendeeSelection && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Select Attendees ({formData.attendee_ids.length} selected)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllAttendees}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {companyContacts.every(contact => formData.attendee_ids.includes(contact.id)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="border rounded-md p-4 max-h-48 overflow-y-auto bg-gray-50">
                {companyContacts.map(contact => (
                  <label key={contact.id} className="flex items-center gap-3 py-2 hover:bg-gray-100 rounded px-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.attendee_ids.includes(contact.id)}
                      onChange={() => handleAttendeeToggle(contact.id)}
                      className="rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{contact.first_name} {contact.last_name}</div>
                      <div className="text-sm text-gray-600">{contact.email}</div>
                      {contact.title && <div className="text-xs text-gray-500">{contact.title}</div>}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="contact_id" className="block text-sm font-medium mb-2">
              Primary Contact (Optional)
            </label>
            <select
              id="contact_id"
              name="contact_id"
              value={formData.contact_id}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a primary contact</option>
              {companyContacts.length > 0 ? (
                companyContacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))
              ) : (
                contacts.map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium mb-2">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Office, Zoom, etc."
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Meeting agenda, notes, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="reminder_minutes" className="block text-sm font-medium mb-2">
                Reminder
              </label>
              <select
                id="reminder_minutes"
                name="reminder_minutes"
                value={formData.reminder_minutes}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value={0}>No reminder</option>
                <option value={5}>5 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={1440}>1 day before</option>
              </select>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium mb-2">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between">
            <div className="flex gap-2">
              {event && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                >
                  Delete Event
                </button>
              )}
              {event && formData.attendee_ids.length > 0 && (
                <button
                  type="button"
                  onClick={handleSendInvites}
                  disabled={sendingInvites}
                  className="px-4 py-2 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {sendingInvites ? 'Sending...' : '📧 Send Invites'}
                </button>
              )}
            </div>
            
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}