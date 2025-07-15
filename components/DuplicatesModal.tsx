'use client'

import { useState, useEffect } from 'react'

interface DuplicateGroup {
  match_value: string
  companies?: Array<{
    id: number
    name: string
    domain: string | null
    phone: string | null
    created_at: string | null
    updated_at: string | null
    deal_count: number
    contact_count: number
  }>
  contacts?: Array<{
    id: number
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    company_id: number | null
    company_name: string | null
    created_at: string | null
    updated_at: string | null
    deal_count: number
    email_count: number
  }>
}

interface DuplicatesData {
  by_name?: DuplicateGroup[]
  by_email?: DuplicateGroup[]
  by_domain?: DuplicateGroup[]
  by_phone?: DuplicateGroup[]
  summary: {
    total_companies?: number
    total_contacts?: number
    duplicate_groups: number
    total_duplicates: number
  }
}

interface DuplicatesModalProps {
  isOpen: boolean
  onClose: () => void
  duplicatesData: DuplicatesData | null
  recordType: 'companies' | 'contacts'
  onDelete: (selectedIds: number[]) => void
  isLoading?: boolean
}

export default function DuplicatesModal({
  isOpen,
  onClose,
  duplicatesData,
  recordType,
  onDelete,
  isLoading = false
}: DuplicatesModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Reset selections when modal opens
    if (isOpen) {
      setSelectedIds(new Set())
      setExpandedGroups(new Set())
    }
  }, [isOpen])

  if (!isOpen || !duplicatesData) return null

  const hasDuplicates = duplicatesData.summary.total_duplicates > 0

  const toggleGroupExpansion = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  const toggleSelection = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleGroupSelection = (group: DuplicateGroup, matchType: string) => {
    const items = recordType === 'companies' ? group.companies : group.contacts
    if (!items) return

    const groupKey = `${matchType}-${group.match_value}`
    const allSelected = items.every(item => selectedIds.has(item.id))

    const newSelected = new Set(selectedIds)
    items.forEach(item => {
      if (allSelected) {
        newSelected.delete(item.id)
      } else {
        newSelected.add(item.id)
      }
    })
    setSelectedIds(newSelected)
  }

  const renderDuplicateGroups = (groups: DuplicateGroup[], matchType: string, matchLabel: string) => {
    if (!groups || groups.length === 0) return null

    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Duplicates by {matchLabel} ({groups.length} groups)
        </h4>
        <div className="space-y-3">
          {groups.map((group, idx) => {
            const items = recordType === 'companies' ? group.companies : group.contacts
            if (!items || items.length === 0) return null

            const groupKey = `${matchType}-${group.match_value}`
            const isExpanded = expandedGroups.has(groupKey)
            const allSelected = items.every(item => selectedIds.has(item.id))
            const someSelected = items.some(item => selectedIds.has(item.id))

            return (
              <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => toggleGroupExpansion(groupKey)}
                    className="flex items-center space-x-2 text-sm font-medium hover:text-blue-600"
                  >
                    <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <span>{matchLabel}: {group.match_value}</span>
                    <span className="text-gray-500">({items.length} records)</span>
                  </button>
                  <button
                    onClick={() => toggleGroupSelection(group, matchType)}
                    className={`text-xs px-2 py-1 rounded ${
                      allSelected
                        ? 'bg-blue-100 text-blue-700'
                        : someSelected
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-100 text-gray-600'
                    } hover:bg-blue-200`}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {recordType === 'companies' && group.companies?.map((company) => (
                      <div
                        key={company.id}
                        className={`p-3 border rounded-md bg-white ${
                          selectedIds.has(company.id) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(company.id)}
                                onChange={() => toggleSelection(company.id)}
                                className="h-4 w-4 text-red-600"
                              />
                              <span className="font-medium">{company.name}</span>
                            </div>
                            <div className="ml-6 mt-1 text-xs text-gray-600 space-y-1">
                              {company.domain && <div>Domain: {company.domain}</div>}
                              {company.phone && <div>Phone: {company.phone}</div>}
                              <div>Created: {company.created_at ? new Date(company.created_at).toLocaleDateString() : 'Unknown'}</div>
                              <div className="flex space-x-4 text-gray-500">
                                <span>{company.contact_count} contacts</span>
                                <span>{company.deal_count} deals</span>
                              </div>
                            </div>
                          </div>
                          {selectedIds.has(company.id) && (
                            <span className="text-xs text-red-600 font-medium">Will be deleted</span>
                          )}
                        </div>
                      </div>
                    ))}

                    {recordType === 'contacts' && group.contacts?.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-3 border rounded-md bg-white ${
                          selectedIds.has(contact.id) ? 'border-red-300 bg-red-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(contact.id)}
                                onChange={() => toggleSelection(contact.id)}
                                className="h-4 w-4 text-red-600"
                              />
                              <span className="font-medium">{contact.first_name} {contact.last_name}</span>
                            </div>
                            <div className="ml-6 mt-1 text-xs text-gray-600 space-y-1">
                              {contact.email && <div>Email: {contact.email}</div>}
                              {contact.phone && <div>Phone: {contact.phone}</div>}
                              {contact.company_name && <div>Company: {contact.company_name}</div>}
                              <div>Created: {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : 'Unknown'}</div>
                              <div className="flex space-x-4 text-gray-500">
                                <span>{contact.email_count} emails</span>
                                <span>{contact.deal_count} deals</span>
                              </div>
                            </div>
                          </div>
                          {selectedIds.has(contact.id) && (
                            <span className="text-xs text-red-600 font-medium">Will be deleted</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[85vh] flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">
            Duplicate {recordType === 'companies' ? 'Companies' : 'Contacts'} Found
          </h2>
          {duplicatesData && (
            <p className="text-sm text-gray-600 mt-2">
              {hasDuplicates 
                ? `Found ${duplicatesData.summary.total_duplicates} potential duplicates in ${duplicatesData.summary.duplicate_groups} groups`
                : `No duplicate ${recordType} found!`
              }
            </p>
          )}
          {selectedIds.size > 0 && (
            <p className="text-sm text-red-600 mt-2 font-medium">
              {selectedIds.size} {recordType === 'companies' ? 'companies' : 'contacts'} selected for deletion
            </p>
          )}
        </div>

        {duplicatesData && hasDuplicates && (
          <div className="flex-1 overflow-auto p-6">
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Tip:</strong> Review each group carefully. The oldest record is shown first. 
                Select the duplicates you want to delete, keeping the primary record.
              </p>
            </div>

            {recordType === 'companies' ? (
              <>
                {renderDuplicateGroups(duplicatesData.by_name || [], 'name', 'Name')}
                {renderDuplicateGroups(duplicatesData.by_domain || [], 'domain', 'Domain')}
                {renderDuplicateGroups(duplicatesData.by_phone || [], 'phone', 'Phone')}
              </>
            ) : (
              <>
                {renderDuplicateGroups(duplicatesData.by_email || [], 'email', 'Email')}
                {renderDuplicateGroups(duplicatesData.by_name || [], 'name', 'Name')}
                {renderDuplicateGroups(duplicatesData.by_phone || [], 'phone', 'Phone')}
              </>
            )}
          </div>
        )}

        {duplicatesData && !hasDuplicates && (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <div className="text-6xl mb-4">✓</div>
              <p className="text-lg text-gray-600">
                No duplicate {recordType} found!
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Your {recordType} data is clean with no duplicates.
              </p>
            </div>
          </div>
        )}

        <div className="p-6 border-t flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedIds.size > 0 && (
              <span>
                {selectedIds.size} {recordType === 'companies' ? 'companies' : 'contacts'} will be deleted
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => onDelete(Array.from(selectedIds))}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-red-400"
                disabled={isLoading}
              >
                {isLoading ? 'Deleting...' : `Delete ${selectedIds.size} Selected`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}