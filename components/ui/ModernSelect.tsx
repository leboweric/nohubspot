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
  const selectedOption = options.find(opt => opt.value === value)

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className={`relative ${className}`}>
        <Listbox.Button className={`
          relative w-full cursor-pointer rounded-lg bg-white py-2.5 pl-3 pr-10 text-left 
          border border-gray-200 hover:border-gray-300
          focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20
          disabled:cursor-not-allowed disabled:opacity-50
          transition-all duration-200
        `}>
          <span className={`block truncate ${!selectedOption ? 'text-gray-500' : ''}`}>
            {selectedOption?.label || placeholder}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
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
          <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            {options.map((option) => (
              <Listbox.Option
                key={option.value}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-2.5 pl-10 pr-4 ${
                    active ? 'bg-primary/10 text-primary' : 'text-gray-900'
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
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
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