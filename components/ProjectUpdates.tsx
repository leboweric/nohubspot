"use client"

import React, { useState, useEffect } from 'react'
import { Calendar, CheckCircle, Circle, AlertCircle, TrendingUp, MessageSquare, Flag, Plus, Edit2, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { getAuthState } from '@/lib/auth'

interface ProjectUpdate {
  id: number
  title: string
  description?: string
  update_type: 'status' | 'milestone' | 'risk' | 'decision'
  is_milestone: boolean
  milestone_date?: string
  milestone_completed?: boolean
  milestone_completed_date?: string
  project_health?: 'green' | 'yellow' | 'red'
  progress_percentage?: number
  created_by_name?: string
  created_at: string
  updated_at: string
}

interface ProjectUpdatesProps {
  projectId: number
  onUpdateProject?: () => void
}

export default function ProjectUpdates({ projectId, onUpdateProject }: ProjectUpdatesProps) {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [milestones, setMilestones] = useState<ProjectUpdate[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUpdate, setEditingUpdate] = useState<ProjectUpdate | null>(null)
  const [activeTab, setActiveTab] = useState<'updates' | 'milestones'>('updates')
  const [expandedUpdates, setExpandedUpdates] = useState<Set<number>>(new Set())
  const { token } = getAuthState()

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    update_type: 'status' as const,
    is_milestone: false,
    milestone_date: '',
    project_health: '' as 'green' | 'yellow' | 'red' | '',
    progress_percentage: 0
  })

  useEffect(() => {
    loadUpdates()
  }, [projectId])

  const loadUpdates = async () => {
    setLoading(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      
      // Load all updates
      const updatesResponse = await fetch(`${baseUrl}/api/projects/${projectId}/updates`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (updatesResponse.ok) {
        const data = await updatesResponse.json()
        const allUpdates = data.filter((u: ProjectUpdate) => !u.is_milestone)
        const projectMilestones = data.filter((u: ProjectUpdate) => u.is_milestone)
        setUpdates(allUpdates)
        setMilestones(projectMilestones)
      }
    } catch (error) {
      console.error('Failed to load updates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const method = editingUpdate ? 'PUT' : 'POST'
      const url = editingUpdate 
        ? `${baseUrl}/api/projects/${projectId}/updates/${editingUpdate.id}`
        : `${baseUrl}/api/projects/${projectId}/updates`
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await loadUpdates()
        resetForm()
        if (onUpdateProject) onUpdateProject()
      }
    } catch (error) {
      console.error('Failed to save update:', error)
    }
  }

  const handleDelete = async (updateId: number) => {
    if (!confirm('Are you sure you want to delete this update?')) return
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/updates/${updateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await loadUpdates()
        if (onUpdateProject) onUpdateProject()
      }
    } catch (error) {
      console.error('Failed to delete update:', error)
    }
  }

  const toggleMilestoneComplete = async (milestone: ProjectUpdate) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/projects/${projectId}/updates/${milestone.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          milestone_completed: !milestone.milestone_completed
        })
      })

      if (response.ok) {
        await loadUpdates()
        if (onUpdateProject) onUpdateProject()
      }
    } catch (error) {
      console.error('Failed to toggle milestone:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      update_type: 'status',
      is_milestone: false,
      milestone_date: '',
      project_health: '',
      progress_percentage: 0
    })
    setShowAddForm(false)
    setEditingUpdate(null)
  }

  const startEdit = (update: ProjectUpdate) => {
    setEditingUpdate(update)
    setFormData({
      title: update.title,
      description: update.description || '',
      update_type: update.update_type,
      is_milestone: update.is_milestone,
      milestone_date: update.milestone_date ? update.milestone_date.split('T')[0] : '',
      project_health: update.project_health || '',
      progress_percentage: update.progress_percentage || 0
    })
    setShowAddForm(true)
  }

  const toggleUpdateExpansion = (updateId: number) => {
    const newExpanded = new Set(expandedUpdates)
    if (newExpanded.has(updateId)) {
      newExpanded.delete(updateId)
    } else {
      newExpanded.add(updateId)
    }
    setExpandedUpdates(newExpanded)
  }

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'milestone': return <Flag className="w-4 h-4" />
      case 'risk': return <AlertCircle className="w-4 h-4" />
      case 'decision': return <CheckCircle className="w-4 h-4" />
      default: return <MessageSquare className="w-4 h-4" />
    }
  }

  const getHealthColor = (health?: string) => {
    switch (health) {
      case 'green': return 'text-green-600'
      case 'yellow': return 'text-yellow-600'
      case 'red': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="mt-3">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-3">
        <button
          onClick={() => setActiveTab('updates')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'updates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Updates ({updates.length})
        </button>
        <button
          onClick={() => setActiveTab('milestones')}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'milestones'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Milestones ({milestones.length})
        </button>
      </div>

      {/* Add Update Button */}
      {!showAddForm && (
        <button
          onClick={() => {
            setFormData({ ...formData, is_milestone: activeTab === 'milestones' })
            setShowAddForm(true)
          }}
          className="w-full mb-3 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center text-xs text-gray-600 hover:text-blue-600"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add {activeTab === 'milestones' ? 'Milestone' : 'Update'}
        </button>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            
            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={formData.update_type}
                onChange={(e) => setFormData({ ...formData, update_type: e.target.value as any })}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="status">Status Update</option>
                <option value="milestone">Milestone</option>
                <option value="risk">Risk/Issue</option>
                <option value="decision">Decision</option>
              </select>

              {activeTab === 'updates' && (
                <select
                  value={formData.project_health}
                  onChange={(e) => setFormData({ ...formData, project_health: e.target.value as any })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Health Status</option>
                  <option value="green">🟢 On Track</option>
                  <option value="yellow">🟡 At Risk</option>
                  <option value="red">🔴 Off Track</option>
                </select>
              )}

              {activeTab === 'milestones' && (
                <input
                  type="date"
                  value={formData.milestone_date}
                  onChange={(e) => setFormData({ ...formData, milestone_date: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>

            {activeTab === 'updates' && (
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Progress:</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.progress_percentage}
                  onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-xs text-gray-600 w-10">{formData.progress_percentage}%</span>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                {editingUpdate ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Updates Tab Content */}
      {activeTab === 'updates' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-xs text-gray-500 text-center py-4">Loading updates...</div>
          ) : updates.length > 0 ? (
            updates.map((update) => (
              <div key={update.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {getUpdateIcon(update.update_type)}
                      <h4 className="text-sm font-medium text-gray-900">{update.title}</h4>
                      {update.project_health && (
                        <span className={`text-xs ${getHealthColor(update.project_health)}`}>
                          {update.project_health === 'green' && '🟢'}
                          {update.project_health === 'yellow' && '🟡'}
                          {update.project_health === 'red' && '🔴'}
                        </span>
                      )}
                    </div>
                    
                    {update.progress_percentage !== null && update.progress_percentage !== undefined && (
                      <div className="mt-1 flex items-center space-x-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${update.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{update.progress_percentage}%</span>
                      </div>
                    )}

                    {update.description && (
                      <div className="mt-1">
                        {update.description.length > 100 && !expandedUpdates.has(update.id) ? (
                          <>
                            <p className="text-xs text-gray-600">{update.description.substring(0, 100)}...</p>
                            <button
                              onClick={() => toggleUpdateExpansion(update.id)}
                              className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                            >
                              Show more
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-gray-600">{update.description}</p>
                            {update.description.length > 100 && (
                              <button
                                onClick={() => toggleUpdateExpansion(update.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                              >
                                Show less
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-1 text-xs text-gray-500">
                      {update.created_by_name} • {formatDateTime(update.created_at)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => startEdit(update)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Edit update"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(update.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete update"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 text-center py-4">
              No updates yet. Add your first project update above.
            </div>
          )}
        </div>
      )}

      {/* Milestones Tab Content */}
      {activeTab === 'milestones' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="text-xs text-gray-500 text-center py-4">Loading milestones...</div>
          ) : milestones.length > 0 ? (
            milestones.map((milestone) => (
              <div key={milestone.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <button
                      onClick={() => toggleMilestoneComplete(milestone)}
                      className={`mt-0.5 ${milestone.milestone_completed ? 'text-green-600' : 'text-gray-400'}`}
                      title={milestone.milestone_completed ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {milestone.milestone_completed ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <h4 className={`text-sm font-medium ${milestone.milestone_completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {milestone.title}
                      </h4>
                      
                      {milestone.description && (
                        <p className="text-xs text-gray-600 mt-1">{milestone.description}</p>
                      )}
                      
                      <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                        {milestone.milestone_date && (
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(milestone.milestone_date)}
                          </span>
                        )}
                        {milestone.milestone_completed && milestone.milestone_completed_date && (
                          <span>Completed {formatDate(milestone.milestone_completed_date)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => startEdit(milestone)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Edit milestone"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(milestone.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete milestone"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-gray-500 text-center py-4">
              No milestones yet. Add key project milestones above.
            </div>
          )}
        </div>
      )}
    </div>
  )
}