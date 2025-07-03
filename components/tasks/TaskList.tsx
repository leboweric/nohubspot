"use client"

import { useState } from "react"
import { TaskFilters } from "./types"
import { Task } from "@/lib/api"

interface TaskListProps {
  tasks: Task[]
  onTaskUpdate: (taskId: number, updates: Partial<Task>) => void
  onTaskDelete: (taskId: number) => void
  filters?: TaskFilters
}

export default function TaskList({ tasks, onTaskUpdate, onTaskDelete, filters }: TaskListProps) {
  const [expandedTask, setExpandedTask] = useState<number | null>(null)

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    }
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    }
  }

  const getTypeIcon = (type: Task['type']) => {
    switch (type) {
      case 'call': return '📞'
      case 'email': return '✉️'
      case 'meeting': return '📅'
      case 'follow_up': return '🔄'
      case 'demo': return '🖥️'
      case 'proposal': return '📄'
      default: return '📋'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`
    if (diffDays === 0) return 'Due today'
    if (diffDays === 1) return 'Due tomorrow'
    if (diffDays <= 7) return `Due in ${diffDays} days`
    
    return date.toLocaleDateString()
  }

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const handleStatusChange = (taskId: number, newStatus: Task['status']) => {
    const updates: Partial<Task> = { 
      status: newStatus
    }
    
    if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString()
    }
    
    onTaskUpdate(taskId, updates)
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No tasks found. Create your first task to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`border rounded-lg p-4 transition-colors ${
            task.status === 'completed' ? 'bg-muted/50' : 'bg-card'
          } ${isOverdue(task.due_date) && task.status !== 'completed' ? 'border-red-200' : ''}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">{getTypeIcon(task.type)}</span>
                <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                  {task.title}
                </h3>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                {task.assigned_to && <span>👤 {task.assigned_to}</span>}
                {task.contact_name && <span>👥 {task.contact_name}</span>}
                {task.company_name && <span>🏢 {task.company_name}</span>}
                <span className={isOverdue(task.due_date) && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}>
                  🗓️ {formatDate(task.due_date)}
                </span>
              </div>

              {task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {task.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {expandedTask === task.id && task.description && (
                <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted rounded-md">
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              {task.description && (
                <button
                  onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expandedTask === task.id ? 'Less' : 'More'}
                </button>
              )}

              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                className="text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <button
                onClick={() => onTaskDelete(task.id)}
                className="text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}