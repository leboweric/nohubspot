"use client"

import Link from "next/link"
import { Contact } from "@/lib/api"
import { 
  User, Phone, Mail, Building2, Calendar, MoreVertical, 
  Star, MessageCircle, UserPlus, FileText, Tag
} from "lucide-react"
import { useState } from "react"

interface ContactCardProps {
  contact: Contact
  onDelete: (id: number, name: string) => void
}

export default function ContactCard({ contact, onDelete }: ContactCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isStarred, setIsStarred] = useState(false)
  
  // Get initials for avatar
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }
  
  // Get full name
  const fullName = `${contact.first_name} ${contact.last_name}`
  
  // Format last activity date
  const formatLastActivity = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return "Today"
      if (diffDays === 1) return "Yesterday"
      if (diffDays < 7) return `${diffDays} days ago`
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
      return `${Math.floor(diffDays / 365)} years ago`
    } catch {
      return "Unknown"
    }
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-200 relative group">
      {/* Star Button */}
      <div className="absolute top-3 right-3">
        <button
          onClick={(e) => {
            e.preventDefault()
            setIsStarred(!isStarred)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Star className={`w-4 h-4 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
        </button>
      </div>
      
      {/* Contact Avatar & Name */}
      <Link href={`/contacts/${contact.id}`} className="block mb-4">
        <div className="flex items-start gap-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
            style={{ 
              background: `linear-gradient(135deg, var(--color-accent), var(--color-primary))` 
            }}
          >
            {getInitials(contact.first_name, contact.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base hover:text-primary transition-colors truncate">
              {fullName}
            </h3>
            {contact.title && (
              <p className="text-sm text-muted-foreground truncate">{contact.title}</p>
            )}
            {contact.company_name && (
              <p 
                className="text-sm transition-colors truncate hover:opacity-80"
                style={{ color: 'var(--color-primary)' }}
              >
                {contact.company_name}
              </p>
            )}
          </div>
        </div>
      </Link>
      
      {/* Contact Info */}
      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-2">
          <Mail className="w-3 h-3" />
          <a 
            href={`mailto:${contact.email}`}
            className="hover:text-primary truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {contact.email}
          </a>
        </div>
        
        {contact.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3" />
            <a 
              href={`tel:${contact.phone}`}
              className="hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {contact.phone}
            </a>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          <span className="truncate">
            Last contacted: {formatLastActivity(contact.last_activity)}
          </span>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex gap-2">
          <Link 
            href={`/contacts/${contact.id}`}
            className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors hover:opacity-80"
            style={{ color: 'var(--color-primary)', backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-light)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            View Details
          </Link>
          <Link 
            href={`/contacts/${contact.id}/edit`}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Edit
          </Link>
        </div>
        
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault()
              setShowMenu(!showMenu)
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 w-48 bg-white rounded-md shadow-lg z-20 border">
                <Link
                  href={`/tasks/new?contactId=${contact.id}&contact=${encodeURIComponent(fullName)}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  <UserPlus className="w-4 h-4" />
                  Create Task
                </Link>
                <Link
                  href={`/pipeline/new?contactId=${contact.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  <FileText className="w-4 h-4" />
                  Create Deal
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setShowMenu(false)
                    // Add email compose functionality here
                    window.location.href = `mailto:${contact.email}`
                  }}
                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  <MessageCircle className="w-4 h-4" />
                  Send Email
                </button>
                <hr className="my-1" />
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setShowMenu(false)
                    onDelete(contact.id, fullName)
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete Contact
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}