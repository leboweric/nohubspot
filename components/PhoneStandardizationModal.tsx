'use client'

import { useState } from 'react'

interface PhonePreviewData {
  companies: Array<{
    name: string
    current: string
    formatted: string
  }>
  contacts: Array<{
    name: string
    current: string
    formatted: string
  }>
  email_signatures: Array<{
    name: string
    current: string
    formatted: string
  }>
  summary: {
    companies_to_update: number
    contacts_to_update: number
    email_signatures_to_update: number
    total_changes: number
  }
}

interface PhoneStandardizationModalProps {
  isOpen: boolean
  onClose: () => void
  previewData: PhonePreviewData | null
  onConfirm: () => void
  isLoading?: boolean
}

export default function PhoneStandardizationModal({
  isOpen,
  onClose,
  previewData,
  onConfirm,
  isLoading = false
}: PhoneStandardizationModalProps) {
  const [activeTab, setActiveTab] = useState<'companies' | 'contacts' | 'signatures'>('companies')

  if (!isOpen) return null

  const hasChanges = previewData?.summary?.total_changes > 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Phone Number Standardization Preview</h2>
          {previewData && (
            <p className="text-sm text-gray-600 mt-2">
              {hasChanges 
                ? `Found ${previewData.summary.total_changes} phone numbers that need formatting`
                : 'All phone numbers are already properly formatted!'
              }
            </p>
          )}
        </div>

        {previewData && hasChanges && (
          <>
            <div className="px-6 py-3 bg-gray-50 border-b">
              <div className="flex space-x-4 text-sm">
                <span className={`font-medium ${previewData.summary.companies_to_update > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                  Companies ({previewData.summary.companies_to_update})
                </span>
                <span className={`font-medium ${previewData.summary.contacts_to_update > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                  Contacts ({previewData.summary.contacts_to_update})
                </span>
                <span className={`font-medium ${previewData.summary.email_signatures_to_update > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                  Email Signatures ({previewData.summary.email_signatures_to_update})
                </span>
              </div>
            </div>

            <div className="flex space-x-1 px-6 pt-4">
              <button
                onClick={() => setActiveTab('companies')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === 'companies'
                    ? 'bg-white border-t border-l border-r'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Companies ({previewData.summary.companies_to_update})
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === 'contacts'
                    ? 'bg-white border-t border-l border-r'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Contacts ({previewData.summary.contacts_to_update})
              </button>
              <button
                onClick={() => setActiveTab('signatures')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
                  activeTab === 'signatures'
                    ? 'bg-white border-t border-l border-r'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Email Signatures ({previewData.summary.email_signatures_to_update})
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Current</th>
                    <th className="text-left py-2 font-medium">→</th>
                    <th className="text-left py-2 font-medium">Formatted</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'companies' && previewData.companies.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-red-600">{item.current}</td>
                      <td className="py-2 text-gray-400">→</td>
                      <td className="py-2 text-green-600">{item.formatted}</td>
                    </tr>
                  ))}
                  {activeTab === 'contacts' && previewData.contacts.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-red-600">{item.current}</td>
                      <td className="py-2 text-gray-400">→</td>
                      <td className="py-2 text-green-600">{item.formatted}</td>
                    </tr>
                  ))}
                  {activeTab === 'signatures' && previewData.email_signatures.map((item, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-red-600">{item.current}</td>
                      <td className="py-2 text-gray-400">→</td>
                      <td className="py-2 text-green-600">{item.formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {previewData && !hasChanges && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <p className="text-lg text-gray-600">All phone numbers are already properly formatted!</p>
              <p className="text-sm text-gray-500 mt-2">No changes needed.</p>
            </div>
          </div>
        )}

        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          {hasChanges && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              disabled={isLoading}
            >
              {isLoading ? 'Standardizing...' : 'Apply Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}