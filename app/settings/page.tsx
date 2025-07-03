"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import SignatureBuilder, { EmailSignature } from "@/components/signature/SignatureBuilder"
import { useEmailSignature } from "@/components/signature/SignatureManager"
import { getAuthState, isAdmin } from "@/lib/auth"

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
  const { user, tenant } = getAuthState()

  useEffect(() => {
    if (isAdmin(user)) {
      loadUsers()
      loadInvites()
    }
  }, [user])

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

  const handleSaveSignature = (newSignature: EmailSignature) => {
    saveSignature(newSignature)
    setShowSignatureBuilder(false)
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
                {tenant?.name || 'Loading...'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Organization ID</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono">
                {tenant?.slug || 'Loading...'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Plan</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {tenant?.plan || 'Free'} Plan
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
            <h3 className="text-lg font-semibold mb-4">Invite User to {tenant?.name}</h3>
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