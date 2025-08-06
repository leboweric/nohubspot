'use client'

import { useState, useEffect } from 'react'
import AuthGuard from '@/components/AuthGuard'
import MainLayout from '@/components/MainLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Pencil, Trash2, Plus, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react'
import { projectAPI } from '@/lib/api'
import { getAuthState, isAdmin } from '@/lib/auth'

interface ProjectType {
  id: number
  name: string
  description?: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function ProjectTypesSettings() {
  const { user } = getAuthState()
  const isUserAdmin = user?.role === 'owner' || user?.role === 'admin'
  
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingType, setEditingType] = useState<ProjectType | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  })

  useEffect(() => {
    loadProjectTypes()
  }, [])

  const loadProjectTypes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/project-types?include_inactive=true', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to load project types')
      
      const data = await response.json()
      setProjectTypes(data.sort((a: ProjectType, b: ProjectType) => a.display_order - b.display_order))
    } catch (err) {
      setError('Failed to load project types')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const response = await fetch('/api/project-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          display_order: projectTypes.length
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to add project type')
      }
      
      await loadProjectTypes()
      setShowAddDialog(false)
      setFormData({ name: '', description: '', is_active: true })
      setSuccess('Project type added successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to add project type')
    }
  }

  const handleEdit = async () => {
    if (!editingType) return
    
    try {
      const response = await fetch(`/api/project-types/${editingType.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      })
      
      if (!response.ok) throw new Error('Failed to update project type')
      
      await loadProjectTypes()
      setShowEditDialog(false)
      setEditingType(null)
      setFormData({ name: '', description: '', is_active: true })
      setSuccess('Project type updated successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to update project type')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project type?')) return
    
    try {
      const response = await fetch(`/api/project-types/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) throw new Error('Failed to delete project type')
      
      await loadProjectTypes()
      setSuccess('Project type deleted successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to delete project type')
    }
  }

  const handleMoveUp = async (type: ProjectType, index: number) => {
    if (index === 0) return
    
    const newTypes = [...projectTypes]
    newTypes[index] = projectTypes[index - 1]
    newTypes[index - 1] = type
    
    // Update display orders
    for (let i = 0; i < newTypes.length; i++) {
      try {
        await fetch(`/api/project-types/${newTypes[i].id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ display_order: i })
        })
      } catch (err) {
        console.error('Failed to update order', err)
      }
    }
    
    setProjectTypes(newTypes)
  }

  const handleMoveDown = async (type: ProjectType, index: number) => {
    if (index === projectTypes.length - 1) return
    
    const newTypes = [...projectTypes]
    newTypes[index] = projectTypes[index + 1]
    newTypes[index + 1] = type
    
    // Update display orders
    for (let i = 0; i < newTypes.length; i++) {
      try {
        await fetch(`/api/project-types/${newTypes[i].id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ display_order: i })
        })
      } catch (err) {
        console.error('Failed to update order', err)
      }
    }
    
    setProjectTypes(newTypes)
  }

  const initializeDefaults = async () => {
    try {
      const response = await fetch('/api/project-types/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      const data = await response.json()
      
      if (response.ok) {
        await loadProjectTypes()
        setSuccess(data.message || 'Default project types initialized')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.message || 'Project types already exist')
        setTimeout(() => setError(null), 3000)
      }
    } catch (err) {
      setError('Failed to initialize project types')
    }
  }

  if (!isUserAdmin) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="container mx-auto p-6 max-w-4xl">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                You must be an admin to access this page.
              </AlertDescription>
            </Alert>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-gray-500">Loading project types...</div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Project Types</CardTitle>
          <div className="flex gap-2">
            {projectTypes.length === 0 && (
              <Button
                onClick={initializeDefaults}
                variant="outline"
              >
                Initialize Defaults
              </Button>
            )}
            <Button
              onClick={() => {
                setFormData({ name: '', description: '', is_active: true })
                setShowAddDialog(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Project Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {projectTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No project types configured.</p>
              <p className="text-sm mt-2">Click "Initialize Defaults" to add standard project types or "Add Project Type" to create custom ones.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projectTypes.map((type, index) => (
                <div
                  key={type.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    type.is_active ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {type.name}
                      {!type.is_active && (
                        <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
                      )}
                    </div>
                    {type.description && (
                      <div className="text-sm text-gray-600 mt-1">{type.description}</div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveUp(type, index)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveDown(type, index)}
                      disabled={index === projectTypes.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingType(type)
                        setFormData({
                          name: type.name,
                          description: type.description || '',
                          is_active: type.is_active
                        })
                        setShowEditDialog(true)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(type.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project type name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project type name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}