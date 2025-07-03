import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') || ''
  const originalHost = request.headers.get('x-forwarded-host') || host
  
  console.log('Middleware - Host:', host, 'Original Host:', originalHost, 'Path:', pathname)
  
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
  // Check both the current host and the original forwarded host
  const subdomain = getSubdomain(originalHost) || getSubdomain(host)
  
  if (subdomain && subdomain !== 'www') {
    console.log('Detected subdomain:', subdomain)
    // This is an organization subdomain (e.g., acme.nothubspot.app)
    // Store the organization slug for the app to use
    const response = NextResponse.next()
    response.headers.set('x-organization-slug', subdomain)
    
    return response
  }

  // On main domain - allow access to all routes
  // The authentication will be handled by the AuthGuard components
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