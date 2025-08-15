"use client"

import Link from "next/link"
import { Company } from "@/lib/api"
import { 
  Building2, Phone, Globe, MapPin, Users, DollarSign, 
  TrendingUp, FileText, MoreVertical, Star, User
} from "lucide-react"
import { useState } from "react"

interface CompanyCardProps {
  company: Company
  onDelete: (id: number, name: string) => void
}

export default function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isStarred, setIsStarred] = useState(false)
  
  // Format revenue for display
  const formatRevenue = (revenue?: number) => {
    if (!revenue) return null
    if (revenue >= 1000000) return `$${(revenue / 1000000).toFixed(1)}M`
    if (revenue >= 1000) return `$${(revenue / 1000).toFixed(0)}K`
    return `$${revenue.toLocaleString()}`
  }
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
      
      {/* Company Avatar & Name */}
      <Link href={`/companies/${company.id}`} className="block mb-4">
        <div className="flex items-start gap-3">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-semibold text-sm"
            style={{ 
              background: `linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))` 
            }}
          >
            {getInitials(company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base hover:text-primary transition-colors truncate">
              {company.name}
            </h3>
            {company.industry && (
              <p className="text-sm text-muted-foreground truncate">{company.industry}</p>
            )}
          </div>
        </div>
      </Link>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {formatRevenue(company.annual_revenue) && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-medium">{formatRevenue(company.annual_revenue)}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4" style={{ color: 'var(--theme-primary)' }} />
          <span>{company.contact_count || 0} contacts</span>
        </div>
        
        {company.attachment_count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4" style={{ color: 'var(--theme-accent)' }} />
            <span>{company.attachment_count} files</span>
          </div>
        )}
      </div>
      
      {/* Contact Info */}
      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        {company.primary_account_owner_name && (
          <div className="flex items-center gap-2">
            <User className="w-3 h-3" />
            <span className="truncate">{company.primary_account_owner_name}</span>
          </div>
        )}
        
        {company.website && (
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3" />
            <a 
              href={company.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-primary truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          </div>
        )}
        
        {company.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3" />
            <a 
              href={`tel:${company.phone}`}
              className="hover:text-primary"
              onClick={(e) => e.stopPropagation()}
            >
              {company.phone}
            </a>
          </div>
        )}
        
        {(company.city || company.state) && (
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3" />
            <span className="truncate">
              {[company.city, company.state].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div className="flex gap-2">
          <Link 
            href={`/companies/${company.id}`}
            className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
          >
            View Details
          </Link>
          <Link 
            href={`/companies/${company.id}/edit`}
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
                  href={`/contacts/new?companyId=${company.id}&company=${encodeURIComponent(company.name)}`}
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  Add Contact
                </Link>
                <Link
                  href={`/pipeline/new?companyId=${company.id}`}
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowMenu(false)}
                >
                  Create Deal
                </Link>
                <hr className="my-1" />
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    setShowMenu(false)
                    onDelete(company.id, company.name)
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete Company
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}