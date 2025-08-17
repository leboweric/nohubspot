"use client"

import { 
  User, Users, Settings, Zap, Building2, Database, 
  HelpCircle, Shield, Palette, Mail, Calendar
} from "lucide-react"

export type SettingsTab = 
  | 'profile' 
  | 'team' 
  | 'integrations' 
  | 'organization' 
  | 'data' 
  | 'support'

interface SettingsNavigationProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  isAdmin: boolean
  isOwner: boolean
}

interface NavItem {
  id: SettingsTab
  label: string
  icon: React.ElementType
  description: string
  adminOnly?: boolean
  ownerOnly?: boolean
}

const navItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile & Account',
    icon: User,
    description: 'Personal settings, email signature, preferences'
  },
  {
    id: 'team',
    label: 'Team Management',
    icon: Users,
    description: 'Manage users, roles, and permissions',
    adminOnly: true
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Zap,
    description: 'Office 365, Google Workspace, third-party apps'
  },
  {
    id: 'organization',
    label: 'Organization',
    icon: Building2,
    description: 'Company info, branding, project types',
    adminOnly: true
  },
  {
    id: 'data',
    label: 'Data Management',
    icon: Database,
    description: 'Phone standardization, duplicates, cleanup',
    ownerOnly: true
  },
  {
    id: 'support',
    label: 'Support & Help',
    icon: HelpCircle,
    description: 'Get help, contact support, documentation'
  }
]

export default function SettingsNavigation({ 
  activeTab, 
  onTabChange, 
  isAdmin, 
  isOwner 
}: SettingsNavigationProps) {
  const visibleItems = navItems.filter(item => {
    if (item.ownerOnly && !isOwner) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <nav className="space-y-2">
      {visibleItems.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id
        
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all duration-200 ${
              isActive
                ? 'text-white shadow-md'
                : 'hover:bg-gray-50 text-gray-700 hover:text-gray-900'
            }`}
            style={isActive ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
              isActive ? 'text-white' : 'text-gray-500'
            }`} />
            <div className="min-w-0 flex-1">
              <div className={`font-medium text-sm ${
                isActive ? 'text-white' : 'text-gray-900'
              }`}>
                {item.label}
              </div>
              <div className={`text-xs mt-1 leading-relaxed ${
                isActive ? 'text-white/80' : 'text-gray-600'
              }`}>
                {item.description}
              </div>
            </div>
          </button>
        )
      })}
    </nav>
  )
}