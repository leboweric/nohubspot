"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import SignatureBuilder, { EmailSignature } from "@/components/signature/SignatureBuilder"
import { useEmailSignature } from "@/components/signature/SignatureManager"
import { getAuthState, isAdmin } from "@/lib/auth"
import { o365API, O365OrganizationConfig, O365UserConnection, handleAPIError } from "@/lib/api"

export default function SettingsPage() {
  const [showSignatureBuilder, setShowSignatureBuilder] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [users, setUsers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const { signature, saveSignature } = useEmailSignature()
  const { user, organization } = getAuthState()

  // Office 365 integration state
  const [o365Config, setO365Config] = useState<O365OrganizationConfig | null>(null)
  const [o365UserConnection, setO365UserConnection] = useState<O365UserConnection | null>(null)
  const [o365Loading, setO365Loading] = useState(false)
  const [showO365Config, setShowO365Config] = useState(false)
  const [o365FormData, setO365FormData] = useState({
    client_id: '',
    client_secret: '',
    tenant_id: '',
    calendar_sync_enabled: true,
    email_sending_enabled: true,
    contact_sync_enabled: true
  })

  const isOwner = user?.role === 'owner'
  const isO365Enabled = process.env.NEXT_PUBLIC_O365_ENABLED === 'true'

  useEffect(() => {
    if (isAdmin(user)) {
      loadUsers()
      loadInvites()
    }
    
    // Only load O365 if explicitly enabled via environment variable
    if (isO365Enabled) {
      if (isOwner) {
        loadO365Config()
      }
      loadO365UserConnection()
    }
  }, [user, isO365Enabled])

  const loadO365Config = async () => {
    try {
      const config = await o365API.getOrganizationConfig()
      setO365Config(config)
      setO365FormData({
        client_id: config.client_id || '',
        client_secret: '',
        tenant_id: config.tenant_id || '',
        calendar_sync_enabled: config.calendar_sync_enabled,
        email_sending_enabled: config.email_sending_enabled,
        contact_sync_enabled: config.contact_sync_enabled
      })
    } catch (err) {
      console.error('Failed to load O365 config:', err)
    }
  }

  const loadO365UserConnection = async () => {
    try {
      const connection = await o365API.getUserConnection()
      setO365UserConnection(connection)
    } catch (err) {
      // Don't spam logs for 404 - no user connection exists yet
      if (err.status !== 404) {
        console.error('Failed to load O365 user connection:', err)
      }
      setO365UserConnection(null)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      if (response.ok) {
        const userData = await response.json()
        setUsers(userData)
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }

  const loadInvites = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invites`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
      if (response.ok) {
        const inviteData = await response.json()
        setInvites(inviteData)
      }
    } catch (err) {
      console.error('Failed to load invites:', err)
    }
  }

  const handleSaveSignature = async (newSignature: EmailSignature) => {
    try {
      setError("")
      setSuccess("")
      await saveSignature(newSignature)
      setShowSignatureBuilder(false)
      setSuccess("Email signature saved successfully!")
    } catch (err) {
      setError(`Failed to save signature: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole
        })
      })

      if (response.ok) {
        setSuccess(`Invitation sent to ${inviteEmail}`)
        setInviteEmail("")
        setShowInviteForm(false)
        loadInvites()
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to send invitation')
      }
    } catch (err) {
      setError('Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeInvite = async (inviteId: number) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/invites/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        setSuccess('Invitation revoked')
        loadInvites()
      } else {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to revoke invitation')
      }
    } catch (err) {
      setError('Failed to revoke invitation')
    }
  }

  const handleSaveO365Config = async (e: React.FormEvent) => {
    e.preventDefault()
    setO365Loading(true)
    setError("")
    setSuccess("")

    try {
      if (o365Config) {
        // Update existing config
        await o365API.updateOrganizationConfig(o365FormData)
        setSuccess('Office 365 configuration updated successfully')
      } else {
        // Create new config
        await o365API.createOrganizationConfig(o365FormData)
        setSuccess('Office 365 configuration created successfully')
      }
      
      // Reload config
      await loadO365Config()
      setShowO365Config(false)
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setO365Loading(false)
    }
  }

  const handleDeleteO365Config = async () => {
    if (!confirm('Are you sure you want to delete the Office 365 configuration? This will disconnect all users.')) return

    setO365Loading(true)
    setError("")
    setSuccess("")

    try {
      await o365API.deleteOrganizationConfig()
      setO365Config(null)
      setO365FormData({
        client_id: '',
        client_secret: '',
        tenant_id: '',
        calendar_sync_enabled: true,
        email_sending_enabled: true,
        contact_sync_enabled: true
      })
      setSuccess('Office 365 configuration deleted successfully')
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setO365Loading(false)
    }
  }

  const handleDisconnectO365User = async () => {
    if (!confirm('Are you sure you want to disconnect your Office 365 account?')) return

    setO365Loading(true)
    setError("")
    setSuccess("")

    try {
      await o365API.disconnectUser()
      setO365UserConnection(null)
      setSuccess('Office 365 account disconnected successfully')
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setO365Loading(false)
    }
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your CRM preferences and configurations</p>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}
      
      {success && (
        <div className="rounded-md bg-green-50 p-4 mb-6">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      <div className="space-y-6">
        {/* Organization Info Section */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Organization Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Organization Name</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {organization?.name || 'Loading...'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Organization ID</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {organization?.slug || 'Loading...'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Plan</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {organization?.plan || 'Free'} Plan
              </div>
            </div>
          </div>
        </div>

        {/* User Management Section - Only for Admins */}
        {isAdmin(user) && (
          <>
            <div className="bg-card border rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold">Team Members</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage users in your organization
                  </p>
                </div>
                <button
                  onClick={() => setShowInviteForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Invite User
                </button>
              </div>

              {/* Current Users */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Current Users</h3>
                {users.length > 0 ? (
                  <div className="space-y-2">
                    {users.map((teamUser) => (
                      <div key={teamUser.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">
                              {teamUser.first_name?.[0] || teamUser.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium">
                              {teamUser.first_name} {teamUser.last_name}
                            </div>
                            <div className="text-xs text-gray-500">{teamUser.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-1 bg-gray-200 rounded">
                            {teamUser.role === 'owner' ? 'Owner' : 
                             teamUser.role === 'admin' ? 'Admin' : 
                             teamUser.role === 'user' ? 'User' : 'Read Only'}
                          </span>
                          {teamUser.email_verified ? (
                            <span className="text-xs text-green-600">✓ Verified</span>
                          ) : (
                            <span className="text-xs text-yellow-600">⚠ Unverified</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">Loading users...</div>
                )}
              </div>

              {/* Pending Invitations */}
              {invites.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="text-sm font-medium">Pending Invitations</h3>
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-yellow-600">
                              {invite.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium">{invite.email}</div>
                            <div className="text-xs text-gray-500">
                              Invited {new Date(invite.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-1 bg-yellow-200 rounded">
                            {invite.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                          <button
                            onClick={() => handleRevokeInvite(invite.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Email Signature Section */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Email Signature</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your email signature that will be automatically added to all outgoing emails
              </p>
            </div>
            <button
              onClick={() => setShowSignatureBuilder(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {signature ? 'Edit Signature' : 'Create Signature'}
            </button>
          </div>

          {signature && signature.enabled ? (
            <div>
              <h3 className="text-sm font-medium mb-2">Current Signature Preview:</h3>
              <div className="bg-muted p-4 rounded-md">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {(() => {
                    let preview = ""
                    if (signature.name) preview += `${signature.name}\n`
                    if (signature.title) preview += `${signature.title}\n`
                    if (signature.company) preview += `${signature.company}\n`
                    if (signature.phone || signature.email) {
                      preview += "\n"
                      if (signature.phone) preview += `📞 ${signature.phone}\n`
                      if (signature.email) preview += `✉️ ${signature.email}\n`
                    }
                    if (signature.website) preview += `🌐 ${signature.website}\n`
                    if (signature.customText) preview += `\n${signature.customText}\n`
                    return preview || "No signature configured"
                  })()}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              {signature ? 'Email signature is disabled' : 'No email signature configured'}
            </div>
          )}
        </div>

        {/* Email Settings Section */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Email Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Default Sender Name</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {process.env.NEXT_PUBLIC_DEFAULT_SENDER_NAME || 'Sales Rep'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure this in your environment variables
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Sender Email</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {process.env.NEXT_PUBLIC_DEFAULT_SENDER_EMAIL || 'sales@company.com'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure this in your environment variables
              </p>
            </div>
          </div>
        </div>

        {/* Office 365 Integration Section */}
        {isO365Enabled && (
          <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Office 365 Integration</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect with Microsoft Office 365 for calendar sync, email sending, and contact management
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowO365Config(!showO365Config)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                {o365Config ? 'Manage Configuration' : 'Configure Office 365'}
              </button>
            )}
          </div>

          {/* Organization Configuration Status */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Organization Configuration Status</label>
              <div className="flex items-center space-x-2">
                {o365Config ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-green-600">Configured</span>
                    {o365Config.last_test_success ? (
                      <span className="text-xs text-green-500">✓ Test successful</span>
                    ) : (
                      <span className="text-xs text-red-500">⚠ Test failed</span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                    <span className="text-sm text-gray-600">Not configured</span>
                  </>
                )}
              </div>
              {!isOwner && (
                <p className="text-xs text-muted-foreground mt-1">
                  Only organization owners can configure Office 365 integration
                </p>
              )}
            </div>

            {/* User Connection Status */}
            <div>
              <label className="block text-sm font-medium mb-2">Your Office 365 Connection</label>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {o365UserConnection ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm text-green-600">Connected</span>
                      <span className="text-xs text-gray-500">
                        ({o365UserConnection.o365_email})
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                      <span className="text-sm text-gray-600">Not connected</span>
                    </>
                  )}
                </div>
                {o365UserConnection && (
                  <button
                    onClick={handleDisconnectO365User}
                    disabled={o365Loading}
                    className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    Disconnect
                  </button>
                )}
              </div>
              {o365Config && !o365UserConnection && (
                <div className="mt-2">
                  <button
                    onClick={() => window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/o365/authorize`}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Connect to Office 365
                  </button>
                </div>
              )}
            </div>

            {/* Features Status */}
            {o365Config && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${o365Config.calendar_sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium">Calendar Sync</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {o365Config.calendar_sync_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${o365Config.email_sending_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium">Email Sending</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {o365Config.email_sending_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className={`h-2 w-2 rounded-full ${o365Config.contact_sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-medium">Contact Sync</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {o365Config.contact_sync_enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* O365 Disabled Notice */}
        {!isO365Enabled && (
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center space-x-3">
              <div className="h-2 w-2 rounded-full bg-gray-400"></div>
              <div>
                <h2 className="text-lg font-semibold">Office 365 Integration</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Office 365 integration is currently disabled to optimize performance. 
                  Contact your administrator to enable it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Settings Section */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">System Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data Storage</label>
              <div className="text-sm text-muted-foreground">
                Currently using browser localStorage for data persistence. In production, this would connect to your backend database.
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Provider</label>
              <div className="text-sm text-muted-foreground">
                SendGrid integration configured for email sending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite User to {organization?.name}</h3>
            <form onSubmit={handleSendInvite}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="inviteEmail" className="block text-sm font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="inviteRole" className="block text-sm font-medium mb-1">
                    Role
                  </label>
                  <select
                    id="inviteRole"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "user" | "admin")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user">User - Can view and edit data</option>
                    <option value="admin">Admin - Can manage users and settings</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Office 365 Configuration Modal */}
      {isO365Enabled && showO365Config && isOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Office 365 Configuration</h3>
              <button
                onClick={() => setShowO365Config(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Azure AD App Registration Required</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Before configuring, you need to register an application in Azure Active Directory:
                </p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Go to Azure Portal → App registrations → New registration</li>
                  <li>Set redirect URI to: <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_API_URL}/api/auth/o365/callback</code></li>
                  <li>Generate a client secret in "Certificates & secrets"</li>
                  <li>Grant these API permissions: Calendar.ReadWrite, Mail.Send, Contacts.ReadWrite</li>
                </ol>
              </div>

              {/* Configuration Form */}
              <form onSubmit={handleSaveO365Config} className="space-y-4">
                <div>
                  <label htmlFor="client_id" className="block text-sm font-medium mb-1">
                    Client ID (Application ID)
                  </label>
                  <input
                    id="client_id"
                    type="text"
                    value={o365FormData.client_id}
                    onChange={(e) => setO365FormData({...o365FormData, client_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="client_secret" className="block text-sm font-medium mb-1">
                    Client Secret
                  </label>
                  <input
                    id="client_secret"
                    type="password"
                    value={o365FormData.client_secret}
                    onChange={(e) => setO365FormData({...o365FormData, client_secret: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter client secret"
                    required={!o365Config}
                  />
                  {o365Config && (
                    <p className="text-xs text-gray-500 mt-1">
                      Leave blank to keep current secret
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="tenant_id" className="block text-sm font-medium mb-1">
                    Tenant ID (Directory ID)
                  </label>
                  <input
                    id="tenant_id"
                    type="text"
                    value={o365FormData.tenant_id}
                    onChange={(e) => setO365FormData({...o365FormData, tenant_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    required
                  />
                </div>

                {/* Feature Toggles */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Integration Features</h4>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="calendar_sync"
                      type="checkbox"
                      checked={o365FormData.calendar_sync_enabled}
                      onChange={(e) => setO365FormData({...o365FormData, calendar_sync_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="calendar_sync" className="text-sm font-medium">
                      Calendar Sync
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="email_sending"
                      type="checkbox"
                      checked={o365FormData.email_sending_enabled}
                      onChange={(e) => setO365FormData({...o365FormData, email_sending_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="email_sending" className="text-sm font-medium">
                      Email Sending
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="contact_sync"
                      type="checkbox"
                      checked={o365FormData.contact_sync_enabled}
                      onChange={(e) => setO365FormData({...o365FormData, contact_sync_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="contact_sync" className="text-sm font-medium">
                      Contact Sync
                    </label>
                  </div>
                </div>

                <div className="flex justify-between space-x-3 pt-4">
                  <div>
                    {o365Config && (
                      <button
                        type="button"
                        onClick={handleDeleteO365Config}
                        disabled={o365Loading}
                        className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete Configuration
                      </button>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowO365Config(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={o365Loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {o365Loading ? 'Saving...' : (o365Config ? 'Update Configuration' : 'Save Configuration')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Signature Builder Modal */}
      <SignatureBuilder
        isOpen={showSignatureBuilder}
        onClose={() => setShowSignatureBuilder(false)}
        onSave={handleSaveSignature}
        initialSignature={signature || undefined}
      />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}