"use client"

import { useState } from "react"
import { 
  User, Mail, Shield, CheckCircle, AlertCircle, 
  MoreVertical, Edit, UserX, Calendar
} from "lucide-react"

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

interface UserManagementCardProps {
  user: UserData
  currentUserId?: number
  onEdit?: (user: UserData) => void
  onDelete?: (userId: number) => void
}

export default function UserManagementCard({ 
  user, 
  currentUserId, 
  onEdit, 
  onDelete 
}: UserManagementCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  const getInitials = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    }
    return user.email[0].toUpperCase()
  }
  
  const getFullName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`
    }
    return user.email.split('@')[0]
  }
  
  const getRoleBadge = () => {
    const roleConfig = {
      owner: { label: 'Owner', color: 'bg-gray-100 text-gray-800', icon: Shield },
      admin: { label: 'Admin', color: 'bg-gray-100 text-gray-700', icon: Shield },
      user: { label: 'User', color: 'bg-gray-50 text-gray-600', icon: User },
      read_only: { label: 'Read Only', color: 'bg-gray-50 text-gray-500', icon: User }
    }
    
    const config = roleConfig[user.role] || roleConfig.user
    const Icon = config.icon
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </div>
    )
  }
  
  const getLastLoginText = () => {
    if (!user.last_login) return 'Never logged in'
    
    const lastLogin = new Date(user.last_login)
    const now = new Date()
    const diffMs = now.getTime() - lastLogin.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffDays > 30) return lastLogin.toLocaleDateString()
    if (diffDays > 0) return `${diffDays} days ago`
    if (diffHours > 0) return `${diffHours} hours ago`
    return 'Recently'
  }
  
  const isCurrentUser = user.id === currentUserId
  const canManage = !isCurrentUser && user.role !== 'owner'
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-gray-300 transition-all duration-200">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg shadow-md">
          {getInitials()}
        </div>
        
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {getFullName()}
                {isCurrentUser && (
                  <span className="ml-2 text-sm text-gray-500 font-normal">(You)</span>
                )}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-3 h-3 text-gray-400" />
                <span className="text-sm text-gray-600 truncate">{user.email}</span>
              </div>
            </div>
            
            {/* Menu */}
            {canManage && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
                
                {showMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-8 w-48 bg-white rounded-md shadow-lg z-20 border">
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          onEdit?.(user)
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 text-left"
                      >
                        <Edit className="w-4 h-4" />
                        Edit User
                      </button>
                      <hr className="my-1" />
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          onDelete?.(user.id)
                        }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                      >
                        <UserX className="w-4 h-4" />
                        Remove User
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Status and Role */}
          <div className="flex items-center gap-3 mb-3">
            {getRoleBadge()}
            
            <div className="flex items-center gap-1">
              {user.email_verified ? (
                <>
                  <CheckCircle className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">Verified</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-orange-600 font-medium">Unverified</span>
                </>
              )}
            </div>
          </div>
          
          {/* Additional Info */}
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-3 h-3" />
              <span>Last login: {getLastLoginText()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}