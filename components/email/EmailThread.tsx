"use client"

import { useState } from "react"
import { EmailMessage } from "./EmailCompose"

interface EmailThreadProps {
  contactName: string
  contactEmail: string
  emails: EmailMessage[]
  onReply: (message: string) => void
  senderName?: string
  senderEmail?: string
}

export default function EmailThread({ contactName, contactEmail, emails, onReply, senderName, senderEmail }: EmailThreadProps) {
  const [replyMessage, setReplyMessage] = useState("")
  const [isReplying, setIsReplying] = useState(false)

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return

    setIsReplying(true)
    
    try {
      // Get the last email's subject for the reply
      const lastEmail = emails[emails.length - 1]
      const replySubject = lastEmail?.subject?.startsWith('Re: ') 
        ? lastEmail.subject 
        : `Re: ${lastEmail?.subject || 'Follow up'}`

      // Send reply via SendGrid API
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: contactEmail,
          subject: replySubject,
          message: replyMessage.trim(),
          contactName: contactName,
          senderName: senderName,
          senderEmail: senderEmail
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reply')
      }

      console.log('Reply sent successfully:', result)
      
      onReply(replyMessage.trim())
      setReplyMessage("")
      setIsReplying(false)

    } catch (error) {
      console.error('Failed to send reply:', error)
      setIsReplying(false)
      
      // Show error feedback
      alert(`Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const formatTime = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No email conversation yet</p>
        <p className="text-sm mt-1">Start a conversation by sending an email</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <div className="border-b p-4">
        <h3 className="font-semibold">{contactName}</h3>
        <p className="text-sm text-muted-foreground">{contactEmail}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`flex ${email.fromSelf ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-3 ${
                email.fromSelf
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              {/* Subject (only show if different from previous or first message) */}
              {email.subject && (
                <div className={`text-sm font-medium mb-2 ${
                  email.fromSelf ? 'text-primary-foreground/90' : 'text-muted-foreground'
                }`}>
                  Re: {email.subject}
                </div>
              )}
              
              {/* Message */}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {email.message}
              </div>
              
              {/* Timestamp */}
              <div className={`text-xs mt-2 ${
                email.fromSelf ? 'text-primary-foreground/70' : 'text-muted-foreground'
              }`}>
                {formatTime(email.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Type your reply..."
            rows={3}
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSendReply()
              }
            }}
          />
          <button
            onClick={handleSendReply}
            disabled={!replyMessage.trim() || isReplying}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 self-end"
          >
            {isReplying ? "..." : "Send"}
          </button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Press Cmd+Enter (Mac) or Ctrl+Enter (PC) to send
        </div>
      </div>
    </div>
  )
}