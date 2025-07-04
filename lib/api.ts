// API client for NotHubSpot CRM backend
import { getAuthHeaders, clearAuthState } from './auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// Generic API request function
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const authHeaders = getAuthHeaders()
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
    ...options,
  }

  try {
    const response = await fetch(url, config)
    
    // Handle authentication errors
    if (response.status === 401) {
      // Don't auto-logout for data fetching endpoints to prevent login loops
      // Only auto-logout for critical auth operations
      const isDataEndpoint = url.includes('/api/signature') || 
                            url.includes('/api/contacts') || 
                            url.includes('/api/companies') || 
                            url.includes('/api/tasks') || 
                            url.includes('/api/activities') ||
                            url.includes('/api/dashboard') ||
                            url.includes('/api/email-templates')
      
      const isCriticalAuthEndpoint = url.includes('/api/auth/') || 
                                   url.includes('/api/users') || 
                                   url.includes('/api/invites')
      
      // Only auto-logout for critical auth operations, not data fetching
      if (isCriticalAuthEndpoint && !isDataEndpoint) {
        clearAuthState()
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login'
        }
      }
      throw new APIError('Authentication required', 401)
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new APIError(errorData.detail || `API Error: ${response.status}`, response.status)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    console.error(`API request failed: ${endpoint}`, error)
    throw new APIError(error instanceof Error ? error.message : 'Network error')
  }
}

// Company API functions
export interface Company {
  id: number
  name: string
  industry?: string
  website?: string
  description?: string
  address?: string
  status: string
  contact_count: number
  attachment_count: number
  created_at: string
  updated_at: string
}

export interface CompanyCreate {
  name: string
  industry?: string
  website?: string
  description?: string
  address?: string
  status?: string
}

export interface CompanyUpdate {
  name?: string
  industry?: string
  website?: string
  description?: string
  address?: string
  status?: string
}

