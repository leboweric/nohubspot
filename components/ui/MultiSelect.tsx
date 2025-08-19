"use client"

import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { X } from 'lucide-react'

interface Option {
  value: string | number
  label: string
}

interface MultiSelectProps {
  value: (string | number)[]
  onChange: (value: (string | number)[]) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function MultiSelect({
  value = [],
  onChange,
  options,
  placeholder = "Select options",
  disabled = false,
  className = ""
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Get selected options
  const selectedOptions = options.filter(opt => value.includes(opt.value))
  
  // Toggle option selection
  const toggleOption = (optionValue: string | number) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }
  
  // Remove a selected option
  const removeOption = (optionValue: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(v => v !== optionValue))
  }

  return (
    <div className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          relative w-full min-h-[36px] cursor-pointer rounded-lg bg-background py-2 px-3 pr-10
          border border-input hover:border-border/80 shadow-xs
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:border-ring
          disabled:cursor-not-allowed disabled:opacity-50
          transition-all duration-200
        `}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-muted-foreground text-sm">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map(option => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm"
              >
                {option.label}
                <button
                  onClick={(e) => removeOption(option.value, e)}
                  className="hover:text-gray-900 focus:outline-none"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </div>
      
      <Transition
        show={isOpen}
        as={Fragment}
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-lg bg-card border border-border py-1 text-sm shadow-lg">
          {options.map((option) => {
            const isSelected = value.includes(option.value)
            return (
              <div
                key={option.value}
                className="relative cursor-pointer select-none py-2 pl-10 pr-4 hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
                onClick={() => toggleOption(option.value)}
              >
                <span className={`block truncate ${isSelected ? 'font-medium' : 'font-normal'}`}>
                  {option.label}
                </span>
                {isSelected && (
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Transition>
      
      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}