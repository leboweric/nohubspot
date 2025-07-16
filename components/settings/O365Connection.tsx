"use client"

import { useState, useEffect } from "react"
import { o365IntegrationAPI, handleAPIError } from "@/lib/api"
import EmailPrivacySettings from "./EmailPrivacySettings"

export default function O365Connection() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      setLoading(true)
      const data = await o365IntegrationAPI.getStatus()
      setStatus(data)
    } catch (error) {
      console.error('Failed to load O365 status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      setConnecting(true)
      const { auth_url } = await o365IntegrationAPI.getAuthUrl()
      
      // Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      
      const popup = window.open(
        auth_url,
        'o365-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      )
      
      // Check if popup was closed
      const checkInterval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkInterval)
          setConnecting(false)
          // Reload status after a delay
          setTimeout(loadStatus, 2000)
        }
      }, 1000)
      
    } catch (error) {
      alert(`Failed to start O365 connection: ${handleAPIError(error)}`)
      setConnecting(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      const result = await o365IntegrationAPI.syncEmails()
      alert(`Successfully synced ${result.synced_count} emails`)
      await loadStatus()
    } catch (error) {
      alert(`Failed to sync emails: ${handleAPIError(error)}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Office 365?')) {
      return
    }
    
    try {
      await o365IntegrationAPI.disconnect()
      await loadStatus()
    } catch (error) {
      alert(`Failed to disconnect: ${handleAPIError(error)}`)
    }
  }

  if (loading) {
    return (
      <div className="bg-card border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Office 365 Integration</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Office 365 Integration</h3>
      
      {status?.connected ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">✓ Connected</p>
              <p className="text-sm text-muted-foreground">{status.email}</p>
              {status.last_sync && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last synced: {new Date(status.last_sync).toLocaleString()}
                </p>
              )}
            </div>
            <div className="space-x-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 text-sm border rounded-md hover:bg-accent"
              >
                Disconnect
              </button>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Sync Settings</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Email sync is {status.sync_enabled ? 'enabled' : 'disabled'}
            </p>
            
            <EmailPrivacySettings />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Office 365 account to sync emails automatically.{' '}
            <a 
              href="/docs/office-365-setup-guide.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View setup guide
            </a>
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">What this enables:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Automatic email threading for all sent and received emails</li>
              <li>• Send emails that appear in your Outlook sent folder</li>
              <li>• Track email conversations across Outlook and CRM</li>
              <li>• Full email history for each contact</li>
            </ul>
          </div>
          
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect Office 365'}
          </button>
          
          {status?.message && (
            <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">
              ⚠️ {status.message}
            </p>
          )}
        </div>
      )}
    </div>
  )
}