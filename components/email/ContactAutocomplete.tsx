"use client"

import { useState, useEffect, useRef } from "react"
import { searchContacts, Contact } from "@/utils/contactSearch"

interface ContactAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelectContact: (contact: Contact) => void
  placeholder?: string
  className?: string
}

export default function ContactAutocomplete({ 
  value, 
  onChange, 
  onSelectContact, 
  placeholder = "Enter email or name...",
  className = ""
}: ContactAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Search for contacts when value changes
  useEffect(() => {
    if (value.trim().length > 0) {
      const searchAsync = async () => {
        try {
          const results = await searchContacts(value.trim())
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
          setSelectedIndex(-1)
        } catch (error) {
          console.error('Contact search failed:', error)
          setSuggestions([])
          setShowSuggestions(false)
          setSelectedIndex(-1)
        }
      }
      
      searchAsync()
    } else {
      setSuggestions([])
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }, [value])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  // Handle contact selection
  const handleSelectContact = (contact: Contact) => {
    onSelectContact(contact)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          )
        }
        break
      
      case 'ArrowUp':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          )
        }
        break
      
      case 'Enter':
        e.preventDefault()
        if (showSuggestions && selectedIndex >= 0 && selectedIndex < suggestions.length) {
          // Select from suggestions
          handleSelectContact(suggestions[selectedIndex])
        } else if (value.includes('@')) {
          // Add as email if it looks like an email
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (emailRegex.test(value.trim())) {
            onSelectContact({
              id: Date.now().toString(),
              firstName: value.split('@')[0],
              lastName: '',
              email: value.trim(),
              status: 'Active'
            })
          }
        }
        break
      
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true)
          }
        }}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
        autoComplete="off"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((contact, index) => (
            <div
              key={contact.id}
              onClick={() => handleSelectContact(contact)}
              className={`px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent ${
                index === selectedIndex ? 'bg-accent' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">
                    {contact.firstName} {contact.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {contact.email}
                  </div>
                  {contact.company && (
                    <div className="text-xs text-muted-foreground">
                      {contact.title ? `${contact.title} at ` : ''}{contact.company}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {contact.status === 'Active' ? '🟢' : '🟡'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}