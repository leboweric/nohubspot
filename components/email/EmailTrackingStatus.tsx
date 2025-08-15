"use client"

import { useState, useEffect } from "react"
import { emailTrackingAPI, EmailTracking } from "@/lib/api"

// Helper function to format relative time without date-fns
function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInMinutes < 1) return 'just now'
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
  
  // For older dates, show the actual date
  return date.toLocaleDateString()
}

interface EmailTrackingStatusProps {
  contactId?: number
  className?: string
}

export default function EmailTrackingStatus({ contactId, className = "" }: EmailTrackingStatusProps) {
  const [trackingRecords, setTrackingRecords] = useState<EmailTracking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTracking = async () => {
      try {
        setIsLoading(true)
        const records = await emailTrackingAPI.getAll({
          contact_id: contactId,
          limit: 10 // Show last 10 emails
        })
        setTrackingRecords(records)
      } catch (err) {
        console.error('Failed to fetch email tracking:', err)
        setError('Failed to load email tracking data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTracking()
  }, [contactId])

  if (isLoading) {
    return (
      <div className={`bg-card border rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Email Engagement</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-card border rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Email Engagement</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (trackingRecords.length === 0) {
    return (
      <div className={`bg-card border rounded-lg p-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Email Engagement</h3>
        <p className="text-sm text-muted-foreground">No emails sent yet</p>
      </div>
    )
  }

  return (
    <div className={`bg-card border rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Email Engagement</h3>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">
            {trackingRecords.length}
          </div>
          <div className="text-xs text-muted-foreground">Emails Sent</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-700">
            {trackingRecords.filter(r => r.open_count > 0).length}
          </div>
          <div className="text-xs text-muted-foreground">Opened</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-700">
            {trackingRecords.filter(r => r.click_count > 0).length}
          </div>
          <div className="text-xs text-muted-foreground">Clicked</div>
        </div>
      </div>

      {/* Recent Emails */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Recent Emails</h4>
        {trackingRecords.slice(0, 5).map((record) => (
          <div key={record.id} className="border-b pb-3 last:border-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{record.subject}</p>
                <p className="text-xs text-muted-foreground">
                  Sent {formatDistanceToNow(new Date(record.sent_at))}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-2">
                {/* Open Status */}
                <div className="text-center">
                  {record.open_count > 0 ? (
                    <div className="flex flex-col items-center">
                      <span className="text-gray-600" title="Email opened">📧</span>
                      <span className="text-xs text-muted-foreground">{record.open_count}x</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-gray-400" title="Not opened yet">📧</span>
                      <span className="text-xs text-muted-foreground">-</span>
                    </div>
                  )}
                </div>
                
                {/* Click Status */}
                <div className="text-center">
                  {record.click_count > 0 ? (
                    <div className="flex flex-col items-center">
                      <span className="text-gray-600" title="Link clicked">🔗</span>
                      <span className="text-xs text-muted-foreground">{record.click_count}x</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-gray-400" title="No clicks yet">🔗</span>
                      <span className="text-xs text-muted-foreground">-</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Engagement Timeline */}
            {(record.opened_at || record.first_clicked_at) && (
              <div className="mt-2 text-xs text-muted-foreground">
                {record.opened_at && (
                  <span className="mr-3">
                    Opened {formatDistanceToNow(new Date(record.opened_at))}
                  </span>
                )}
                {record.first_clicked_at && (
                  <span>
                    Clicked {formatDistanceToNow(new Date(record.first_clicked_at))}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}