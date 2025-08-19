// API client for NotHubSpot CRM backend
import { getAuthHeaders, clearAuthState, type User } from './auth'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// DEBUG: Log API configuration
console.log("🔍 API Configuration - Base URL:", API_BASE_URL);
console.log("🔍 API Configuration - Environment:", process.env.NODE_ENV);

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
    console.log(`🔍 API Request: ${options.method || 'GET'} ${url}`);
    console.log('🔍 Request config:', config);
    
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
      console.error('API Error Response:', errorData)
      
      // Extract error message from various possible formats
      let errorMessage = `API Error: ${response.status}`
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)
      } else if (errorData.message) {
        errorMessage = errorData.message
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (Array.isArray(errorData) && errorData.length > 0) {
        errorMessage = errorData.map(e => e.msg || e.message || JSON.stringify(e)).join(', ')
      }
      
      throw new APIError(errorMessage, response.status)
    }

    return await response.json()
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    console.error(`❌ API request failed: ${endpoint}`, error)
    console.error('❌ Error details:', {
      url,
      method: options.method || 'GET',
      error: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof TypeError ? 'Network/CORS error' : 'Other error'
    })
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
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  annual_revenue?: number
  status: string
  contact_count: number
  attachment_count: number
  primary_account_owner_id?: number
  primary_account_owner_name?: string
  created_at: string
  updated_at: string
}

export interface CompanyCreate {
  name: string
  industry?: string
  website?: string
  description?: string
  address?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  annual_revenue?: number
  primary_account_owner_id?: number
  status?: string
}

export interface CompanyUpdate {
  name?: string
  industry?: string
  website?: string
  description?: string
  address?: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  phone?: string
  annual_revenue?: number
  primary_account_owner_id?: number
  status?: string
}

export interface CompanyPaginatedResponse {
  items: Company[]
  total: number
  page: number
  per_page: number
  pages: number
}

export const companyAPI = {
  // Get all companies
  getAll: (params?: {
    skip?: number
    limit?: number
    search?: string
    status?: string
    sort_by?: string
    sort_order?: 'asc' | 'desc'
  }): Promise<CompanyPaginatedResponse> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.search) searchParams.append('search', params.search)
    if (params?.status) searchParams.append('status', params.status)
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by)
    if (params?.sort_order) searchParams.append('sort_order', params.sort_order)
    
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

