"use client"

import { useState, useEffect, useMemo } from "react"
import MainLayout from "@/components/MainLayout"
import { 
  Send, Search, Users, Eye, Code, CheckSquare, Square,
  AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp,
  Mail, X, Filter, Clock, Calendar, Trash2, Pencil, Save, BookOpen, FileText
} from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

interface BulkContact {
  id: number
  first_name: string
  last_name: string
  email: string
  company_name?: string
  title?: string
  status: string
}

interface SendResult {
  success_count: number
  error_count: number
  skipped_count: number
  total: number
  skipped: Array<{ contact: string; reason: string }>
  errors: Array<{ contact: string; email: string; reason: string }>
  message: string
}

interface ScheduleResult {
  scheduled: boolean
  scheduled_email_id: number
  scheduled_at: string
  contact_count: number
  message: string
}

interface ScheduledEmail {
  id: number
  subject: string
  from_email: string
  from_name: string
  contact_count: number
  scheduled_at: string
  schedule_timezone: string | null
  status: string
  sent_at: string | null
  result: any
  created_at: string
}

interface EmailTemplate {
  id: number
  name: string
  subject: string | null
  description: string | null
  html_content: string
  created_at: string
  updated_at: string
}

export default function BulkEmailPage() {
  // Form state
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [bccEmail, setBccEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlContent, setHtmlContent] = useState("")
  
  // Schedule state
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("08:00")
  const [scheduleTimezone, setScheduleTimezone] = useState("America/Chicago")
  
  // Contacts state
  const [contacts, setContacts] = useState<BulkContact[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // Scheduled emails state
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)
  
  // Edit state
  const [editingScheduledId, setEditingScheduledId] = useState<number | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)

  // UI state
  const [activeTab, setActiveTab] = useState<"compose" | "preview" | "scheduled">("compose")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [error, setError] = useState("")

  // Load contacts on mount
  useEffect(() => {
    fetchContacts()
    fetchScheduledEmails()
    fetchTemplates()
  }, [])

  const fetchContacts = async () => {
    setLoadingContacts(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/contacts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch contacts')
      const data = await res.json()
      setContacts(data)
    } catch (err) {
      console.error('Failed to fetch contacts:', err)
      setError('Failed to load contacts')
    } finally {
      setLoadingContacts(false)
    }
  }

  const fetchScheduledEmails = async () => {
    setLoadingScheduled(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/scheduled`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch scheduled emails')
      const data = await res.json()
      setScheduledEmails(data)
    } catch (err) {
      console.error('Failed to fetch scheduled emails:', err)
    } finally {
      setLoadingScheduled(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/email-templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to fetch templates')
      const data = await res.json()
      setTemplates(data)
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }

  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name')
      return
    }
    if (!htmlContent.trim()) {
      setError('No HTML content to save as template')
      return
    }
    setSavingTemplate(true)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/email-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: templateName.trim(),
          subject: subject.trim() || null,
          html_content: htmlContent,
          description: templateDescription.trim() || null,
        })
      })
      if (!res.ok) throw new Error('Failed to save template')
      await fetchTemplates()
      setShowSaveTemplate(false)
      setTemplateName('')
      setTemplateDescription('')
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const loadTemplate = (template: EmailTemplate) => {
    setHtmlContent(template.html_content)
    if (template.subject) setSubject(template.subject)
    setShowTemplateMenu(false)
  }

  const deleteTemplate = async (id: number) => {
    if (!confirm('Delete this template?')) return
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/email-templates/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to delete template')
      await fetchTemplates()
    } catch (err: any) {
      setError(err.message || 'Failed to delete template')
    }
  }

  const cancelScheduledEmail = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/scheduled/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to cancel')
      fetchScheduledEmails()
    } catch (err: any) {
      setError(err.message || 'Failed to cancel scheduled email')
    }
  }

  const deleteScheduledEmail = async (id: number) => {
    if (!confirm('Delete this entry?')) return
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/scheduled/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to delete')
      fetchScheduledEmails()
    } catch (err: any) {
      setError(err.message || 'Failed to delete scheduled email')
    }
  }

  const clearCompletedEmails = async () => {
    const toDelete = scheduledEmails.filter(e => e.status === 'cancelled' || e.status === 'sent' || e.status === 'failed')
    if (!confirm(`Delete ${toDelete.length} completed/cancelled entries?`)) return
    const token = localStorage.getItem('auth_token')
    for (const email of toDelete) {
      try {
        await fetch(`${API_BASE_URL}/api/bulk-email/scheduled/${email.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      } catch (err) {
        console.error(`Failed to delete scheduled email ${email.id}:`, err)
      }
    }
    fetchScheduledEmails()
  }

  const editScheduledEmail = async (id: number) => {
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/scheduled/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed to load scheduled email')
      const data = await res.json()
      
      // Populate the form with the scheduled email data
      setSubject(data.subject || '')
      setHtmlContent(data.html_content || '')
      setFromEmail(data.from_email || '')
      setFromName(data.from_name || '')
      setBccEmail(data.bcc_email || '')
      
      // Select the contacts
      if (data.contact_ids && data.contact_ids.length > 0) {
        setSelectedIds(new Set(data.contact_ids))
      }
      
      // Set schedule mode and parse the scheduled time
      setSendMode('schedule')
      if (data.scheduled_at) {
        const tz = data.schedule_timezone || 'America/Chicago'
        setScheduleTimezone(tz)
        // Convert UTC time to the scheduled timezone for the date/time inputs
        const d = new Date(data.scheduled_at)
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
        const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
        setScheduleDate(formatter.format(d)) // YYYY-MM-DD format
        const timeParts = timeFormatter.format(d) // HH:MM format
        setScheduleTime(timeParts.replace(/^24:/, '00:'))
      }
      
      setEditingScheduledId(id)
      setActiveTab('compose')
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduled email for editing')
    }
  }

  const saveScheduledEdit = async () => {
    if (!editingScheduledId) return
    if (selectedIds.size === 0) {
      setError('Please select at least one contact')
      return
    }
    if (!subject.trim()) {
      setError('Please enter a subject line')
      return
    }
    if (!htmlContent.trim()) {
      setError('Please paste your HTML email content')
      return
    }
    
    setSavingEdit(true)
    setError('')
    
    try {
      const token = localStorage.getItem('auth_token')
      const payload: any = {
        subject: subject.trim(),
        html_content: htmlContent,
        from_email: fromEmail.trim() || null,
        from_name: fromName.trim() || null,
        bcc_email: bccEmail.trim() || null,
        contact_ids: Array.from(selectedIds),
        scheduled_at: getScheduledAtISO(),
        schedule_timezone: scheduleTimezone,
      }
      
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/scheduled/${editingScheduledId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to update scheduled email')
      }
      
      // Success — reset form and go to scheduled tab
      cancelEdit()
      fetchScheduledEmails()
      setActiveTab('scheduled')
      setScheduleResult({ scheduled: true, scheduled_email_id: editingScheduledId, scheduled_at: '', contact_count: selectedIds.size, message: 'Scheduled email updated successfully' })
    } catch (err: any) {
      setError(err.message || 'Failed to update scheduled email')
    } finally {
      setSavingEdit(false)
    }
  }

  const cancelEdit = () => {
    setEditingScheduledId(null)
    setSelectedIds(new Set())
    setSubject('')
    setHtmlContent('')
    setFromEmail('')
    setFromName('')
    setBccEmail('')
    setSendMode('now')
    setScheduleDate('')
    setScheduleTime('08:00')
    setError('')
  }

  // Filter contacts based on search and company
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const matchesSearch = !searchTerm || 
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.company_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCompany = !companyFilter || 
        (c.company_name || '').toLowerCase().includes(companyFilter.toLowerCase())
      
      return matchesSearch && matchesCompany
    })
  }, [contacts, searchTerm, companyFilter])

  // Get unique company names for filter
  const companyNames = useMemo(() => {
    const names = new Set(contacts.map(c => c.company_name).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [contacts])

  // Selection helpers
  const toggleContact = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredContacts.map(c => c.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredContacts.every(c => selectedIds.has(c.id))
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredContacts.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredContacts.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  // Preview HTML with sample data
  const previewHtml = useMemo(() => {
    if (!htmlContent) return "<p style='color: #999; text-align: center; padding: 40px;'>Paste your HTML content to see a preview</p>"
    
    let preview = htmlContent
    const sampleContact = selectedIds.size > 0 
      ? contacts.find(c => selectedIds.has(c.id)) 
      : contacts[0]
    
    if (sampleContact) {
      preview = preview
        .replace(/\{\{contact\.first_name\}\}/g, sampleContact.first_name)
        .replace(/\{\{contact\.last_name\}\}/g, sampleContact.last_name)
        .replace(/\{\{contact\.email\}\}/g, sampleContact.email)
        .replace(/\{\{contact\.company_name\}\}/g, sampleContact.company_name || '')
        .replace(/\{\{contact\.title\}\}/g, sampleContact.title || '')
        .replace(/\{\{first_name\}\}/g, sampleContact.first_name)
        .replace(/\{\{last_name\}\}/g, sampleContact.last_name)
        .replace(/\{\{email\}\}/g, sampleContact.email)
        .replace(/\{\{company_name\}\}/g, sampleContact.company_name || '')
    }
    
    return preview
  }, [htmlContent, contacts, selectedIds])

  // Convert schedule datetime in selected timezone to UTC ISO string
  // Uses hardcoded offsets based on whether DST is active for the date
  const getScheduledAtISO = (): string | null => {
    if (sendMode !== "schedule" || !scheduleDate || !scheduleTime) return null
    
    // Hardcoded UTC offsets in hours (negative = behind UTC)
    // DST runs roughly Mar second Sunday to Nov first Sunday
    const isDST = (() => {
      const d = new Date(`${scheduleDate}T12:00:00Z`)
      const month = d.getUTCMonth() // 0-indexed
      if (month > 2 && month < 10) return true  // Apr-Oct always DST
      if (month < 2 || month > 10) return false  // Jan-Feb, Dec never DST
      // March or November - approximate
      if (month === 2) return d.getUTCDate() >= 10 // After ~Mar 10
      return d.getUTCDate() < 3 // Before ~Nov 3
    })()
    
    const offsets: Record<string, number> = {
      'America/New_York': isDST ? -4 : -5,
      'America/Chicago': isDST ? -5 : -6,
      'America/Denver': isDST ? -6 : -7,
      'America/Los_Angeles': isDST ? -7 : -8,
      'UTC': 0
    }
    
    const offsetHours = offsets[scheduleTimezone] ?? -5 // default CDT
    
    // Parse the user's time as a pure number, add the negative offset to get UTC
    // e.g., user says 14:00 Chicago CDT (offset -5) => UTC = 14:00 - (-5) = 19:00
    const [hours, minutes] = scheduleTime.split(':').map(Number)
    const userMinutes = hours * 60 + minutes
    const utcMinutes = userMinutes - offsetHours * 60 // subtract offset (offset is negative, so this adds)
    
    // Handle day rollover
    let utcDay = new Date(`${scheduleDate}T00:00:00Z`)
    let finalMinutes = utcMinutes
    if (finalMinutes >= 1440) {
      finalMinutes -= 1440
      utcDay = new Date(utcDay.getTime() + 86400000)
    } else if (finalMinutes < 0) {
      finalMinutes += 1440
      utcDay = new Date(utcDay.getTime() - 86400000)
    }
    
    const utcH = Math.floor(finalMinutes / 60).toString().padStart(2, '0')
    const utcM = (finalMinutes % 60).toString().padStart(2, '0')
    const utcDateStr = utcDay.toISOString().split('T')[0]
    
    return `${utcDateStr}T${utcH}:${utcM}:00Z`
  }

  // Send or schedule bulk email
  const handleSend = async () => {
    if (selectedIds.size === 0) {
      setError("Please select at least one contact")
      return
    }
    if (!subject.trim()) {
      setError("Please enter a subject line")
      return
    }
    if (!htmlContent.trim()) {
      setError("Please paste your HTML email content")
      return
    }

    if (sendMode === "schedule") {
      if (!scheduleDate) {
        setError("Please select a date for scheduling")
        return
      }
      if (!scheduleTime) {
        setError("Please select a time for scheduling")
        return
      }
    }

    setError("")
    setSending(true)
    setSendResult(null)
    setScheduleResult(null)

    try {
      const token = localStorage.getItem('auth_token')
      const payload: any = {
        contact_ids: Array.from(selectedIds),
        subject: subject.trim(),
        html_content: htmlContent,
        from_email: fromEmail.trim() || undefined,
        from_name: fromName.trim() || undefined,
        bcc_email: bccEmail.trim() || undefined,
      }

      if (sendMode === "schedule") {
        payload.scheduled_at = getScheduledAtISO()
        payload.schedule_timezone = scheduleTimezone
      }

      const res = await fetch(`${API_BASE_URL}/api/bulk-email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to send emails')
      }

      const result = await res.json()
      
      if (result.scheduled) {
        setScheduleResult(result as ScheduleResult)
        fetchScheduledEmails()
        // Reset form after successful schedule
        setSelectedIds(new Set())
        setSubject("")
        setHtmlContent("")
        setBccEmail("")
        setSendMode("now")
        setScheduleDate("")
        setScheduleTime("08:00")
        setActiveTab("scheduled")
      } else {
        setSendResult(result as SendResult)
        // Reset form after successful send
        setSelectedIds(new Set())
        setSubject("")
        setHtmlContent("")
        setBccEmail("")
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send emails')
    } finally {
      setSending(false)
    }
  }

  const formatScheduledDate = (isoStr: string, timezone?: string | null) => {
    try {
      const d = new Date(isoStr)
      const opts: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }
      // If we have the original timezone, display in that timezone
      if (timezone) {
        opts.timeZone = timezone
      }
      return d.toLocaleString('en-US', opts)
    } catch {
      return isoStr
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'sending': return 'bg-blue-100 text-blue-800'
      case 'sent': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold flex items-center gap-3">
            <Mail className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
            Bulk Email
          </h1>
          <p className="text-muted-foreground mt-1">
            Send personalized emails to multiple contacts — now or scheduled for later
          </p>
        </div>

        {/* Send Result Banner */}
        {sendResult && (
          <div className={`mb-6 p-4 rounded-lg border ${
            sendResult.error_count === 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start gap-3">
              <CheckCircle className={`w-5 h-5 mt-0.5 ${
                sendResult.error_count === 0 ? 'text-green-600' : 'text-yellow-600'
              }`} />
              <div className="flex-1">
                <p className="font-medium">{sendResult.message}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-green-700">Sent: {sendResult.success_count}</span>
                  {sendResult.skipped_count > 0 && (
                    <span className="text-gray-600">Skipped: {sendResult.skipped_count}</span>
                  )}
                  {sendResult.error_count > 0 && (
                    <span className="text-red-600">Errors: {sendResult.error_count}</span>
                  )}
                </div>
                {sendResult.skipped.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                      View skipped contacts ({sendResult.skipped_count})
                    </summary>
                    <ul className="mt-1 space-y-1 pl-4">
                      {sendResult.skipped.map((s, i) => (
                        <li key={i} className="text-gray-600">{s.contact}: {s.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {sendResult.errors.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800">
                      View errors ({sendResult.error_count})
                    </summary>
                    <ul className="mt-1 space-y-1 pl-4">
                      {sendResult.errors.map((e, i) => (
                        <li key={i} className="text-red-600">{e.contact} ({e.email}): {e.reason}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
              <button onClick={() => setSendResult(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Schedule Result Banner */}
        {scheduleResult && (
          <div className="mb-6 p-4 rounded-lg border bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 mt-0.5 text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-blue-900">{scheduleResult.message}</p>
                <p className="text-sm text-blue-700 mt-1">
                  You can view and manage scheduled emails in the "Scheduled" tab.
                </p>
              </div>
              <button onClick={() => setScheduleResult(null)} className="text-blue-400 hover:text-blue-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border bg-red-50 border-red-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800">{error}</p>
              <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Contact Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border shadow-sm">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Recipients
                  </h2>
                  <span className="text-sm px-2 py-0.5 rounded-full" style={{ 
                    backgroundColor: 'var(--color-primary-light, #EBF5FF)', 
                    color: 'var(--color-primary)' 
                  }}>
                    {selectedIds.size} selected
                  </span>
                </div>
                
                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Company filter */}
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-2"
                >
                  <Filter className="w-3 h-3" />
                  Filter by company
                  {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                
                {showFilters && (
                  <select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                    className="w-full text-sm border rounded-md px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All companies</option>
                    {companyNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}

                {/* Select all / deselect */}
                <div className="flex gap-2">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50 transition-colors"
                  >
                    {filteredContacts.every(c => selectedIds.has(c.id)) && filteredContacts.length > 0
                      ? "Deselect All" 
                      : `Select All (${filteredContacts.length})`
                    }
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={deselectAll}
                      className="text-xs px-2 py-1 rounded border text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Contact list */}
              <div className="max-h-[500px] overflow-y-auto">
                {loadingContacts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading contacts...</span>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No contacts found
                  </div>
                ) : (
                  filteredContacts.map(contact => (
                    <div
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
                        selectedIds.has(contact.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      {selectedIds.has(contact.id) ? (
                        <CheckSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                      ) : (
                        <Square className="w-4 h-4 flex-shrink-0 text-gray-300" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                        {contact.company_name && (
                          <p className="text-xs text-gray-400 truncate">{contact.company_name}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Compose / Preview / Scheduled */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border shadow-sm">
              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab("compose")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "compose"
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Compose
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "preview"
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => { setActiveTab("scheduled"); fetchScheduledEmails(); }}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "scheduled"
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Scheduled
                  {scheduledEmails.filter(s => s.status === 'pending').length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                      {scheduledEmails.filter(s => s.status === 'pending').length}
                    </span>
                  )}
                </button>
              </div>

              <div className="p-4">
                {activeTab === "compose" ? (
                  <div className="space-y-4">
                    {/* Editing Banner */}
                    {editingScheduledId && (
                      <div className="p-3 rounded-lg border bg-blue-50 border-blue-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Pencil className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Editing scheduled email</span>
                        </div>
                        <button
                          onClick={cancelEdit}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                        >
                          Cancel Edit
                        </button>
                      </div>
                    )}
                    {/* From fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          From Name
                        </label>
                        <input
                          type="text"
                          value={fromName}
                          onChange={(e) => setFromName(e.target.value)}
                          placeholder="e.g. AIOps Team"
                          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          From Email
                        </label>
                        <input
                          type="email"
                          value={fromEmail}
                          onChange={(e) => setFromEmail(e.target.value)}
                          placeholder="e.g. rick@aiop.one"
                          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* BCC */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        BCC <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={bccEmail}
                        onChange={(e) => setBccEmail(e.target.value)}
                        placeholder="e.g. tracking@aiop.one — receives a copy of every sent email"
                        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        This address will be BCC'd on every email sent to each recipient
                      </p>
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Subject Line
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Thank You for Attending the AIOps Conference!"
                        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Supports variables: {"{{first_name}}"}, {"{{last_name}}"}, {"{{company_name}}"}
                      </p>
                    </div>

                    {/* HTML Content with Template Controls */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                          HTML Email Content
                        </label>
                        <div className="flex items-center gap-2">
                          {/* Load Template */}
                          <div className="relative">
                            <button
                              onClick={() => { setShowTemplateMenu(!showTemplateMenu); setShowSaveTemplate(false); }}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border hover:bg-gray-50 transition-colors text-gray-600"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Templates {templates.length > 0 && `(${templates.length})`}
                            </button>
                            {showTemplateMenu && (
                              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg border shadow-lg z-50 max-h-64 overflow-y-auto">
                                {templates.length === 0 ? (
                                  <div className="p-4 text-center text-sm text-gray-500">
                                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    No saved templates yet
                                  </div>
                                ) : (
                                  templates.map(t => (
                                    <div key={t.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 border-b last:border-b-0">
                                      <button
                                        onClick={() => loadTemplate(t)}
                                        className="flex-1 text-left min-w-0"
                                      >
                                        <p className="text-sm font-medium truncate">{t.name}</p>
                                        {t.subject && <p className="text-xs text-gray-400 truncate">Subject: {t.subject}</p>}
                                        {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                                        className="ml-2 p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
                                        title="Delete template"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                          {/* Save as Template */}
                          <div className="relative">
                            <button
                              onClick={() => { setShowSaveTemplate(!showSaveTemplate); setShowTemplateMenu(false); }}
                              disabled={!htmlContent.trim()}
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save as Template
                            </button>
                            {showSaveTemplate && (
                              <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg border shadow-lg z-50 p-3">
                                <p className="text-sm font-medium mb-2">Save Current Email as Template</p>
                                <input
                                  type="text"
                                  value={templateName}
                                  onChange={(e) => setTemplateName(e.target.value)}
                                  placeholder="Template name (e.g. Welcome Email)"
                                  className="w-full px-2.5 py-1.5 text-sm border rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                <input
                                  type="text"
                                  value={templateDescription}
                                  onChange={(e) => setTemplateDescription(e.target.value)}
                                  placeholder="Description (optional)"
                                  className="w-full px-2.5 py-1.5 text-sm border rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => { setShowSaveTemplate(false); setTemplateName(''); setTemplateDescription(''); }}
                                    className="text-xs px-3 py-1.5 rounded border hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={saveAsTemplate}
                                    disabled={savingTemplate || !templateName.trim()}
                                    className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {savingTemplate ? 'Saving...' : 'Save Template'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <textarea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        placeholder="Paste your HTML email content here..."
                        rows={18}
                        className="w-full px-3 py-2 text-sm border rounded-md font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ resize: 'vertical' }}
                      />
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-400">
                          Available variables: {"{{contact.first_name}}"}, {"{{contact.last_name}}"}, {"{{contact.email}}"}, {"{{contact.company_name}}"}, {"{{contact.title}}"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {htmlContent.length.toLocaleString()} chars
                        </p>
                      </div>
                    </div>

                    {/* Send Mode Toggle */}
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sendMode"
                            checked={sendMode === "now"}
                            onChange={() => setSendMode("now")}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <Send className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium">Send Now</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sendMode"
                            checked={sendMode === "schedule"}
                            onChange={() => setSendMode("schedule")}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <Clock className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium">Schedule for Later</span>
                        </label>
                      </div>

                      {sendMode === "schedule" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                            <input
                              type="date"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                            <select
                              value={scheduleTimezone}
                              onChange={(e) => setScheduleTimezone(e.target.value)}
                              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="America/New_York">Eastern (ET)</option>
                              <option value="America/Chicago">Central (CT)</option>
                              <option value="America/Denver">Mountain (MT)</option>
                              <option value="America/Los_Angeles">Pacific (PT)</option>
                              <option value="UTC">UTC</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeTab === "preview" ? (
                  /* Preview Tab */
                  <div>
                    <div className="mb-3 p-3 bg-gray-50 rounded-md text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-gray-500">From:</span> {fromName || "(default)"} &lt;{fromEmail || "(default)"}&gt;</div>
                        <div><span className="text-gray-500">To:</span> {selectedIds.size} recipient{selectedIds.size !== 1 ? 's' : ''}</div>
                        {bccEmail && <div><span className="text-gray-500">BCC:</span> {bccEmail}</div>}
                        <div className="col-span-2"><span className="text-gray-500">Subject:</span> {subject || "(no subject)"}</div>
                        {sendMode === "schedule" && scheduleDate && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Scheduled:</span>{' '}
                            <span className="text-blue-600 font-medium">
                              {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              })} {scheduleTimezone.includes('Chicago') ? 'CT' : scheduleTimezone.includes('New_York') ? 'ET' : scheduleTimezone.includes('Denver') ? 'MT' : scheduleTimezone.includes('Los_Angeles') ? 'PT' : 'UTC'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div 
                      className="border rounded-md p-4 min-h-[400px] bg-white"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                    {selectedIds.size > 0 && contacts.find(c => selectedIds.has(c.id)) && (
                      <p className="text-xs text-gray-400 mt-2">
                        Preview shown with data from: {(() => {
                          const c = contacts.find(c => selectedIds.has(c.id))!
                          return `${c.first_name} ${c.last_name} (${c.email})`
                        })()}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Scheduled Emails Tab */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-800">Scheduled Emails</h3>
                      <div className="flex items-center gap-3">
                        {scheduledEmails.some(e => e.status === 'cancelled' || e.status === 'sent' || e.status === 'failed') && (
                          <button
                            onClick={clearCompletedEmails}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear Old
                          </button>
                        )}
                        <button
                          onClick={fetchScheduledEmails}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          <Loader2 className={`w-3 h-3 ${loadingScheduled ? 'animate-spin' : ''}`} />
                          Refresh
                        </button>
                      </div>
                    </div>

                    {loadingScheduled ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Loading...</span>
                      </div>
                    ) : scheduledEmails.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">No scheduled emails yet</p>
                        <p className="text-xs text-gray-400 mt-1">Schedule an email from the Compose tab</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {scheduledEmails.map(email => (
                          <div key={email.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-sm truncate">{email.subject}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(email.status)}`}>
                                    {email.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatScheduledDate(email.scheduled_at, email.schedule_timezone)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {email.contact_count} recipient{email.contact_count !== 1 ? 's' : ''}
                                  </span>
                                  {email.from_name && (
                                    <span>From: {email.from_name}</span>
                                  )}
                                </div>
                                {email.status === 'sent' && email.result && (
                                  <p className="text-xs text-green-600 mt-1">
                                    {email.result.message || `Sent ${email.result.success_count} emails`}
                                  </p>
                                )}
                                {email.status === 'failed' && email.result && (
                                  <p className="text-xs text-red-600 mt-1">
                                    {email.result.error || 'Failed to send'}
                                  </p>
                                )}
                              </div>
                              {email.status === 'pending' ? (
                                <div className="flex items-center gap-1 ml-3">
                                  <button
                                    onClick={() => editScheduledEmail(email.id)}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Edit scheduled email"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => cancelScheduledEmail(email.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Cancel scheduled email"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => deleteScheduledEmail(email.id)}
                                  className="ml-3 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Send/Schedule button - only show on compose and preview tabs */}
              {activeTab !== "scheduled" && (
                <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {selectedIds.size === 0 ? (
                        <span className="text-amber-600">Select recipients to send</span>
                      ) : sendMode === "schedule" && scheduleDate ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-blue-500" />
                          Schedule for <strong>{selectedIds.size}</strong> contact{selectedIds.size !== 1 ? 's' : ''} on{' '}
                          {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' at '}
                          {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      ) : (
                        <span>Ready to send to <strong>{selectedIds.size}</strong> contact{selectedIds.size !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {editingScheduledId ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border font-medium transition-all hover:bg-gray-50"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          onClick={saveScheduledEdit}
                          disabled={savingEdit || selectedIds.size === 0 || !subject.trim() || !htmlContent.trim() || !scheduleDate || !scheduleTime}
                          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                          style={{ backgroundColor: '#2563EB' }}
                        >
                          {savingEdit ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Pencil className="w-4 h-4" />
                              Update Scheduled Email
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSend}
                        disabled={sending || selectedIds.size === 0 || !subject.trim() || !htmlContent.trim() || (sendMode === "schedule" && (!scheduleDate || !scheduleTime))}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        style={{ backgroundColor: sendMode === "schedule" ? '#2563EB' : 'var(--color-primary)' }}
                      >
                        {sending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {sendMode === "schedule" ? "Scheduling..." : "Sending..."}
                          </>
                        ) : sendMode === "schedule" ? (
                          <>
                            <Clock className="w-4 h-4" />
                            Schedule Email
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send Emails
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
