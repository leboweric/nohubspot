"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getAuthState, getOrganizationSlug, type AuthState } from "@/lib/auth"

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  adminOnly?: boolean
}

export default function AuthGuard({ 
  children, 
  requireAuth = true, 
  adminOnly = false 
}: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getAuthState()
    const orgSlug = getOrganizationSlug()
    setAuthState(auth)
    setLoading(false)

    // Skip auth check for auth pages
    if (pathname.startsWith('/auth/')) {
      if (auth.isAuthenticated) {
        // If user is authenticated and on auth page, redirect to their org subdomain
        if (auth.tenant && auth.tenant.slug !== orgSlug) {
          window.location.href = `https://${auth.tenant.slug}.nothubspot.app/dashboard`
        } else {
          router.push('/dashboard')
        }
      }
      return
    }

    // Check if user is accessing the correct organization subdomain
    if (requireAuth && auth.isAuthenticated && orgSlug && auth.tenant) {
      if (auth.tenant.slug !== orgSlug) {
        // User is authenticated but accessing wrong org subdomain
        window.location.href = `https://${auth.tenant.slug}.nothubspot.app${pathname}`
        return
      }
    }

    // Redirect to login if not authenticated and auth is required
    if (requireAuth && !auth.isAuthenticated) {
      const loginUrl = orgSlug ? `/auth/login?org=${orgSlug}` : '/auth/login'
      router.push(loginUrl)
      return
    }

    // Check admin permissions
    if (adminOnly && auth.user && !['owner', 'admin'].includes(auth.user.role)) {
      router.push('/dashboard')
      return
    }
  }, [pathname, router, requireAuth, adminOnly])

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Don't render children if auth check failed
  if (requireAuth && !authState?.isAuthenticated) {
    return null
  }

  // Don't render children if admin required but user is not admin
  if (adminOnly && authState?.user && !['owner', 'admin'].includes(authState.user.role)) {
    return null
  }

  return <>{children}</>
}