// Users API functions
export const usersAPI = {
  // Get all users in the organization
  getAll: (): Promise<User[]> => 
    apiRequest('/api/users'),
    
  // Get a specific user
  get: (id: number): Promise<User> =>
    apiRequest(`/api/users/${id}`),
    
  // Delete a user
  delete: (id: number): Promise<void> =>
    apiRequest(`/api/users/${id}`, {
      method: 'DELETE'
    }),
    
  // Update a user
  update: (id: number, data: Partial<User>): Promise<User> =>
    apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
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
  primary_account_owner_id?: number
  primary_account_owner_name?: string
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
  primary_account_owner_id?: number
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
  primary_account_owner_id?: number
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
  get: (): Promise<EmailSignature | null> =>
    apiRequest('/api/signature'),

  // Create or update signature with retry logic
  createOrUpdate: async (data: EmailSignatureCreate): Promise<EmailSignature> => {
    let lastError: any
    
    // Try up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await apiRequest('/api/signature', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      } catch (error) {
        lastError = error
        console.warn(`Signature save attempt ${attempt} failed:`, error)
        
        // Only retry on network errors, not on validation/auth errors
        if (error instanceof APIError && error.status && error.status < 500) {
          throw error // Don't retry client errors (4xx)
        }
        
        // Wait before retry (except on last attempt)
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    
    throw lastError
  },
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

export interface ActivityCreate {
  title: string
  description?: string
  type: string
  entity_id?: string
}

export const dashboardAPI = {
  // Get dashboard stats
  getStats: (): Promise<DashboardStats> =>
    apiRequest('/api/dashboard/stats'),

  // Get recent activities
  getActivities: (limit: number = 10): Promise<Activity[]> =>
    apiRequest(`/api/activities?limit=${limit}`),

  // Create a new activity
  createActivity: (activity: ActivityCreate): Promise<Activity> =>
    apiRequest('/api/activities', {
      method: 'POST',
      body: JSON.stringify(activity),
    }),

  // Get AI-powered daily summary
  getDailySummary: (): Promise<{
    generated_at: string
    user_id: number
    ai_insights: string
    quick_stats: {
      overdue_tasks: number
      today_tasks: number
      total_contacts: number
      active_deals: number
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

// Office 365 Integration Types
export interface O365OrganizationConfig {
  id: number
  organization_id: number
  client_id?: string
  tenant_id?: string
  calendar_sync_enabled: boolean
  email_sending_enabled: boolean
  contact_sync_enabled: boolean
  is_configured: boolean
  last_test_at?: string
  last_test_success: boolean
  last_error_message?: string
  created_at: string
  updated_at: string
}

export interface O365OrganizationConfigCreate {
  client_id?: string
  client_secret?: string
  tenant_id?: string
  calendar_sync_enabled?: boolean
  email_sending_enabled?: boolean
  contact_sync_enabled?: boolean
}

export interface O365OrganizationConfigUpdate {
  client_id?: string
  client_secret?: string
  tenant_id?: string
  calendar_sync_enabled?: boolean
  email_sending_enabled?: boolean
  contact_sync_enabled?: boolean
}

export interface O365UserConnection {
  id: number
  user_id: number
  o365_user_id: string
  o365_email: string
  o365_display_name?: string
  scopes_granted?: string[]
  sync_calendar_enabled: boolean
  sync_email_enabled: boolean
  sync_contacts_enabled: boolean
  is_active: boolean
  last_sync_at?: string
  last_sync_success: boolean
  last_error_message?: string
  token_expires_at: string
  created_at: string
  updated_at: string
}

export interface O365UserConnectionUpdate {
  sync_calendar_enabled?: boolean
  sync_email_enabled?: boolean
  sync_contacts_enabled?: boolean
}

// Office 365 API functions
export const o365API = {
  // Organization configuration (Owner only)
  getOrganizationConfig: (): Promise<O365OrganizationConfig> => {
    return apiRequest('/api/settings/o365/organization')
  },

  createOrganizationConfig: (config: O365OrganizationConfigCreate): Promise<O365OrganizationConfig> => {
    return apiRequest('/api/settings/o365/organization', {
      method: 'POST',
      body: JSON.stringify(config)
    })
  },

  updateOrganizationConfig: (config: O365OrganizationConfigUpdate): Promise<O365OrganizationConfig> => {
    return apiRequest('/api/settings/o365/organization', {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  },

  deleteOrganizationConfig: (): Promise<{ message: string }> => {
    return apiRequest('/api/settings/o365/organization', {
      method: 'DELETE'
    })
  },

  // User connection
  getUserConnection: (): Promise<O365UserConnection> => {
    return apiRequest('/api/settings/o365/user')
  },

  updateUserConnection: (connection: O365UserConnectionUpdate): Promise<O365UserConnection> => {
    return apiRequest('/api/settings/o365/user', {
      method: 'PUT',
      body: JSON.stringify(connection)
    })
  },

  disconnectUser: (): Promise<{ message: string }> => {
    return apiRequest('/api/settings/o365/user', {
      method: 'DELETE'
    })
  },
}

// Pipeline Stage interfaces
export interface PipelineStage {
  id: number
  organization_id: number
  name: string
  description?: string
  position: number
  is_closed_won: boolean
  is_closed_lost: boolean
  color: string
  is_active: boolean
  deal_count?: number
  created_at: string
  updated_at: string
}

export interface PipelineStageCreate {
  name: string
  description?: string
  position: number
  is_closed_won?: boolean
  is_closed_lost?: boolean
  color?: string
  is_active?: boolean
}

export interface PipelineStageUpdate {
  name?: string
  description?: string
  position?: number
  is_closed_won?: boolean
  is_closed_lost?: boolean
  color?: string
  is_active?: boolean
}

// Deal interfaces
export interface Deal {
  id: number
  organization_id: number
  created_by: number
  assigned_to?: number
  title: string
  description?: string
  value: number
  currency: string
  probability: number
  expected_close_date?: string
  actual_close_date?: string
  stage_id: number
  contact_id?: number
  company_id?: number
  is_active: boolean
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
  
  // Populated by API
  stage_name?: string
  stage_color?: string
  contact_name?: string
  company_name?: string
  creator_name?: string
  assignee_name?: string
}

export interface DealCreate {
  title: string
  description?: string
  value?: number
  currency?: string
  probability?: number
  expected_close_date?: string
  stage_id: number
  contact_id?: number
  company_id?: number
  assigned_to?: number
  notes?: string
  tags?: string[]
}

export interface DealUpdate {
  title?: string
  description?: string
  value?: number
  currency?: string
  probability?: number
  expected_close_date?: string
  actual_close_date?: string
  stage_id?: number
  contact_id?: number
  company_id?: number
  assigned_to?: number
  notes?: string
  tags?: string[]
  is_active?: boolean
}

// Project interfaces
export interface ProjectStage {
  id: number
  organization_id: number
  name: string
  description?: string
  position: number
  is_closed: boolean
  color: string
  is_active: boolean
  project_count?: number
  created_at: string
  updated_at: string
}

export interface ProjectStageCreate {
  name: string
  description?: string
  position: number
  is_closed?: boolean
  color?: string
  is_active?: boolean
}

export interface ProjectStageUpdate {
  name?: string
  description?: string
  position?: number
  is_closed?: boolean
  color?: string
  is_active?: boolean
}

export interface Project {
  id: number
  organization_id: number
  created_by: number
  title: string
  description?: string
  start_date?: string
  projected_end_date?: string
  actual_end_date?: string
  hourly_rate?: number
  project_type?: string
  projected_hours?: number
  actual_hours: number
  stage_id: number
  contact_id?: number
  company_id?: number
  assigned_team_members?: number[]
  is_active: boolean
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
  
  // Populated by API
  stage_name?: string
  stage_color?: string
  contact_name?: string
  company_name?: string
  creator_name?: string
  assigned_team_member_names?: string[]
}

export interface ProjectCreate {
  title: string
  description?: string
  start_date?: string
  projected_end_date?: string
  hourly_rate?: number
  project_type?: string
  projected_hours?: number
  stage_id: number
  contact_id?: number
  company_id?: number
  assigned_team_members?: number[]
  notes?: string
  tags?: string[]
}

export interface ProjectUpdate {
  title?: string
  description?: string
  start_date?: string
  projected_end_date?: string
  actual_end_date?: string
  hourly_rate?: number
  project_type?: string
  projected_hours?: number
  actual_hours?: number
  stage_id?: number
  contact_id?: number
  company_id?: number
  assigned_team_members?: number[]
  notes?: string
  tags?: string[]
  is_active?: boolean
}

// Pipeline API functions
export const pipelineAPI = {
  // Stage operations
  getStages: (includeInactive = false): Promise<PipelineStage[]> =>
    apiRequest(`/api/pipeline/stages?include_inactive=${includeInactive}`),

  createStage: (stage: PipelineStageCreate): Promise<PipelineStage> =>
    apiRequest('/api/pipeline/stages', {
      method: 'POST',
      body: JSON.stringify(stage),
    }),

  getStage: (stageId: number): Promise<PipelineStage> =>
    apiRequest(`/api/pipeline/stages/${stageId}`),

  updateStage: (stageId: number, stage: PipelineStageUpdate): Promise<PipelineStage> =>
    apiRequest(`/api/pipeline/stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(stage),
    }),

  deleteStage: (stageId: number): Promise<{ message: string }> =>
    apiRequest(`/api/pipeline/stages/${stageId}`, {
      method: 'DELETE',
    }),

  initializeDefaultStages: (): Promise<{ message: string; stages: PipelineStage[] }> =>
    apiRequest('/api/pipeline/stages/initialize', {
      method: 'POST',
    }),
}

// Deal API functions
export const dealAPI = {
  getDeals: (params?: {
    skip?: number
    limit?: number
    stage_id?: number
    contact_id?: number
    company_id?: number
    assigned_to?: number
    include_inactive?: boolean
  }): Promise<Deal[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.stage_id) searchParams.append('stage_id', params.stage_id.toString())
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    if (params?.company_id) searchParams.append('company_id', params.company_id.toString())
    if (params?.assigned_to) searchParams.append('assigned_to', params.assigned_to.toString())
    if (params?.include_inactive) searchParams.append('include_inactive', 'true')
    
    return apiRequest(`/api/deals?${searchParams.toString()}`)
  },

  createDeal: (deal: DealCreate): Promise<Deal> =>
    apiRequest('/api/deals', {
      method: 'POST',
      body: JSON.stringify(deal),
    }),

  getDeal: (dealId: number): Promise<Deal> =>
    apiRequest(`/api/deals/${dealId}`),

  updateDeal: (dealId: number, deal: DealUpdate): Promise<Deal> =>
    apiRequest(`/api/deals/${dealId}`, {
      method: 'PUT',
      body: JSON.stringify(deal),
    }),

  deleteDeal: (dealId: number): Promise<{ message: string }> =>
    apiRequest(`/api/deals/${dealId}`, {
      method: 'DELETE',
    }),
}

// Project Stage API functions
export const projectStageAPI = {
  // Stage operations
  getStages: (includeInactive = false): Promise<ProjectStage[]> =>
    apiRequest(`/api/projects/stages?include_inactive=${includeInactive}`),

  createStage: (stage: ProjectStageCreate): Promise<ProjectStage> =>
    apiRequest('/api/projects/stages', {
      method: 'POST',
      body: JSON.stringify(stage),
    }),

  getStage: (stageId: number): Promise<ProjectStage> =>
    apiRequest(`/api/projects/stages/${stageId}`),

  updateStage: (stageId: number, stage: ProjectStageUpdate): Promise<ProjectStage> =>
    apiRequest(`/api/projects/stages/${stageId}`, {
      method: 'PUT',
      body: JSON.stringify(stage),
    }),

  deleteStage: (stageId: number): Promise<{ message: string }> =>
    apiRequest(`/api/projects/stages/${stageId}`, {
      method: 'DELETE',
    }),

  initializeDefaultStages: (): Promise<{ message: string; stages: ProjectStage[] }> =>
    apiRequest('/api/projects/stages/initialize', {
      method: 'POST',
    }),
}

// Project API functions
export const projectAPI = {
  getProjects: (params?: {
    skip?: number
    limit?: number
    stage_id?: number
    contact_id?: number
    company_id?: number
    assigned_to?: number
    project_type?: string
    include_inactive?: boolean
  }): Promise<Project[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.stage_id) searchParams.append('stage_id', params.stage_id.toString())
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    if (params?.company_id) searchParams.append('company_id', params.company_id.toString())
    if (params?.assigned_to) searchParams.append('assigned_to', params.assigned_to.toString())
    if (params?.project_type) searchParams.append('project_type', params.project_type)
    if (params?.include_inactive) searchParams.append('include_inactive', params.include_inactive.toString())

    const url = `/api/projects${searchParams.toString() ? '?' + searchParams.toString() : ''}`
    return apiRequest(url)
  },

  createProject: (project: ProjectCreate): Promise<Project> =>
    apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    }),

  getProject: (projectId: number): Promise<Project> =>
    apiRequest(`/api/projects/${projectId}`),

  updateProject: (projectId: number, project: ProjectUpdate): Promise<Project> =>
    apiRequest(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    }),

  deleteProject: (projectId: number): Promise<{ message: string }> =>
    apiRequest(`/api/projects/${projectId}`, {
      method: 'DELETE',
    }),

  getProjectTypes: (): Promise<string[]> =>
    apiRequest('/api/projects/types'),
}

// Email tracking API functions
export interface EmailTracking {
  id: number
  message_id: string
  to_email: string
  from_email: string
  subject: string
  contact_id?: number
  sent_by: number
  sent_at: string
  opened_at?: string
  open_count: number
  first_clicked_at?: string
  click_count: number
  created_at: string
  updated_at: string
  sender_name?: string
  contact_name?: string
}

export interface EmailEvent {
  id: number
  tracking_id: number
  event_type: string
  timestamp: string
  ip_address?: string
  user_agent?: string
  url?: string
  created_at: string
}

export const emailTrackingAPI = {
  // Get all email tracking records
  getAll: (params?: {
    skip?: number
    limit?: number
    contact_id?: number
  }): Promise<EmailTracking[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    
    return apiRequest(`/api/email-tracking?${searchParams}`)
  },

  // Get single tracking record
  getById: (id: number): Promise<EmailTracking> => 
    apiRequest(`/api/email-tracking/${id}`),

  // Get events for a tracking record
  getEvents: (trackingId: number): Promise<EmailEvent[]> =>
    apiRequest(`/api/email-tracking/${trackingId}/events`),
}

// Email Thread API functions
export interface EmailThread {
  id: number
  organization_id: number
  subject: string
  contact_id: number
  message_count: number
  preview: string
  created_at: string
  updated_at: string
  messages: EmailMessage[]
}

export interface EmailMessage {
  id: number
  thread_id: number
  sender: string
  content: string
  direction: 'incoming' | 'outgoing'
  message_id?: string
  created_at: string
}

export interface EmailThreadCreate {
  subject: string
  contact_id: number
  preview?: string
}

export interface EmailMessageCreate {
  sender: string
  content: string
  direction: 'incoming' | 'outgoing'
  message_id?: string
}

export const emailThreadAPI = {
  // Get all email threads
  getAll: (params?: {
    skip?: number
    limit?: number
    contact_id?: number
  }): Promise<EmailThread[]> => {
    const searchParams = new URLSearchParams()
    if (params?.skip) searchParams.append('skip', params.skip.toString())
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.contact_id) searchParams.append('contact_id', params.contact_id.toString())
    
    return apiRequest(`/api/email-threads?${searchParams}`)
  },

  // Get threads for a specific contact
  getByContact: (contactId: number): Promise<EmailThread[]> =>
    apiRequest(`/api/contacts/${contactId}/email-threads`),

  // Create new email thread
  create: (thread: EmailThreadCreate): Promise<EmailThread> =>
    apiRequest('/api/email-threads', {
      method: 'POST',
      body: JSON.stringify(thread),
    }),

  // Add message to thread
  addMessage: (threadId: number, message: EmailMessageCreate): Promise<EmailMessage> =>
    apiRequest(`/api/email-threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify(message),
    }),
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

// Office 365 Integration API (new endpoints)
export const o365IntegrationAPI = {
  getStatus: (): Promise<{
    connected: boolean
    email?: string
    display_name?: string
    last_sync?: string
    sync_enabled?: boolean
    message?: string
  }> => apiRequest('/api/o365/status'),
  
  getAuthUrl: (): Promise<{ auth_url: string }> =>
    apiRequest('/api/o365/auth/url'),
  
  handleCallback: (code: string, state?: string): Promise<{
    success: boolean
    message: string
    email?: string
  }> => apiRequest('/api/o365/auth/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state })
  }),
  
  syncEmails: (): Promise<{
    success: boolean
    synced_count: number
    last_sync: string
  }> => apiRequest('/api/o365/sync', {
    method: 'POST'
  }),
  
  disconnect: (): Promise<{ success: boolean; message: string }> =>
    apiRequest('/api/o365/disconnect', {
      method: 'DELETE'
    })
}

// Google API endpoints for organization config
export const googleAPI = {
  // Organization Configuration
  getOrganizationConfig: (): Promise<any> =>
    apiRequest('/api/settings/google/organization'),
  
  createOrganizationConfig: (config: any): Promise<any> =>
    apiRequest('/api/settings/google/organization', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  
  updateOrganizationConfig: (config: any): Promise<any> =>
    apiRequest('/api/settings/google/organization', {
      method: 'PUT',
      body: JSON.stringify(config)
    }),
  
  deleteOrganizationConfig: (): Promise<any> =>
    apiRequest('/api/settings/google/organization', {
      method: 'DELETE'
    }),
  
  testConfiguration: (config: any): Promise<any> =>
    apiRequest('/api/settings/google/test', {
      method: 'POST',
      body: JSON.stringify(config)
    })
}

// Google Workspace Integration API
export const googleIntegrationAPI = {
  getStatus: (): Promise<{
    connected: boolean
    email?: string
    display_name?: string
    last_sync?: string
    sync_enabled?: boolean
    message?: string
  }> => apiRequest('/api/google/status'),
  
  getAuthUrl: (): Promise<{ auth_url: string }> =>
    apiRequest('/api/google/auth/url'),
  
  handleCallback: (code: string, state?: string): Promise<{
    success: boolean
    message: string
    email?: string
  }> => apiRequest('/api/google/auth/callback', {
    method: 'POST',
    body: JSON.stringify({ code, state })
  }),
  
  syncEmails: (): Promise<{
    success: boolean
    synced_count: number
    last_sync: string
  }> => apiRequest('/api/google/sync', {
    method: 'POST'
  }),
  
  disconnect: (): Promise<{ success: boolean; message: string }> =>
    apiRequest('/api/google/disconnect', {
      method: 'DELETE'
    })
}