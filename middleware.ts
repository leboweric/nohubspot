import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Temporarily disabled for debugging - just pass through all requests
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