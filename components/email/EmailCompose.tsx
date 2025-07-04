"use client"

import { useState, useEffect } from "react"
import { useEmailSignature } from "../signature/SignatureManager"
import ContactAutocomplete from "./ContactAutocomplete"
import { Contact } from "@/utils/contactSearch"
import { emailTemplateAPI, EmailTemplate, handleAPIError } from "@/lib/api"

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

  // Set initial search value when component opens
  useEffect(() => {
    if (recipientEmail && recipientName) {
      setToSearchValue(`${recipientName} <${recipientEmail}>`)
    } else {
      setToSearchValue("")
    }
  }, [recipientEmail, recipientName, isOpen])

  const handleContactSelect = (contact: Contact) => {
    setToEmail(contact.email)
    setToName(`${contact.firstName} ${contact.lastName}`)
    setToSearchValue(`${contact.firstName} ${contact.lastName} <${contact.email}>`)
    setSelectedContact(contact)
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

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || !toEmail.trim()) return

    setIsSending(true)
    
    try {
      // Send email via SendGrid API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: subject.trim(),
          message: message.trim(),
          contactName: toName.trim(),
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
        to: toEmail.trim(),
        subject: subject.trim(),
        message: message.trim(),
        timestamp: new Date(),
        fromSelf: true
      }

      console.log('Email sent successfully:', result)
      
      onSend(emailMessage)
      setSubject("")
      setMessage("")
      setToEmail("")
      setToName("")
      setToSearchValue("")
      setIsSending(false)
      onClose()

      // Show success feedback
      alert('Email sent successfully!')

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
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">From:</label>
            <div className="px-3 py-2 bg-muted rounded-md text-sm">
              {senderName || 'Sales Team'} &lt;{senderEmail || 'noreply@nothubspot.app'}&gt;
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To:</label>
            {recipientEmail ? (
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {recipientName} &lt;{recipientEmail}&gt;
              </div>
            ) : (
              <ContactAutocomplete
                value={toSearchValue}
                onChange={handleSearchValueChange}
                onSelectContact={handleContactSelect}
                placeholder="Type contact name or email..."
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="subject" className="block text-sm font-medium">Subject:</label>
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
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
                      className="w-full text-left p-2 text-sm border border-gray-200 rounded hover:bg-white hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-gray-600 text-xs truncate">{template.subject}</div>
                      {template.category && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800">
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

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!subject.trim() || !message.trim() || !toEmail.trim() || isSending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  )
}