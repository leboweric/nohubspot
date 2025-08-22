"use client"

import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'

interface Option {
  value: string | number
  label: string
}

interface ModernSelectProps {
  value: string | number
  onChange: (value: string | number) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function ModernSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className = ""
}: ModernSelectProps) {
  // Convert both to strings for comparison to handle mixed types
  const selectedOption = options.find(opt => String(opt.value) === String(value))

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={`relative ${className}`}>
        <Listbox.Button className={`
          relative w-full h-9 cursor-pointer rounded-lg bg-background py-2 px-3 pr-10 text-left text-sm
          border border-input hover:border-border/80 shadow-xs
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:border-ring
          disabled:cursor-not-allowed disabled:opacity-50
          transition-all duration-200
        `}>
          <span className={`block truncate ${!selectedOption ? 'text-muted-foreground' : ''}`}>
            {selectedOption?.label || placeholder}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-lg bg-card border border-border py-1 text-sm shadow-lg focus:outline-none">
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-2 pl-10 pr-4 transition-colors duration-200 ${
                    active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                  }`
                }
                value={option.value}
              >
                {({ selected }) => (
                  <>
                    <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                      {option.label}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}