"use client"

import { useState, useEffect } from "react"
import { useEmailSignature } from "../signature/SignatureManager"
import ContactAutocomplete from "./ContactAutocomplete"
import { Contact } from "@/utils/contactSearch"
import { emailTemplateAPI, EmailTemplate, handleAPIError } from "@/lib/api"
import { getAuthHeaders } from "@/lib/auth"

interface EmailComposeProps {
  isOpen: boolean
  onClose: () => void
  recipientEmail?: string
  recipientName?: string
  onSend: (email: EmailMessage) => void
  senderName?: string
  senderEmail?: string
}

export interface EmailMessage {
  id: string
  to: string
  subject: string
  message: string
  timestamp: Date
  fromSelf: boolean
}

export default function EmailCompose({ isOpen, onClose, recipientEmail, recipientName, onSend, senderName, senderEmail }: EmailComposeProps) {
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [toEmail, setToEmail] = useState(recipientEmail || "")
  const [toName, setToName] = useState(recipientName || "")
  const [toSearchValue, setToSearchValue] = useState("")
  const [selectedRecipients, setSelectedRecipients] = useState<Contact[]>([])
  const [isSending, setIsSending] = useState(false)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const { getSignatureText, isLoaded } = useEmailSignature()

  // Load templates when component opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  // Add signature to message when component loads or when signature changes
  useEffect(() => {
    if (isLoaded && isOpen) {
      const signatureText = getSignatureText()
      if (signatureText && !message.includes(signatureText)) {
        setMessage(prev => prev + signatureText)
      }
    }
  }, [isLoaded, isOpen, getSignatureText])

  const loadTemplates = async () => {
    try {
      const templatesData = await emailTemplateAPI.getAll({ limit: 50 })
      setTemplates(templatesData)
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  // Set initial recipients when component opens
  useEffect(() => {
    if (recipientEmail && recipientName) {
      setSelectedRecipients([{
        id: Date.now().toString(),
        firstName: recipientName.split(' ')[0] || '',
        lastName: recipientName.split(' ').slice(1).join(' ') || '',
        email: recipientEmail,
        status: 'Active'
      }])
      setToSearchValue("")
    } else {
      setSelectedRecipients([])
      setToSearchValue("")
    }
  }, [recipientEmail, recipientName, isOpen])

  const handleContactSelect = (contact: Contact) => {
    // Add contact to recipients if not already selected
    if (!selectedRecipients.find(r => r.email === contact.email)) {
      setSelectedRecipients(prev => [...prev, contact])
    }
    setToSearchValue("")
    setSelectedContact(contact)
  }

  const removeRecipient = (email: string) => {
    setSelectedRecipients(prev => prev.filter(r => r.email !== email))
  }

  const handleTemplateSelect = async (template: EmailTemplate) => {
    try {
      // Use template API to get processed content with variables replaced
      const processedTemplate = await emailTemplateAPI.use(template.id, {
        contact_id: selectedContact?.id,
        // company_id could be passed if available
      })
      
      setSubject(processedTemplate.subject)
      setMessage(processedTemplate.body)
      setShowTemplates(false)
    } catch (error) {
      console.error('Failed to use template:', error)
      // Fallback to using template as-is
      setSubject(template.subject)
      setMessage(template.body)
      setShowTemplates(false)
    }
  }

  const handleSearchValueChange = (value: string) => {
    setToSearchValue(value)
    
    // If user is typing a plain email, update toEmail
    if (value.includes('@') && !value.includes('<')) {
      setToEmail(value)
      setToName('')
    }
  }

  // Add email on Enter key or when losing focus with valid email
  const handleAddEmailOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && toSearchValue.includes('@')) {
      e.preventDefault()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (emailRegex.test(toSearchValue.trim())) {
        handleContactSelect({
          id: Date.now().toString(),
          firstName: toSearchValue.split('@')[0],
          lastName: '',
          email: toSearchValue.trim(),
          status: 'Active'
        })
      }
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || selectedRecipients.length === 0) return

    setIsSending(true)
    
    try {
      // Send email to all recipients
      const recipientEmails = selectedRecipients.map(r => r.email)
      const recipientNames = selectedRecipients.map(r => `${r.firstName} ${r.lastName}`).join(', ')
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          to: recipientEmails, // Send array of emails
          subject: subject.trim(),
          message: message.trim(),
          contactName: recipientNames,
          senderName: senderName,
          senderEmail: senderEmail
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email')
      }

      // Create email message for UI
      const emailMessage: EmailMessage = {
        id: result.messageId || Date.now().toString(),
        to: recipientEmails.join(', '),
        subject: subject.trim(),
        message: message.trim(),
        timestamp: new Date(),
        fromSelf: true
      }

      console.log('Email sent successfully:', result)
      if (result.debug) {
        console.log('Email tracking debug:', result.debug)
      }
      
      onSend(emailMessage)
      setSubject("")
      setMessage("")
      setSelectedRecipients([])
      setToSearchValue("")
      setIsSending(false)
      onClose()

      // Show success feedback
      alert(`Email sent successfully to ${recipientEmails.length} recipient${recipientEmails.length > 1 ? 's' : ''}!`)

    } catch (error) {
      console.error('Failed to send email:', error)
      setIsSending(false)
      
      // Show error feedback
      alert(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Compose Email</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-3 py-1 text-sm border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!subject.trim() || !message.trim() || selectedRecipients.length === 0 || isSending}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !selectedRecipients.length ? "Add at least one recipient" :
                !subject.trim() ? "Add a subject" :
                !message.trim() ? "Add a message" :
                "Send email"
              }
            >
              {isSending ? "Sending..." : `Send${selectedRecipients.length > 1 ? ` to ${selectedRecipients.length}` : ""}`}
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium mb-1">From:</label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {senderName || 'Sales Team'} &lt;{senderEmail || 'noreply@nothubspot.app'}&gt;
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To:</label>
            
            {/* Selected Recipients */}
            {selectedRecipients.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedRecipients.map((recipient) => (
                  <div
                    key={recipient.email}
                    className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-sm flex items-center gap-1"
                  >
                    {recipient.firstName} {recipient.lastName} &lt;{recipient.email}&gt;
                    <button
                      type="button"
                      onClick={() => removeRecipient(recipient.email)}
                      className="text-gray-600 hover:text-gray-800 ml-1"
                      title="Remove recipient"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Contact Search - only show if not in single recipient mode */}
            {!recipientEmail && (
              <div>
                <ContactAutocomplete
                  value={toSearchValue}
                  onChange={handleSearchValueChange}
                  onSelectContact={handleContactSelect}
                  placeholder="Type contact name or email to add recipients..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tip: Type an email address and press Enter to add it, or select from contacts
                </p>
              </div>
            )}

            {/* Single recipient display - when opened with specific recipient */}
            {recipientEmail && (
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {recipientName} &lt;{recipientEmail}&gt;
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="subject" className="block text-sm font-medium">Subject:</label>
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                📄 Use Template
              </button>
            </div>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter subject..."
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Template Selection */}
          {showTemplates && (
            <div className="border rounded-md p-3 bg-gray-50">
              <h4 className="text-sm font-medium mb-2">Select a Template:</h4>
              {templates.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full text-left p-2 text-sm border border-gray-200 rounded hover:bg-white hover:border-gray-400 transition-colors"
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-gray-600 text-xs truncate">{template.subject}</div>
                      {template.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                          {template.category}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No templates available</p>
              )}
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex-1">
            <label htmlFor="message" className="block text-sm font-medium mb-1">Message:</label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={10}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}