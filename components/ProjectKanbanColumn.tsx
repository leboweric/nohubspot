"use client"

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ProjectStage, Project } from '@/lib/api'
import ProjectCardWithAttachments from './ProjectCardWithAttachments'

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
    <div className="flex flex-col w-80 bg-white border border-gray-200 rounded-lg">
      {/* Column Header */}
      <div 
        className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg border-l-4"
        style={{ borderLeftColor: 'var(--theme-primary)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900">{stage.name}</h3>
          <span 
            className="text-sm font-medium px-2 py-0.5 rounded-full"
            style={{ 
              backgroundColor: 'var(--theme-primary-background)',
              color: 'var(--theme-primary)'
            }}
          >
            {projects.length}
          </span>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Total Value: <span className="font-medium text-gray-700">{formatCurrency(totalValue)}</span>
          </span>
          <span>
            Total Hours: <span className="font-medium text-gray-700">{totalHours.toFixed(0)}h</span>
          </span>
        </div>
      </div>

      {/* Droppable Area */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-3 min-h-96 transition-colors bg-gray-50 ${
          isOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
        }`}
      >
        {projects.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm border-2 border-dashed border-gray-300 rounded-lg bg-white">
            No projects in this stage
          </div>
        ) : (
          projects.map((project) => (
            <ProjectCardWithAttachments 
              key={project.id} 
              project={project} 
              onEdit={onEditProject} 
              onUpdate={() => window.location.reload()}
            />
          ))
        )}

        {/* Add Project Button */}
        {onAddProject && (
          <button
            onClick={() => onAddProject(stage.id)}
            className="w-full p-3 text-sm border-2 border-dashed rounded-lg transition-all"
            style={{
              borderColor: 'var(--theme-primary-border)',
              color: 'var(--theme-primary)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--theme-primary-background)';
              e.currentTarget.style.borderColor = 'var(--theme-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '';
              e.currentTarget.style.borderColor = 'var(--theme-primary-border)';
            }}
          >
            + Add Project
          </button>
        )}
      </div>
    </div>
  )
}