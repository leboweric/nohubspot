"use client"

import { useState, useEffect } from "react"
import BulkUpload, { BulkUploadData, FieldMapping } from "@/components/upload/BulkUpload"
import { contactAPI, Contact, ContactCreate, handleAPIError } from "@/lib/api"

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  // Load contacts from API
  const loadContacts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await contactAPI.getAll({ 
        search: searchTerm || undefined,
        limit: 1000 // Get all contacts for now
      })
      setContacts(data)
    } catch (err) {
      setError(handleAPIError(err))
      console.error('Failed to load contacts:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load contacts on mount and when search term changes
  useEffect(() => {
    loadContacts()
  }, []) // Load initially

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        loadContacts()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Reload contacts when window gains focus (returning from add/edit pages)
  useEffect(() => {
    const handleFocus = () => {
      loadContacts()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Since we're using API search, no need for client-side filtering
  const filteredContacts = contacts

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage your professional network</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="px-4 py-2 border border-green-200 rounded-md hover:bg-green-50 hover:border-green-300 transition-all text-green-700"
          >
            📂 Bulk Upload
          </button>
          <a href="/contacts/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm">
            ➕ Add Contact
          </a>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={loading}
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
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
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium">{contact.first_name} {contact.last_name}</div>
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
                      <a href={`/contacts/${contact.id}`} className="text-primary hover:underline">
                        View
                      </a>
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
  )
}