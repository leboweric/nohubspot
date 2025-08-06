"use client"

import React, { useState, useEffect } from 'react'
import { PipelineStage, Deal, DealCreate, companyAPI, contactAPI, Company, Contact } from '@/lib/api'
import ModernSelect from '@/components/ui/ModernSelect'

interface DealModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (deal: DealCreate) => Promise<void>
  onDelete?: (dealId: number) => Promise<void>
  stages: PipelineStage[]
  deal?: Deal | null // For editing existing deals
  defaultStageId?: number // For creating deals in specific stages
}

export default function DealModal({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  stages, 
  deal = null, 
  defaultStageId 
}: DealModalProps) {
  const [formData, setFormData] = useState<DealCreate>({
    title: '',
    description: '',
    value: 0,
    currency: 'USD',
    probability: 50,
    expected_close_date: '',
    stage_id: defaultStageId || stages[0]?.id || 1,
    contact_id: undefined,
    company_id: undefined,
    assigned_to: undefined,
    notes: '',
    tags: []
  })

  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load companies and contacts for dropdowns
  useEffect(() => {
    if (isOpen) {
      loadFormData()
    }
  }, [isOpen])

  // Populate form when editing existing deal
  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title,
        description: deal.description || '',
        value: deal.value,
        currency: deal.currency,
        probability: deal.probability,
        expected_close_date: deal.expected_close_date 
          ? new Date(deal.expected_close_date).toISOString().split('T')[0] 
          : '',
        stage_id: deal.stage_id,
        contact_id: deal.contact_id,
        company_id: deal.company_id,
        assigned_to: deal.assigned_to,
        notes: deal.notes || '',
        tags: deal.tags || []
      })
    } else if (defaultStageId) {
      setFormData(prev => ({ ...prev, stage_id: defaultStageId }))
    }
  }, [deal, defaultStageId])

  const loadFormData = async () => {
    try {
      const [companiesResponse, contactsData] = await Promise.all([
        companyAPI.getAll({ limit: 1000 }), // Increased to get all companies
        contactAPI.getAll({ limit: 1000 })   // Increased to get more contacts
      ])
      // Extract items array from paginated response
      setCompanies(companiesResponse?.items || [])
      setContacts(Array.isArray(contactsData) ? contactsData : [])
    } catch (err) {
      console.error('Failed to load form data:', err)
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
      setError('Deal title is required')
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
        expected_close_date: formData.expected_close_date 
          ? new Date(formData.expected_close_date).toISOString()
          : undefined,
        contact_id: formData.contact_id || undefined,
        company_id: formData.company_id || undefined,
        assigned_to: formData.assigned_to || undefined,
        tags: formData.tags?.length ? formData.tags : undefined
      }
      
      console.log('Sending deal data:', cleanedData)
      await onSave(cleanedData)
      handleClose()
    } catch (err) {
      console.error('Deal modal error:', err)
      let errorMessage = 'Failed to save deal'
      
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
      value: 0,
      currency: 'USD',
      probability: 50,
      expected_close_date: '',
      stage_id: defaultStageId || stages[0]?.id || 1,
      contact_id: undefined,
      company_id: undefined,
      assigned_to: undefined,
      notes: '',
      tags: []
    })
    setError('')
    setShowDeleteConfirm(false)
    onClose()
  }

  const handleDelete = async () => {
    if (!deal || !onDelete) return
    
    setLoading(true)
    setError('')
    
    try {
      await onDelete(deal.id)
      handleClose()
    } catch (err) {
      setError('Failed to delete deal')
      console.error('Delete error:', err)
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const getProbabilityColor = (prob: number) => {
    if (prob >= 80) return 'text-green-600'
    if (prob >= 60) return 'text-blue-600'
    if (prob >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {deal ? 'Edit Deal' : 'Create New Deal'}
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

          {/* Deal Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deal Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter deal title..."
              required
            />
          </div>

          {/* Value and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deal Value
              </label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                onFocus={(e) => e.target.select()}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <ModernSelect
                value={formData.currency || "USD"}
                onChange={(value) => setFormData(prev => ({ ...prev, currency: value as string }))}
                options={[
                  { value: "USD", label: "USD" },
                  { value: "EUR", label: "EUR" },
                  { value: "GBP", label: "GBP" },
                  { value: "CAD", label: "CAD" }
                ]}
                placeholder="Select currency"
              />
            </div>
          </div>

          {/* Stage and Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pipeline Stage
              </label>
              <ModernSelect
                value={formData.stage_id}
                onChange={(value) => setFormData(prev => ({ ...prev, stage_id: value as number }))}
                options={stages.map(stage => ({
                  value: stage.id,
                  label: stage.name
                }))}
                placeholder="Select stage"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Probability
                <span className={`ml-2 font-semibold ${getProbabilityColor(formData.probability || 50)}`}>
                  {formData.probability}%
                </span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => setFormData(prev => ({ ...prev, probability: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>

          {/* Company and Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company
              </label>
              <ModernSelect
                value={formData.company_id || ''}
                onChange={(value) => handleCompanyChange(value.toString())}
                options={[
                  { value: '', label: 'Select company...' },
                  ...companies.map(company => ({
                    value: company.id,
                    label: company.name
                  }))
                ]}
                placeholder="Select company"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Contact
              </label>
              <ModernSelect
                value={formData.contact_id || ''}
                onChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  contact_id: value ? value as number : undefined 
                }))}
                options={[
                  { 
                    value: '', 
                    label: !formData.company_id 
                      ? "Select company first..." 
                      : getFilteredContacts().length === 0 
                        ? "No contacts in this company" 
                        : "Select contact..."
                  },
                  ...getFilteredContacts().map(contact => ({
                    value: contact.id,
                    label: `${contact.first_name} ${contact.last_name}${contact.title ? ` - ${contact.title}` : ''}`
                  }))
                ]}
                placeholder="Select contact"
                disabled={!formData.company_id && getFilteredContacts().length === 0}
              />
            </div>
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Close Date
            </label>
            <input
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Deal description or notes..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Internal Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Internal notes (not visible to client)..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t">
            {/* Delete Button - Only show when editing */}
            <div>
              {deal && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                  disabled={loading}
                >
                  Delete Deal
                </button>
              )}
            </div>
            
            {/* Save/Cancel Buttons */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : (deal ? 'Update Deal' : 'Create Deal')}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 rounded-lg">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Deal?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{deal?.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Deal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}