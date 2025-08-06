"use client"

import React from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { PipelineStage, Deal } from '@/lib/api'
import KanbanColumn from './KanbanColumn'
import DealCardWithAttachments from './DealCardWithAttachments'

interface KanbanBoardProps {
  stages: PipelineStage[]
  deals: Deal[]
  onDealMove: (dealId: number, newStageId: number) => Promise<void>
  onAddDeal?: (stageId?: number) => void
  onEditDeal?: (deal: Deal) => void
}

export default function KanbanBoard({ stages, deals, onDealMove, onAddDeal, onEditDeal }: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = React.useState<Deal | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const getDealsForStage = (stageId: number): Deal[] => {
    return deals.filter(deal => deal.stage_id === stageId && deal.is_active)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const dealId = active.id as number
    const deal = deals.find(d => d.id === dealId)
    setActiveDeal(deal || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeal(null)

    if (!over) return

    const dealId = active.id as number
    const overId = over.id as string

    // Check if we're dropping over a stage column
    const targetStageId = parseInt(overId.replace('stage-', ''))
    
    if (isNaN(targetStageId)) return

    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage_id === targetStageId) return

    try {
      await onDealMove(dealId, targetStageId)
    } catch (error) {
      console.error('Failed to move deal:', error)
      // You could add a toast notification here
    }
  }

  return (
    <div className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-full overflow-x-auto pb-6">
          {stages.map((stage) => {
            const stageDeals = getDealsForStage(stage.id)
            const dealIds = stageDeals.map(deal => deal.id as UniqueIdentifier)

            return (
              <SortableContext
                key={stage.id}
                items={dealIds}
                strategy={verticalListSortingStrategy}
              >
                <KanbanColumn
                  stage={stage}
                  deals={stageDeals}
                  onAddDeal={onAddDeal}
                  onEditDeal={onEditDeal}
                />
              </SortableContext>
            )
          })}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <div className="rotate-2 opacity-90">
              <DealCardWithAttachments deal={activeDeal} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}