"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import EventFormModal from "@/components/calendar/EventFormModal"
import DocumentManager from "@/components/DocumentManager"
import { 
  Building2, Phone, Globe, DollarSign, User, MapPin, Calendar, 
  FileText, Users, FolderOpen, TrendingUp, MessageSquare, StickyNote,
  Edit, Plus, Clock, Tag
} from "lucide-react"
import { companyAPI, Company, handleAPIError, CalendarEventCreate, calendarAPI, contactAPI, Contact, dealAPI, Deal, dashboardAPI, Activity } from "@/lib/api"

// Tab component
function TabButton({ active, onClick, children, icon: Icon }: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  icon?: React.ElementType;
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
    </button>
  )
}

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const [company, setCompany] = useState<Company | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [showScheduleEvent, setShowScheduleEvent] = useState(false)
  const [notes, setNotes] = useState("")
  const [editingNotes, setEditingNotes] = useState(false)

  useEffect(() => {
    const loadCompany = async () => {
      try {
        setLoading(true)
        setError(null)
        const companyData = await companyAPI.getById(parseInt(params.id))
        setCompany(companyData)
        // Load notes from description for now
        setNotes(companyData.description || "")
      } catch (err) {
        setError(handleAPIError(err))
        console.error('Failed to load company:', err)
      } finally {
        setLoading(false)
      }
    }

    loadCompany()
  }, [params.id])

  // Load contacts when company is loaded
  useEffect(() => {
    const loadContacts = async () => {
      if (!company) return
      
      try {
        const contactsData = await contactAPI.getAll({ company_id: company.id })
        setContacts(contactsData)
      } catch (err) {
        console.error('Failed to load contacts:', err)
      }
    }

    loadContacts()
  }, [company])

  // Load deals when deals tab is active
  useEffect(() => {
    const loadDeals = async () => {
      if (!company || activeTab !== "deals") return
      
      try {
        const dealsData = await dealAPI.getAll({ company_id: company.id })
        setDeals(dealsData)
      } catch (err) {
        console.error('Failed to load deals:', err)
      }
    }

    loadDeals()
  }, [company, activeTab])

  // Load activities when activity tab is active
  useEffect(() => {
    const loadActivities = async () => {
      if (!company || activeTab !== "activity") return
      
      try {
        const activitiesData = await dashboardAPI.getActivities(100)
        // Filter for this company (would be better with backend filtering)
        const companyActivities = activitiesData.filter(a => 
          a.description?.includes(company.name) || 
          a.entity_id === company.id.toString()
        )
        setActivities(companyActivities)
      } catch (err) {
        console.error('Failed to load activities:', err)
      }
    }

    loadActivities()
  }, [company, activeTab])

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

  const handleSaveNotes = async () => {
    if (!company) return
    
    try {
      await companyAPI.update(company.id, { description: notes })
      setEditingNotes(false)
      alert('Notes saved successfully!')
    } catch (err) {
      console.error('Failed to save notes:', err)
      alert('Failed to save notes')
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading company...</p>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  if (error || !company) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h1 className="text-2xl font-semibold mb-4">Company Not Found</h1>
              <p className="text-muted-foreground mb-4">
                {error || "The company you're looking for doesn't exist."}
              </p>
              <Link href="/companies" className="text-primary hover:underline">
                Back to Companies
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
          {/* Header */}
          <div className="mb-6">
            <Link href="/companies" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
              ← Back to Companies
            </Link>
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold">{company.name}</h1>
                  <span className={`inline-flex px-3 py-1 text-sm rounded-full ${
                    company.status === "Active" 
                      ? "bg-gray-100 text-gray-700" 
                      : "bg-gray-50 text-gray-500"
                  }`}>
                    {company.status}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{company.industry}</p>
              </div>
              
              <div className="flex gap-2">
                <Link 
                  href={`/companies/${params.id}/edit`} 
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
              </div>
            </div>

            {/* Key Info Bar */}
            <div className="flex flex-wrap gap-4 text-sm">
              {company.annual_revenue && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span>${company.annual_revenue.toLocaleString()}</span>
                </div>
              )}
              {company.primary_account_owner_name && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{company.primary_account_owner_name}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${company.phone}`} className="hover:underline">
                    {company.phone}
                  </a>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-1">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {(company.city || company.state) && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {[company.city, company.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b mb-6">
            <div className="flex gap-1 overflow-x-auto">
              <TabButton 
                active={activeTab === "overview"} 
                onClick={() => setActiveTab("overview")}
                icon={Building2}
              >
                Overview
              </TabButton>
              <TabButton 
                active={activeTab === "contacts"} 
                onClick={() => setActiveTab("contacts")}
                icon={Users}
              >
                Contacts ({contacts.length})
              </TabButton>
              <TabButton 
                active={activeTab === "documents"} 
                onClick={() => setActiveTab("documents")}
                icon={FolderOpen}
              >
                Documents
              </TabButton>
              <TabButton 
                active={activeTab === "deals"} 
                onClick={() => setActiveTab("deals")}
                icon={TrendingUp}
              >
                Deals ({deals.length})
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
                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Company Details</h2>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Industry</dt>
                        <dd className="mt-1">{company.industry || "Not specified"}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                        <dd className="mt-1">{company.status}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Annual Revenue</dt>
                        <dd className="mt-1">
                          {company.annual_revenue 
                            ? `$${company.annual_revenue.toLocaleString()}`
                            : "Not specified"
                          }
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Account Owner</dt>
                        <dd className="mt-1">
                          {company.primary_account_owner_name || "Not assigned"}
                        </dd>
                      </div>
                      <div className="md:col-span-2">
                        <dt className="text-sm font-medium text-muted-foreground">Address</dt>
                        <dd className="mt-1">
                          {company.street_address || company.city || company.state || company.postal_code ? (
                            <div>
                              {company.street_address && <div>{company.street_address}</div>}
                              {(company.city || company.state || company.postal_code) && (
                                <div>
                                  {[company.city, company.state, company.postal_code]
                                    .filter(Boolean)
                                    .join(', ')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not provided</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Recent Contacts */}
                  <div className="bg-card border rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold">Recent Contacts</h2>
                      <button 
                        onClick={() => setActiveTab("contacts")}
                        className="text-sm hover:underline"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        View all
                      </button>
                    </div>
                    {contacts.slice(0, 3).length > 0 ? (
                      <div className="space-y-3">
                        {contacts.slice(0, 3).map(contact => (
                          <div key={contact.id} className="flex items-center justify-between">
                            <div>
                              <Link 
                                href={`/contacts/${contact.id}`}
                                className="font-medium hover:underline"
                              >
                                {contact.first_name} {contact.last_name}
                              </Link>
                              <p className="text-sm text-muted-foreground">
                                {contact.title || contact.email}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No contacts yet</p>
                    )}
                  </div>
                </div>

                {/* Stats Sidebar */}
                <div className="space-y-6">
                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Total Contacts</dt>
                        <dd className="text-sm font-medium">{contacts.length}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Active Deals</dt>
                        <dd className="text-sm font-medium">{deals.length}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Documents</dt>
                        <dd className="text-sm font-medium">{company.attachment_count || 0}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="space-y-2">
                      <Link 
                        href={`/contacts/new?companyId=${company.id}&company=${encodeURIComponent(company.name)}`}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Contact
                      </Link>
                      <Link 
                        href={`/pipeline/new?companyId=${company.id}`}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-lg hover:bg-accent transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create Deal
                      </Link>
                      <button 
                        onClick={() => setActiveTab("documents")}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left border rounded-lg hover:bg-accent transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Upload Document
                      </button>
                    </div>
                  </div>

                  <div className="bg-card border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Meta Information</h2>
                    <dl className="space-y-2 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="font-medium">
                          {new Date(company.created_at).toLocaleDateString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last Updated</dt>
                        <dd className="font-medium">
                          {new Date(company.updated_at).toLocaleDateString()}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === "contacts" && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Contacts</h2>
                  <Link 
                    href={`/contacts/new?companyId=${company.id}&company=${encodeURIComponent(company.name)}`}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Contact
                  </Link>
                </div>
                
                {contacts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {contacts.map(contact => (
                      <div key={contact.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <Link 
                            href={`/contacts/${contact.id}`}
                            className="font-medium text-lg hover:text-primary"
                          >
                            {contact.first_name} {contact.last_name}
                          </Link>
                          <Link 
                            href={`/contacts/${contact.id}/edit`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </div>
                        {contact.title && (
                          <p className="text-sm font-medium text-muted-foreground mb-2">{contact.title}</p>
                        )}
                        <div className="space-y-1 text-sm">
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary hover:underline">
                            {contact.email}
                          </a>
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:underline">
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No contacts yet</p>
                    <Link 
                      href={`/contacts/new?companyId=${company.id}&company=${encodeURIComponent(company.name)}`}
                      className="text-primary hover:underline"
                    >
                      Add the first contact
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <div className="bg-card border rounded-lg p-6">
                <DocumentManager companyId={company.id} />
              </div>
            )}

            {/* Deals Tab */}
            {activeTab === "deals" && (
              <div className="bg-card border rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Deals</h2>
                  <Link 
                    href={`/pipeline/new?companyId=${company.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
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
                            <p className="text-sm text-muted-foreground">
                              Stage: {deal.stage} • Value: ${deal.value?.toLocaleString() || 0}
                            </p>
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
                      href={`/pipeline/new?companyId=${company.id}`}
                      className="text-primary hover:underline"
                    >
                      Create the first deal
                    </Link>
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
                      className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
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
                      className="w-full h-64 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Add notes about this company..."
                    />
                    <div className="flex gap-2 mt-4">
                      <button 
                        onClick={handleSaveNotes}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => {
                          setEditingNotes(false)
                          setNotes(company.description || "")
                        }}
                        className="px-4 py-2 border rounded-lg hover:bg-accent"
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

          {/* Schedule Event Modal */}
          <EventFormModal
            isOpen={showScheduleEvent}
            onClose={() => setShowScheduleEvent(false)}
            onSave={handleEventSave}
            event={null}
            selectedDate={null}
            preselectedCompanyId={company?.id}
          />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}