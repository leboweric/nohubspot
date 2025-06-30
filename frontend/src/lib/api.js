const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const token = localStorage.getItem('access_token')
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      // Handle token expiration
      if (response.status === 401 && data.error?.message === 'Token expired') {
        const refreshed = await this.refreshToken()
        if (refreshed) {
          // Retry the original request with new token
          const newToken = localStorage.getItem('access_token')
          config.headers.Authorization = `Bearer ${newToken}`
          const retryResponse = await fetch(url, config)
          return await retryResponse.json()
        } else {
          // Refresh failed, redirect to login
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.reload()
          return { success: false, error: { message: 'Session expired' } }
        }
      }
      
      return data
    } catch (error) {
      console.error('API request failed:', error)
      return { success: false, error: { message: 'Network error' } }
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) return false

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      
      const data = await response.json()
      if (data.success) {
        localStorage.setItem('access_token', data.data.access_token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  // Auth endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      return this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    }
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  // Contacts endpoints
  async getContacts(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/contacts/${queryString ? `?${queryString}` : ''}`)
  }

  async getContact(id) {
    return this.request(`/contacts/${id}`)
  }

  async createContact(contactData) {
    return this.request('/contacts/', {
      method: 'POST',
      body: JSON.stringify(contactData),
    })
  }

  async updateContact(id, contactData) {
    return this.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contactData),
    })
  }

  async deleteContact(id) {
    return this.request(`/contacts/${id}`, {
      method: 'DELETE',
    })
  }

  async getContactTimeline(id) {
    return this.request(`/contacts/${id}/timeline`)
  }

  async getContactStats() {
    return this.request('/contacts/stats')
  }

  // Email endpoints
  async sendEmail(emailData) {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(emailData),
    })
  }

  async getEmails(params = {}) {
    const queryString = new URLSearchParams(params).toString()
    return this.request(`/emails/${queryString ? `?${queryString}` : ''}`)
  }

  async getEmailDetails(id) {
    return this.request(`/emails/${id}`)
  }

  async getEmailStats() {
    return this.request('/emails/stats')
  }
}

export const api = new ApiClient()

