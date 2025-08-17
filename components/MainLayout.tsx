"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getAuthState, logout, isAdmin } from "@/lib/auth"
import { o365IntegrationAPI } from "@/lib/api"
import FloatingSupportButton from "./FloatingSupportButton"
import NHSLogo, { NHSLogoModern } from "./NHSLogo"

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, organization, isAuthenticated } = getAuthState()
  const [o365Connected, setO365Connected] = useState(false)
  // Initialize from localStorage to prevent flash
  const [logoUrl, setLogoUrl] = useState<string | null>(organization?.logo_url || null)
  const [logoSize, setLogoSize] = useState<number>(organization?.logo_size || 100)

  const handleLogout = () => {
    logout()
  }

  // Check O365 connection status and fetch organization logo
  useEffect(() => {
    const checkO365Status = async () => {
      try {
        const status = await o365IntegrationAPI.getStatus()
        setO365Connected(status.connected)
      } catch (err) {
        console.error('Failed to check O365 status:', err)
        setO365Connected(false)
      }
    }

    const fetchOrgLogo = async () => {
      try {
        // First check localStorage for immediate update
        const cachedOrg = localStorage.getItem('organization')
        if (cachedOrg) {
          const orgData = JSON.parse(cachedOrg)
          if (orgData.logo_url !== undefined || orgData.logo_size !== undefined) {
            console.log('MainLayout: Using cached logo data:', { logo_url: orgData.logo_url, logo_size: orgData.logo_size })
            setLogoUrl(orgData.logo_url || null)
            setLogoSize(orgData.logo_size || 100)
          }
        }
        
        // Then fetch latest from API
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
        const response = await fetch(`${baseUrl}/api/organization/theme`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('MainLayout: Fetched logo data from API:', { logo_url: data.logo_url, logo_size: data.logo_size })
          setLogoUrl(data.logo_url || null)
          setLogoSize(data.logo_size || 100)
          
          // Update localStorage with latest data
          const currentOrg = localStorage.getItem('organization')
          if (currentOrg) {
            const orgData = JSON.parse(currentOrg)
            orgData.logo_url = data.logo_url
            orgData.logo_size = data.logo_size
            localStorage.setItem('organization', JSON.stringify(orgData))
          }
        }
      } catch (err) {
        console.error('Failed to fetch organization logo:', err)
      }
    }

    if (isAuthenticated) {
      checkO365Status()
      fetchOrgLogo()
    }
  }, [isAuthenticated])
  
  // Add listener for localStorage changes (for real-time logo size updates)
  useEffect(() => {
    if (!isAuthenticated) return
    
    const checkForLogoChanges = () => {
      const cachedOrg = localStorage.getItem('organization')
      if (cachedOrg) {
        try {
          const orgData = JSON.parse(cachedOrg)
          if (orgData.logo_size !== logoSize) {
            console.log('MainLayout: Logo size changed from', logoSize, 'to', orgData.logo_size)
            setLogoSize(orgData.logo_size || 100)
          }
          if (orgData.logo_url !== logoUrl) {
            setLogoUrl(orgData.logo_url || null)
          }
        } catch (err) {
          console.error('Failed to parse cached organization:', err)
        }
      }
    }
    
    // Check every 200ms for changes (since storage events don't fire in same tab)
    const interval = setInterval(checkForLogoChanges, 200)
    
    return () => clearInterval(interval)
  }, [isAuthenticated, logoSize, logoUrl])

  const navigation = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Companies", href: "/companies" },
    { name: "Contacts", href: "/contacts" },
    { name: "Calendar", href: "/calendar" },
    { name: "Tasks", href: "/tasks" },
    { name: "Pipeline", href: "/pipeline" },
    { name: "Projects", href: "/projects" },
    ...(o365Connected ? [{ name: "Templates", href: "/templates" }] : []),
    { name: "Settings", href: "/settings" },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link 
                href="/dashboard" 
                className="flex items-center" 
                style={{ height: `${40 * (logoSize / 100)}px` }}
                title={`Logo size: ${logoSize}%`}
              >
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={organization?.name || 'Organization Logo'} 
                    className="h-full object-contain"
                    style={{ maxWidth: `${150 * (logoSize / 100)}px` }}
                    onError={(e) => {
                      // If logo fails to load, fall back to text
                      setLogoUrl(null)
                    }}
                  />
                ) : (
                  <NHSLogo className="h-10" variant="full" />
                )}
              </Link>
              
              {isAuthenticated && (
                <>
                  <div className="hidden md:flex space-x-6">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`text-sm font-medium transition-colors ${
                          pathname === item.href
                            ? "border-b-2 pb-4"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                        style={pathname === item.href ? { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' } : {}}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>

                </>
              )}
            </div>

            {isAuthenticated && user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-primary-dark)' }}>
                      {user.first_name?.[0] || user.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-medium text-gray-900">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.role === 'owner' ? 'Owner' : 
                       user.role === 'admin' ? 'Admin' : 
                       user.role === 'user' ? 'User' : 'Read Only'}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 px-3 py-1 rounded transition-colors"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/register"
                  className="text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu */}
          {isAuthenticated && (
            <div className="md:hidden border-t pt-4 pb-4">
              <div className="flex flex-col space-y-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
                      pathname === item.href
                        ? ""
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    style={pathname === item.href ? { color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)' } : {}}
                  >
                    {item.name}
                  </Link>
                ))}
                
                {/* Mobile user info and logout */}
                <div className="border-t pt-3 mt-3">
                  {user && (
                    <div className="flex items-center space-x-3 px-2 py-2">
                      <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-light)' }}>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-primary-dark)' }}>
                          {user.first_name?.[0] || user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.role === 'owner' ? 'Owner' : 
                           user.role === 'admin' ? 'Admin' : 
                           user.role === 'user' ? 'User' : 'Read Only'}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-2 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1 bg-gray-50">
        {children}
      </main>

      {/* Floating Support Button - only show when authenticated */}
      {isAuthenticated && <FloatingSupportButton />}
    </div>
  )
}