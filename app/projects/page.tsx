"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard"
import ProjectModal from "@/components/ProjectModal"
import { projectAPI, projectStageAPI, handleAPIError, ProjectStage, Project, ProjectCreate } from "@/lib/api"

export default function ProjectsPage() {
  const [stages, setStages] = useState<ProjectStage[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedStage, setSelectedStage] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [defaultStageId, setDefaultStageId] = useState<number | undefined>(undefined)

  useEffect(() => {
    loadProjectData()
  }, [])

  const loadProjectData = async () => {
    try {
      setLoading(true)
      setError("")
      
      // Load stages first
      const stagesData = await projectStageAPI.getStages()
      setStages(stagesData)
      
      // If no stages exist, offer to create defaults
      if (stagesData.length === 0) {
        setError("No project stages found. Would you like to create default stages?")
        return
      }
      
      // Load all projects
      const projectsData = await projectAPI.getProjects({ limit: 100 })
      setProjects(projectsData)
      
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setLoading(false)
    }
  }

  const initializeDefaultStages = async () => {
    try {
      setLoading(true)
      setError("")
      
      const result = await projectStageAPI.initializeDefaultStages()
      setSuccess(result.message)
      
      // Reload data
      await loadProjectData()
      
    } catch (err) {
      setError(handleAPIError(err))
      setLoading(false)
    }
  }


  const getProjectsForStage = (stageId: number) => {
    return projects.filter(project => project.stage_id === stageId && project.is_active)
  }

  const diagnoseProjects = async () => {
    try {
      const response = await fetch('/api/projects/stages/diagnostic', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Failed to run diagnostic')
      }
      
      const diagnostic = await response.json()
      
      // Show diagnostic info in alert for now
      const message = `
Diagnostic Results:
- Organization ID: ${diagnostic.organization_id}
- Total Projects: ${diagnostic.total_projects}
- Valid Projects: ${diagnostic.valid_projects_count}
- Invalid Projects: ${diagnostic.invalid_projects_count}

Available Stages:
${diagnostic.stages.map((s: any) => `- ${s.name} (ID: ${s.id})`).join('\n')}

${diagnostic.invalid_projects_count > 0 ? `
Invalid Projects (first 10):
${diagnostic.invalid_projects.map((p: any) => `- "${p.title}" has stage_id: ${p.stage_id}`).join('\n')}

These projects have stage IDs that don't match any of your organization's stages.
` : ''}
      `
      
      alert(message)
      
      // If there are invalid projects, offer to fix them
      if (diagnostic.invalid_projects_count > 0) {
        if (confirm('Would you like to reassign these projects to the Planning stage?')) {
          // For now, show instructions
          alert('Please run the SQL migration: fix_project_stage_assignments.sql in your database to fix this issue.')
        }
      }
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const calculateProjectValue = (project: Project) => {
    if (!project.hourly_rate || !project.projected_hours) return 0
    return project.hourly_rate * project.projected_hours
  }

  const handleProjectMove = async (projectId: number, newStageId: number) => {
    try {
      setError("")
      // Optimistically update the UI
      setProjects(prevProjects => 
        prevProjects.map(project => 
          project.id === projectId ? { ...project, stage_id: newStageId } : project
        )
      )
      
      // Update the project in the backend
      await projectAPI.updateProject(projectId, { stage_id: newStageId })
      
      // Show success message briefly
      setSuccess("Project moved successfully!")
      setTimeout(() => setSuccess(""), 2000)
      
    } catch (err) {
      setError(handleAPIError(err))
      // Revert the optimistic update by reloading data
      await loadProjectData()
    }
  }

  const handleCreateProject = (stageId?: number) => {
    setSelectedProject(null)
    setDefaultStageId(stageId)
    setShowProjectModal(true)
  }

  const handleEditProject = (project: Project) => {
    setSelectedProject(project)
    setDefaultStageId(undefined)
    setShowProjectModal(true)
  }

  const handleSaveProject = async (projectData: ProjectCreate) => {
    try {
      setError("")
      
      if (selectedProject) {
        // Editing existing project
        const updatedProject = await projectAPI.updateProject(selectedProject.id, projectData)
        setProjects(prevProjects => 
          prevProjects.map(project => 
            project.id === selectedProject.id ? updatedProject : project
          )
        )
        setSuccess("Project updated successfully!")
      } else {
        // Creating new project
        const newProject = await projectAPI.createProject(projectData)
        setProjects(prevProjects => [...prevProjects, newProject])
        setSuccess("Project created successfully!")
      }
      
      setTimeout(() => setSuccess(""), 3000)
      
    } catch (err) {
      const errorMessage = handleAPIError(err)
      console.error('Project save error:', err)
      throw new Error(errorMessage)
    }
  }

  const handleCloseModal = () => {
    setShowProjectModal(false)
    setSelectedProject(null)
    setDefaultStageId(undefined)
  }

  const handleDeleteProject = async (projectId: number) => {
    try {
      setError("")
      await projectAPI.deleteProject(projectId)
      
      // Remove project from local state
      setProjects(prevProjects => prevProjects.filter(project => project.id !== projectId))
      
      setSuccess("Project deleted successfully!")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      const errorMessage = handleAPIError(err)
      console.error('Project delete error:', err)
      throw new Error(errorMessage)
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Project Tracking</h1>
                <p className="text-muted-foreground mt-1">
                  Track your projects through each stage from planning to completion
                </p>
              </div>
              
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 Board
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📄 List
                </button>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-red-700">{error}</div>
                {error.includes("create default stages") && (
                  <button
                    onClick={initializeDefaultStages}
                    className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Create Default Stages
                  </button>
                )}
              </div>
            </div>
          )}
          
          {success && (
            <div className="rounded-md bg-green-50 p-4 mb-6">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* Diagnostic Button - Show when projects exist but aren't visible */}
          {stages.length > 0 && projects.length > 0 && (
            (() => {
              const visibleProjects = projects.filter(p => 
                p.is_active && stages.some(stage => stage.id === p.stage_id)
              ).length
              const activeProjects = projects.filter(p => p.is_active).length
              
              if (activeProjects > visibleProjects) {
                return (
                  <div className="rounded-md bg-yellow-50 p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-yellow-700 font-medium">
                          Projects Not Showing in Kanban
                        </div>
                        <div className="text-xs text-yellow-600 mt-1">
                          {activeProjects} active projects found, but only {visibleProjects} are visible.
                          Click diagnose to see why.
                        </div>
                      </div>
                      <button
                        onClick={diagnoseProjects}
                        className="ml-4 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        Diagnose Issue
                      </button>
                    </div>
                  </div>
                )
              }
              return null
            })()
          )}


          {/* Project Overview */}
          {stages.length > 0 && (
            <div className="space-y-6">
              {/* Project Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary">
                    {projects.filter(p => p.is_active).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Projects</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      projects
                        .filter(p => p.is_active)
                        .reduce((sum, project) => sum + calculateProjectValue(project), 0)
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Project Value</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {projects
                      .filter(p => p.is_active)
                      .reduce((sum, project) => sum + (project.projected_hours || 0), 0)
                      .toFixed(0)
                    }h
                  </div>
                  <div className="text-sm text-muted-foreground">Projected Hours</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {projects.filter(p => p.is_active && p.stage_name === 'Closed').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Completed This Month</div>
                </div>
              </div>

              {/* Stage Filters - Only show in list view */}
              {viewMode === 'list' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedStage(null)}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedStage === null
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All Stages
                  </button>
                  {stages.map(stage => (
                    <button
                      key={stage.id}
                      onClick={() => setSelectedStage(stage.id)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedStage === stage.id
                          ? 'text-white'
                          : 'text-muted-foreground hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: selectedStage === stage.id ? stage.color : undefined,
                        border: selectedStage !== stage.id ? `1px solid ${stage.color}` : undefined
                      }}
                    >
                      {stage.name} ({stage.project_count || 0})
                    </button>
                  ))}
                </div>
              )}

              {/* Conditional View Rendering */}
              {viewMode === 'kanban' ? (
                /* Kanban Board View */
                <div className="h-[calc(100vh-400px)]">
                  <ProjectKanbanBoard
                    stages={stages}
                    projects={projects}
                    onProjectMove={handleProjectMove}
                    onAddProject={handleCreateProject}
                    onEditProject={handleEditProject}
                  />
                </div>
              ) : (
                /* List View */
                <div className="space-y-6">
                  {stages
                    .filter(stage => selectedStage === null || stage.id === selectedStage)
                    .map(stage => {
                      const stageProjects = getProjectsForStage(stage.id)
                      
                      return (
                        <div key={stage.id} className="bg-card border rounded-lg">
                          <div 
                            className="px-6 py-4 border-b"
                            style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold">{stage.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {stageProjects.length} projects • {formatCurrency(
                                    stageProjects.reduce((sum, project) => sum + calculateProjectValue(project), 0)
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Total Hours</div>
                                <div className="font-semibold">
                                  {stageProjects.reduce((sum, project) => sum + (project.projected_hours || 0), 0).toFixed(0)}h
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            {stageProjects.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                No projects in this stage
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {stageProjects.map(project => (
                                  <div 
                                    key={project.id} 
                                    className="border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer group relative"
                                    onClick={() => handleEditProject(project)}
                                  >
                                    {/* Edit Icon - appears on hover */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </div>

                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-sm">{project.title}</h4>
                                        <div className="text-lg font-bold text-primary mt-1">
                                          {project.hourly_rate && project.projected_hours 
                                            ? formatCurrency(calculateProjectValue(project))
                                            : 'TBD'
                                          }
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                          {project.project_type && (
                                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                              {project.project_type}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                      {project.company_name && (
                                        <div>Company: {project.company_name}</div>
                                      )}
                                      {project.contact_name && (
                                        <div>Contact: {project.contact_name}</div>
                                      )}
                                      {project.assigned_team_member_names?.length > 0 && (
                                        <div>Team: {project.assigned_team_member_names.join(', ')}</div>
                                      )}
                                      {project.start_date && (
                                        <div>Started: {formatDate(project.start_date)}</div>
                                      )}
                                      {project.projected_end_date && (
                                        <div>Due: {formatDate(project.projected_end_date)}</div>
                                      )}
                                      {project.hourly_rate && (
                                        <div>Rate: {formatCurrency(project.hourly_rate)}/hr</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                  {/* Quick Actions for List View */}
                  <div className="flex justify-center">
                    <button 
                      onClick={() => handleCreateProject()}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      + Add New Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Project Creation/Edit Modal */}
        <ProjectModal
          isOpen={showProjectModal}
          onClose={handleCloseModal}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
          stages={stages}
          project={selectedProject}
          defaultStageId={defaultStageId}
        />
      </MainLayout>
    </AuthGuard>
  )
}