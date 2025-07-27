"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Company, companyAPI } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'

interface CompanyAutocompleteProps {
  value?: number | null
  onChange: (companyId: number | undefined, companyName: string | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function CompanyAutocomplete({
  value,
  onChange,
  placeholder = "Type to search companies...",
  disabled = false,
  className = ""
}: CompanyAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Load initial company if value is provided
  useEffect(() => {
    if (value && !selectedCompany) {
      loadCompanyById(value)
    }
  }, [value])

  // Search companies when search term changes
  useEffect(() => {
    if (debouncedSearchTerm) {
      searchCompanies(debouncedSearchTerm)
    } else {
      setCompanies([])
    }
  }, [debouncedSearchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const loadCompanyById = async (companyId: number) => {
    try {
      const companies = await companyAPI.getAll({ 
        limit: 1,
        search: companyId.toString() 
      })
      const company = companies.find(c => c.id === companyId)
      if (company) {
        setSelectedCompany(company)
        setSearchTerm(company.name)
      }
    } catch (err) {
      console.error('Failed to load company:', err)
    }
  }

  const searchCompanies = async (search: string) => {
    try {
      setLoading(true)
      const results = await companyAPI.getAll({ 
        search,
        limit: 20  // Show up to 20 results
      })
      setCompanies(results)
      setIsOpen(results.length > 0)
    } catch (err) {
      console.error('Failed to search companies:', err)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const selectCompany = (company: Company) => {
    setSelectedCompany(company)
    setSearchTerm(company.name)
    setIsOpen(false)
    onChange(company.id, company.name)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // If the input is cleared, clear the selection
    if (!value) {
      setSelectedCompany(null)
      onChange(undefined, undefined)
    }
  }

  const handleFocus = () => {
    if (searchTerm && companies.length > 0) {
      setIsOpen(true)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
      />
      
      {loading && (
        <div className="absolute right-2 top-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </div>
      )}

      {isOpen && companies.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {companies.map(company => (
            <button
              key={company.id}
              onClick={() => selectCompany(company)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            >
              <div className="font-medium text-gray-900">{company.name}</div>
              {company.industry && (
                <div className="text-sm text-gray-500">{company.industry}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && companies.length === 0 && searchTerm && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
          <div className="text-gray-500 text-sm">No companies found</div>
        </div>
      )}
    </div>
  )
}