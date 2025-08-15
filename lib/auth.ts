/**
 * Authentication utilities for NotHubSpot frontend
 */

export interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  organization_id: number
  role: 'owner' | 'admin' | 'user' | 'readonly'
  is_active: boolean
  email_verified: boolean
  last_login?: string
  created_at: string
}

export interface Organization {
  id: number
  slug: string
  name: string
  plan: string
  is_active: boolean
  created_at: string
  logo_url?: string | null
  logo_size?: number
  theme_primary_color?: string
  theme_secondary_color?: string
  theme_accent_color?: string
}

export interface AuthState {
  user: User | null
  organization: Organization | null
  token: string | null
  isAuthenticated: boolean
}


/**
 * Get authentication state from localStorage
 */
export function getAuthState(): AuthState {
  if (typeof window === 'undefined') {
    return {
      user: null,
      organization: null,
      token: null,
      isAuthenticated: false
    }
  }

  try {
    const token = localStorage.getItem('auth_token')
    const user = localStorage.getItem('user')
    const organization = localStorage.getItem('organization')

    if (!token || !user || !organization) {
      return {
        user: null,
        organization: null,
        token: null,
        isAuthenticated: false
      }
    }

    return {
      user: JSON.parse(user),
      organization: JSON.parse(organization),
      token,
      isAuthenticated: true
    }
  } catch (error) {
    console.error('Error parsing auth state:', error)
    return {
      user: null,
      organization: null,
      token: null,
      isAuthenticated: false
    }
  }
}

/**
 * Clear authentication state
 */
export function clearAuthState(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    localStorage.removeItem('organization')
  }
}

/**
 * Check if user has admin permissions
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'owner' || user?.role === 'admin'
}

/**
 * Check if user is organization owner
 */
export function isOwner(user: User | null): boolean {
  return user?.role === 'owner'
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  const { token } = getAuthState()
  
  if (!token) {
    return {}
  }

  return {
    'Authorization': `Bearer ${token}`
  }
}

/**
 * Make authenticated API request
 */
export async function authenticatedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = getAuthHeaders()
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  })

  // If unauthorized, clear auth state and redirect to login
  if (response.status === 401) {
    clearAuthState()
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  }

  return response
}

/**
 * Logout user
 */
export function logout(): void {
  clearAuthState()
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login'
  }
}