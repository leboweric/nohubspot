"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { getAuthState } from "@/lib/auth"
import { handleAPIError } from "@/lib/api"

export default function O365SetupPage() {
  const router = useRouter()
  const { user } = getAuthState()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: '',
    tenant_id: '',
    calendar_sync_enabled: true,
    email_sending_enabled: true,
    contact_sync_enabled: true
  })

  // Only owners can access this page
  useEffect(() => {
    if (user && user.role !== 'owner') {
      router.push('/settings')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/o365/organization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        alert('Office 365 configuration saved successfully!')
        router.push('/settings')
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to save configuration'}`)
      }
    } catch (error) {
      alert(`Error: ${handleAPIError(error)}`)
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.role !== 'owner') {
    return null
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">Office 365 Setup</h1>
            <p className="text-muted-foreground mt-1">Configure Office 365 integration for your organization</p>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Azure AD App Registration</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-3">
                  Before configuring, you need to register an application in Azure Active Directory:
                </p>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline">Azure Portal</a> → Azure Active Directory → App registrations → New registration</li>
                  <li>Name your app (e.g., "NotHubSpot CRM")</li>
                  <li>Set redirect URI to: <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_API_URL || window.location.origin}/api/auth/o365/callback</code></li>
                  <li>After registration, copy the Application (client) ID and Directory (tenant) ID</li>
                  <li>Go to "Certificates & secrets" → New client secret → Copy the secret value</li>
                  <li>Go to "API permissions" → Add permission → Microsoft Graph → Delegated permissions:</li>
                  <ul className="ml-4 mt-1 list-disc list-inside">
                    <li>User.Read</li>
                    <li>Mail.Read</li>
                    <li>Mail.ReadWrite</li>
                    <li>Mail.Send</li>
                    <li>offline_access</li>
                  </ul>
                  <li>Click "Grant admin consent" for your organization</li>
                </ol>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="tenant_id" className="block text-sm font-medium mb-1">
                  Tenant ID (Directory ID)
                </label>
                <input
                  id="tenant_id"
                  type="text"
                  value={formData.tenant_id}
                  onChange={(e) => setFormData({...formData, tenant_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Found in Azure Portal → Azure Active Directory → Overview
                </p>
              </div>

              <div>
                <label htmlFor="client_id" className="block text-sm font-medium mb-1">
                  Client ID (Application ID)
                </label>
                <input
                  id="client_id"
                  type="text"
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Found in your App registration → Overview
                </p>
              </div>

              <div>
                <label htmlFor="client_secret" className="block text-sm font-medium mb-1">
                  Client Secret
                </label>
                <input
                  id="client_secret"
                  type="password"
                  value={formData.client_secret}
                  onChange={(e) => setFormData({...formData, client_secret: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter client secret"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Created in App registration → Certificates & secrets
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Integration Features</h3>
                
                <div className="flex items-center space-x-2">
                  <input
                    id="email_sending"
                    type="checkbox"
                    checked={formData.email_sending_enabled}
                    onChange={(e) => setFormData({...formData, email_sending_enabled: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="email_sending" className="text-sm">
                    Enable Email Sending & Sync
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    id="calendar_sync"
                    type="checkbox"
                    checked={formData.calendar_sync_enabled}
                    onChange={(e) => setFormData({...formData, calendar_sync_enabled: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="calendar_sync" className="text-sm">
                    Enable Calendar Sync (Coming Soon)
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    id="contact_sync"
                    type="checkbox"
                    checked={formData.contact_sync_enabled}
                    onChange={(e) => setFormData({...formData, contact_sync_enabled: e.target.checked})}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="contact_sync" className="text-sm">
                    Enable Contact Sync (Coming Soon)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => router.push('/settings')}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}