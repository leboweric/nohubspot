import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const host = request.headers.get('host') || ''
  
  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname.startsWith('/auth/')
  ) {
    return NextResponse.next()
  }

  // Handle subdomain routing for organizations
  const subdomain = getSubdomain(host)
  
  if (subdomain && subdomain !== 'www') {
    // This is an organization subdomain (e.g., acme.nothubspot.app)
    // Store the organization slug for the app to use
    const response = NextResponse.next()
    response.headers.set('x-organization-slug', subdomain)
    
    // If user is not on the main domain auth flow, redirect to login with org context
    if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/companies') && 
        !pathname.startsWith('/contacts') && !pathname.startsWith('/tasks') && 
        !pathname.startsWith('/settings') && pathname !== '/') {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('org', subdomain)
      return NextResponse.redirect(loginUrl)
    }
    
    return response
  }

  // If on main domain (nothubspot.app) and accessing app routes without auth
  if (!subdomain || subdomain === 'www') {
    // Allow access to auth pages and home page
    if (pathname.startsWith('/auth/') || pathname === '/') {
      return NextResponse.next()
    }
    
    // For protected routes on main domain, redirect to home page
    // Users should access the app via their organization subdomain
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/companies') || 
        pathname.startsWith('/contacts') || pathname.startsWith('/tasks') || 
        pathname.startsWith('/settings')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

function getSubdomain(host: string): string | null {
  // Remove port if present (for local development)
  const hostname = host.split(':')[0]
  
  // For local development
  if (hostname === 'localhost' || hostname.startsWith('127.0.0.1') || hostname.startsWith('192.168.')) {
    return null
  }
  
  // For production: extract subdomain from nothubspot.app
  if (hostname.includes('nothubspot.app')) {
    const parts = hostname.split('.')
    if (parts.length > 2) {
      return parts[0] // Return the subdomain part
    }
  }
  
  // For other domains or no subdomain
  return null
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}