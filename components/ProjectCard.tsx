"use client"

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Project } from '@/lib/api'

interface ProjectCardProps {
  project: Project
  isDragging?: boolean
  onEdit?: (project: Project) => void
}

export default function ProjectCard({ project, isDragging = false, onEdit }: ProjectCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: project.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const calculateProjectValue = () => {
    if (project.hourly_rate && project.projected_hours) {
      return project.hourly_rate * project.projected_hours
    }
    return 0
  }

  const getProjectTypeColor = (type?: string) => {
    if (!type) return 'text-gray-600 bg-gray-50 border-gray-200'
    
    // Color mapping for different project types - all subtle grays
    const colorMap: { [key: string]: string } = {
      'Strategic Planning': 'text-gray-700 bg-gray-50 border-gray-200',
      'Board Development': 'text-gray-600 bg-gray-50 border-gray-200',
      'Capital Campaign': 'text-gray-600 bg-gray-50 border-gray-200',
      'Grant Writing': 'text-gray-600 bg-gray-50 border-gray-200',
      'Fundraising Training': 'text-gray-600 bg-gray-50 border-gray-200',
      'Executive Search': 'text-gray-700 bg-gray-50 border-gray-200',
    }
    
    return colorMap[type] || 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(project)
    }
  }

  const cardClasses = `
    bg-white border rounded-lg p-3 cursor-grab active:cursor-grabbing
    hover:shadow-md transition-shadow relative group
    ${isDragging || isSortableDragging ? 'shadow-lg opacity-90' : ''}
    ${isSortableDragging ? 'z-50' : ''}
  `.trim()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cardClasses}
    >
      {/* Edit Button - Appears on hover */}
      {onEdit && (
        <button
          onClick={handleEdit}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md rounded-full p-1 hover:bg-gray-50 z-10"
          title="Edit project"
        >
          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}

      {/* Project Header */}
      <div className="mb-2">
        <h4 className="font-semibold text-sm text-gray-900 truncate">
          {project.title}
        </h4>
        <div className="flex items-center justify-between mt-1">
          <div className="text-lg font-bold text-blue-600">
            {calculateProjectValue() > 0 
              ? formatCurrency(calculateProjectValue())
              : 'TBD'
            }
          </div>
          {project.project_type && (
            <div className={`px-2 py-1 rounded text-xs font-medium border ${getProjectTypeColor(project.project_type)}`}>
              {project.project_type.length > 12 
                ? project.project_type.substring(0, 12) + '...'
                : project.project_type
              }
            </div>
          )}
        </div>
      </div>

      {/* Project Details */}
      <div className="space-y-1 text-xs text-gray-600">
        {project.company_name && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">Company: {project.company_name}</span>
          </div>
        )}
        
        {project.contact_name && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">Contact: {project.contact_name}</span>
          </div>
        )}
        
        {project.assigned_team_member_names && project.assigned_team_member_names.length > 0 && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">
              Consultant: {project.assigned_team_member_names[0]}
            </span>
          </div>
        )}
        
        {project.start_date && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">
              Started: {formatDate(project.start_date)}
            </span>
          </div>
        )}
        
        {project.projected_end_date && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">
              Due: {formatDate(project.projected_end_date)}
            </span>
          </div>
        )}

        {project.hourly_rate && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">
              Rate: {formatCurrency(project.hourly_rate)}/hr
            </span>
          </div>
        )}

        {project.projected_hours && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">
              Hours: {project.projected_hours}h projected
            </span>
          </div>
        )}
      </div>

      {/* Project Description */}
      {project.description && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-600 line-clamp-2">
            {project.description}
          </p>
        </div>
      )}

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {project.tags.slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
            >
              {tag}
            </span>
          ))}
          {project.tags.length > 2 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              +{project.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  )
}