"use client"

import { useState } from "react"
import Link from "next/link"
import { Deal } from "@/lib/api"
import { 
  Calendar, Clock, AlertCircle, DollarSign, User, Building2,
  MoreVertical, Edit, Trash2, Flag, Phone, Mail, Users,
  TrendingUp, Target, CheckCircle, AlertTriangle
} from "lucide-react"

interface DealCardProps {
  deal: Deal
  onEdit: (deal: Deal) => void
  onDelete: (dealId: number) => void
  onMove?: (dealId: number, newStageId: number) => void
  isDragging?: boolean
}

export default function DealCard({ deal, onEdit, onDelete, onMove, isDragging }: DealCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  const getPriorityColor = (value: number, probability: number) => {
    // All priorities now use subtle gray
    return 'bg-gray-400'
  }
  
  const getPriorityIcon = (value: number, probability: number) => {
    if (value >= 100000 && probability >= 70) return AlertCircle
    if (value >= 50000 && probability >= 50) return Flag
    return Target
  }
  
  const getHealthStatus = () => {
    const now = new Date()
    const closeDate = deal.expected_close_date ? new Date(deal.expected_close_date) : null
    const updatedDate = new Date(deal.updated_at)
    const daysSinceUpdate = Math.floor((now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // Health logic - all using subtle gray
    if (closeDate && closeDate < now && deal.stage_name !== 'Closed Won') {
      return { status: 'overdue', color: 'text-gray-600 bg-gray-100', icon: AlertTriangle, label: 'Overdue' }
    } else if (daysSinceUpdate > 14) {
      return { status: 'stalled', color: 'text-gray-600 bg-gray-100', icon: AlertCircle, label: 'Stalled' }
    } else if (deal.probability >= 80) {
      return { status: 'hot', color: 'text-gray-600 bg-gray-100', icon: TrendingUp, label: 'Hot' }
    } else if (closeDate) {
      const daysToClose = Math.floor((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToClose <= 7 && daysToClose > 0) {
        return { status: 'closing', color: 'text-gray-600 bg-gray-100', icon: Target, label: 'Closing Soon' }
      }
    }
    
    return { status: 'active', color: 'text-gray-600 bg-gray-100', icon: CheckCircle, label: 'Active' }
  }
  
  const getCloseDateStatus = () => {
    if (!deal.expected_close_date) return null
    
    const closeDate = new Date(deal.expected_close_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    closeDate.setHours(0, 0, 0, 0)
    
    const diffTime = closeDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { text: `Overdue ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`, color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays === 0) {
      return { text: 'Closes today', color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays === 1) {
      return { text: 'Closes tomorrow', color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays <= 7) {
      return { text: `Closes in ${diffDays} days`, color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays <= 30) {
      return { text: `Closes in ${diffDays} days`, color: 'text-gray-600 bg-gray-100' }
    } else {
      return { text: closeDate.toLocaleDateString(), color: 'text-gray-600 bg-gray-100' }
    }
  }
  
  const formatCurrency = (value: number, currency = 'USD') => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
  }
  
  const priorityColor = getPriorityColor(deal.value, deal.probability)
  const PriorityIcon = getPriorityIcon(deal.value, deal.probability)
  const healthStatus = getHealthStatus()
  const closeDateStatus = getCloseDateStatus()
  const HealthIcon = healthStatus.icon
  
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-gray-300 transition-all duration-200 ${
      isDragging ? 'opacity-50 rotate-2 scale-105' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Priority indicator - subtle gray */}
          <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></div>
        </div>
        
        {/* Health status badge - subtle gray */}
        <div className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100 flex items-center gap-1">
          <HealthIcon className="w-3 h-3" />
          {healthStatus.label}
        </div>
        
        {/* Menu button */}
        <div className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
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
                    onEdit(deal)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 text-left"
                >
                  <Edit className="w-4 h-4" />
                  Edit Deal
                </button>
                <Link
                  href={`/contacts/new?dealId=${deal.id}&company=${encodeURIComponent(deal.company_name || '')}`}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 text-left"
                  onClick={() => setShowMenu(false)}
                >
                  <Users className="w-4 h-4" />
                  Add Contact
                </Link>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDelete(deal.id)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Deal
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Deal title and value */}
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
          {deal.title}
        </h3>
        
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold text-gray-700">
            {formatCurrency(deal.value, deal.currency)}
          </span>
          <span className="text-xs text-gray-500">
            {deal.probability}% • ${Math.round(deal.value * deal.probability / 100).toLocaleString()} weighted
          </span>
        </div>
      </div>
      
      {/* Deal info */}
      <div className="space-y-2 text-sm text-gray-600 mb-3">
        {deal.contact_name && (
          <div className="flex items-center gap-2">
            <User className="w-3 h-3" />
            <Link
              href={`/contacts/${deal.primary_contact_id}`}
              className="hover:text-primary transition-colors truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {deal.contact_name}
            </Link>
          </div>
        )}
        
        {deal.company_name && (
          <div className="flex items-center gap-2">
            <Building2 className="w-3 h-3" />
            <Link
              href={`/companies/${deal.company_id}`}
              className="hover:text-primary transition-colors truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {deal.company_name}
            </Link>
          </div>
        )}
        
        {deal.assignee_name && (
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span className="truncate">{deal.assignee_name}</span>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-3 text-xs">
          {/* Close date - subtle */}
          {closeDateStatus && (
            <span className="px-2 py-1 rounded-full text-gray-600 bg-gray-100">
              {closeDateStatus.text}
            </span>
          )}
        </div>
        
        {/* Quick actions */}
        <div className="flex items-center gap-1">
          {deal.contact_name && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.location.href = `mailto:${deal.contact_name}`
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Send email"
            >
              <Mail className="w-3 h-3 text-gray-500" />
            </button>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(deal)
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Edit deal"
          >
            <Edit className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}