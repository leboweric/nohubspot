"use client"

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PipelineStage, Deal } from '@/lib/api'
import DealCard from './pipeline/DealCard'

interface KanbanColumnProps {
  stage: PipelineStage
  deals: Deal[]
  onAddDeal?: (stageId?: number) => void
  onEditDeal?: (deal: Deal) => void
  onDeleteDeal?: (dealId: number) => void
}

export default function KanbanColumn({ stage, deals, onAddDeal, onEditDeal, onDeleteDeal }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
  })

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value)
  }

  const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0)
  const weightedValue = deals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0)
  
  // Draggable Deal Card Wrapper
  function DraggableDealCard({ deal, onEdit, onDelete }: { 
    deal: Deal; 
    onEdit?: (deal: Deal) => void; 
    onDelete?: (dealId: number) => void 
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({
      id: deal.id,
    })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <DealCard
          deal={deal}
          onEdit={onEdit || (() => {})}
          onDelete={onDelete || (() => {})}
          isDragging={isDragging}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col w-80 bg-gray-50 rounded-lg">
      {/* Column Header */}
      <div 
        className="p-4 border-b bg-white rounded-t-lg"
        style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{stage.name}</h3>
          <span className="text-sm text-gray-500">
            {deals.length}
          </span>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Total:</span>
            <span className="font-medium">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Weighted:</span>
            <span className="font-medium">{formatCurrency(weightedValue)}</span>
          </div>
        </div>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-3 min-h-[400px] transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
      >
        {deals.map((deal) => (
          <DraggableDealCard 
            key={deal.id} 
            deal={deal} 
            onEdit={onEditDeal} 
            onDelete={onDeleteDeal} 
          />
        ))}
        
        {deals.length === 0 && (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            No deals in this stage
          </div>
        )}

        {/* Add Deal Button */}
        {onAddDeal && (
          <button
            onClick={() => onAddDeal(stage.id)}
            className="w-full p-3 text-sm text-gray-600 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add Deal
          </button>
        )}
      </div>
    </div>
  )
}