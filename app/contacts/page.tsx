"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import BulkUpload, { BulkUploadData, FieldMapping } from "@/components/upload/BulkUpload"
import { contactAPI, Contact, ContactCreate, handleAPIError, companyAPI, Company } from "@/lib/api"
import ModernSelect from "@/components/ui/ModernSelect"

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [companies, setCompanies] = useState<Company[]>([])

  // Load contacts from API
  const loadContacts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await contactAPI.getAll({ 
        search: searchTerm || undefined,
        limit: 100 // Reduced for better performance
      })
      setContacts(data)
    } catch (err) {
      setError(handleAPIError(err))
      console.error('Failed to load contacts:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load contacts and companies on mount
  useEffect(() => {
    loadContacts()
    loadCompanies()
  }, []) // Load initially

  const loadCompanies = async () => {
    try {
      const response = await companyAPI.getAll({ 
        limit: 1000,  // Increased to get all companies
        sort_by: 'name',
        sort_order: 'asc'
      })
      // Handle paginated response
      setCompanies(response.items || [])
    } catch (err) {
      console.error('Failed to load companies:', err)
      setCompanies([])
    }
  }

  // Debounced search with increased delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        loadContacts()
      }
    }, 1000) // Increased from 300ms to 1000ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Throttled reload on window focus with cooldown
  useEffect(() => {
    let lastFocusTime = 0
    const FOCUS_COOLDOWN = 30000 // 30 seconds cooldown

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFocusTime > FOCUS_COOLDOWN) {
        console.log('Window focus detected, reloading contacts after cooldown')
        loadContacts()
        lastFocusTime = now
      } else {
        console.log('Window focus ignored - still in cooldown period')
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Apply client-side filters on top of server-side search
  const filteredContacts = (Array.isArray(contacts) ? contacts : []).filter(contact => {
    // Status filter
    if (statusFilter !== "all" && contact.status !== statusFilter) {
      return false
    }
    
    // Company filter
    if (companyFilter !== "all") {
      const companyId = parseInt(companyFilter)
      if (contact.company_id !== companyId) {
        return false
      }
    }
    
    return true
  })

  const handleDelete = async (contactId: number, contactName: string) => {
    const confirmed = confirm(`Are you sure you want to delete ${contactName}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      setLoading(true)
      await contactAPI.delete(contactId)
      alert(`${contactName} has been deleted successfully.`)
      loadContacts() // Refresh the list
    } catch (err) {
      console.error('Failed to delete contact:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      alert(`Failed to delete contact: ${errorMessage}\n\nPlease check your internet connection and try again.`)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkUpload = async (data: BulkUploadData, mappings: FieldMapping[]) => {
    try {
      const newContacts: ContactCreate[] = data.rows.map((row) => {
        const contact: any = {
          status: "Active"
        }

        mappings.forEach(mapping => {
          if (mapping.targetField) {
            const columnIndex = data.headers.indexOf(mapping.csvColumn)
            if (columnIndex !== -1) {
              const value = row[columnIndex] || ''
              // Map frontend field names to backend field names
              if (mapping.targetField === 'firstName') {
                contact.first_name = value
              } else if (mapping.targetField === 'lastName') {
                contact.last_name = value
              } else if (mapping.targetField === 'email') {
                contact.email = value
              } else if (mapping.targetField === 'phone') {
                contact.phone = value
              } else if (mapping.targetField === 'title') {
                contact.title = value
              } else if (mapping.targetField === 'company') {
                contact.company_name = value
              } else if (mapping.targetField === 'status') {
                contact.status = value
              } else if (mapping.targetField === 'notes') {
                contact.notes = value
              }
            }
          }
        })

        return contact
      })

      // Upload via API
      const result = await contactAPI.bulkUpload(newContacts)
      
      if (result.error_count > 0) {
        alert(`Imported ${result.success_count} contacts successfully.\n${result.error_count} failed:\n${result.errors.join('\n')}`)
      } else {
        alert(`Successfully imported ${result.success_count} contacts!`)
      }

      // Refresh the contacts list
      loadContacts()
    } catch (error) {
      console.error('Failed to import contacts:', error)
      alert(`Failed to import contacts: ${handleAPIError(error)}`)
    }
  }

  const contactFields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'title', label: 'Job Title' },
    { key: 'company', label: 'Company' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' }
  ]

  const handleExportContacts = () => {
    try {
      // Create CSV headers
      const headers = [
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Job Title',
        'Company',
        'Status',
        'Notes'
      ]
      
      // Create CSV rows
      const rows = filteredContacts.map(contact => [
        contact.first_name,
        contact.last_name,
        contact.email,
        contact.phone || '',
        contact.title || '',
        contact.company_name || '',
        contact.status,
        contact.notes || ''
      ])
      
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
      link.setAttribute('download', `contacts_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      URL.revokeObjectURL(url)
      
      const filterInfo = []
      if (searchTerm) filterInfo.push(`matching "${searchTerm}"`)
      if (statusFilter !== "all") filterInfo.push(`with status: ${statusFilter}`)
      if (companyFilter !== "all") {
        const company = companies.find(c => c.id.toString() === companyFilter)
        if (company) filterInfo.push(`from ${company.name}`)
      }
      
      const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : ''
      alert(`Successfully exported ${filteredContacts.length} contacts${filterText} to CSV!`)
    } catch (error) {
      console.error('Failed to export contacts:', error)
      alert('Failed to export contacts. Please try again.')
    }
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage your professional network</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="px-4 py-2 border border-blue-200 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-all text-blue-700"
          >
            📂 Bulk Upload
          </button>
          <button
            onClick={handleExportContacts}
            disabled={loading || filteredContacts.length === 0}
            className="px-4 py-2 border border-green-200 rounded-md hover:bg-green-50 hover:border-green-300 transition-all text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 Export to CSV
          </button>
          <a href="/contacts/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm">
            ➕ Add Contact
          </a>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <ModernSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as string)}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "Active", label: "Active" },
                { value: "Inactive", label: "Inactive" }
              ]}
              placeholder="Select status"
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company
            </label>
            <ModernSelect
              value={companyFilter}
              onChange={(value) => setCompanyFilter(value as string)}
              options={[
                { value: "all", label: "All Companies" },
                ...(Array.isArray(companies) ? companies : []).map(company => ({
                  value: company.id.toString(),
                  label: company.name
                }))
              ]}
              placeholder="Select company"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
          <button 
            onClick={loadContacts}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading contacts...</p>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Company</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(Array.isArray(filteredContacts) ? filteredContacts : []).map((contact) => (
                  <tr key={contact.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <span>{contact.first_name} {contact.last_name}</span>
                          {contact.shared_with_team && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full" title="Shared with team">
                              Team
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{contact.title || 'No title'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{contact.email}</td>
                    <td className="px-6 py-4 text-sm">{contact.phone || "-"}</td>
                    <td className="px-6 py-4 text-sm">{contact.company_name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        contact.status === "Active" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <a href={`/contacts/${contact.id}`} className="text-primary hover:underline">
                          View
                        </a>
                        <a href={`/contacts/${contact.id}/edit`} className="text-blue-600 hover:underline">
                          Edit
                        </a>
                        <button
                          onClick={() => handleDelete(contact.id, `${contact.first_name} ${contact.last_name}`)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredContacts.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm ? `No contacts found matching "${searchTerm}"` : "No contacts yet. Add your first contact to get started."}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Upload Modal */}
      <BulkUpload
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onUpload={handleBulkUpload}
        type="contacts"
        requiredFields={['firstName', 'lastName', 'email']}
        availableFields={contactFields}
      />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}