import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
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
  Calendar
} from 'lucide-react'
import { api } from '../lib/api'

export default function ContactDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [contact, setContact] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (id) {
      loadContactData()
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
        // Reload timeline to show the new email
        loadContactData()
      }
    } catch (error) {
      console.error('Failed to send email:', error)
    } finally {
      setSendingEmail(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getTimelineIcon = (type) => {
    switch (type) {
      case 'email':
        return Mail
      case 'call':
        return Phone
      case 'note':
        return Edit
      default:
        return Calendar
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="lg:col-span-2">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium text-gray-900 mb-2">Contact not found</h2>
        <p className="text-gray-600 mb-4">The contact you're looking for doesn't exist.</p>
        <Link to="/contacts">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Contacts
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link to="/contacts">
            <Button variant="ghost" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {contact.full_name || contact.email}
            </h1>
            <p className="text-gray-600 mt-1">
              {contact.job_title && contact.company 
                ? `${contact.job_title} at ${contact.company}`
                : contact.job_title || contact.company || 'Contact details'
              }
            </p>
          </div>
        </div>
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700" disabled={!contact.email}>
              <Send className="mr-2 h-4 w-4" />
              Send Email
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Send Email</DialogTitle>
              <DialogDescription>
                Send a tracked email to {contact.full_name || contact.email}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input id="to" value={contact.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" placeholder="Email subject" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Message</Label>
                <Textarea 
                  id="content" 
                  name="content" 
                  placeholder="Write your email message here..."
                  rows={8}
                  required 
                />
              </div>
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                📊 This email will be automatically tracked for opens and clicks
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEmailDialogOpen(false)}
                  disabled={sendingEmail}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={sendingEmail}
                >
                  {sendingEmail ? 'Sending...' : 'Send Email'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="lg:col-span-1">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                  <span className="text-xl font-medium text-gray-700">
                    {contact.first_name?.[0] || contact.email?.[0] || '?'}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-medium">{contact.full_name || 'No name'}</h3>
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1
                    ${contact.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                    }
                  `}>
                    {contact.status}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contact.email && (
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-sm">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-sm">{contact.phone}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center">
                  <Building className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-sm">{contact.company}</span>
                </div>
              )}
              {contact.website && (
                <div className="flex items-center">
                  <Globe className="h-4 w-4 text-gray-400 mr-3" />
                  <a 
                    href={contact.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {contact.website}
                  </a>
                </div>
              )}
              {contact.address && (
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-gray-400 mr-3 mt-0.5" />
                  <span className="text-sm">{contact.address}</span>
                </div>
              )}
              {contact.notes && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600">{contact.notes}</p>
                </div>
              )}
              <div className="pt-4 border-t border-gray-200 text-xs text-gray-500">
                <p>Created {formatDate(contact.created_at)}</p>
                {contact.updated_at !== contact.created_at && (
                  <p>Updated {formatDate(contact.updated_at)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2">
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                  <p className="text-gray-600 mb-4">Start engaging with this contact to see activity here</p>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setEmailDialogOpen(true)}
                    disabled={!contact.email}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send First Email
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  {timeline.map((item) => {
                    const Icon = getTimelineIcon(item.type)
                    return (
                      <div key={item.id} className="flex">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <Icon className="h-4 w-4 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-4 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-900">
                              {item.subject}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                          {item.content && (
                            <p className="text-sm text-gray-600 mt-1">{item.content}</p>
                          )}
                          {item.type === 'email' && item.direction === 'outbound' && (
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <div className="flex items-center">
                                <Eye className="h-3 w-3 mr-1" />
                                Email sent
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

