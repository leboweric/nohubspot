"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Contact, contactAPI } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'

interface ContactAutocompleteProps {
  value?: number | null
  onChange: (contactId: number | undefined, contactName: string | undefined) => void
  companyId?: number | null  // Optional: filter by company
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function ContactAutocomplete({
  value,
  onChange,
  companyId,
  placeholder = "Type to search contacts...",
  disabled = false,
  className = ""
}: ContactAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Load initial contact if value is provided
  useEffect(() => {
    if (value && !selectedContact) {
      loadContactById(value)
    }
  }, [value])

  // Search contacts when search term changes
  useEffect(() => {
    if (debouncedSearchTerm) {
      searchContacts(debouncedSearchTerm)
    } else {
      setContacts([])
    }
  }, [debouncedSearchTerm, companyId])

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

  const loadContactById = async (contactId: number) => {
    try {
      const contacts = await contactAPI.getAll({ 
        limit: 1,
        search: contactId.toString() 
      })
      const contact = contacts.find(c => c.id === contactId)
      if (contact) {
        setSelectedContact(contact)
        setSearchTerm(`${contact.first_name} ${contact.last_name}`)
      }
    } catch (err) {
      console.error('Failed to load contact:', err)
    }
  }

  const searchContacts = async (search: string) => {
    try {
      setLoading(true)
      const params: any = { 
        search,
        limit: 20  // Show up to 20 results
      }
      
      // If company is selected, filter by it
      if (companyId) {
        params.company_id = companyId
      }
      
      const results = await contactAPI.getAll(params)
      setContacts(results)
      setIsOpen(results.length > 0)
    } catch (err) {
      console.error('Failed to search contacts:', err)
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  const selectContact = (contact: Contact) => {
    setSelectedContact(contact)
    setSearchTerm(`${contact.first_name} ${contact.last_name}`)
    setIsOpen(false)
    onChange(contact.id, `${contact.first_name} ${contact.last_name}`)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // If the input is cleared, clear the selection
    if (!value) {
      setSelectedContact(null)
      onChange(undefined, undefined)
    }
  }

  const handleFocus = () => {
    if (searchTerm && contacts.length > 0) {
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

      {isOpen && contacts.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {contacts.map(contact => (
            <button
              key={contact.id}
              onClick={() => selectContact(contact)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            >
              <div className="font-medium text-gray-900">
                {contact.first_name} {contact.last_name}
              </div>
              <div className="text-sm text-gray-500">
                {contact.email}
                {contact.company_name && ` • ${contact.company_name}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && contacts.length === 0 && searchTerm && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
          <div className="text-gray-500 text-sm">No contacts found</div>
        </div>
      )}
    </div>
  )
}