export const companyAPI = {
  // Get all companies
  getAll: (params?: {
    skip?: number
    limit?: number
    search?: string
    status?: string
  }): Promise<Company[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    
    return apiRequest(`/api/companies?${searchParams}`)
  },

  // Get single company
  getById: (id: number): Promise<Company> => 
    apiRequest(`/api/companies/${id}`),

  // Create company
  create: (data: CompanyCreate): Promise<Company> =>
    apiRequest('/api/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update company
  update: (id: number, data: CompanyUpdate): Promise<Company> =>
    apiRequest(`/api/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete company
  delete: (id: number): Promise<{ message: string }> =>
    apiRequest(`/api/companies/${id}`, {
      method: 'DELETE',
    }),

  // Bulk upload
  bulkUpload: (companies: CompanyCreate[]): Promise<{
    success_count: number
    error_count: number
    total_count: number
    errors: string[]
  }> =>
    apiRequest('/api/companies/bulk', {
      method: 'POST',
      body: JSON.stringify(companies),
    }),
}

// Contact API functions
export interface Contact {
  id: number
  first_name: string
  last_name: string
  email: string
  phone?: string
  title?: string
  company_id?: number
  company_name?: string
  status: string
  notes?: string
  created_at: string
  updated_at: string
  last_activity: string
}

export interface ContactCreate {
  first_name: string
  last_name: string
  email: string
  phone?: string
  title?: string
  company_id?: number
  company_name?: string
  status?: string
  notes?: string
}

export interface ContactUpdate {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  title?: string
  company_id?: number
  company_name?: string
  status?: string
  notes?: string
}

export const contactAPI = {
  // Get all contacts
  getAll: (params?: {
    skip?: number
    limit?: number
    search?: string
    company_id?: number
    status?: string
  }): Promise<Contact[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.company_id) searchParams.append('company_id', params.company_id.toString())
    if (params?.status) searchParams.append('status', params.status)
    
    return apiRequest(`/api/contacts?${searchParams}`)
  },

  // Get single contact
  getById: (id: number): Promise<Contact> => 
    apiRequest(`/api/contacts/${id}`),

  // Create contact
  create: (data: ContactCreate): Promise<Contact> =>
    apiRequest('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update contact
  update: (id: number, data: ContactUpdate): Promise<Contact> =>
    apiRequest(`/api/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete contact
  delete: (id: number): Promise<{ message: string }> =>
    apiRequest(`/api/contacts/${id}`, {
      method: 'DELETE',
    }),

  // Bulk upload
  bulkUpload: (contacts: ContactCreate[]): Promise<{
    success_count: number
    error_count: number
    total_count: number
    errors: string[]
  }> =>
    apiRequest('/api/contacts/bulk', {
      method: 'POST',
      body: JSON.stringify(contacts),
    }),
}

// Task API functions
export interface Task {
  id: number
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  assigned_to?: string
  contact_id?: number
  contact_name?: string
  company_id?: number
  company_name?: string
  type: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'other'
  tags: string[]
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface TaskCreate {
  title: string
  description?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  assigned_to?: string
  contact_id?: number
  contact_name?: string
  company_id?: number
  company_name?: string
  type?: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'other'
  tags?: string[]
}

export interface TaskUpdate {
  title?: string
  description?: string
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string
  assigned_to?: string
  contact_id?: number
  contact_name?: string
  company_id?: number
  company_name?: string
  type?: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'other'
  tags?: string[]
}

export const taskAPI = {
  // Get all tasks
  getAll: (params?: {
    skip?: number
    limit?: number
    search?: string
    status?: string
    priority?: string
    contact_id?: number
    company_id?: number
  }): Promise<Task[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.priority) searchParams.append('priority', params.priority)
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    if (params?.company_id) searchParams.append('company_id', params.company_id.toString())
    
    return apiRequest(`/api/tasks?${searchParams}`)
  },

  // Get single task
  getById: (id: number): Promise<Task> => 
    apiRequest(`/api/tasks/${id}`),

  // Create task
  create: (data: TaskCreate): Promise<Task> =>
    apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update task
  update: (id: number, data: TaskUpdate): Promise<Task> =>
    apiRequest(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete task
  delete: (id: number): Promise<{ message: string }> =>
    apiRequest(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),
}

// Email Signature API functions
export interface EmailSignature {
  id: number
  user_id: string
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  website?: string
  custom_text?: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface EmailSignatureCreate {
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  website?: string
  custom_text?: string
  enabled?: boolean
}

export const signatureAPI = {
  // Get signature
  get: (user_id: string = 'default'): Promise<EmailSignature | null> =>
    apiRequest(`/api/signature?user_id=${user_id}`),

  // Create or update signature
  createOrUpdate: (data: EmailSignatureCreate, user_id: string = 'default'): Promise<EmailSignature> =>
    apiRequest(`/api/signature?user_id=${user_id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Dashboard API functions
export interface DashboardStats {
  total_companies: number
  total_contacts: number
  total_tasks: number
  total_email_threads: number
  active_companies: number
  active_contacts: number
  pending_tasks: number
  overdue_tasks: number
}

export interface Activity {
  id: number
  title: string
  description?: string
  type: string
  entity_id?: string
  created_by?: string
  created_at: string
}

export const dashboardAPI = {
  // Get dashboard stats
  getStats: (): Promise<DashboardStats> =>
    apiRequest('/api/dashboard/stats'),

  // Get recent activities
  getActivities: (limit: number = 10): Promise<Activity[]> =>
    apiRequest(`/api/activities?limit=${limit}`),

  // Get AI-powered daily summary
  getDailySummary: (): Promise<{
    generated_at: string
    user_id: number
    ai_insights: string
    quick_stats: {
      overdue_tasks: number
      today_tasks: number
      total_contacts: number
      contacts_needing_attention: number
      active_companies: number
    }
  }> =>
    apiRequest('/api/dashboard/daily-summary'),
}

// Error handling utility
export class APIError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'APIError'
  }
}

// Email Template API functions
export interface EmailTemplate {
  id: number
  name: string
  subject: string
  body: string
  category?: string
  is_shared: boolean
  organization_id: number
  created_by?: number
  variables_used?: string[]
  usage_count: number
  last_used_at?: string
  created_at: string
  updated_at: string
  creator_name?: string
}

export interface EmailTemplateCreate {
  name: string
  subject: string
  body: string
  category?: string
  is_shared?: boolean
  variables_used?: string[]
}

export interface EmailTemplateUpdate {
  name?: string
  subject?: string
  body?: string
  category?: string
  is_shared?: boolean
  variables_used?: string[]
}

export const emailTemplateAPI = {
  // Get all templates
  getAll: (params?: {
    skip?: number
    limit?: number
    category?: string
    search?: string
    include_personal?: boolean
  }): Promise<EmailTemplate[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.category) searchParams.append('category', params.category)
    if (params?.search) searchParams.append('search', params.search)
    if (params?.include_personal !== undefined) searchParams.append('include_personal', params.include_personal.toString())
    
    return apiRequest(`/api/email-templates?${searchParams}`)
  },

  // Get template categories
  getCategories: (): Promise<{ categories: string[] }> =>
    apiRequest('/api/email-templates/categories'),

  // Get single template
  getById: (id: number): Promise<EmailTemplate> => 
    apiRequest(`/api/email-templates/${id}`),

  // Create template
  create: (data: EmailTemplateCreate): Promise<EmailTemplate> =>
    apiRequest('/api/email-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update template
  update: (id: number, data: EmailTemplateUpdate): Promise<EmailTemplate> =>
    apiRequest(`/api/email-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete template
  delete: (id: number): Promise<{ message: string }> =>
    apiRequest(`/api/email-templates/${id}`, {
      method: 'DELETE',
    }),

  // Use template with variable replacement
  use: (id: number, params?: {
    contact_id?: number
    company_id?: number
  }): Promise<{
    id: number
    name: string
    subject: string
    body: string
    category?: string
  }> => {
    const searchParams = new URLSearchParams()
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    if (params?.company_id) searchParams.append('company_id', params.company_id.toString())
    
    return apiRequest(`/api/email-templates/${id}/use?${searchParams}`, {
      method: 'POST',
    })
  },
}

// Calendar Event interfaces
export interface CalendarEvent {
  id: number
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  event_type: string
  contact_id?: number
  company_id?: number
  is_all_day: boolean
  reminder_minutes: number
  status: string
  created_by: number
  contact_name?: string
  company_name?: string
  creator_name?: string
  created_at: string
  updated_at: string
}

export interface CalendarEventCreate {
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  event_type?: string
  contact_id?: number
  company_id?: number
  is_all_day?: boolean
  reminder_minutes?: number
  status?: string
  attendee_ids?: number[]
}

export interface CalendarEventUpdate {
  title?: string
  description?: string
  start_time?: string
  end_time?: string
  location?: string
  event_type?: string
  contact_id?: number
  company_id?: number
  is_all_day?: boolean
  reminder_minutes?: number
  status?: string
}

// Calendar API functions
export const calendarAPI = {
  // Get all calendar events
  getAll: (params?: {
    skip?: number
    limit?: number
    start_date?: string
    end_date?: string
    contact_id?: number
    company_id?: number
    event_type?: string
  }): Promise<CalendarEvent[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.start_date) searchParams.append('start_date', params.start_date)
    if (params?.end_date) searchParams.append('end_date', params.end_date)
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    if (params?.company_id) searchParams.append('company_id', params.company_id.toString())
    if (params?.event_type) searchParams.append('event_type', params.event_type)
    
    return apiRequest(`/api/calendar/events?${searchParams}`)
  },

  // Get single calendar event
  getById: (id: number): Promise<CalendarEvent> => 
    apiRequest(`/api/calendar/events/${id}`),

  // Create calendar event
  create: (data: CalendarEventCreate): Promise<CalendarEvent> =>
    apiRequest('/api/calendar/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update calendar event
  update: (id: number, data: CalendarEventUpdate): Promise<CalendarEvent> =>
    apiRequest(`/api/calendar/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete calendar event
  delete: (id: number): Promise<{ message: string }> =>
    apiRequest(`/api/calendar/events/${id}`, {
      method: 'DELETE',
    }),

  // Get upcoming events
  getUpcoming: (limit?: number): Promise<CalendarEvent[]> => {
    const searchParams = new URLSearchParams()
    if (limit) searchParams.append('limit', limit.toString())
    
    return apiRequest(`/api/calendar/upcoming?${searchParams}`)
  },

  // Send calendar invites to attendees
  sendInvite: (id: number): Promise<{ success: boolean; message: string; attendees_notified: string[] }> => {
    return apiRequest(`/api/calendar/events/${id}/send-invite`, {
      method: 'POST'
    })
  },
}

// Helper function to handle API errors consistently
export const handleAPIError = (error: unknown): string => {
  if (error instanceof APIError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred'
}