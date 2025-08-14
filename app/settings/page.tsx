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
import SettingsNavigation, { SettingsTab } from "@/components/settings/SettingsNavigation"
import UserManagementCard from "@/components/settings/UserManagementCard"
import IntegrationCard from "@/components/settings/IntegrationCard"
import ColorThemePicker from "@/components/settings/ColorThemePicker"
import LogoUploader from "@/components/settings/LogoUploader"
import { useEmailSignature } from "@/components/signature/SignatureManager"
import { getAuthState, isAdmin } from "@/lib/auth"
import { o365API, o365IntegrationAPI, O365OrganizationConfig, O365UserConnection, googleAPI, googleIntegrationAPI, handleAPIError, usersAPI } from "@/lib/api"
import { 
  User, Users, Mail, Building2, Shield, Calendar, Settings, 
  Zap, Database, HelpCircle, Plus, Download, Search,
  Phone, Trash2, FileText, Palette, Globe
} from "lucide-react"

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  // Navigation state
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  
  // Modal states
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
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  
  // Form states
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user")
  const [tempPassword, setTempPassword] = useState("")
  
  // General states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [users, setUsers] = useState<any[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [logoSaving, setLogoSaving] = useState(false)
  
  // Auth and signature
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

  // Google Workspace integration state - simplified (no org config needed)

  // API call monitoring
  const [apiCallCount, setApiCallCount] = useState(0)
  const [lastResetTime, setLastResetTime] = useState(Date.now())

  const trackApiCall = (endpoint: string) => {
    setApiCallCount(prev => {
      const newCount = prev + 1
      const now = Date.now()
      
      // Reset counter every minute
      if (now - lastResetTime > 60000) {
        // Debug: console.log(`API calls in last minute: ${newCount}`)
        if (newCount > 20) {
          // Debug: console.warn('⚠️ HIGH API CALL FREQUENCY DETECTED')
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
      // Debug: console.error('Failed to load O365 config:', err)
    }
  }

  const loadO365UserConnection = async () => {
    try {
      const connection = await o365API.getUserConnection()
      setO365UserConnection(connection)
    } catch (err) {
      // Don't spam logs for 404 - no user connection exists yet
      if (err.status !== 404) {
        // Debug: console.error('Failed to load O365 user connection:', err)
      }
      setO365UserConnection(null)
    }
  }

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      const userData = await usersAPI.getAll()
      // Debug: console.log('Loaded users:', userData)
      setUsers(userData || [])
    } catch (err) {
      // Debug: console.error('Failed to load users:', err)
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  // Removed loadGoogleConfig - no longer needed with centralized OAuth

  // Circuit breaker state
  const [failureCount, setFailureCount] = useState(0)
  const MAX_FAILURES = 3
  const BACKOFF_TIME = 30000 // 30 seconds
  const [isCircuitBreakerActive, setIsCircuitBreakerActive] = useState(false)

  const fetchWithCircuitBreaker = async (url: string, options: RequestInit = {}) => {
    // Debug: console.log('fetchWithCircuitBreaker called:', url, options.method || 'GET')
    // Track API call
    trackApiCall(url)

    // Emergency disable check
    if (process.env.NEXT_PUBLIC_DISABLE_POLLING === 'true') {
      // Debug: console.log('Polling disabled by environment variable')
      return null
    }

    if (failureCount >= MAX_FAILURES) {
      // Debug: console.log('Circuit breaker active - skipping API call')
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
      // Debug: console.error(`API call failed (${newFailureCount}/${MAX_FAILURES}):`, error)
      
      if (newFailureCount >= MAX_FAILURES) {
        // Debug: console.log(`Circuit breaker activated. Waiting ${BACKOFF_TIME}ms`)
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

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) return
    
    setLoading(true)
    setError("")
    setSuccess("")
    
    try {
      await usersAPI.delete(userId)
      setSuccess('User removed successfully')
      // Reload users list
      await loadUsers()
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = async (user: any) => {
    // For now, just show a message. Full edit functionality can be added later
    alert('Edit functionality coming soon')
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

  // Removed Google org config handlers - no longer needed with centralized OAuth

  // Load data on mount
  useEffect(() => {
    if (hasLoaded) return
    
    // Debug: console.log("Settings page loading...")
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
    
    // Google config loading removed - using centralized OAuth
    
    setHasLoaded(true)
  }, [user?.role]) // Only depend on user role to avoid re-renders

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileTab()
      case 'team':
        return renderTeamTab()
      case 'integrations':
        return renderIntegrationsTab()
      case 'organization':
        return renderOrganizationTab()
      case 'data':
        return renderDataTab()
      case 'support':
        return renderSupportTab()
      default:
        return renderProfileTab()
    }
  }

  function renderProfileTab() {
    return (
      <div className="space-y-6">
        {/* Profile Settings */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Profile Settings</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                {user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}`
                  : 'Not set'
                }
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                {user?.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm capitalize">
                {user?.role}
              </div>
            </div>
          </div>
        </div>

        {/* Email Signature */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5" />
              <div>
                <h2 className="text-lg font-semibold">Email Signature</h2>
                <p className="text-sm text-gray-600">Configure your automatic email signature</p>
              </div>
            </div>
            <button
              onClick={() => setShowSignatureBuilder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {signature ? 'Edit Signature' : 'Create Signature'}
            </button>
          </div>

          {signature && signature.enabled ? (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Preview:</h3>
              <div className="text-sm whitespace-pre-wrap">
                {(() => {
                  let preview = ""
                  if (signature.name) preview += `${signature.name}\n`
                  if (signature.title) preview += `${signature.title}\n`
                  if (signature.company) preview += `${signature.company}\n`
                  if (signature.phone || signature.email) {
                    preview += "\n"
                    if (signature.phone) preview += `Phone: ${signature.phone}\n`
                    if (signature.email) preview += `Email: ${signature.email}\n`
                  }
                  if (signature.website) preview += `Website: ${signature.website}\n`
                  if (signature.customText) preview += `\n${signature.customText}\n`
                  return preview || "No signature configured"
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No email signature configured</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderTeamTab() {
    if (!isAdmin(user)) return <div>Access denied</div>

    return (
      <div className="space-y-6">
        {/* Team Header */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" />
              <div>
                <h2 className="text-lg font-semibold">Team Management</h2>
                <p className="text-sm text-gray-600">Manage users in your organization</p>
              </div>
            </div>
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Users Grid */}
        <div className="space-y-4">
          {usersLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Loading users...</p>
            </div>
          ) : users.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {users.map((teamUser) => (
                <UserManagementCard
                  key={teamUser.id}
                  user={teamUser}
                  currentUserId={user?.id}
                  onEdit={handleEditUser}
                  onDelete={handleDeleteUser}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  function renderIntegrationsTab() {
    return (
      <div className="space-y-6">
        {/* Integrations Header */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-5 h-5" />
            <div>
              <h2 className="text-lg font-semibold">Integrations</h2>
              <p className="text-sm text-gray-600">Connect with third-party services</p>
            </div>
          </div>
        </div>

        {/* Integration Cards */}
        <div className="space-y-6">
          {/* Office 365 */}
          <IntegrationCard
            name="Office 365"
            description="Connect with Microsoft Office 365 for calendar sync, email sending, and contact management"
            icon={Calendar}
            connected={!!o365UserConnection}
            connectedEmail={o365UserConnection?.o365_email}
            testStatus={o365Config?.last_test_success ? 'success' : o365Config ? 'failed' : null}
            features={o365Config ? [
              {
                name: "Calendar Sync",
                enabled: o365Config.calendar_sync_enabled,
                icon: Calendar,
                description: "Sync events and meetings"
              },
              {
                name: "Email Sending",
                enabled: o365Config.email_sending_enabled,
                icon: Mail,
                description: "Send emails through Office 365"
              },
              {
                name: "Contact Sync",
                enabled: o365Config.contact_sync_enabled,
                icon: Users,
                description: "Sync contact information"
              }
            ] : []}
            onConnect={o365Config && !o365UserConnection ? async () => {
              try {
                const { auth_url } = await o365IntegrationAPI.getAuthUrl()
                window.open(auth_url, 'o365-auth', 'width=600,height=700')
              } catch (error) {
                setError(handleAPIError(error))
              }
            } : undefined}
            onDisconnect={o365UserConnection ? handleDisconnectO365User : undefined}
            onConfigure={user?.role === 'owner' ? () => setShowO365Config(true) : undefined}
            canConfigure={user?.role === 'owner'}
          />

          {/* Google Workspace */}
          <GoogleConnection />
        </div>
      </div>
    )
  }

  function renderOrganizationTab() {
    if (!isAdmin(user)) return <div>Access denied</div>

    return (
      <div className="space-y-6">
        {/* Organization Info */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Organization Information</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Organization Name</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                {organization?.name || 'Loading...'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Organization ID</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-mono">
                {organization?.slug || 'Loading...'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Plan</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm">
                {organization?.plan || 'Free'} Plan
              </div>
            </div>
          </div>
        </div>

        {/* Project Types Management */}
        {(user?.role === 'owner' || user?.role === 'admin') && (
          <div className="bg-white border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <div>
                  <h2 className="text-lg font-semibold">Project Types</h2>
                  <p className="text-sm text-gray-600">Customize project types for your organization</p>
                </div>
              </div>
              <a
                href="/settings/project-types"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Manage Types
              </a>
            </div>
            <p className="text-sm text-gray-600">
              Define custom project types that match your organization's workflow for better categorization and reporting.
            </p>
          </div>
        )}

        {/* Organization Logo */}
        {(user?.role === 'owner' || user?.role === 'admin') && (
          <LogoUploader
            currentLogoUrl={organization?.logo_url}
            saving={logoSaving}
            onSave={async (logoUrl) => {
              setLogoSaving(true)
              try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
                const response = await fetch(`${baseUrl}/api/organization/logo`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                  },
                  body: JSON.stringify({
                    logo_url: logoUrl
                  })
                })
                
                if (response.ok) {
                  const data = await response.json()
                  setOrganization(data)
                  // Reload page to update logo in navigation
                  setTimeout(() => {
                    window.location.reload()
                  }, 500)
                } else {
                  throw new Error('Failed to update logo')
                }
              } catch (error) {
                console.error('Failed to update logo:', error)
                throw error
              } finally {
                setLogoSaving(false)
              }
            }}
          />
        )}

        {/* Brand Colors */}
        {(user?.role === 'owner' || user?.role === 'admin') && (
          <ColorThemePicker
            currentTheme={{
              primary: organization?.theme_primary_color || '#3B82F6',
              secondary: organization?.theme_secondary_color || '#1E40AF',
              accent: organization?.theme_accent_color || '#60A5FA'
            }}
            onSave={async (colors) => {
              try {
                const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
                const response = await fetch(`${baseUrl}/api/organization/theme`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                  },
                  body: JSON.stringify({
                    theme_primary_color: colors.primary,
                    theme_secondary_color: colors.secondary,
                    theme_accent_color: colors.accent
                  })
                })
                
                if (response.ok) {
                  const data = await response.json()
                  setOrganization(data)
                  // Reload page to apply new theme
                  window.location.reload()
                } else {
                  throw new Error('Failed to update theme')
                }
              } catch (error) {
                console.error('Failed to update theme:', error)
                throw error
              }
            }}
          />
        )}
      </div>
    )
  }

  function renderDataTab() {
    if (user?.role !== 'owner') return <div>Access denied</div>

    return (
      <div className="space-y-6">
        {/* Data Management Header */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5" />
            <div>
              <h2 className="text-lg font-semibold">Data Management</h2>
              <p className="text-sm text-gray-600">Clean and standardize your organization's data</p>
            </div>
          </div>
        </div>

        {/* Phone Standardization */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-5 h-5" />
            <div>
              <h3 className="text-lg font-semibold">Phone Number Standardization</h3>
              <p className="text-sm text-gray-600">Standardize all phone numbers to format: (XXX) XXX-XXXX</p>
            </div>
          </div>
          
          <div className="flex gap-3">
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
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400"
              disabled={isLoadingPhone}
            >
              <Search className="w-4 h-4" />
              {isLoadingPhone ? 'Loading...' : 'Preview Changes'}
            </button>
            <button
              onClick={async () => {
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
                  } else {
                    alert('Failed to standardize phone numbers')
                  }
                } catch (error) {
                  alert('Error standardizing phone numbers')
                } finally {
                  setIsLoadingPhone(false)
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={isLoadingPhone}
            >
              <Phone className="w-4 h-4" />
              {isLoadingPhone ? 'Loading...' : 'Standardize Now'}
            </button>
          </div>
        </div>

        {/* Duplicate Detection */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5" />
            <div>
              <h3 className="text-lg font-semibold">Duplicate Detection</h3>
              <p className="text-sm text-gray-600">Find and remove duplicate records from your database</p>
            </div>
          </div>
          
          <div className="flex gap-3">
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
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              disabled={isLoadingDuplicates}
            >
              <Building2 className="w-4 h-4" />
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
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              disabled={isLoadingDuplicates}
            >
              <User className="w-4 h-4" />
              {isLoadingDuplicates ? 'Searching...' : 'Find Duplicate Contacts'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderSupportTab() {
    return (
      <div className="space-y-6">
        {/* Support Header */}
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5" />
              <div>
                <h2 className="text-lg font-semibold">Support & Help</h2>
                <p className="text-sm text-gray-600">Get help and contact our support team</p>
              </div>
            </div>
            <button
              onClick={() => setShowSupportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </button>
          </div>
        </div>

        {/* Support Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-lg p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Technical Support</h3>
                <p className="text-sm text-gray-600">Report bugs and technical issues</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Get help with login issues, errors, or other technical problems. Our team typically responds within 24 hours.
            </p>
          </div>

          <div className="bg-white border rounded-lg p-6 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Feature Requests</h3>
                <p className="text-sm text-gray-600">Suggest improvements and new features</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Have an idea for a new feature? We'd love to hear from you! Help us make the CRM better for everyone.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              <Settings className="w-6 h-6" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">Manage your CRM preferences and configurations</p>
          </div>

          {/* Success/Error Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 mb-6">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
          
          {success && (
            <div className="rounded-lg bg-green-50 p-4 mb-6">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Navigation Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg border p-4 sticky top-8">
                <SettingsNavigation
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  isAdmin={isAdmin(user)}
                  isOwner={user?.role === 'owner'}
                />
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              {renderTabContent()}
            </div>
          </div>
        </div>

        {/* All Modals */}
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete Configuration
                        </button>
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowO365Config(false)}
                        className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={o365Loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
                    className="ml-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </MainLayout>
    </AuthGuard>
  )
}