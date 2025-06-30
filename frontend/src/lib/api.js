const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      const data = await response.json()
      
      if (data.success && data.access_token) {
        localStorage.setItem('access_token', data.access_token)
        return true
      }
      
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  // Auth endpoints
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async getCurrentUser() {
    return this.request('/auth/me')
  }

  // Contact endpoints
  async getContacts() {
    return this.request('/contacts/')
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

  async getRecentContacts() {
    return this.request('/contacts/?limit=5&sort=created_at&order=desc')
  }

  // Email endpoints
  async sendEmail(emailData) {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(emailData),
    })
  }

  async getEmailDetails(id) {
    return this.request(`/emails/${id}`)
  }

  async getEmailStats() {
    return this.request('/emails/stats')
  }

  // NEW: Email thread endpoints
  async getEmailThread(threadId) {
    return this.request(`/emails/threads/${threadId}`)
  }

  async getContactThreads(contactId) {
    return this.request(`/emails/threads/contact/${contactId}`)
  }
}

export const api = new ApiClient()

