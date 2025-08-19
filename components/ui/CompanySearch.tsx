'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Building2 } from 'lucide-react'
import { companyAPI, Company } from '@/lib/api'
import debounce from 'lodash/debounce'

interface CompanySearchProps {
  value: number | null
  onChange: (companyId: number | null, companyName: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
}

export default function CompanySearch({
  value,
  onChange,
  placeholder = "Search for a company...",
  className = "",
  disabled = false,
  required = false
}: CompanySearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCompanyName, setSelectedCompanyName] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load the initially selected company
  useEffect(() => {
    if (value && !selectedCompanyName) {
      loadCompanyById(value)
    }
  }, [value])

  const loadCompanyById = async (companyId: number) => {
    try {
      const company = await companyAPI.getById(companyId)
      if (company) {
        setSelectedCompanyName(company.name)
        setSearchQuery(company.name)
      }
    } catch (err) {
      console.error('Failed to load company:', err)
    }
  }

  // Debounced search function
  const searchCompanies = useCallback(
    debounce(async (query: string) => {
      if (!query || query.length < 2) {
        setCompanies([])
        setHasSearched(false)
        return
      }

      setLoading(true)
      setHasSearched(true)
      try {
        const response = await companyAPI.getAll({ 
          search: query, 
          limit: 50  // Show top 50 matches
        })
        setCompanies(response?.items || [])
      } catch (err) {
        console.error('Failed to search companies:', err)
        setCompanies([])
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
    
    // Clear selection if user is typing something different
    if (selectedCompanyName && query !== selectedCompanyName) {
      setSelectedCompanyName('')
      onChange(null, '')
    }
    
    searchCompanies(query)
    setIsOpen(true)
  }

  // Handle company selection
  const handleSelectCompany = (company: Company) => {
    setSelectedCompanyName(company.name)
    setSearchQuery(company.name)
    onChange(company.id, company.name)
    setIsOpen(false)
    setCompanies([])
    setHasSearched(false)
  }

  // Handle clear
  const handleClear = () => {
    setSearchQuery('')
    setSelectedCompanyName('')
    onChange(null, '')
    setCompanies([])
    setIsOpen(false)
    setHasSearched(false)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            if (searchQuery.length >= 2) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required && !value}
          className={`w-full px-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
          }`}
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        {searchQuery && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Searching...
            </div>
          )}
          
          {!loading && hasSearched && companies.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              No companies found matching "{searchQuery}"
            </div>
          )}
          
          {!loading && companies.length > 0 && (
            <>
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleSelectCompany(company)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{company.name}</div>
                    {company.industry && (
                      <div className="text-xs text-gray-500 truncate">{company.industry}</div>
                    )}
                  </div>
                </button>
              ))}
              {companies.length === 50 && (
                <div className="px-4 py-2 text-xs text-gray-500 border-t">
                  Showing first 50 results. Type more to refine your search.
                </div>
              )}
            </>
          )}
          
          {!loading && !hasSearched && searchQuery.length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Press Enter to search
            </div>
          )}
          
          {!loading && !hasSearched && searchQuery.length < 2 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  )
}