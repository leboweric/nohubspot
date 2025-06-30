import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft,
  Mail,
  Phone,
  Building,
  Globe,
  MapPin,
  Edit,
  Send,
  Eye,
  MousePointer,
  Calendar,
  Trash2,
  MessageSquare,
  Reply,
  Clock
} from 'lucide-react'
import { api } from '../lib/api'
import EmailThread from './EmailThread'

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [threadDialogOpen, setThreadDialogOpen] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (id) {
      loadContactData()
      loadEmailThreads()
    }
  }, [id])

  const loadContactData = async () => {
    try {
      const [contactResponse, timelineResponse] = await Promise.all([
        api.getContact(id),
        api.getContactTimeline(id)
      ])

      if (contactResponse.success) {
        setContact(contactResponse.data)
      }

      if (timelineResponse.success) {
        setTimeline(timelineResponse.data)
      }
    } catch (error) {
      console.error('Failed to load contact data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEmailThreads = async () => {
    try {
      const response = await api.getContactThreads(id)
      if (response.success) {
        setThreads(response.threads)
      }
    } catch (error) {
      console.error('Failed to load email threads:', error)
    }
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    setSendingEmail(true)

    const formData = new FormData(e.target)
    const emailData = {
      contact_id: id,
      subject: formData.get('subject'),
      content: formData.get('content'),
    }

    try {
      const response = await api.sendEmail(emailData)
      if (response.success) {
        setEmailDialogOpen(false)
        e.target.reset()
        // Reload timeline and threads to show the new email
        loadContactData()
        loadEmailThreads()
      }
    } catch (error) {
      console.error('Failed to send email:', error)
    } finally {
      setSendingEmail(false)
    }
  }

  const handleEditContact = async (e) => {
    e.preventDefault()
    setUpdating(true)

    const formData = new FormData(e.target)
    const contactData = {
      first_name: formData.get('first_name'),
      last_name: formData.get('last_name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      company: formData.get('company'),
      website: formData.get('website'),
      address: formData.get('address'),
      notes: formData.get('notes'),
    }

    try {
      const response = await api.updateContact(id, contactData)
      if (response.success) {
        setEditDialogOpen(false)
        loadContactData() // Reload to show updated data
      }
    } catch (error) {
      console.error('Failed to update contact:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteContact = async () => {
    setDeleting(true)

    try {
      const response = await api.deleteContact(id)
      if (response.success) {
        navigate('/contacts') // Navigate back to contacts list
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
    } finally {
      setDeleting(false)
    }
  }

  const handleViewThread = (threadId) => {
    setSelectedThreadId(threadId)
    setThreadDialogOpen(true)
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'call':
        return <Phone className="h-4 w-4" />
      case 'meeting':
        return <Calendar className="h-4 w-4" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact not found</h2>
          <p className="text-gray-600 mb-4">The contact you're looking for doesn't exist.</p>
          <Link to="/contacts">
            <Button>Back to Contacts</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/contacts">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Contacts
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {contact.full_name}
                </h1>
                <p className="text-gray-600">{contact.company}</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Send className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Send Email</DialogTitle>
                    <DialogDescription>
                      Send a tracked email to {contact.full_name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSendEmail} className="space-y-4">
                    <div>
                      <Label htmlFor="to">To</Label>
                      <Input
                        id="to"
                        value={contact.email}
                        disabled
                        className="bg-gray-50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        name="subject"
                        required
                        placeholder="Email subject"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content">Message</Label>
                      <Textarea
                        id="content"
                        name="content"
                        required
                        rows={6}
                        placeholder="Your message..."
                      />
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-blue-600">
                      <Eye className="h-4 w-4" />
                      <span>This email will be automatically tracked for opens and clicks</span>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={sendingEmail}>
                        {sendingEmail ? 'Sending...' : 'Send Email'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Contact</DialogTitle>
                    <DialogDescription>
                      Update contact information
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEditContact} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          name="first_name"
                          defaultValue={contact.first_name}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          name="last_name"
                          defaultValue={contact.last_name}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={contact.email}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        defaultValue={contact.phone}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        name="company"
                        defaultValue={contact.company}
                      />
                    </div>
                    <div>
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        name="website"
                        defaultValue={contact.website}
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        name="address"
                        defaultValue={contact.address}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        defaultValue={contact.notes}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updating}>
                        {updating ? 'Updating...' : 'Update Contact'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Contact</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete {contact.full_name}? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleDeleteContact} disabled={deleting}>
                      {deleting ? 'Deleting...' : 'Delete Contact'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                  <span>{contact.email}</span>
                </div>
                {contact.phone && (
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-gray-400" />
                    <span>{contact.company}</span>
                  </div>
                )}
                {contact.website && (
                  <div className="flex items-center space-x-3">
                    <Globe className="h-5 w-5 text-gray-400" />
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {contact.website}
                    </a>
                  </div>
                )}
                {contact.address && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <span>{contact.address}</span>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Created {new Date(contact.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    Updated {new Date(contact.updated_at).toLocaleDateString()}
                  </p>
                </div>
                {contact.notes && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                    <p className="text-sm text-gray-600">{contact.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Email Threads */}
            {threads.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Email Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {threads.map((thread) => (
                      <div
                        key={thread.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleViewThread(thread.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm truncate">{thread.subject}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {thread.reply_count} replies
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Last activity: {formatTimestamp(thread.last_activity_at)}</span>
                          <Reply className="h-3 w-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length > 0 ? (
                  <div className="space-y-4">
                    {timeline.map((item) => (
                      <div key={item.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                        <div className="flex-shrink-0 mt-1">
                          {getActivityIcon(item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">
                              {item.subject}
                            </p>
                            <div className="flex items-center space-x-2">
                              {item.type === 'email' && item.opens > 0 && (
                                <div className="flex items-center space-x-1 text-xs text-green-600">
                                  <Eye className="h-3 w-3" />
                                  <span>{item.opens} opens</span>
                                </div>
                              )}
                              {item.type === 'email' && item.clicks > 0 && (
                                <div className="flex items-center space-x-1 text-xs text-blue-600">
                                  <MousePointer className="h-3 w-3" />
                                  <span>{item.clicks} clicks</span>
                                </div>
                              )}
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                <span>{formatTimestamp(item.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.content}
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge variant={item.direction === 'outbound' ? 'default' : 'secondary'}>
                              {item.direction === 'outbound' ? 'Sent' : 'Received'}
                            </Badge>
                            <Badge variant="outline">
                              {item.type}
                            </Badge>
                            {item.status && (
                              <Badge variant={item.status === 'completed' ? 'default' : 'secondary'}>
                                {item.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                    <p className="text-gray-600">Start by sending an email to this contact.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Email Thread Dialog */}
      <EmailThread
        threadId={selectedThreadId}
        isOpen={threadDialogOpen}
        onClose={() => setThreadDialogOpen(false)}
        contactName={contact.full_name}
      />
    </div>
  )
}

