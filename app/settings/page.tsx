"use client"

import { useState, useEffect, useCallback } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import SignatureBuilder, { EmailSignature } from "@/components/signature/SignatureBuilder"
import SupportModal from "@/components/support/SupportModal"
import PhoneStandardizationModal from "@/components/PhoneStandardizationModal"
import DuplicatesModal from "@/components/DuplicatesModal"
import O365Connection from "@/components/settings/O365Connection"
import GoogleConnection from "@/components/settings/GoogleConnection"
import { useEmailSignature } from "@/components/signature/SignatureManager"
import { getAuthState, isAdmin } from "@/lib/auth"
import { o365API, o365IntegrationAPI, O365OrganizationConfig, O365UserConnection, googleAPI, googleIntegrationAPI, handleAPIError, usersAPI } from "@/lib/api"

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const [showSignatureBuilder, setShowSignatureBuilder] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phonePreviewData, setPhonePreviewData] = useState(null)
  const [isLoadingPhone, setIsLoadingPhone] = useState(false)
  const [showDuplicatesModal, setShowDuplicatesModal] = useState(false)
  const [duplicatesData, setDuplicatesData] = useState(null)
  const [duplicatesType, setDuplicatesType] = useState<'companies' | 'contacts'>('companies')
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user")
  const [tempPassword, setTempPassword] = useState("")
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
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
  const isO365Enabled = true  // O365 is now always enabled

  // Google Workspace integration state
  const [googleConfig, setGoogleConfig] = useState<any>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showGoogleConfig, setShowGoogleConfig] = useState(false)
  const [googleFormData, setGoogleFormData] = useState({
    client_id: '',
    client_secret: '',
    project_id: '',
    gmail_sync_enabled: true,
    calendar_sync_enabled: true,
    contact_sync_enabled: true,
    drive_sync_enabled: false
  })

  // API call monitoring
  const [apiCallCount, setApiCallCount] = useState(0)
  const [lastResetTime, setLastResetTime] = useState(Date.now())

  const trackApiCall = (endpoint: string) => {
    setApiCallCount(prev => {
      const newCount = prev + 1
      const now = Date.now()
      
      // Reset counter every minute
      if (now - lastResetTime > 60000) {
        console.log(`API calls in last minute: ${newCount}`)
        if (newCount > 20) {
          console.warn('⚠️ HIGH API CALL FREQUENCY DETECTED')
        }
        setLastResetTime(now)
        return 1
      }
      
      return newCount
    })
  }

  // Prevent multiple calls on mount
  const [hasLoaded, setHasLoaded] = useState(false)

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
      setUsersLoading(true)
      const userData = await usersAPI.getAll()
      console.log('Loaded users:', userData)
      setUsers(userData || [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const loadGoogleConfig = async () => {
    try {
      const config = await googleAPI.getOrganizationConfig()
      setGoogleConfig(config)
      setGoogleFormData({
        client_id: config.client_id || '',
        client_secret: '',
        project_id: config.project_id || '',
        gmail_sync_enabled: config.gmail_sync_enabled,
        calendar_sync_enabled: config.calendar_sync_enabled,
        contact_sync_enabled: config.contact_sync_enabled,
        drive_sync_enabled: config.drive_sync_enabled
      })
    } catch (err) {
      console.error('Failed to load Google config:', err)
    }
  }

  // Circuit breaker state
  const [failureCount, setFailureCount] = useState(0)
  const MAX_FAILURES = 3
  const BACKOFF_TIME = 30000 // 30 seconds
  const [isCircuitBreakerActive, setIsCircuitBreakerActive] = useState(false)

  const fetchWithCircuitBreaker = async (url: string, options: RequestInit = {}) => {
    console.log('fetchWithCircuitBreaker called:', url, options.method || 'GET')
    // Track API call
    trackApiCall(url)

    // Emergency disable check
    if (process.env.NEXT_PUBLIC_DISABLE_POLLING === 'true') {
      console.log('Polling disabled by environment variable')
      return null
    }

    if (failureCount >= MAX_FAILURES) {
      console.log('Circuit breaker active - skipping API call')
      return null
    }

    try {
      const response = await fetch(url, options)
      if (response.ok) {
        setFailureCount(0) // Reset on success
        setIsCircuitBreakerActive(false)
      }
      return response // Return response regardless of status
    } catch (error) {
      const newFailureCount = failureCount + 1
      setFailureCount(newFailureCount)
      console.error(`API call failed (${newFailureCount}/${MAX_FAILURES}):`, error)
      
      if (newFailureCount >= MAX_FAILURES) {
        console.log(`Circuit breaker activated. Waiting ${BACKOFF_TIME}ms`)
        setIsCircuitBreakerActive(true)
        setTimeout(() => {
          setFailureCount(0) // Reset after backoff
          setIsCircuitBreakerActive(false)
        }, BACKOFF_TIME)
      }
      
      throw error
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
      const response = await fetchWithCircuitBreaker(`${process.env.NEXT_PUBLIC_API_URL}/api/users/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          role: inviteRole
        })
      })

      if (response && response.ok) {
        const data = await response.json()
        setSuccess(`User ${inviteEmail} added successfully!`)
        setTempPassword(data.temporary_password)
        setShowPasswordModal(true)
        setInviteEmail("")
        setInviteFirstName("")
        setInviteLastName("")
        setShowInviteForm(false)
        // Reload users list
        setTimeout(() => loadUsers(), 1000)
      } else if (response) {
        const errorData = await response.json()
        setError(errorData.detail || 'Failed to add user')
      }
    } catch (err) {
      setError('Failed to add user')
    } finally {
      setLoading(false)
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

  const handleSaveGoogleConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setGoogleLoading(true)
    setError("")
    setSuccess("")

    try {
      if (googleConfig) {
        // Update existing config
        await googleAPI.updateOrganizationConfig(googleFormData)
        setSuccess('Google Workspace configuration updated successfully')
      } else {
        // Create new config
        await googleAPI.createOrganizationConfig(googleFormData)
        setSuccess('Google Workspace configuration created successfully')
      }
      
      // Reload config
      await loadGoogleConfig()
      setShowGoogleConfig(false)
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleDeleteGoogleConfig = async () => {
    if (!confirm('Are you sure you want to delete the Google Workspace configuration? This will disconnect all users.')) return

    setGoogleLoading(true)
    setError("")
    setSuccess("")

    try {
      await googleAPI.deleteOrganizationConfig()
      setGoogleConfig(null)
      setGoogleFormData({
        client_id: '',
        client_secret: '',
        project_id: '',
        gmail_sync_enabled: true,
        calendar_sync_enabled: true,
        contact_sync_enabled: true,
        drive_sync_enabled: false
      })
      setSuccess('Google Workspace configuration deleted successfully')
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    if (hasLoaded) return
    
    console.log("Settings page loading...")
    if (isAdmin(user)) {
      loadUsers()
    }
    
    // Only load O365 if explicitly enabled via environment variable
    if (isO365Enabled) {
      if (isOwner) {
        loadO365Config()
      }
      loadO365UserConnection()
    }
    
    // Load Google config for owners
    if (isOwner) {
      loadGoogleConfig()
    }
    
    setHasLoaded(true)
  }, [user?.role]) // Only depend on user role to avoid re-renders

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
                  Add User
                </button>
              </div>

              {/* Current Users */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Current Users</h3>
                {usersLoading ? (
                  <div className="text-sm text-gray-500">Loading users...</div>
                ) : users.length > 0 ? (
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
                  <div className="text-sm text-gray-500">No users found</div>
                )}
              </div>
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
                {user?.first_name && user?.last_name 
                  ? `${user?.first_name} ${user?.last_name}`
                  : user?.email?.split('@')[0] || 'Sales Rep'
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your name used as the sender for outgoing emails
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Sender Email</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {user?.email || 'sales@company.com'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your email address used as the sender for outgoing emails
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
                    onClick={async () => {
                      try {
                        const { auth_url } = await o365IntegrationAPI.getAuthUrl()
                        window.open(auth_url, 'o365-auth', 'width=600,height=700')
                      } catch (error) {
                        setError(handleAPIError(error))
                      }
                    }}
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

        {/* Office 365 Connection Component - For all users */}
        <O365Connection />

        {/* Google Workspace Organization Configuration - For owners only */}
        {isOwner && (
          <div className="bg-card border rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold">Google Workspace Configuration</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure Google Workspace integration for your organization
                </p>
              </div>
              <button
                onClick={() => setShowGoogleConfig(!showGoogleConfig)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                {googleConfig ? 'Manage Configuration' : 'Configure Google Workspace'}
              </button>
            </div>

            {/* Configuration Status */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Configuration Status</label>
                <div className="flex items-center space-x-2">
                  {googleConfig ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm text-green-600">Configured</span>
                      {googleConfig.last_test_success ? (
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
              </div>

              {/* Features Status */}
              {googleConfig && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${googleConfig.gmail_sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium">Gmail Sync</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {googleConfig.gmail_sync_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${googleConfig.calendar_sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium">Calendar Sync</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {googleConfig.calendar_sync_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${googleConfig.contact_sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium">Contact Sync</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {googleConfig.contact_sync_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <div className={`h-2 w-2 rounded-full ${googleConfig.drive_sync_enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-medium">Drive Sync</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {googleConfig.drive_sync_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Google Workspace Connection Component - For all users */}
        <GoogleConnection />

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

        {/* Data Management Section */}
        {isOwner && (
          <div className="bg-card border rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Data Management</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and standardize your organization's data.
                </p>
              </div>
            </div>
            
            <div className="mt-4 space-y-4">
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-2">Phone Number Standardization</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Standardize all phone numbers to format: (XXX) XXX-XXXX. This runs automatically every night at 2 AM.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        setIsLoadingPhone(true)
                        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
                        const response = await fetch(`${baseUrl}/api/admin/standardize-phone-numbers?dry_run=true`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${getAuthState().token}`,
                            'Content-Type': 'application/json',
                          },
                        })
                        if (response.ok) {
                          const data = await response.json()
                          setPhonePreviewData(data)
                          setShowPhoneModal(true)
                        } else {
                          alert('Failed to run phone standardization preview')
                        }
                      } catch (error) {
                        alert('Error running preview')
                      } finally {
                        setIsLoadingPhone(false)
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:bg-gray-400"
                    disabled={isLoadingPhone}
                  >
                    {isLoadingPhone ? 'Loading...' : 'Preview Changes'}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setIsLoadingPhone(true)
                        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
                        const response = await fetch(`${baseUrl}/api/admin/standardize-phone-numbers?dry_run=true`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${getAuthState().token}`,
                            'Content-Type': 'application/json',
                          },
                        })
                        if (response.ok) {
                          const data = await response.json()
                          if (data.summary.total_changes === 0) {
                            alert('All phone numbers are already properly formatted!')
                          } else {
                            setPhonePreviewData(data)
                            setShowPhoneModal(true)
                          }
                        } else {
                          alert('Failed to check phone numbers')
                        }
                      } catch (error) {
                        alert('Error checking phone numbers')
                      } finally {
                        setIsLoadingPhone(false)
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                    disabled={isLoadingPhone}
                  >
                    {isLoadingPhone ? 'Loading...' : 'Standardize Now'}
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium mb-2">Duplicate Detection</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Find and remove duplicate companies and contacts from your database.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        setIsLoadingDuplicates(true)
                        setDuplicatesType('companies')
                        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
                        const response = await fetch(`${baseUrl}/api/admin/find-duplicates?record_type=companies`, {
                          headers: {
                            'Authorization': `Bearer ${getAuthState().token}`,
                          },
                        })
                        if (response.ok) {
                          const data = await response.json()
                          setDuplicatesData(data)
                          setShowDuplicatesModal(true)
                        } else {
                          alert('Failed to find duplicate companies')
                        }
                      } catch (error) {
                        alert('Error finding duplicates')
                      } finally {
                        setIsLoadingDuplicates(false)
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-purple-400"
                    disabled={isLoadingDuplicates}
                  >
                    {isLoadingDuplicates ? 'Searching...' : 'Find Duplicate Companies'}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        setIsLoadingDuplicates(true)
                        setDuplicatesType('contacts')
                        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
                        const response = await fetch(`${baseUrl}/api/admin/find-duplicates?record_type=contacts`, {
                          headers: {
                            'Authorization': `Bearer ${getAuthState().token}`,
                          },
                        })
                        if (response.ok) {
                          const data = await response.json()
                          setDuplicatesData(data)
                          setShowDuplicatesModal(true)
                        } else {
                          alert('Failed to find duplicate contacts')
                        }
                      } catch (error) {
                        alert('Error finding duplicates')
                      } finally {
                        setIsLoadingDuplicates(false)
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-purple-400"
                    disabled={isLoadingDuplicates}
                  >
                    {isLoadingDuplicates ? 'Searching...' : 'Find Duplicate Contacts'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Section - Contact Support Feature */}
        {console.log("Rendering support section...")}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Support</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Need help or have a feature request? Get in touch with our support team.
              </p>
            </div>
            <button
              onClick={() => setShowSupportModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Contact Support
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">🔧</span>
                <h3 className="text-sm font-medium">Technical Support</h3>
              </div>
              <p className="text-xs text-gray-600">
                Report bugs, login issues, errors, or other technical problems
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">💡</span>
                <h3 className="text-sm font-medium">Feature Requests</h3>
              </div>
              <p className="text-xs text-gray-600">
                Suggest new features or improvements to make the CRM better
              </p>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            Support requests are sent directly to our team and typically receive a response within 24 hours.
          </div>
        </div>
      </div>

      {/* Invite User Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add User to {organization?.name}</h3>
            <form onSubmit={handleSendInvite}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="inviteFirstName" className="block text-sm font-medium mb-1">
                      First Name
                    </label>
                    <input
                      id="inviteFirstName"
                      type="text"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="inviteLastName" className="block text-sm font-medium mb-1">
                      Last Name
                    </label>
                    <input
                      id="inviteLastName"
                      type="text"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
                
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
                  {loading ? 'Adding...' : 'Add User'}
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
                  <li>Set redirect URI to: <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_API_URL}/api/auth/microsoft/callback</code></li>
                  <li>Generate a client secret in "Certificates & secrets"</li>
                  <li>Grant these API permissions: Calendar.ReadWrite, Mail.Send, Contacts.ReadWrite</li>
                </ol>
                <p className="text-sm text-blue-800 mt-2">
                  <a href="/docs/office-365-setup-guide.html" target="_blank" rel="noopener noreferrer" className="underline">
                    View detailed setup guide →
                  </a>
                </p>
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

      {/* Google Workspace Configuration Modal */}
      {showGoogleConfig && isOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Google Workspace Configuration</h3>
              <button
                onClick={() => setShowGoogleConfig(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Google Cloud Project Required</h4>
                <p className="text-sm text-blue-800 mb-3">
                  Before configuring, you need to create a Google Cloud Project:
                </p>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Go to Google Cloud Console → Create a new project</li>
                  <li>Enable Gmail API, Calendar API, People API, and Drive API</li>
                  <li>Configure OAuth consent screen</li>
                  <li>Create OAuth 2.0 credentials (Web application)</li>
                  <li>Add redirect URI: <code className="bg-blue-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/google/callback</code></li>
                </ol>
                <p className="text-sm text-blue-800 mt-2">
                  <a href="/docs/google-workspace-setup-guide.html" target="_blank" rel="noopener noreferrer" className="underline">
                    View detailed setup guide →
                  </a>
                </p>
              </div>

              {/* Configuration Form */}
              <form onSubmit={handleSaveGoogleConfig} className="space-y-4">
                <div>
                  <label htmlFor="google_client_id" className="block text-sm font-medium mb-1">
                    Client ID
                  </label>
                  <input
                    id="google_client_id"
                    type="text"
                    value={googleFormData.client_id}
                    onChange={(e) => setGoogleFormData({...googleFormData, client_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="google_client_secret" className="block text-sm font-medium mb-1">
                    Client Secret
                  </label>
                  <input
                    id="google_client_secret"
                    type="password"
                    value={googleFormData.client_secret}
                    onChange={(e) => setGoogleFormData({...googleFormData, client_secret: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter client secret"
                    required={!googleConfig}
                  />
                  {googleConfig && (
                    <p className="text-xs text-gray-500 mt-1">
                      Leave blank to keep current secret
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="google_project_id" className="block text-sm font-medium mb-1">
                    Project ID (Optional)
                  </label>
                  <input
                    id="google_project_id"
                    type="text"
                    value={googleFormData.project_id}
                    onChange={(e) => setGoogleFormData({...googleFormData, project_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your-project-id"
                  />
                </div>

                {/* Feature Toggles */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Integration Features</h4>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="gmail_sync"
                      type="checkbox"
                      checked={googleFormData.gmail_sync_enabled}
                      onChange={(e) => setGoogleFormData({...googleFormData, gmail_sync_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="gmail_sync" className="text-sm font-medium">
                      Gmail Sync
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="google_calendar_sync"
                      type="checkbox"
                      checked={googleFormData.calendar_sync_enabled}
                      onChange={(e) => setGoogleFormData({...googleFormData, calendar_sync_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="google_calendar_sync" className="text-sm font-medium">
                      Calendar Sync
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="google_contact_sync"
                      type="checkbox"
                      checked={googleFormData.contact_sync_enabled}
                      onChange={(e) => setGoogleFormData({...googleFormData, contact_sync_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="google_contact_sync" className="text-sm font-medium">
                      Contact Sync
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="google_drive_sync"
                      type="checkbox"
                      checked={googleFormData.drive_sync_enabled}
                      onChange={(e) => setGoogleFormData({...googleFormData, drive_sync_enabled: e.target.checked})}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="google_drive_sync" className="text-sm font-medium">
                      Drive Sync (Future Feature)
                    </label>
                  </div>
                </div>

                <div className="flex justify-between space-x-3 pt-4">
                  <div>
                    {googleConfig && (
                      <button
                        type="button"
                        onClick={handleDeleteGoogleConfig}
                        disabled={googleLoading}
                        className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete Configuration
                      </button>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowGoogleConfig(false)}
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={googleLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {googleLoading ? 'Saving...' : (googleConfig ? 'Update Configuration' : 'Save Configuration')}
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

      {/* Support Modal */}
      <SupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />

      {/* Phone Standardization Modal */}
      <PhoneStandardizationModal
        isOpen={showPhoneModal}
        onClose={() => {
          setShowPhoneModal(false)
          setPhonePreviewData(null)
        }}
        previewData={phonePreviewData}
        isLoading={isLoadingPhone}
        onConfirm={async () => {
          try {
            setIsLoadingPhone(true)
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
            const response = await fetch(`${baseUrl}/api/admin/standardize-phone-numbers`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${getAuthState().token}`,
                'Content-Type': 'application/json',
              },
            })
            if (response.ok) {
              const result = await response.json()
              alert(result.message)
              setShowPhoneModal(false)
              setPhonePreviewData(null)
            } else {
              alert('Failed to standardize phone numbers')
            }
          } catch (error) {
            alert('Error standardizing phone numbers')
          } finally {
            setIsLoadingPhone(false)
          }
        }}
      />

      {/* Duplicates Modal */}
      <DuplicatesModal
        isOpen={showDuplicatesModal}
        onClose={() => {
          setShowDuplicatesModal(false)
          setDuplicatesData(null)
        }}
        duplicatesData={duplicatesData}
        recordType={duplicatesType}
        isLoading={isLoadingDuplicates}
        onDelete={async (selectedIds) => {
          if (confirm(`Are you sure you want to delete ${selectedIds.length} ${duplicatesType}? This action cannot be undone.`)) {
            try {
              setIsLoadingDuplicates(true)
              const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
              const response = await fetch(`${baseUrl}/api/admin/delete-duplicates`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${getAuthState().token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  record_type: duplicatesType,
                  record_ids: selectedIds
                })
              })
              if (response.ok) {
                const result = await response.json()
                alert(result.message)
                setShowDuplicatesModal(false)
                setDuplicatesData(null)
              } else {
                alert('Failed to delete duplicates')
              }
            } catch (error) {
              alert('Error deleting duplicates')
            } finally {
              setIsLoadingDuplicates(false)
            }
          }
        }}
      />

      {/* Password Display Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">User Created Successfully!</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 mb-2">
                The user has been added and a welcome email has been sent with their login credentials.
              </p>
              <p className="text-sm text-green-800">
                Please save the temporary password below in case they don't receive the email.
              </p>
            </div>
            
            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Temporary Password:</p>
              <div className="flex items-center justify-between">
                <code className="bg-white px-3 py-2 rounded border border-gray-300 font-mono text-sm flex-1">
                  {tempPassword}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword)
                    alert('Password copied to clipboard!')
                  }}
                  className="ml-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Copy to clipboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              The user will be required to change this password on their first login.
            </p>
            
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setTempPassword("")
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </MainLayout>
    </AuthGuard>
  )
}