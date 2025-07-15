"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getAuthState } from "@/lib/auth"


export default function OrganizationRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const orgSlug = params.slug as string

  useEffect(() => {
    const auth = getAuthState()
    
    if (auth.isAuthenticated && auth.tenant) {
      if (auth.tenant.slug === orgSlug) {
        // User belongs to this organization, redirect to subdomain
        window.location.href = `https://${orgSlug}.nothubspot.app/dashboard`
      } else {
        // User belongs to different organization
        window.location.href = `https://${auth.tenant.slug}.nothubspot.app/dashboard`
      }
    } else {
      // User not authenticated, redirect to login with org context
      router.push(`/auth/login?org=${orgSlug}`)
    }
  }, [orgSlug, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to {orgSlug}...</p>
      </div>
    </div>
  )
}