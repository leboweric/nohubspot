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
import { 
  contactAPI, Contact, handleAPIError, CalendarEventCreate, calendarAPI, 
  emailThreadAPI, EmailThread, emailTrackingAPI, taskAPI, 
  TaskCreate as TaskCreateType, o365IntegrationAPI, dealAPI, Deal, dashboardAPI, Activity 
} from "@/lib/api"
import { 
  Mail, Phone, Building2, Calendar, Clock, Tag, Edit, Plus,
  MessageSquare, StickyNote, TrendingUp, CheckCircle, User,
  Star, Globe, Linkedin, Twitter, FileText, Users
} from "lucide-react"
import { getAuthState } from "@/lib/auth"

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic'

// Tab component
function TabButton({ active, onClick, children, icon: Icon, count }: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  icon?: React.ElementType;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
        active 
          ? "border-primary text-primary" 
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
      {count !== undefined && count > 0 && (
        <span className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded-full">
          {count}
        </span>
      )}
    </button>
  )
}

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const { user } = getAuthState()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  const [activeTab, setActiveTab] = useState("overview")
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState("")

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

  // Load deals when deals tab is active
  useEffect(() => {
    const loadDeals = async () => {
      if (!contact || activeTab !== "deals") return
      
      try {
        const allDeals = await dealAPI.getAll({})
        // Filter deals for this contact
        const contactDeals = allDeals.filter(d => 
          d.primary_contact_id === contact.id
        )
        setDeals(contactDeals)
      } catch (err) {
        console.error('Failed to load deals:', err)
      }
    }

    loadDeals()
  }, [contact, activeTab])

  // Load tasks when tasks tab is active
  useEffect(() => {
    const loadTasks = async () => {
      if (!contact || activeTab !== "tasks") return
      
      try {
        const allTasks = await taskAPI.getAll()
        // Filter tasks for this contact
        const contactTasks = allTasks.filter(t => 
          t.entity_type === 'contact' && t.entity_id === params.id
        )
        setTasks(contactTasks)
      } catch (err) {
        console.error('Failed to load tasks:', err)
      }
    }

    loadTasks()
  }, [contact, activeTab, params.id])

  // Load activities when activity tab is active
  useEffect(() => {
    const loadActivities = async () => {
      if (!contact || activeTab !== "activity") return
      
      try {
        const activitiesData = await dashboardAPI.getActivities(100)
        // Filter for this contact
        const contactActivities = activitiesData.filter(a => 
          a.description?.includes(`${contact.first_name} ${contact.last_name}`) || 
          a.entity_id === contact.id.toString()
        )
        setActivities(contactActivities)
      } catch (err) {
        console.error('Failed to load activities:', err)
      }
    }

    loadActivities()
  }, [contact, activeTab])

  // Initialize notes from contact data
  useEffect(() => {
    if (contact) {
      setNotes(contact.notes || "")
    }
  }, [contact])

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
    if (contact && o365Connected) {
      loadEmailThreads()
      loadActivityStats()
    }
  }, [contact, o365Connected])

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

  const handleSaveNotes = async () => {
    if (!contact) return
    
    try {
      await contactAPI.update(contact.id, { notes })
      setEditingNotes(false)
      alert('Notes saved successfully!')
    } catch (err) {
      console.error('Failed to save notes:', err)
      alert('Failed to save notes')
    }
  }

  // Get initials for avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase()
  }

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    return date.toLocaleDateString()
  }

  // Calculate relationship metrics
  const getRelationshipDuration = () => {
    if (!contact) return ''
    const created = new Date(contact.created_at)
    const now = new Date()
    const months = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30))
    if (months < 1) return 'New contact'
    if (months === 1) return '1 month'
    if (months < 12) return `${months} months`
    const years = Math.floor(months / 12)
    return years === 1 ? '1 year' : `${years} years`
  }

  const getEngagementScore = () => {
    // Simple engagement calculation based on activity
    const emailScore = Math.min(emails.length * 10, 40)
    const meetingScore = activityStats.meetings * 20
    const callScore = activityStats.callsMade * 15
    const total = Math.min(emailScore + meetingScore + callScore, 100)
    
    if (total >= 80) return { score: total, label: 'Very High', color: 'text-green-600' }
    if (total >= 60) return { score: total, label: 'High', color: 'text-blue-600' }
    if (total >= 40) return { score: total, label: 'Medium', color: 'text-yellow-600' }
    if (total >= 20) return { score: total, label: 'Low', color: 'text-orange-600' }
    return { score: total, label: 'Very Low', color: 'text-red-600' }
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

  const engagement = getEngagementScore()
  
  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <Link href="/contacts" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
              ← Back to Contacts
            </Link>
            
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-4">
                {/* Contact Avatar */}
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-semibold text-xl"
                  style={{ 
                    background: `linear-gradient(135deg, var(--theme-accent), var(--theme-primary))` 
                  }}
                >
                  {getInitials(contact.first_name, contact.last_name)}
                </div>
                
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-semibold">{contact.first_name} {contact.last_name}</h1>
                    <span className={`inline-flex px-3 py-1 text-sm rounded-full ${
                      contact.status === "Active" 
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                    }`}>
                      {contact.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {contact.title && <span>{contact.title}</span>}
                    {contact.title && contact.company_name && <span> at </span>}
                    {contact.company_name && (
                      contact.company_id ? (
                        <Link href={`/companies/${contact.company_id}`} className="text-primary hover:underline">
                          {contact.company_name}
                        </Link>
                      ) : (
                        <span>{contact.company_name}</span>
                      )
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Link 
                  href={`/contacts/${params.id}/edit`} 
                  className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
                {o365Connected && (
                  <button 
                    onClick={handleSendEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Send Email
                  </button>
                )}
              </div>
            </div>

            {/* Key Info Bar */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a href={`mailto:${contact.email}`} className="hover:underline">
                  {contact.email}
                </a>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${contact.phone}`} className="hover:underline">
                    {contact.phone}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Last activity: {formatRelativeTime(contact.last_activity)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>Relationship: {getRelationshipDuration()}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b mb-6">
            <div className="flex gap-1 overflow-x-auto">
              <TabButton 
                active={activeTab === "overview"} 
                onClick={() => setActiveTab("overview")}
                icon={User}
              >
                Overview
              </TabButton>
              {o365Connected && (
                <TabButton 
                  active={activeTab === "communication"} 
                  onClick={() => setActiveTab("communication")}
                  icon={MessageSquare}
                  count={emails.length}
                >
                  Communication
                </TabButton>
              )}
              <TabButton 
                active={activeTab === "deals"} 
                onClick={() => setActiveTab("deals")}
                icon={TrendingUp}
                count={deals.length}
              >
                Deals
              </TabButton>
              <TabButton 
                active={activeTab === "tasks"} 
                onClick={() => setActiveTab("tasks")}
                icon={CheckCircle}
                count={tasks.length}
              >
                Tasks
              </TabButton>
              <TabButton 
                active={activeTab === "activity"} 
                onClick={() => setActiveTab("activity")}
                icon={Clock}
              >
                Activity
              </TabButton>
              <TabButton 
                active={activeTab === "notes"} 
                onClick={() => setActiveTab("notes")}
                icon={StickyNote}
              >
                Notes
              </TabButton>
            </div>
          </div>

          {/* Tab Content */}
          <div className="min-h-[500px]">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Contact Details */}
                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Contact Details</h2>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Full Name</dt>
                        <dd className="mt-1">{contact.first_name} {contact.last_name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Job Title</dt>
                        <dd className="mt-1">{contact.title || "Not specified"}</dd>
                      </div>
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
                            <span>{contact.company_name}</span>
                          ) : (
                            <span className="text-muted-foreground">Not specified</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                        <dd className="mt-1">
                          <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            contact.status === "Active" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {contact.status}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-card border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Recent Activity</h2>
                      <button 
                        onClick={() => setActiveTab("activity")}
                        className="text-sm text-primary hover:underline"
                      >
                        View all
                      </button>
                    </div>
                    {activities.slice(0, 5).length > 0 ? (
                      <div className="space-y-3">
                        {activities.slice(0, 5).map(activity => (
                          <div key={activity.id} className="flex gap-3 pb-3 border-b last:border-0">
                            <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{activity.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatRelativeTime(activity.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No recent activity</p>
                    )}
                  </div>

                  {/* Recent Deals */}
                  {deals.length > 0 && (
                    <div className="bg-card border rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Active Deals</h2>
                        <button 
                          onClick={() => setActiveTab("deals")}
                          className="text-sm text-primary hover:underline"
                        >
                          View all
                        </button>
                      </div>
                      <div className="space-y-3">
                        {deals.slice(0, 3).map(deal => (
                          <div key={deal.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div>
                              <p className="font-medium">{deal.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {deal.stage} • ${deal.value?.toLocaleString() || 0}
                              </p>
                            </div>
                            <Link 
                              href="/pipeline"
                              className="text-xs text-primary hover:underline"
                            >
                              View
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="space-y-2">
                      <button 
                        onClick={handleScheduleMeeting}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Schedule Meeting
                      </button>
                      <button 
                        onClick={() => setShowCreateTask(true)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Task
                      </button>
                      <button 
                        onClick={handleScheduleCall}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        Schedule Call
                      </button>
                      {o365Connected && (
                        <button 
                          onClick={handleSendEmail}
                          className="flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                          Send Email
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Meta Information */}
                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Meta Information</h2>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="font-medium">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last Updated</dt>
                        <dd className="font-medium">
                          {new Date(contact.updated_at).toLocaleDateString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last Activity</dt>
                        <dd className="font-medium">
                          {formatRelativeTime(contact.last_activity)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {/* Communication Tab */}
            {activeTab === "communication" && o365Connected && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Email Communication</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEmailThread(true)}
                      className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
                    >
                      View Thread
                    </button>
                    <button
                      onClick={handleSendEmail}
                      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Send Email
                    </button>
                  </div>
                </div>
                
                <EmailTrackingStatus contactId={contact.id} />
                
                <div className="mt-6">
                  {emailsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse">
                          <div className="h-24 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : emails.length > 0 ? (
                    <div className="space-y-4">
                      {emails.map((email) => (
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
                              {email.timestamp.toLocaleString()}
                            </span>
                          </div>
                          <div className="p-4">
                            <h4 className="text-sm font-semibold mb-2">{email.subject}</h4>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {email.message.length > 300 
                                ? `${email.message.substring(0, 300)}...` 
                                : email.message
                              }
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No email conversation yet</p>
                      <button 
                        onClick={handleSendEmail}
                        className="mt-4 text-primary hover:underline"
                      >
                        Start a conversation
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deals Tab */}
            {activeTab === "deals" && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Related Deals</h2>
                  <Link 
                    href={`/pipeline/new?contactId=${contact.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Deal
                  </Link>
                </div>
                
                {deals.length > 0 ? (
                  <div className="space-y-4">
                    {deals.map(deal => (
                      <div key={deal.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium text-lg">{deal.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              Stage: <span className="font-medium">{deal.stage}</span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Value: <span className="font-medium text-green-600">${deal.value?.toLocaleString() || 0}</span>
                            </p>
                            {deal.expected_close_date && (
                              <p className="text-sm text-muted-foreground">
                                Expected Close: {new Date(deal.expected_close_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <Link 
                            href="/pipeline"
                            className="text-primary hover:underline text-sm"
                          >
                            View in Pipeline
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No deals yet</p>
                    <Link 
                      href={`/pipeline/new?contactId=${contact.id}`}
                      className="text-primary hover:underline"
                    >
                      Create the first deal
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Tasks</h2>
                  <button 
                    onClick={() => setShowCreateTask(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Task
                  </button>
                </div>
                
                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <div key={task.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <input 
                          type="checkbox" 
                          checked={task.status === 'completed'}
                          className="mt-1"
                          readOnly
                        />
                        <div className="flex-1">
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {task.due_date && (
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full ${
                              task.priority === 'high' ? 'bg-gray-200 text-gray-800' :
                              task.priority === 'medium' ? 'bg-gray-100 text-gray-700' :
                              'bg-gray-50 text-gray-600'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No tasks yet</p>
                    <button 
                      onClick={() => setShowCreateTask(true)}
                      className="text-primary hover:underline"
                    >
                      Create the first task
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <div className="bg-card border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6">Activity Timeline</h2>
                
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map(activity => (
                      <div key={activity.id} className="flex gap-4 pb-4 border-b last:border-0">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.title}</p>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(activity.created_at).toLocaleString()}
                            {activity.created_by && ` by ${activity.created_by}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No activity recorded yet</p>
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === "notes" && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Internal Notes</h2>
                  {!editingNotes && (
                    <button 
                      onClick={() => setEditingNotes(true)}
                      className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                </div>
                
                {editingNotes ? (
                  <div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full h-64 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Add notes about this contact..."
                    />
                    <div className="flex gap-2 mt-4">
                      <button 
                        onClick={handleSaveNotes}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setEditingNotes(false)
                          setNotes(contact.notes || "")
                        }}
                        className="px-4 py-2 border rounded-md hover:bg-accent"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose max-w-none">
                    {notes ? (
                      <p className="whitespace-pre-wrap">{notes}</p>
                    ) : (
                      <p className="text-muted-foreground italic">No notes yet. Click Edit to add notes.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

      {/* Email Compose Modal */}
      {o365Connected && (
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
      )}

      {/* Email Thread Modal */}
      {o365Connected && showEmailThread && (
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