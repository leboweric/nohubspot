import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Mail, 
  Reply, 
  Clock, 
  User, 
  ArrowRight,
  ArrowLeft 
} from 'lucide-react'
import { api } from '../lib/api'

const EmailThread = ({ threadId }) => {
  const [thread, setThread] = useState(null)
  const [threadItems, setThreadItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (threadId) {
      loadThread()
    }
  }, [threadId])

  const loadThread = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('Loading thread:', threadId)
      const response = await api.getEmailThread(threadId)
      console.log('Thread response:', response)
      
      if (response.success) {
        setThread(response.thread)
        setThreadItems(response.items || [])
      } else {
        setError(response.error?.message || 'Failed to load thread')
      }
    } catch (error) {
      console.error('Error loading thread:', error)
      setError('Failed to load email thread')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time'
    
    try {
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return 'Invalid date'
      
      const now = new Date()
      const diffInHours = (now - date) / (1000 * 60 * 60)
      
      if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now - date) / (1000 * 60))
        return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`
      } else if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } else if (diffInHours < 168) { // 7 days
        return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error)
      return 'Invalid date'
    }
  }

  const stripHtml = (html) => {
    if (!html) return ''
    
    try {
      const tmp = document.createElement('div')
      tmp.innerHTML = html
      return tmp.textContent || tmp.innerText || ''
    } catch (error) {
      console.error('Error stripping HTML:', error)
      return html
    }
  }

  const getDisplayContent = (item) => {
    let content = item.content || item.content_text || item.content_html || ''
    
    if (!content || content.trim() === '') {
      return `${item.type} ${item.direction || ''} - ${item.subject || 'No subject'}`
    }
    
    // Strip HTML tags if it's HTML content
    if (content.includes('<') && content.includes('>')) {
      content = stripHtml(content)
    }
    
    return content.trim()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading thread</h3>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (!thread || !threadItems.length) {
    return (
      <div className="text-center py-8">
        <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
        <p className="text-gray-600">This thread appears to be empty.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Thread Header */}
      {thread && (
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">{thread.subject}</h3>
            <Badge variant="secondary" className="ml-2">
              {threadItems.length} messages
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
            <span>Thread started: {formatTimestamp(thread.created_at)}</span>
            <span>Last activity: {formatTimestamp(thread.last_activity_at)}</span>
          </div>
        </div>
      )}

      {/* Thread Messages */}
      <ScrollArea className="max-h-96 pr-4">
        <div className="space-y-4">
          {threadItems.map((item, index) => (
            <Card key={`${item.type}-${item.id || index}`} className={`${
              item.direction === 'outbound' 
                ? 'ml-8 border-blue-200 bg-blue-50' 
                : 'mr-8 border-green-200 bg-green-50'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.direction === 'outbound' ? (
                      <>
                        <ArrowRight className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-700">You sent</span>
                      </>
                    ) : (
                      <>
                        <ArrowLeft className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700">
                          {item.from_name || 'Contact'} replied
                        </span>
                      </>
                    )}
                    <Badge variant={item.direction === 'outbound' ? 'default' : 'secondary'}>
                      {item.type === 'email' ? 'Email' : 'Reply'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(item.timestamp)}
                  </div>
                </div>

                {/* Subject (if different from thread subject) */}
                {item.subject && item.subject !== thread.subject && (
                  <div className="mb-2">
                    <h4 className="font-medium text-gray-900">{item.subject}</h4>
                  </div>
                )}

                {/* Message Content */}
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {getDisplayContent(item)}
                </div>

                {/* From Email (for inbound messages) */}
                {item.direction === 'inbound' && item.from_email && (
                  <div className="mt-2 text-xs text-gray-500">
                    From: {item.from_email}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* Thread Summary */}
      {threadItems.length > 0 && (
        <div className="border-t pt-4 text-sm text-gray-500">
          <p>
            This thread contains {threadItems.filter(i => i.direction === 'outbound').length} sent message(s) 
            and {threadItems.filter(i => i.direction === 'inbound').length} received message(s).
          </p>
        </div>
      )}
    </div>
  )
}

export default EmailThread
