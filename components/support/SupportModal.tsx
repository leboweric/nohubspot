"use client"

import { useState } from "react"
import { getAuthState } from "@/lib/auth"

interface SupportModalProps {
  isOpen: boolean
  onClose: () => void
}

type SupportType = 'technical' | 'enhancement'

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [supportType, setSupportType] = useState<SupportType>('technical')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const { user, organization } = getAuthState()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const emailSubject = `[${supportType === 'technical' ? 'SUPPORT' : 'ENHANCEMENT'}] ${subject}`
      const emailBody = `
Support Request from NoHubSpot CRM

Type: ${supportType === 'technical' ? 'Technical Support' : 'Product Enhancement'}
Organization: ${organization?.name || 'Unknown'}
User: ${user?.first_name} ${user?.last_name} (${user?.email})
User ID: ${user?.id}
Organization ID: ${organization?.id}

Subject: ${subject}

Description:
${description}

---
Submitted via NoHubSpot CRM Support Form
Date: ${new Date().toISOString()}
`.trim()

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: 'leboweric@gmail.com',
          subject: emailSubject,
          message: emailBody,
          senderName: `${user?.first_name} ${user?.last_name}`,
          senderEmail: user?.email
        })
      })

      if (response.ok) {
        setSuccess(true)
        setSubject('')
        setDescription('')
        setTimeout(() => {
          onClose()
          setSuccess(false)
        }, 2000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to send support request')
      }
    } catch (err) {
      setError('Failed to send support request')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-xl">✓</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Support Request Sent!</h3>
            <p className="text-gray-600 text-sm">
              Your support request has been sent successfully. We'll get back to you as soon as possible.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Contact Support</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Support Type */}
          <div>
            <label className="block text-sm font-medium mb-3">Request Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  supportType === 'technical' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSupportType('technical')}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="supportType"
                    value="technical"
                    checked={supportType === 'technical'}
                    onChange={() => setSupportType('technical')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">🔧 Technical Support</div>
                    <div className="text-sm text-gray-600">Bug reports, login issues, errors</div>
                  </div>
                </div>
              </div>
              
              <div 
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  supportType === 'enhancement' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSupportType('enhancement')}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="supportType"
                    value="enhancement"
                    checked={supportType === 'enhancement'}
                    onChange={() => setSupportType('enhancement')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">💡 Product Enhancement</div>
                    <div className="text-sm text-gray-600">Feature requests, improvements</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium mb-1">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={supportType === 'technical' ? "Brief description of the issue" : "Brief description of the enhancement"}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={
                supportType === 'technical' 
                  ? "Please provide detailed steps to reproduce the issue, error messages, and what you expected to happen..."
                  : "Please describe the feature or improvement you'd like to see, how it would help you, and any specific requirements..."
              }
              required
            />
          </div>

          {/* User Info Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Your Information</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Name: {user?.first_name} {user?.last_name}</div>
              <div>Email: {user?.email}</div>
              <div>Organization: {organization?.name}</div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This information will be included in your support request to help us assist you better.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
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
              {loading ? 'Sending...' : 'Send Support Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}