"use client"

import { useState, useEffect } from "react"
import { X, User, Mail, Shield, AlertCircle } from "lucide-react"

interface UserData {
  id: number
  email: string
  first_name?: string
  last_name?: string
  role: 'owner' | 'admin' | 'user' | 'read_only'
  email_verified: boolean
  created_at: string
  last_login?: string
}

interface EditUserModalProps {
  user: UserData | null
  isOpen: boolean
  onClose: () => void
  onSave: (userId: number, updates: Partial<UserData>) => Promise<void>
  currentUserRole?: string
}

export default function EditUserModal({ 
  user, 
  isOpen, 
  onClose, 
  onSave,
  currentUserRole 
}: EditUserModalProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    role: 'user' as 'owner' | 'admin' | 'user' | 'read_only'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        role: user.role
      })
      setError("")
    }
  }, [user])

  if (!isOpen || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      await onSave(user.id, {
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
        role: formData.role
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  // Check if current user can change roles
  const canChangeRole = currentUserRole === 'owner' || (currentUserRole === 'admin' && user.role !== 'owner')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-semibold">Edit User</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Email (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>

            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="Enter first name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Enter last name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Shield className="w-4 h-4 inline mr-1" />
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                disabled={!canChangeRole || user.role === 'owner'}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                  !canChangeRole || user.role === 'owner' ? 'bg-gray-50 text-gray-500' : ''
                }`}
              >
                <option value="owner" disabled={currentUserRole !== 'owner'}>Owner</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
                <option value="read_only">Read Only</option>
              </select>
              {user.role === 'owner' && (
                <p className="text-xs text-gray-500 mt-1">Owner role cannot be changed</p>
              )}
              {!canChangeRole && user.role !== 'owner' && (
                <p className="text-xs text-gray-500 mt-1">You don't have permission to change roles</p>
              )}
            </div>

            {/* User Info */}
            <div className="pt-4 border-t">
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Created:</span> {new Date(user.created_at).toLocaleDateString()}
                </div>
                {user.last_login && (
                  <div>
                    <span className="font-medium">Last Login:</span> {new Date(user.last_login).toLocaleDateString()}
                  </div>
                )}
                <div>
                  <span className="font-medium">Email Verified:</span> {user.email_verified ? 'Yes' : 'No'}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}