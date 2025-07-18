"use client"

import { useState, useEffect, useCallback } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import BulkUpload, { BulkUploadData, FieldMapping } from "@/components/upload/BulkUpload"
import { companyAPI, Company, CompanyCreate, handleAPIError } from "@/lib/api"

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  // Load companies from API
  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Loading companies with search term:', searchTerm)
      
      const data = await companyAPI.getAll({ 
        search: searchTerm || undefined,
        limit: 1000, // Get all companies for now
        sort_by: 'name',
        sort_order: 'asc'
      })
      
      console.log('Companies loaded successfully:', data.length)
      setCompanies(data)
    } catch (err) {
      const errorMessage = handleAPIError(err)
      setError(errorMessage)
      console.error('Failed to load companies:', err)
      console.error('Error message:', errorMessage)
      console.error('Error type:', err instanceof Error ? err.constructor.name : typeof err)
      
      // More specific error handling
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        setError('Network error: Unable to connect to the server. Please check your internet connection.')
      } else if (errorMessage.includes('401') || errorMessage.includes('Authentication')) {
        setError('Authentication error: Please log in again.')
      }
    } finally {
      setLoading(false)
    }
  }, [searchTerm])

  // Load companies on mount
  useEffect(() => {
    loadCompanies()
  }, []) // Only run on mount

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadCompanies()
    }, searchTerm === '' ? 0 : 1000) // Immediate reload on empty, debounced on search

    return () => clearTimeout(timeoutId)
  }, [searchTerm, loadCompanies])

  // Throttled reload on window focus with cooldown
  useEffect(() => {
    let lastFocusTime = 0
    const FOCUS_COOLDOWN = 30000 // 30 seconds cooldown

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFocusTime > FOCUS_COOLDOWN) {
        console.log('Window focus detected, reloading companies after cooldown')
        loadCompanies()
        lastFocusTime = now
      } else {
        console.log('Window focus ignored - still in cooldown period')
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadCompanies])

  // Since we're using API search, no need for client-side filtering
  const filteredCompanies = companies

  const handleDelete = async (companyId: number, companyName: string) => {
    const confirmed = confirm(`Are you sure you want to delete ${companyName}? This action cannot be undone.`)
    if (!confirmed) return

    try {
      setLoading(true)
      await companyAPI.delete(companyId)
      alert(`${companyName} has been deleted successfully.`)
      loadCompanies() // Refresh the list
    } catch (err) {
      console.error('Failed to delete company:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      alert(`Failed to delete company: ${errorMessage}\n\nPlease check your internet connection and try again.`)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkUpload = async (data: BulkUploadData, mappings: FieldMapping[]) => {
    try {
      console.log('Starting bulk upload with data:', { 
        rowCount: data.rows.length, 
        headers: data.headers,
        mappings 
      })
      
      const newCompanies: CompanyCreate[] = data.rows.map((row, index) => {
        const company: any = {
          status: "Active"
        }

        mappings.forEach(mapping => {
          if (mapping.targetField) {
            const columnIndex = data.headers.indexOf(mapping.csvColumn)
            if (columnIndex !== -1) {
              const value = String(row[columnIndex] || '').trim()
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
              } else if (mapping.targetField === 'phone') {
                company.phone = value
              } else if (mapping.targetField === 'street_address') {
                company.street_address = value
              } else if (mapping.targetField === 'city') {
                company.city = value
              } else if (mapping.targetField === 'state') {
                company.state = value
              } else if (mapping.targetField === 'postal_code') {
                company.postal_code = value
              } else if (mapping.targetField === 'annual_revenue') {
                company.annual_revenue = parseFloat(value) || undefined
              }
            }
          }
        })

        // Validate required fields
        if (!company.name) {
          console.warn(`Row ${index + 1} missing company name:`, row)
        }

        return company
      })
      
      // Filter out companies without names
      const validCompanies = newCompanies.filter(c => c.name)
      console.log(`Processing ${validCompanies.length} valid companies out of ${newCompanies.length} total`)

      // Check if we have too many companies - batch them
      const BATCH_SIZE = 100
      if (validCompanies.length > BATCH_SIZE) {
        const totalBatches = Math.ceil(validCompanies.length / BATCH_SIZE)
        let totalSuccess = 0
        let totalErrors = 0
        const allErrors: string[] = []
        
        // Show progress
        const confirmed = confirm(`This will import ${validCompanies.length} companies in ${totalBatches} batches of ${BATCH_SIZE}. Continue?`)
        if (!confirmed) return
        
        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE
          const end = Math.min(start + BATCH_SIZE, validCompanies.length)
          const batch = validCompanies.slice(start, end)
          
          console.log(`Processing batch ${i + 1}/${totalBatches} (${batch.length} companies)`)
          
          try {
            const result = await companyAPI.bulkUpload(batch)
            totalSuccess += result.success_count
            totalErrors += result.error_count
            if (result.errors) {
              allErrors.push(...result.errors)
            }
          } catch (batchError) {
            console.error(`Batch ${i + 1} failed:`, batchError)
            totalErrors += batch.length
            allErrors.push(`Batch ${i + 1}: ${handleAPIError(batchError)}`)
          }
        }
        
        if (totalErrors > 0) {
          alert(`Import completed!\n\nSuccessful: ${totalSuccess}\nFailed: ${totalErrors}\n\nErrors:\n${allErrors.slice(0, 10).join('\n')}${allErrors.length > 10 ? '\n...and more' : ''}`)
        } else {
          alert(`Successfully imported all ${totalSuccess} companies!`)
        }
      } else {
        // Small batch, upload normally
        const result = await companyAPI.bulkUpload(validCompanies)
        
        if (result.error_count > 0) {
          alert(`Imported ${result.success_count} companies successfully.\n${result.error_count} failed:\n${result.errors.join('\n')}`)
        } else {
          alert(`Successfully imported ${result.success_count} companies!`)
        }
      }

      // Refresh the companies list
      loadCompanies()
    } catch (error) {
      console.error('Failed to import companies:', error)
      
      // Better error handling
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error)
      } else {
        errorMessage = String(error)
      }
      
      alert(`Failed to import companies: ${errorMessage}`)
    }
  }

  const companyFields = [
    { key: 'name', label: 'Company Name' },
    { key: 'industry', label: 'Industry' },
    { key: 'website', label: 'Website' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'street_address', label: 'Street Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State/Region' },
    { key: 'postal_code', label: 'Postal Code' },
    { key: 'annual_revenue', label: 'Annual Revenue' },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' }
  ]

  const handleExportCompanies = () => {
    try {
      // Create CSV headers
      const headers = [
        'Company Name',
        'Account Owner',
        'Phone Number',
        'City',
        'State/Region',
        'Industry',
        'Street Address',
        'Postal Code',
        'Annual Revenue',
        'Website',
        'Status',
        'Contact Count',
        'Description'
      ]
      
      // Create CSV rows
      const rows = filteredCompanies.map(company => [
        company.name,
        company.primary_account_owner_name || '',
        company.phone || '',
        company.city || '',
        company.state || '',
        company.industry || '',
        company.street_address || '',
        company.postal_code || '',
        company.annual_revenue?.toString() || '',
        company.website || '',
        company.status,
        company.contact_count.toString(),
        company.description || ''
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
      link.setAttribute('download', `companies_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      URL.revokeObjectURL(url)
      
      alert(`Successfully exported ${filteredCompanies.length} companies to CSV!`)
    } catch (error) {
      console.error('Failed to export companies:', error)
      alert('Failed to export companies. Please try again.')
    }
  }

  return (
    <AuthGuard>
      <MainLayout>
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
          <button
            onClick={handleExportCompanies}
            disabled={loading || filteredCompanies.length === 0}
            className="px-4 py-2 border border-green-200 rounded-md hover:bg-green-50 hover:border-green-300 transition-all text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📥 Export to CSV
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
            }
          }}
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
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Account Owner</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Location</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Industry</th>
                  <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Status</th>
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
                    <td className="px-6 py-4 text-sm">{company.primary_account_owner_name || '-'}</td>
                    <td className="px-6 py-4 text-sm">{company.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      {company.city || company.state ? (
                        <span>
                          {company.city}
                          {company.city && company.state && ', '}
                          {company.state}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">{company.industry || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        company.status === "Active" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" 
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                      }`}>
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <a href={`/companies/${company.id}`} className="text-primary hover:underline">
                          View
                        </a>
                        <a href={`/companies/${company.id}/edit`} className="text-blue-600 hover:underline">
                          Edit
                        </a>
                        <button
                          onClick={() => handleDelete(company.id, company.name)}
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
      </MainLayout>
    </AuthGuard>
  )
}