"use client"

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Deal } from '@/lib/api'

interface DealCardProps {
  deal: Deal
  isDragging?: boolean
}

export default function DealCard({ deal, isDragging = false }: DealCardProps) {
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

  const cardClasses = `
    bg-white border rounded-lg p-3 cursor-grab active:cursor-grabbing
    hover:shadow-md transition-shadow
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