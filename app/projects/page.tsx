"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import ProjectKanbanBoard from "@/components/ProjectKanbanBoard"
import ProjectModal from "@/components/ProjectModal"
import ProjectCard from "@/components/projects/ProjectCard"
import ProjectStats from "@/components/projects/ProjectStats"
import { projectAPI, projectStageAPI, handleAPIError, ProjectStage, Project, ProjectCreate } from "@/lib/api"
import { 
  LayoutGrid, List, Plus, Download, Filter, Search,
  TrendingUp, DollarSign, Target, Trophy
} from "lucide-react"

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

  const handleExportProjects = () => {
    try {
      // Create CSV headers
      const headers = [
        'Project Title',
        'Stage',
        'Status',
        'Company',
        'Primary Contact',
        'Consultant',
        'Project Type',
        'Start Date',
        'Projected End Date',
        'Actual End Date',
        'Hourly Rate',
        'Projected Hours',
        'Actual Hours',
        'Projected Value',
        'Description',
        'Notes',
        'Tags',
        'Created Date',
        'Last Updated'
      ]
      
      // Filter active projects if selectedStage is set (for list view)
      const projectsToExport = projects.filter(project => {
        if (!project.is_active) return false
        if (viewMode === 'list' && selectedStage !== null) {
          return project.stage_id === selectedStage
        }
        return true
      })
      
      // Create CSV rows
      const rows = projectsToExport.map(project => {
        const stage = stages.find(s => s.id === project.stage_id)
        const projectedValue = calculateProjectValue(project)
        
        return [
          project.title,
          stage?.name || '',
          project.is_active ? 'Active' : 'Inactive',
          project.company_name || '',
          project.contact_name || '',
          project.assigned_team_member_names?.join(', ') || '',
          project.project_type || '',
          project.start_date ? formatDate(project.start_date) : '',
          project.projected_end_date ? formatDate(project.projected_end_date) : '',
          project.actual_end_date ? formatDate(project.actual_end_date) : '',
          project.hourly_rate?.toString() || '',
          project.projected_hours?.toString() || '',
          project.actual_hours?.toString() || '0',
          projectedValue ? formatCurrency(projectedValue) : '',
          project.description || '',
          project.notes || '',
          project.tags?.join(', ') || '',
          formatDate(project.created_at),
          formatDate(project.updated_at)
        ]
      })
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma, newline, or quotes
            const escaped = cell.replace(/"/g, '""')
            return /[,"\n]/.test(cell) ? `"${escaped}"` : escaped
          }).join(',')
        )
      ].join('\n')
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `projects_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      URL.revokeObjectURL(url)
      
      // Show success message with context
      const filterInfo = []
      if (viewMode === 'list' && selectedStage !== null) {
        const stage = stages.find(s => s.id === selectedStage)
        if (stage) filterInfo.push(`in ${stage.name} stage`)
      }
      
      const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : ''
      setSuccess(`Successfully exported ${projectsToExport.length} projects${filterText} to CSV!`)
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      console.error('Failed to export projects:', error)
      setError('Failed to export projects. Please try again.')
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderBottomColor: 'var(--color-primary)' }}></div>
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
              
              <div className="flex items-center gap-4">
                {/* Export Button */}
                <button
                  onClick={handleExportProjects}
                  disabled={loading || projects.length === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export to CSV
                </button>
                
                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Board
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                </div>
                
                {/* Create Project Button */}
                <button
                  onClick={() => handleCreateProject()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Plus className="w-4 h-4" />
                  Create Project
                </button>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 mb-6">
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
            <div className="rounded-lg bg-green-50 p-4 mb-6">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}



          {/* Project Overview */}
          {stages.length > 0 && (
            <div className="space-y-6">
              {/* Enhanced Project Stats - Only the top row */}
              <ProjectStats projects={projects} stages={stages} showOnlyTopRow={true} />

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
                        backgroundColor: selectedStage === stage.id ? (
                          stage.name === 'Planning' ? 'var(--color-primary)' :
                          stage.name === 'Active' ? 'var(--color-secondary)' :
                          stage.name === 'Wrapping Up' ? 'var(--color-accent)' :
                          stage.name === 'Closed' ? 'var(--color-neutral-400)' :
                          'var(--color-neutral-300)'
                        ) : undefined,
                        border: selectedStage !== stage.id ? `1px solid ${
                          stage.name === 'Planning' ? 'var(--color-primary)' :
                          stage.name === 'Active' ? 'var(--color-secondary)' :
                          stage.name === 'Wrapping Up' ? 'var(--color-accent)' :
                          stage.name === 'Closed' ? 'var(--color-neutral-400)' :
                          'var(--color-neutral-300)'
                        }` : undefined
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
                <div className="h-[calc(100vh-300px)]">
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
                        <div key={stage.id} className="bg-white border border-gray-200 rounded-lg">
                          <div 
                            className="px-6 py-4 border-b border-gray-200 border-l-2"
                            style={{ borderLeftColor: '#e5e7eb' }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{stage.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-sm text-gray-500">
                                    {stageProjects.length}
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-sm text-gray-500">
                                    Total Value: <span className="font-medium text-gray-700">{formatCurrency(
                                      stageProjects.reduce((sum, project) => sum + calculateProjectValue(project), 0)
                                    )}</span>
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-sm text-gray-500">
                                    Total Hours: <span className="font-medium text-gray-700">{stageProjects.reduce((sum, project) => sum + (project.projected_hours || 0), 0).toFixed(0)}h</span>
                                  </span>
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
                                  <ProjectCard 
                                    key={project.id}
                                    project={project}
                                    onEdit={handleEditProject}
                                    onDelete={handleDeleteProject}
                                  />
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