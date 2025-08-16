"use client"

import { useState } from "react"
import Link from "next/link"
import { Project } from "@/lib/api"
import { 
  Calendar, Clock, AlertCircle, DollarSign, User, Building2,
  MoreVertical, Edit, Trash2, Flag, CheckCircle, AlertTriangle,
  TrendingUp, Target, Users, Play, Pause
} from "lucide-react"

interface ProjectCardProps {
  project: Project
  onEdit: (project: Project) => void
  onDelete: (projectId: number) => void
  isDragging?: boolean
}

export default function ProjectCard({ project, onEdit, onDelete, isDragging }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  const calculateProjectValue = (project: Project) => {
    if (!project.hourly_rate || !project.projected_hours) return 0
    return project.hourly_rate * project.projected_hours
  }
  
  const getProgressPercentage = () => {
    const actualHours = project.actual_hours || 0
    const projectedHours = project.projected_hours || 0
    if (projectedHours === 0) return 0
    return Math.min(100, Math.round((actualHours / projectedHours) * 100))
  }
  
  const getPriorityColor = (value: number, daysToDeadline: number | null) => {
    if (value >= 50000 && daysToDeadline !== null && daysToDeadline <= 14) return 'bg-gray-600' // High value, urgent deadline
    if (value >= 25000 || (daysToDeadline !== null && daysToDeadline <= 7)) return 'bg-gray-500' // Medium-high
    if (value >= 10000 || (daysToDeadline !== null && daysToDeadline <= 30)) return 'bg-gray-400' // Medium
    return 'bg-gray-300' // Low priority
  }
  
  const getPriorityIcon = (value: number, daysToDeadline: number | null) => {
    if (value >= 50000 && daysToDeadline !== null && daysToDeadline <= 14) return AlertCircle
    if (value >= 25000 || (daysToDeadline !== null && daysToDeadline <= 7)) return Flag
    return Target
  }
  
  const getHealthStatus = () => {
    const now = new Date()
    const endDate = project.projected_end_date ? new Date(project.projected_end_date) : null
    const actualHours = project.actual_hours || 0
    const projectedHours = project.projected_hours || 0
    const progressPercentage = getProgressPercentage()
    
    // Health logic
    if (endDate && endDate < now && project.stage_name !== 'Completed') {
      return { status: 'overdue', color: 'text-gray-700 bg-gray-100', icon: AlertTriangle, label: 'Overdue' }
    } else if (projectedHours > 0 && actualHours > projectedHours * 1.2) {
      return { status: 'over_budget', color: 'text-gray-700 bg-gray-100', icon: AlertCircle, label: 'Over Budget' }
    } else if (endDate) {
      const daysToEnd = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysToEnd <= 7 && daysToEnd > 0) {
        return { status: 'due_soon', color: 'text-gray-600 bg-gray-100', icon: Clock, label: 'Due Soon' }
      } else if (projectedHours > 0 && actualHours > projectedHours * 1.1) {
        return { status: 'at_risk', color: 'text-gray-600 bg-gray-100', icon: AlertCircle, label: 'At Risk' }
      } else if (progressPercentage >= 80) {
        return { status: 'nearly_done', color: 'text-gray-600 bg-gray-100', icon: CheckCircle, label: 'Nearly Done' }
      }
    }
    
    if (progressPercentage > 0) {
      return { status: 'in_progress', color: 'text-gray-600 bg-gray-100', icon: Play, label: 'In Progress' }
    }
    
    return { status: 'not_started', color: 'text-gray-600 bg-gray-100', icon: Pause, label: 'Not Started' }
  }
  
  const getDeadlineStatus = () => {
    if (!project.projected_end_date) return null
    
    const endDate = new Date(project.projected_end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    endDate.setHours(0, 0, 0, 0)
    
    const diffTime = endDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { text: `Overdue ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`, color: 'text-gray-700 bg-gray-100' }
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, color: 'text-gray-600 bg-gray-100' }
    } else if (diffDays <= 30) {
      return { text: `Due in ${diffDays} days`, color: 'text-gray-600 bg-gray-100' }
    } else {
      return { text: endDate.toLocaleDateString(), color: 'text-gray-600 bg-gray-100' }
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
  
  const projectValue = calculateProjectValue(project)
  const endDate = project.projected_end_date ? new Date(project.projected_end_date) : null
  const daysToDeadline = endDate ? Math.floor((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
  const priorityColor = getPriorityColor(projectValue, daysToDeadline)
  const PriorityIcon = getPriorityIcon(projectValue, daysToDeadline)
  const healthStatus = getHealthStatus()
  const deadlineStatus = getDeadlineStatus()
  const HealthIcon = healthStatus.icon
  const progressPercentage = getProgressPercentage()
  
  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all duration-200 ${
      isDragging ? 'opacity-50 rotate-2 scale-105' : ''
    }`}
      style={{
        borderColor: isDragging ? 'var(--color-secondary)' : undefined,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = '';
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Priority indicator - using theme color */}
          <div 
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          ></div>
        </div>
        
        {/* Health status badge - using theme color */}
        <div 
          className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
          style={{ 
            backgroundColor: 'var(--color-neutral-100)',
            color: 'var(--color-neutral-700)'
          }}
        >
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
                    onEdit(project)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 text-left"
                >
                  <Edit className="w-4 h-4" />
                  Edit Project
                </button>
                <Link
                  href={`/contacts/new?projectId=${project.id}&company=${encodeURIComponent(project.company_name || '')}`}
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
                    onDelete(project.id)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Project
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Project title and value */}
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
          {project.title}
        </h3>
        
        <div className="flex items-baseline gap-2 mb-2">
          <span 
            className="text-xl font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            {projectValue > 0 ? formatCurrency(projectValue) : 'TBD'}
          </span>
          {project.hourly_rate && (
            <span className="text-xs text-gray-500">
              ${project.hourly_rate}/hr • {project.projected_hours || 0}h
            </span>
          )}
        </div>
        
        {/* Progress bar */}
        {project.projected_hours && project.projected_hours > 0 && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress</span>
              <span>{progressPercentage}% ({project.actual_hours || 0}h / {project.projected_hours}h)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(progressPercentage, 100)}%`,
                  backgroundColor: 'var(--color-primary)'
                }}
              />
            </div>
          </div>
        )}
        
        {/* Project type badge */}
        {project.project_type && (
          <span className="inline-block text-gray-600 text-xs">
            {project.project_type}
          </span>
        )}
      </div>
      
      {/* Project info */}
      <div className="space-y-2 text-sm text-gray-600 mb-3">
        {project.contact_name && (
          <div className="flex items-center gap-2">
            <User className="w-3 h-3" />
            <Link
              href={`/contacts/${project.primary_contact_id}`}
              className="transition-colors truncate hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {project.contact_name}
            </Link>
          </div>
        )}
        
        {project.company_name && (
          <div className="flex items-center gap-2">
            <Building2 className="w-3 h-3" />
            <Link
              href={`/companies/${project.company_id}`}
              className="transition-colors truncate hover:opacity-80"
              style={{ color: 'var(--color-primary)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {project.company_name}
            </Link>
          </div>
        )}
        
        {project.assigned_team_member_names && project.assigned_team_member_names.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <span className="truncate">{project.assigned_team_member_names.join(', ')}</span>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex items-center gap-3 text-xs">
          {/* Deadline status - using theme */}
          {deadlineStatus && (
            <span 
              className="px-2 py-1 rounded-full text-xs"
              style={{ 
                backgroundColor: 'var(--color-neutral-100)',
                color: 'var(--color-neutral-700)'
              }}
            >
              {deadlineStatus.text}
            </span>
          )}
        </div>
        
        {/* Quick actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(project)
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Edit project"
          >
            <Edit className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}