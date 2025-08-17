"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import EmailTemplateModal from "@/components/templates/EmailTemplateModal"
import { emailTemplateAPI, EmailTemplate, handleAPIError } from "@/lib/api"

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Load templates and categories
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [templatesData, categoriesData] = await Promise.all([
        emailTemplateAPI.getAll({ 
          search: searchTerm || undefined,
          category: selectedCategory || undefined,
          limit: 1000 
        }),
        emailTemplateAPI.getCategories()
      ])
      
      setTemplates(templatesData)
      setCategories(categoriesData.categories)
    } catch (err) {
      setError(handleAPIError(err))
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Debounced search with increased delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData()
    }, 1000) // Increased from 300ms to 1000ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedCategory])

  const handleCreate = () => {
    setEditingTemplate(null)
    setShowModal(true)
  }

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setShowModal(true)
  }

  const handleSave = async (templateData: any) => {
    try {
      if (editingTemplate) {
        await emailTemplateAPI.update(editingTemplate.id, templateData)
      } else {
        await emailTemplateAPI.create(templateData)
      }
      setShowModal(false)
      setEditingTemplate(null)
      loadData()
    } catch (err) {
      throw new Error(handleAPIError(err))
    }
  }

  const handleDelete = async (templateId: number) => {
    try {
      await emailTemplateAPI.delete(templateId)
      setDeleteConfirm(null)
      loadData()
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      'sales': 'bg-gray-100 text-gray-700',
      'support': 'bg-gray-50 text-gray-600',
      'follow-up': 'bg-gray-100 text-gray-600',
      'onboarding': 'bg-gray-100 text-gray-700',
      'marketing': 'bg-gray-50 text-gray-600',
    }
    return colors[category?.toLowerCase() || ''] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getVariablesList = (variables?: string[]) => {
    if (!variables || variables.length === 0) return 'None'
    return variables.slice(0, 3).join(', ') + (variables.length > 3 ? '...' : '')
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-semibold">Email Templates</h1>
              <p className="text-muted-foreground mt-1">Create and manage reusable email templates</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
            >
              ➕ Create Template
            </button>
          </div>

          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={loading}
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
              <button 
                onClick={loadData}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Templates Grid */}
          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderBottomColor: 'var(--color-primary)' }}></div>
                  <p className="text-muted-foreground">Loading templates...</p>
                </div>
              </div>
            ) : templates.length > 0 ? (
              <div className="divide-y">
                {templates.map((template) => (
                  <div key={template.id} className="p-6 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium">{template.name}</h3>
                          {template.category && (
                            <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(template.category)}`}>
                              {template.category}
                            </span>
                          )}
                          {!template.is_shared && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                              Personal
                            </span>
                          )}
                        </div>
                        
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Subject: {template.subject}
                        </p>
                        
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {template.body.substring(0, 150)}...
                        </p>
                        
                        <div className="flex items-center gap-6 text-xs text-muted-foreground">
                          <span>Variables: {getVariablesList(template.variables_used)}</span>
                          <span>Used {template.usage_count} times</span>
                          <span>Created {formatDate(template.created_at)}</span>
                          {template.creator_name && (
                            <span>by {template.creator_name}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(template)}
                          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(template.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || selectedCategory ? 
                    'No templates match your search criteria.' : 
                    'Get started by creating your first email template.'
                  }
                </p>
                {!searchTerm && !selectedCategory && (
                  <button
                    onClick={handleCreate}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Create Your First Template
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Delete Template</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Are you sure you want to delete this template? This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Template Modal */}
          <EmailTemplateModal
            isOpen={showModal}
            onClose={() => {
              setShowModal(false)
              setEditingTemplate(null)
            }}
            onSave={handleSave}
            template={editingTemplate}
            categories={categories}
          />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}