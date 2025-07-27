"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import EmailCompose, { EmailMessage } from "@/components/email/EmailCompose"
import EmailThreadComponent from "@/components/email/EmailThread"
import EmailTrackingStatus from "@/components/email/EmailTrackingStatus"
import TaskCreate from "@/components/tasks/TaskCreate"
import EventFormModal from "@/components/calendar/EventFormModal"
import { Task } from "@/components/tasks/types"
import { contactAPI, Contact, handleAPIError, CalendarEventCreate, calendarAPI, emailThreadAPI, EmailThread, emailTrackingAPI, taskAPI, TaskCreate as TaskCreateType, o365IntegrationAPI } from "@/lib/api"
import { getAuthState } from "@/lib/auth"

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic'

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const { user } = getAuthState()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadContact = async () => {
      try {
        setLoading(true)
        setError(null)
        const contactData = await contactAPI.getById(parseInt(params.id))
        setContact(contactData)
      } catch (err) {
        setError(handleAPIError(err))
        console.error('Failed to load contact:', err)
      } finally {
        setLoading(false)
      }
    }

    const checkO365Status = async () => {
      try {
        const status = await o365IntegrationAPI.getStatus()
        setO365Connected(status.connected)
      } catch (err) {
        console.error('Failed to check O365 status:', err)
        setO365Connected(false)
      }
    }

    loadContact()
    checkO365Status()
  }, [params.id])

  // Load email threads for this contact
  const loadEmailThreads = async () => {
    if (!contact) return
    
    try {
      setEmailsLoading(true)
      const threads = await emailThreadAPI.getByContact(contact.id)
      console.log(`Loaded ${threads.length} email threads for contact ${contact.id}`)
      threads.forEach((thread, index) => {
        console.log(`Thread ${index}: ${thread.subject}, messages: ${thread.messages?.length || 0}`)
      })
      setEmailThreads(threads)
      
      // Convert threads to flat email messages for the existing UI
      const allMessages: EmailMessage[] = []
      threads.forEach(thread => {
        thread.messages?.forEach(msg => {
          allMessages.push({
            id: msg.id.toString(),
            to: msg.direction === 'outgoing' ? contact.email : user?.email || '',
            subject: thread.subject,
            message: msg.content,
            timestamp: new Date(msg.created_at),
            fromSelf: msg.direction === 'outgoing'
          })
        })
      })
      
      console.log(`Converted to ${allMessages.length} messages for display`)
      
      // Sort by timestamp
      allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      setEmails(allMessages)
      
    } catch (err) {
      console.error('Failed to load email threads:', err)
    } finally {
      setEmailsLoading(false)
    }
  }

  // Load activity stats for this contact
  const loadActivityStats = async () => {
    if (!contact) return
    
    try {
      console.log(`Loading activity stats for contact ${contact.id}: ${contact.first_name} ${contact.last_name}`)
      
      // Get email tracking records for this contact
      const emailTracking = await emailTrackingAPI.getAll({
        contact_id: contact.id,
        limit: 1000
      })
      console.log(`Found ${emailTracking.length} email tracking records for contact ${contact.id}`)
      
      // Get calendar events for this contact
      const events = await calendarAPI.getAll({
        contact_id: contact.id,
        limit: 1000
      })
      console.log(`Found ${events.length} calendar events for contact ${contact.id}`)
      
      // Count different types of activities
      const callEvents = events.filter(e => e.event_type === 'call')
      const meetingEvents = events.filter(e => e.event_type === 'meeting')
      
      setActivityStats({
        emailsSent: emailTracking.length,
        callsMade: callEvents.length,
        meetings: meetingEvents.length
      })
    } catch (err) {
      console.error('Failed to load activity stats:', err)
    }
  }

  // Load email threads and activity stats when contact is loaded
  useEffect(() => {
    if (contact) {
      loadEmailThreads()
      loadActivityStats()
    }
  }, [contact])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [showEmailCompose, setShowEmailCompose] = useState(false)
  const [showEmailThread, setShowEmailThread] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showScheduleEvent, setShowScheduleEvent] = useState(false)
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([])
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [activityStats, setActivityStats] = useState({
    emailsSent: 0,
    callsMade: 0,
    meetings: 0
  })
  const [o365Connected, setO365Connected] = useState(false)

  const handleSendEmail = () => {
    setShowEmailCompose(true)
  }

  const handleScheduleCall = () => {
    // TODO: Integrate with calendar system
    alert(`Schedule call feature would integrate with your calendar system.\n\nContact: ${contact?.firstName} ${contact?.lastName}\nPhone: ${contact?.phone || 'No phone number'}`)
  }

  const handleAddNote = () => {
    if (newNote.trim()) {
      // TODO: Save note to backend
      console.log("New note:", newNote)
      alert(`Note added: "${newNote}"\n\n(This would be saved to the backend)`)
      setNewNote("")
      setShowNoteModal(false)
    }
  }

  const handleEmailSent = (email: EmailMessage) => {
    // Close the compose modal
    setShowEmailCompose(false)
    // Refresh email threads and stats to show the new email
    loadEmailThreads()
    loadActivityStats()
    // Small delay to allow backend to process
    setTimeout(() => {
      loadActivityStats()
    }, 2000)
  }

  const handleReply = (message: string) => {
    const reply: EmailMessage = {
      id: Date.now().toString(),
      to: contact?.email || "",
      subject: "Re: " + (emails[emails.length - 1]?.subject || "Follow up"),
      message,
      timestamp: new Date(),
      fromSelf: true
    }
    setEmails(prev => [...prev, reply])
  }

  const handleScheduleMeeting = () => {
    setShowScheduleEvent(true)
  }

  const handleEventSave = async (eventData: CalendarEventCreate) => {
    try {
      await calendarAPI.create(eventData)
      setShowScheduleEvent(false)
      alert('Meeting scheduled successfully!')
    } catch (err) {
      console.error('Failed to schedule meeting:', err)
      alert(`Failed to schedule meeting: ${handleAPIError(err)}`)
    }
  }

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // Convert the task data to match the API format
      const apiTaskData: TaskCreateType = {
        title: taskData.title,
        description: taskData.description || undefined,
        due_date: taskData.dueDate || undefined,
        priority: taskData.priority,
        status: taskData.status,
        assigned_to: taskData.assignedTo || undefined,
        entity_type: 'contact',
        entity_id: params.id
      }
      
      await taskAPI.create(apiTaskData)
      setShowCreateTask(false)
      alert('Task created successfully!')
      
      // Optionally refresh the page or update local state
      // to show the new task in the UI
    } catch (error) {
      console.error('Failed to create task:', error)
      alert(`Failed to create task: ${handleAPIError(error)}`)
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading contact...</p>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  if (error || !contact) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-semibold mb-4">Contact Not Found</h1>
              <p className="text-muted-foreground mb-4">
                {error || "The contact you're looking for doesn't exist."}
              </p>
              <Link href="/contacts" className="text-primary hover:underline">
                Back to Contacts
              </Link>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <Link href="/contacts" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          ← Back to Contacts
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">{contact.first_name} {contact.last_name}</h1>
            <p className="text-muted-foreground mt-1">{contact.title} at {contact.company_name}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm rounded-full ${
            contact.status === "Active" 
              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
          }`}>
            {contact.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                <dd className="mt-1">
                  <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                    {contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                <dd className="mt-1">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                      {contact.phone}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Company</dt>
                <dd className="mt-1">
                  {contact.company_id && contact.company_name ? (
                    <Link href={`/companies/${contact.company_id}`} className="text-primary hover:underline">
                      {contact.company_name}
                    </Link>
                  ) : contact.company_name ? (
                    <span className="text-foreground">{contact.company_name}</span>
                  ) : (
                    <span className="text-muted-foreground">Not specified</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Created</dt>
                <dd className="mt-1">{new Date(contact.created_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Last Activity</dt>
                <dd className="mt-1">{new Date(contact.last_activity).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Notes</h2>
            <p className="text-sm">{contact.notes}</p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Communication History</h2>
              <button
                onClick={() => setShowEmailThread(true)}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                View Thread
              </button>
            </div>
            
            {emailsLoading ? (
              <div className="space-y-3">
                <div className="animate-pulse">
                  <div className="flex items-start space-x-3 p-3 bg-muted rounded-md">
                    <div className="w-2 h-2 rounded-full bg-gray-300 mt-2"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : emails.length > 0 ? (
              <div className="space-y-4">
                {emails.slice(-5).map((email) => (
                  <div key={email.id} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          email.fromSelf ? 'bg-blue-500' : 'bg-green-500'
                        }`}></div>
                        <span className="text-sm font-medium">
                          {email.fromSelf ? 'You' : `${contact?.first_name} ${contact?.last_name}`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {email.timestamp.toLocaleDateString()} at {email.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="p-4">
                      <h4 className="text-sm font-semibold mb-2">{email.subject}</h4>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {email.message.length > 200 
                          ? `${email.message.substring(0, 200)}...` 
                          : email.message
                        }
                      </div>
                    </div>
                  </div>
                ))}
                {emails.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Showing latest 5 of {emails.length} messages
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No email conversation yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start a conversation by sending an email</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Email Engagement Tracking */}
          <EmailTrackingStatus contactId={contact.id} />
          
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              {o365Connected && (
                <button onClick={handleSendEmail} className="w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                  Send Email
                </button>
              )}
              <button onClick={handleScheduleCall} className="w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Schedule Call
              </button>
              <button onClick={handleScheduleMeeting} className="w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Schedule Meeting
              </button>
              <button onClick={() => setShowCreateTask(true)} className="w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Create Task
              </button>
              <Link href={`/contacts/${params.id}/edit`} className="block w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Edit Contact
              </Link>
              <button onClick={() => setShowNoteModal(true)} className="w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Add Note
              </button>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Activity Summary</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Emails Sent</dt>
                <dd className="text-sm font-medium">{activityStats.emailsSent}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Calls Made</dt>
                <dd className="text-sm font-medium">{activityStats.callsMade}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Meetings</dt>
                <dd className="text-sm font-medium">{activityStats.meetings}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Email Compose Modal */}
      <EmailCompose
        isOpen={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        recipientEmail={contact?.email || ""}
        recipientName={`${contact?.first_name} ${contact?.last_name}` || ""}
        onSend={handleEmailSent}
        senderName={user?.first_name && user?.last_name 
          ? `${user?.first_name} ${user?.last_name}`
          : user?.email?.split('@')[0] || "Sales Rep"
        }
        senderEmail={user?.email || "sales@company.com"}
      />

      {/* Email Thread Modal */}
      {showEmailThread && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg w-full max-w-4xl mx-4 h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Email Thread</h2>
              <button
                onClick={() => setShowEmailThread(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1">
              <EmailThreadComponent
                contactName={`${contact?.first_name} ${contact?.last_name}` || ""}
                contactEmail={contact?.email || ""}
                emails={emails}
                onReply={handleReply}
                senderName={user?.first_name && user?.last_name 
                  ? `${user?.first_name} ${user?.last_name}`
                  : user?.email?.split('@')[0] || "Sales Rep"
                }
                senderEmail={user?.email || "sales@company.com"}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      <TaskCreate
        isOpen={showCreateTask}
        onClose={() => setShowCreateTask(false)}
        onSave={handleCreateTask}
        contactId={params.id}
        contactName={`${contact?.first_name} ${contact?.last_name}`}
        companyId={contact?.company_id} 
        companyName={contact?.company_name}
      />

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Note</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter your note here..."
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring mb-4"
              rows={4}
            />
            <div className="flex gap-4">
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Add Note
              </button>
              <button
                onClick={() => {
                  setShowNoteModal(false)
                  setNewNote("")
                }}
                className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Event Modal */}
      <EventFormModal
        isOpen={showScheduleEvent}
        onClose={() => setShowScheduleEvent(false)}
        onSave={handleEventSave}
        event={null}
        selectedDate={null}
        preselectedContactId={contact?.id}
      />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}