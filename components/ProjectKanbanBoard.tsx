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
import { ProjectStage, Project } from '@/lib/api'
import ProjectKanbanColumn from './ProjectKanbanColumn'
import ProjectCard from './ProjectCard'

interface ProjectKanbanBoardProps {
  stages: ProjectStage[]
  projects: Project[]
  onProjectMove: (projectId: number, newStageId: number) => Promise<void>
  onAddProject?: (stageId?: number) => void
  onEditProject?: (project: Project) => void
}

export default function ProjectKanbanBoard({ 
  stages, 
  projects, 
  onProjectMove, 
  onAddProject, 
  onEditProject 
}: ProjectKanbanBoardProps) {
  const [activeProject, setActiveProject] = React.useState<Project | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const getProjectsForStage = (stageId: number): Project[] => {
    return projects.filter(project => project.stage_id === stageId && project.is_active)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const projectId = active.id as number
    const project = projects.find(p => p.id === projectId)
    setActiveProject(project || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveProject(null)

    if (!over) return

    const projectId = active.id as number
    const overId = over.id as string

    // Check if we're dropping over a stage column
    const targetStageId = parseInt(overId.replace('stage-', ''))
    
    if (isNaN(targetStageId)) return

    const project = projects.find(p => p.id === projectId)
    if (!project || project.stage_id === targetStageId) return

    try {
      await onProjectMove(projectId, targetStageId)
    } catch (error) {
      console.error('Failed to move project:', error)
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
            const stageProjects = getProjectsForStage(stage.id)
            const projectIds = stageProjects.map(project => project.id as UniqueIdentifier)

            return (
              <SortableContext
                key={stage.id}
                items={projectIds}
                strategy={verticalListSortingStrategy}
              >
                <ProjectKanbanColumn
                  stage={stage}
                  projects={stageProjects}
                  onAddProject={onAddProject}
                  onEditProject={onEditProject}
                />
              </SortableContext>
            )
          })}
        </div>

        <DragOverlay>
          {activeProject ? (
            <div className="rotate-2 opacity-90">
              <ProjectCard project={activeProject} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}