export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string | null
  assignedTo: string
  contactId?: string
  contactName?: string
  companyId?: string
  companyName?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  tags: string[]
  type: 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'other'
}

export interface TaskFilters {
  status?: Task['status'][]
  priority?: Task['priority'][]
  type?: Task['type'][]
  assignedTo?: string
  contactId?: string
  companyId?: string
  searchTerm?: string
  dueDateRange?: {
    start: string
    end: string
  }
}

export interface TaskStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  overdue: number
  dueToday: number
  dueThisWeek: number
}