"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { getAuthState, logout, isAdmin } from "@/lib/auth"
import { o365IntegrationAPI } from "@/lib/api"
import FloatingSupportButton from "./FloatingSupportButton"
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarDays,
  CheckSquare,
  Kanban,
  FolderKanban,
  Clock,
  Mail,
  FileText,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  PanelLeft,
} from "lucide-react"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar"

interface MainLayoutProps {
  children: React.ReactNode
}

// Inner component that uses sidebar context
function MainLayoutInner({ children }: MainLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, organization, isAuthenticated } = getAuthState()
  const [o365Connected, setO365Connected] = useState(false)
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
        const cachedOrg = localStorage.getItem('organization')
        if (cachedOrg) {
          const orgData = JSON.parse(cachedOrg)
          if (orgData.logo_url !== undefined || orgData.logo_size !== undefined) {
            setLogoUrl(orgData.logo_url || null)
            setLogoSize(orgData.logo_size || 100)
          }
        }
        
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app'
        const response = await fetch(`${baseUrl}/api/organization/theme`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setLogoUrl(data.logo_url || null)
          setLogoSize(data.logo_size || 100)
          
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
  
  // Poll for logo changes
  useEffect(() => {
    if (!isAuthenticated) return
    
    const checkForLogoChanges = () => {
      const cachedOrg = localStorage.getItem('organization')
      if (cachedOrg) {
        try {
          const orgData = JSON.parse(cachedOrg)
          if (orgData.logo_size !== logoSize) {
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
    
    const interval = setInterval(checkForLogoChanges, 200)
    return () => clearInterval(interval)
  }, [isAuthenticated, logoSize, logoUrl])

  // Time Tracking is restricted to specific users during beta
  const timeTrackingAllowedEmails = [
    'kharding@strategic-cc.com',
    'elebow@bmhmn.com',
    'elebow@strategic-cc.com',
    'eric@profitbuildernetwork.com',
    'eric.lebow@aiop.one',
    'leboweric@gmail.com',
  ]
  const canSeeTimeTracking = user && timeTrackingAllowedEmails.includes(user.email?.toLowerCase())

  // Navigation items grouped by section
  const crmItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Companies", href: "/companies", icon: Building2 },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "Pipeline", href: "/pipeline", icon: Kanban },
  ]

  const workItems = [
    { name: "Projects", href: "/projects", icon: FolderKanban },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Calendar", href: "/calendar", icon: CalendarDays },
    ...(canSeeTimeTracking ? [{ name: "Time Tracking", href: "/time-tracking", icon: Clock }] : []),
  ]

  const toolItems = [
    { name: "Bulk Email", href: "/bulk-email", icon: Mail },
    ...(o365Connected ? [{ name: "Templates", href: "/templates", icon: FileText }] : []),
    { name: "Settings", href: "/settings", icon: Settings },
  ]

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  // Not authenticated — show minimal layout
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b bg-white">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/dashboard" className="flex items-center">
                <span className="text-3xl font-bold transition-colors tracking-tight" style={{ color: 'var(--color-primary)' }}>
                  NHS
                </span>
              </Link>
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
            </div>
          </nav>
        </header>
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    )
  }

  return (
    <>
      <Sidebar collapsible="icon" className="border-r">
        {/* Logo / Org Header */}
        <SidebarHeader className="p-3">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center"
            style={{ height: `${36 * (logoSize / 100)}px` }}
          >
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt={organization?.name || 'Organization Logo'} 
                className="h-full object-contain"
                style={{ maxWidth: `${140 * (logoSize / 100)}px` }}
                onError={() => setLogoUrl(null)}
              />
            ) : (
              <span className="text-xl font-bold tracking-tight group-data-[collapsible=icon]:text-sm" style={{ color: 'var(--color-primary)' }}>
                NHS
              </span>
            )}
          </Link>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          {/* CRM Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
              CRM
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {crmItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Work Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
              Work
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Tools Section */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">
              Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {toolItems.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.name}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        {/* User Footer */}
        <SidebarFooter className="p-3">
          <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center">
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--color-primary-dark)' }}>
                {user?.first_name?.[0] || user?.email[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
              <div className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="text-xs text-gray-500">
                {user?.role === 'owner' ? 'Owner' : 
                 user?.role === 'admin' ? 'Admin' : 
                 user?.role === 'user' ? 'User' : 'Read Only'}
              </div>
            </div>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                tooltip="Sign out"
                className="text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Main Content Area */}
      <SidebarInset>
        {/* Top bar with sidebar trigger for mobile + collapsed state */}
        <header className="flex h-12 items-center gap-2 border-b bg-white px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt={organization?.name || 'Logo'} 
              className="h-7 object-contain"
            />
          ) : (
            <span className="text-base font-bold" style={{ color: 'var(--color-primary)' }}>NHS</span>
          )}
          <div className="flex-1" />
        </header>
        
        <main className="flex-1 bg-gray-50 min-h-[calc(100vh-3rem)] md:min-h-screen">
          {children}
        </main>
      </SidebarInset>

      {isAuthenticated && <FloatingSupportButton />}
    </>
  )
}

// Outer wrapper that provides sidebar context
export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </SidebarProvider>
  )
}
