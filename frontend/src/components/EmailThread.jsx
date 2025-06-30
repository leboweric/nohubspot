import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

const EmailThread = ({ threadId, isOpen, onClose, contactName }) => {
  const [thread, setThread] = useState(null)
  const [threadItems, setThreadItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && threadId) {
      loadThread()
    }
  }, [isOpen, threadId])

  const loadThread = async () => {
    setLoading(true)
    try {
      const response = await api.getEmailThread(threadId)
      if (response.success) {
        setThread(response.thread)
        setThreadItems(response.items)
      }
    } catch (error) {
      console.error('Error loading thread:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  const stripHtml = (html) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Conversation with {contactName}
            {thread && (
              <Badge variant="secondary" className="ml-2">
                {threadItems.length} messages
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {threadItems.map((item, index) => (
                <Card key={`${item.type}-${item.id}`} className={`${
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
                              {item.from_name || contactName} replied
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

                    <div className="mb-2">
                      <h4 className="font-medium text-gray-900">{item.subject}</h4>
                    </div>

                    <div className="text-sm text-gray-700 leading-relaxed">
                      {stripHtml(item.content)}
                    </div>

                    {item.direction === 'inbound' && item.from_email && (
                      <div className="mt-2 text-xs text-gray-500">
                        From: {item.from_email}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {threadItems.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  No messages in this thread yet.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {thread && (
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Thread started: {formatTimestamp(thread.created_at)}</span>
              <span>Last activity: {formatTimestamp(thread.last_activity_at)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default EmailThread

