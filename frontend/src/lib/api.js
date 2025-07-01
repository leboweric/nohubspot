const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const token = localStorage.getItem('access_token')
    
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }
      
      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Auth methods
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

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  // Contact methods
  async getContacts() {
    return this.request('/contacts')
  }

  async getContact(id) {
    return this.request(`/contacts/${id}`)
  }

  async createContact(contactData) {
    return this.request('/contacts', {
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

  // Dashboard/Stats methods
  async getContactStats() {
    return this.request('/contacts/stats')
  }

  // Email methods
  async sendEmail(emailData) {
    return this.request('/emails/send', {
      method: 'POST',
      body: JSON.stringify(emailData),
    })
  }

  async getEmailStats() {
    return this.request('/emails/stats')
  }

  async getEmailThreads() {
    return this.request('/emails/threads')
  }

  async getEmailThread(threadId) {
    return this.request(`/emails/threads/${threadId}`)
  }

  async getContactThreads(contactId) {
    return this.request(`/emails/threads/contact/${contactId}`)
  }

  async markEmailOpened(emailId, trackingData) {
    return this.request(`/emails/${emailId}/open`, {
      method: 'POST',
      body: JSON.stringify(trackingData),
    })
  }

  async markEmailClicked(emailId, trackingData) {
    return this.request(`/emails/${emailId}/click`, {
      method: 'POST',
      body: JSON.stringify(trackingData),
    })
  }

  // Quote methods
  async getQuotes() {
    return this.request('/quotes')
  }

  async getQuote(id) {
    return this.request(`/quotes/${id}`)
  }

  async getContactQuotes(contactId) {
    return this.request(`/quotes/contact/${contactId}`)
  }

  async createQuote(quoteData) {
    return this.request('/quotes', {
      method: 'POST',
      body: JSON.stringify(quoteData),
    })
  }

  async updateQuote(id, quoteData) {
    return this.request(`/quotes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(quoteData),
    })
  }

  async deleteQuote(id) {
    return this.request(`/quotes/${id}`, {
      method: 'DELETE',
    })
  }

  async sendQuote(id) {
    return this.request(`/quotes/${id}/send`, {
      method: 'POST',
    })
  }

  async updateQuoteStatus(id, statusData) {
    return this.request(`/quotes/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData),
    })
  }

  async getQuoteStats() {
    return this.request('/quotes/stats')
  }

  // Document methods
  async getContactDocuments(contactId) {
    return this.request(`/documents/contact/${contactId}`)
  }

  async uploadDocument(contactId, formData) {
    const token = localStorage.getItem('access_token')
    const url = `${this.baseURL}/documents/contact/${contactId}/upload`
    
    const config = {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      body: formData,
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`)
      }
      
      return data
    } catch (error) {
      console.error('Document upload failed:', error)
      throw error
    }
  }

  async getDocument(documentId) {
    return this.request(`/documents/${documentId}`)
  }

  async updateDocument(documentId, documentData) {
    return this.request(`/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(documentData),
    })
  }

  async updateDocumentStatus(documentId, status) {
    return this.request(`/documents/${documentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  }

  async deleteDocument(documentId) {
    return this.request(`/documents/${documentId}`, {
      method: 'DELETE',
    })
  }

  async downloadDocument(documentId) {
    const token = localStorage.getItem('access_token')
    const url = `${this.baseURL}/documents/${documentId}/download`
    
    const config = {
      method: 'GET',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || `HTTP error! status: ${response.status}`)
      }
      
      // Return the response for blob handling
      return response
    } catch (error) {
      console.error('Document download failed:', error)
      throw error
    }
  }

  async getDocumentStats() {
    return this.request('/documents/stats')
  }

  // Import methods
  async importContacts(formData) {
    const token = localStorage.getItem('access_token')
    const url = `${this.baseURL}/import/contacts`
    
    const config = {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData, // FormData for file upload
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }
      
      return data
    } catch (error) {
      console.error('Import request failed:', error)
      throw error
    }
  }

  // Additional utility methods
  async getAnalytics(timeframe = '30d') {
    return this.request(`/analytics?timeframe=${timeframe}`)
  }

  async searchContacts(query) {
    return this.request(`/contacts?search=${encodeURIComponent(query)}`)
  }

  async bulkUpdateContacts(contactIds, updateData) {
    return this.request('/contacts/bulk-update', {
      method: 'PUT',
      body: JSON.stringify({
        contact_ids: contactIds,
        update_data: updateData,
      }),
    })
  }

  async exportContacts(format = 'csv') {
    return this.request(`/contacts/export?format=${format}`)
  }
}

export const api = new ApiClient()

