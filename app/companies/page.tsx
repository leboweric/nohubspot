"use client"

import { useState, useEffect } from "react"
import BulkUpload, { BulkUploadData, FieldMapping } from "@/components/upload/BulkUpload"
import { companyAPI, Company, CompanyCreate, handleAPIError } from "@/lib/api"

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  // Load companies from API
  const loadCompanies = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await companyAPI.getAll({ 
        search: searchTerm || undefined,
        limit: 1000 // Get all companies for now
      })
      setCompanies(data)
    } catch (err) {
      setError(handleAPIError(err))
      console.error('Failed to load companies:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load companies on mount and when search term changes
  useEffect(() => {
    loadCompanies()
  }, []) // Load initially

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        loadCompanies()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Reload companies when window gains focus (returning from add/edit pages)
  useEffect(() => {
    const handleFocus = () => {
      loadCompanies()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Since we're using API search, no need for client-side filtering
  const filteredCompanies = companies

  const handleBulkUpload = async (data: BulkUploadData, mappings: FieldMapping[]) => {
    try {
      const newCompanies: CompanyCreate[] = data.rows.map((row) => {
        const company: any = {
          status: "Active"
        }

        mappings.forEach(mapping => {
          if (mapping.targetField) {
            const columnIndex = data.headers.indexOf(mapping.csvColumn)
            if (columnIndex !== -1) {
              const value = row[columnIndex] || ''
              // Map frontend field names to backend field names
              if (mapping.targetField === 'name') {
                company.name = value
              } else if (mapping.targetField === 'industry') {
                company.industry = value
              } else if (mapping.targetField === 'website') {
                company.website = value
              } else if (mapping.targetField === 'description') {
                company.description = value
              } else if (mapping.targetField === 'status') {
                company.status = value
              }
            }
          }
        })

        return company
      })

      // Upload via API
      const result = await companyAPI.bulkUpload(newCompanies)
      
      if (result.error_count > 0) {
        alert(`Imported ${result.success_count} companies successfully.\n${result.error_count} failed:\n${result.errors.join('\n')}`)
      } else {
        alert(`Successfully imported ${result.success_count} companies!`)
      }

      // Refresh the companies list
      loadCompanies()
    } catch (error) {
      console.error('Failed to import companies:', error)
      alert(`Failed to import companies: ${handleAPIError(error)}`)
    }
  }

  const companyFields = [
    { key: 'name', label: 'Company Name' },
    { key: 'industry', label: 'Industry' },
    { key: 'website', label: 'Website' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-muted-foreground mt-1">Manage your business relationships</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkUpload(true)}
            className="px-4 py-2 border border-blue-200 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-all text-blue-700"
          >
            📂 Bulk Upload
          </button>
          <a href="/companies/new" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm">
            ➕ Add Company
          </a>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search companies..."
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
            onClick={loadCompanies}
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
              <p className="text-muted-foreground">Loading companies...</p>
            </div>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Company</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Industry</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Contacts</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Files</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCompanies.map((company) => (
                  <tr key={company.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-muted-foreground">{company.website || 'No website'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{company.industry || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        company.status === "Active" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{company.contact_count}</td>
                    <td className="px-6 py-4 text-sm">{company.attachment_count}</td>
                    <td className="px-6 py-4 text-sm">
                      <a href={`/companies/${company.id}`} className="text-primary hover:underline">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredCompanies.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm ? `No companies found matching "${searchTerm}"` : "No companies yet. Add your first company to get started."}
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
        type="companies"
        requiredFields={['name']}
        availableFields={companyFields}
      />
    </div>
  )
}