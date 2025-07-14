"use client"

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ProjectStage, Project } from '@/lib/api'
import ProjectCard from './ProjectCard'

interface ProjectKanbanColumnProps {
  stage: ProjectStage
  projects: Project[]
  onAddProject?: (stageId?: number) => void
  onEditProject?: (project: Project) => void
}

export default function ProjectKanbanColumn({ 
  stage, 
  projects, 
  onAddProject, 
  onEditProject 
}: ProjectKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage.id}`,
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  const calculateProjectValue = (project: Project) => {
    if (project.hourly_rate && project.projected_hours) {
      return project.hourly_rate * project.projected_hours
    }
    return 0
  }

  const totalValue = projects.reduce((sum, project) => sum + calculateProjectValue(project), 0)
  const totalHours = projects.reduce((sum, project) => sum + (project.projected_hours || 0), 0)

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
            {projects.length}
          </span>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Total Value:</span>
            <span className="font-medium">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>Total Hours:</span>
            <span className="font-medium">{totalHours.toFixed(0)}h</span>
          </div>
        </div>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-3 min-h-96 transition-colors ${
          isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
      >
        {projects.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            No projects in this stage
          </div>
        ) : (
          projects.map((project) => (
            <ProjectCard key={project.id} project={project} onEdit={onEditProject} />
          ))
        )}

        {/* Add Project Button */}
        {onAddProject && (
          <button
            onClick={() => onAddProject(stage.id)}
            className="w-full p-3 text-sm text-gray-600 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add Project
          </button>
        )}
      </div>
    </div>
  )
}