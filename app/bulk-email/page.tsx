"use client"

import { useState, useEffect, useMemo } from "react"
import MainLayout from "@/components/MainLayout"
import { 
  Send, Search, Users, Eye, Code, CheckSquare, Square,
  AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp,
  Mail, X, Filter
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

export default function BulkEmailPage() {
  // Form state
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlContent, setHtmlContent] = useState("")
  
  // Contacts state
  const [contacts, setContacts] = useState<BulkContact[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [companyFilter, setCompanyFilter] = useState("")
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  
  // UI state
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<SendResult | null>(null)
  const [error, setError] = useState("")

  // Load contacts on mount
  useEffect(() => {
    fetchContacts()
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
      // Deselect all filtered
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredContacts.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      // Select all filtered
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
    
    // Replace template variables with sample data
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

  // Send bulk email
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

    setError("")
    setSending(true)
    setSendResult(null)

    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`${API_BASE_URL}/api/bulk-email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contact_ids: Array.from(selectedIds),
          subject: subject.trim(),
          html_content: htmlContent,
          from_email: fromEmail.trim() || undefined,
          from_name: fromName.trim() || undefined,
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to send emails')
      }

      const result: SendResult = await res.json()
      setSendResult(result)
    } catch (err: any) {
      setError(err.message || 'Failed to send emails')
    } finally {
      setSending(false)
    }
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Mail className="w-7 h-7" style={{ color: 'var(--color-primary)' }} />
            Bulk Email
          </h1>
          <p className="text-muted-foreground mt-1">
            Send personalized emails to multiple contacts at once
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

          {/* Right: Compose / Preview */}
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
              </div>

              <div className="p-4">
                {activeTab === "compose" ? (
                  <div className="space-y-4">
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

                    {/* HTML Content */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        HTML Email Content
                      </label>
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
                  </div>
                ) : (
                  /* Preview Tab */
                  <div>
                    <div className="mb-3 p-3 bg-gray-50 rounded-md text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="text-gray-500">From:</span> {fromName || "(default)"} &lt;{fromEmail || "(default)"}&gt;</div>
                        <div><span className="text-gray-500">To:</span> {selectedIds.size} recipient{selectedIds.size !== 1 ? 's' : ''}</div>
                        <div className="col-span-2"><span className="text-gray-500">Subject:</span> {subject || "(no subject)"}</div>
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
                )}
              </div>

              {/* Send button */}
              <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {selectedIds.size === 0 ? (
                      <span className="text-amber-600">Select recipients to send</span>
                    ) : (
                      <span>Ready to send to <strong>{selectedIds.size}</strong> contact{selectedIds.size !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || selectedIds.size === 0 || !subject.trim() || !htmlContent.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Emails
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
