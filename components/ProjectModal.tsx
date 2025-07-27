"use client"

import React, { useState, useEffect } from 'react'
import { ProjectStage, Project, ProjectCreate, companyAPI, contactAPI, Company, Contact, projectAPI, usersAPI, User } from '@/lib/api'

interface ProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (project: ProjectCreate) => Promise<void>
  onDelete?: (projectId: number) => Promise<void>
  stages: ProjectStage[]
  project?: Project | null // For editing existing projects
  defaultStageId?: number // For creating projects in specific stages
}

export default function ProjectModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  stages, 
  project = null, 
  defaultStageId 
}: ProjectModalProps) {
  const [formData, setFormData] = useState<ProjectCreate>({
    title: '',
    description: '',
    start_date: '',
    projected_end_date: '',
    hourly_rate: undefined,
    project_type: '',
    projected_hours: undefined,
    stage_id: defaultStageId || stages[0]?.id || 1,
    contact_id: undefined,
    company_id: undefined,
    assigned_team_members: [],
    notes: '',
    tags: []
  })

  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [projectTypes, setProjectTypes] = useState<string[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load companies and contacts for dropdowns
  useEffect(() => {
    if (isOpen) {
      loadFormData()
    }
  }, [isOpen])

  // Populate form when editing existing project
  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title,
        description: project.description || '',
        start_date: project.start_date 
          ? new Date(project.start_date).toISOString().split('T')[0] 
          : '',
        projected_end_date: project.projected_end_date 
          ? new Date(project.projected_end_date).toISOString().split('T')[0] 
          : '',
        hourly_rate: project.hourly_rate,
        project_type: project.project_type || '',
        projected_hours: project.projected_hours,
        stage_id: project.stage_id,
        contact_id: project.contact_id,
        company_id: project.company_id,
        assigned_team_members: project.assigned_team_members || [],
        notes: project.notes || '',
        tags: project.tags || []
      })
    } else if (defaultStageId) {
      setFormData(prev => ({ ...prev, stage_id: defaultStageId }))
    }
  }, [project, defaultStageId])

  const loadFormData = async () => {
    try {
      setLoadingData(true)
      console.log('Loading form data...')
      
      // Load each resource separately to better handle errors
      let companiesData: Company[] = []
      let contactsData: Contact[] = []
      let projectTypesData: string[] = []
      let usersData: User[] = []
      
      try {
        companiesData = await companyAPI.getAll({ limit: 100 })
        console.log('Companies loaded:', companiesData?.length || 0)
      } catch (err) {
        console.error('Failed to load companies:', err)
      }
      
      try {
        contactsData = await contactAPI.getAll({ limit: 100 })
        console.log('Contacts loaded:', contactsData?.length || 0)
      } catch (err) {
        console.error('Failed to load contacts:', err)
      }
      
      try {
        projectTypesData = await projectAPI.getProjectTypes()
        console.log('Project types loaded:', projectTypesData?.length || 0)
      } catch (err) {
        console.error('Failed to load project types:', err)
      }
      
      try {
        usersData = await usersAPI.getAll()
        console.log('Users loaded:', usersData?.length || 0)
      } catch (err) {
        console.error('Failed to load users:', err)
      }
      
      setCompanies(companiesData || [])
      setContacts(contactsData || [])
      setProjectTypes(projectTypesData || [])
      setUsers(usersData || [])
      
      // Clear error if at least some data loaded
      if (companiesData.length > 0 || contactsData.length > 0 || projectTypesData.length > 0 || usersData.length > 0) {
        setError('')
      }
    } catch (err) {
      console.error('Failed to load form data:', err)
      setError('Failed to load dropdown data. Please try again.')
    } finally {
      setLoadingData(false)
    }
  }

  // Filter contacts based on selected company
  const getFilteredContacts = () => {
    if (!formData.company_id) {
      return contacts // Show all contacts if no company selected
    }
    return contacts.filter(contact => contact.company_id === formData.company_id)
  }

  // Handle company change and reset contact if needed
  const handleCompanyChange = (companyId: string) => {
    const newCompanyId = companyId ? parseInt(companyId) : undefined
    
    setFormData(prev => {
      const updatedFormData = { ...prev, company_id: newCompanyId }
      
      // If changing company, check if current contact is still valid
      if (prev.contact_id && newCompanyId) {
        const currentContact = contacts.find(c => c.id === prev.contact_id)
        if (currentContact && currentContact.company_id !== newCompanyId) {
          // Reset contact if it doesn't belong to the new company
          updatedFormData.contact_id = undefined
        }
      }
      
      return updatedFormData
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setError('Project title is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Clean the form data before sending
      const cleanedData = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        start_date: formData.start_date 
          ? new Date(formData.start_date).toISOString()
          : undefined,
        projected_end_date: formData.projected_end_date 
          ? new Date(formData.projected_end_date).toISOString()
          : undefined,
        contact_id: formData.contact_id || undefined,
        company_id: formData.company_id || undefined,
        hourly_rate: formData.hourly_rate || undefined,
        projected_hours: formData.projected_hours || undefined,
        project_type: formData.project_type || undefined,
        assigned_team_members: formData.assigned_team_members?.length ? formData.assigned_team_members : undefined,
        tags: formData.tags?.length ? formData.tags : undefined
      }
      
      console.log('Sending project data:', cleanedData)
      await onSave(cleanedData)
      handleClose()
    } catch (err) {
      console.error('Project modal error:', err)
      let errorMessage = 'Failed to save project'
      
      if (err instanceof Error) {
        errorMessage = err.message
      } else if (typeof err === 'string') {
        errorMessage = err
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message)
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      start_date: '',
      projected_end_date: '',
      hourly_rate: undefined,
      project_type: '',
      projected_hours: undefined,
      stage_id: defaultStageId || stages[0]?.id || 1,
      contact_id: undefined,
      company_id: undefined,
      assigned_team_members: [],
      notes: '',
      tags: []
    })
    setError('')
    setShowDeleteConfirm(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!project || !onDelete) return
    
    setLoading(true)
    setError('')
    
    try {
      await onDelete(project.id)
      handleClose()
    } catch (err) {
      setError('Failed to delete project')
      console.error('Delete error:', err)
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const calculateProjectValue = () => {
    if (formData.hourly_rate && formData.projected_hours) {
      return formData.hourly_rate * formData.projected_hours
    }
    return 0
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {project ? 'Edit Project' : 'Create New Project'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project title..."
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project description..."
              rows={3}
            />
          </div>

          {/* Company and Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <select
                value={formData.company_id || ''}
                onChange={(e) => handleCompanyChange(e.target.value)}
                disabled={loadingData}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">{loadingData ? 'Loading companies...' : companies.length === 0 ? 'No companies available' : 'Select Company'}</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Contact
              </label>
              <select
                value={formData.contact_id || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  contact_id: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                disabled={loadingData}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">{loadingData ? 'Loading contacts...' : 'Select Contact'}</option>
                {getFilteredContacts().map(contact => (
                  <option key={contact.id} value={contact.id}>
                    {contact.first_name} {contact.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projected End Date
              </label>
              <input
                type="date"
                value={formData.projected_end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, projected_end_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Hourly Rate and Projected Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                value={formData.hourly_rate || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  hourly_rate: e.target.value ? parseFloat(e.target.value) : undefined 
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projected Hours
              </label>
              <input
                type="number"
                value={formData.projected_hours || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  projected_hours: e.target.value ? parseFloat(e.target.value) : undefined 
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
                step="0.5"
              />
            </div>
          </div>

          {/* Calculated Project Value */}
          {calculateProjectValue() > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-sm text-blue-700">
                <strong>Estimated Project Value: </strong>
                ${calculateProjectValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}

          {/* Project Type and Stage */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Type
              </label>
              <select
                value={formData.project_type}
                onChange={(e) => setFormData(prev => ({ ...prev, project_type: e.target.value }))}
                disabled={loadingData}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">{loadingData ? 'Loading project types...' : 'Select Type'}</option>
                {projectTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Stage
              </label>
              <select
                value={formData.stage_id}
                onChange={(e) => setFormData(prev => ({ ...prev, stage_id: parseInt(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {stages.map(stage => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Consultant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Consultant
            </label>
            <select
              value={formData.assigned_team_members?.[0] || ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                assigned_team_members: e.target.value ? [parseInt(e.target.value)] : []
              }))}
              disabled={loadingData}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">{loadingData ? 'Loading consultants...' : 'Select Consultant'}</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name}
                  {user.role === 'admin' ? ' (Admin)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div>
              {project && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete Project
                </button>
              )}
            </div>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : (project ? 'Update Project' : 'Create Project')}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">Delete Project</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this project? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}