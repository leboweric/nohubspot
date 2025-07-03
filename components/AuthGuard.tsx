"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getAuthState, type AuthState } from "@/lib/auth"

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
    console.log('AuthGuard - pathname:', pathname, 'auth:', auth)
    setAuthState(auth)
    setLoading(false)

    // Skip auth check for auth pages
    if (pathname.startsWith('/auth/')) {
      if (auth.isAuthenticated) {
        console.log('AuthGuard - Authenticated user on auth page, redirecting to dashboard')
        // If user is authenticated and on auth page, redirect to dashboard
        router.push('/dashboard')
      }
      return
    }

    // Redirect to login if not authenticated and auth is required
    if (requireAuth && !auth.isAuthenticated) {
      console.log('AuthGuard - Not authenticated, redirecting to login')
      router.push('/auth/login')
      return
    }

    // Check admin permissions
    if (adminOnly && auth.user && !['owner', 'admin'].includes(auth.user.role)) {
      console.log('AuthGuard - Not admin, redirecting to dashboard')
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