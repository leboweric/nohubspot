"use client"

import { useState, useEffect } from "react"
import { EmailTemplate } from "@/lib/api"

interface EmailTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (templateData: any) => Promise<void>
  template?: EmailTemplate | null
  categories: string[]
}

export default function EmailTemplateModal({
  isOpen,
  onClose,
  onSave,
  template,
  categories
}: EmailTemplateModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body: "",
    category: "",
    is_shared: true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showVariableHelp, setShowVariableHelp] = useState(false)

  // Reset form when modal opens/closes or template changes
  useEffect(() => {
    if (isOpen) {
      if (template) {
        setFormData({
          name: template.name,
          subject: template.subject,
          body: template.body,
          category: template.category || "",
          is_shared: template.is_shared
        })
      } else {
        setFormData({
          name: "",
          subject: "",
          body: "",
          category: "",
          is_shared: true
        })
      }
      setError("")
    }
  }, [isOpen, template])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await onSave(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template")
    } finally {
      setLoading(false)
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      const before = text.substring(0, start)
      const after = text.substring(end, text.length)
      const newText = before + `{{${variable}}}` + after
      
      setFormData(prev => ({ ...prev, body: newText }))
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4)
      }, 0)
    }
  }

  const commonVariables = [
    { label: "Contact First Name", value: "contact.first_name" },
    { label: "Contact Last Name", value: "contact.last_name" },
    { label: "Contact Email", value: "contact.email" },
    { label: "Contact Phone", value: "contact.phone" },
    { label: "Contact Title", value: "contact.title" },
    { label: "Contact Company", value: "contact.company_name" },
    { label: "Company Name", value: "company.name" },
    { label: "Company Industry", value: "company.industry" },
    { label: "Company Website", value: "company.website" },
    { label: "Your First Name", value: "user.first_name" },
    { label: "Your Last Name", value: "user.last_name" },
    { label: "Your Email", value: "user.email" },
    { label: "Current Date", value: "date" },
    { label: "Current Time", value: "time" }
  ]

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {template ? 'Edit Template' : 'Create New Template'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex h-[70vh]">
          {/* Left Column - Form */}
          <div className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Template Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Welcome Email, Follow-up, Meeting Request"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium mb-1">
                    Category
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                    <option value="sales">Sales</option>
                    <option value="support">Support</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>

                <div className="flex items-center mt-6">
                  <input
                    id="is_shared"
                    name="is_shared"
                    type="checkbox"
                    checked={formData.is_shared}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_shared" className="ml-2 text-sm text-gray-700">
                    Share with team
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-1">
                  Email Subject *
                </label>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Use variables like {{contact.first_name}} for personalization"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="template-body" className="block text-sm font-medium">
                    Email Body *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowVariableHelp(!showVariableHelp)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {showVariableHelp ? 'Hide' : 'Show'} Variables
                  </button>
                </div>
                <textarea
                  id="template-body"
                  name="body"
                  required
                  rows={12}
                  value={formData.body}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="Write your email template here. Use {{contact.first_name}}, {{company.name}}, etc. for dynamic content..."
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
              </button>
            </div>
          </div>

          {/* Right Column - Variables */}
          {showVariableHelp && (
            <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto">
              <h3 className="font-medium mb-3">Available Variables</h3>
              <p className="text-xs text-gray-600 mb-4">
                Click any variable to insert it at your cursor position in the email body.
              </p>
              
              <div className="space-y-2">
                {commonVariables.map((variable) => (
                  <button
                    key={variable.value}
                    type="button"
                    onClick={() => insertVariable(variable.value)}
                    className="w-full text-left p-2 text-sm border border-gray-200 rounded hover:bg-white hover:border-blue-300 transition-colors"
                  >
                    <div className="font-mono text-blue-600 text-xs">
                      {`{{${variable.value}}}`}
                    </div>
                    <div className="text-gray-700">
                      {variable.label}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                <h4 className="font-medium text-blue-900 mb-2">Tips:</h4>
                <ul className="text-blue-800 space-y-1">
                  <li>• Variables are automatically replaced when using templates</li>
                  <li>• Use contact variables when emailing specific people</li>
                  <li>• Company variables work when emailing companies</li>
                  <li>• Date/time are always current when email is sent</li>
                </ul>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}