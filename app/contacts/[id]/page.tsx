"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import EmailCompose, { EmailMessage } from "@/components/email/EmailCompose"
import EmailThread from "@/components/email/EmailThread"
import TaskCreate from "@/components/tasks/TaskCreate"
import EventFormModal from "@/components/calendar/EventFormModal"
import { Task } from "@/components/tasks/types"
import { contactAPI, Contact, handleAPIError, CalendarEventCreate, calendarAPI } from "@/lib/api"
import { getAuthState } from "@/lib/auth"

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

    loadContact()
  }, [params.id])
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [showEmailCompose, setShowEmailCompose] = useState(false)
  const [showEmailThread, setShowEmailThread] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [showScheduleEvent, setShowScheduleEvent] = useState(false)
  const [emails, setEmails] = useState<EmailMessage[]>([
    // Sample email thread data
    {
      id: "1",
      to: contact?.email || "",
      subject: "Introduction and Partnership Opportunity",
      message: "Hi John,\n\nI hope this email finds you well. I wanted to reach out regarding a potential partnership opportunity that I believe could benefit Acme Corporation.\n\nWould you be available for a brief call this week to discuss?\n\nBest regards,\nSales Team",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      fromSelf: true
    },
    {
      id: "2",
      to: "sales@ourcompany.com",
      subject: "Re: Introduction and Partnership Opportunity",
      message: "Hi there,\n\nThanks for reaching out! I'm definitely interested in learning more about this partnership opportunity.\n\nI'm available for a call on Thursday afternoon or Friday morning. What works best for you?\n\nLooking forward to hearing from you.\n\nBest,\nJohn",
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      fromSelf: false
    }
  ])

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
    setEmails(prev => [...prev, email])
    setShowEmailCompose(false)
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

  const handleCreateTask = (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Save to localStorage
    try {
      const existingTasks = JSON.parse(localStorage.getItem('tasks') || '[]')
      existingTasks.unshift(newTask)
      localStorage.setItem('tasks', JSON.stringify(existingTasks))
    } catch (error) {
      console.error('Failed to save task:', error)
    }
    
    setShowCreateTask(false)
    alert('Task created successfully!')
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
                  {contact.company_name ? (
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
            
            {emails.length > 0 ? (
              <div className="space-y-3">
                {emails.slice(-3).map((email) => (
                  <div key={email.id} className="flex items-start space-x-3 p-3 bg-muted rounded-md">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      email.fromSelf ? 'bg-blue-500' : 'bg-green-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {email.fromSelf ? 'You' : contact.first_name} sent: {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {email.timestamp.toLocaleDateString()} at {email.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {emails.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    And {emails.length - 3} more messages...
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No communication history yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-2">
              <button onClick={handleSendEmail} className="w-full text-left px-4 py-2 border rounded-md hover:bg-accent transition-colors">
                Send Email
              </button>
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
                <dd className="text-sm font-medium">0</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Calls Made</dt>
                <dd className="text-sm font-medium">0</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Meetings</dt>
                <dd className="text-sm font-medium">0</dd>
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
          ? `${user.first_name} ${user.last_name}`
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
              <EmailThread
                contactName={`${contact?.first_name} ${contact?.last_name}` || ""}
                contactEmail={contact?.email || ""}
                emails={emails}
                onReply={handleReply}
                senderName={user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}`
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