"use client"

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Deal } from '@/lib/api'

interface DealCardProps {
  deal: Deal
  isDragging?: boolean
  onEdit?: (deal: Deal) => void
}

export default function DealCard({ deal, isDragging = false, onEdit }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value)
  }

  const getPriorityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (probability >= 60) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (probability >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(deal)
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
          title="Edit deal"
        >
          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}

      {/* Deal Header */}
      <div className="mb-2">
        <h4 className="font-semibold text-sm text-gray-900 truncate">
          {deal.title}
        </h4>
        <div className="flex items-center justify-between mt-1">
          <div className="text-lg font-bold text-blue-600">
            {formatCurrency(deal.value, deal.currency)}
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(deal.probability)}`}>
            {deal.probability}%
          </div>
        </div>
      </div>

      {/* Deal Details */}
      <div className="space-y-1 text-xs text-gray-600">
        {deal.contact_name && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">Contact: {deal.contact_name}</span>
          </div>
        )}
        
        {deal.company_name && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">Company: {deal.company_name}</span>
          </div>
        )}
        
        {deal.assignee_name && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">Assigned: {deal.assignee_name}</span>
          </div>
        )}
        
        {deal.expected_close_date && (
          <div className="flex items-center">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
            <span className="truncate">
              Close: {new Date(deal.expected_close_date).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Deal Description */}
      {deal.description && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-600 line-clamp-2">
            {deal.description}
          </p>
        </div>
      )}

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {deal.tags.slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
            >
              {tag}
            </span>
          ))}
          {deal.tags.length > 2 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              +{deal.tags.length - 2}
            </span>
          )}
        </div>
      )}
    </div>
  )
}