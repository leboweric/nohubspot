"use client"

import Link from "next/link"
import { AlertCircle, DollarSign, Phone, FileSignature, Users } from "lucide-react"

interface ActionItem {
  count: number
  label: string
  value?: string
  href: string
  icon: React.ElementType
  color: string
}

interface ActionItemsBarProps {
  items: ActionItem[]
}

export default function ActionItemsBar({ items }: ActionItemsBarProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="border rounded-lg p-4 mb-6" style={{ backgroundColor: 'var(--color-neutral-50)', borderColor: 'var(--color-secondary-light)' }}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        🎯 Today's Priorities
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <Link
              key={index}
              href={item.href}
              className="flex items-center gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-all group"
            >
              <div className="p-2 rounded-lg" style={{ backgroundColor: index === 0 ? 'var(--color-secondary)' : index === 1 ? 'var(--color-primary)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-400)' }}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {item.count}
                </p>
                <p className="text-xs text-gray-600 group-hover:text-gray-900">
                  {item.label}
                  {item.value && (
                    <span className="font-semibold ml-1">({item.value})</span>
                  )}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}