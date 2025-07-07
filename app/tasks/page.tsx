"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import TaskList from "@/components/tasks/TaskList"
import TaskCreate from "@/components/tasks/TaskCreate"
import { TaskStats } from "@/components/tasks/types"
import { taskAPI, Task, TaskCreate as TaskCreateType, handleAPIError } from "@/lib/api"


export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState("")
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Load tasks from API
  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const params: any = { limit: 1000 }
      
      // Add search filter if provided
      if (searchTerm) {
        params.search = searchTerm
      }
      
      // Add status filter if not 'all'
      if (filterStatus !== 'all') {
        params.status = filterStatus
      }
      
      // Add priority filter if not 'all'
      if (filterPriority !== 'all') {
        params.priority = filterPriority
      }
      
      const data = await taskAPI.getAll(params)
      setTasks(data)
    } catch (err) {
      setError(handleAPIError(err))
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load tasks on mount
  useEffect(() => {
    loadTasks()
  }, [])

  // Debounced search and filtering with increased delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadTasks()
    }, 1000) // Increased from 300ms to 1000ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm, filterStatus, filterPriority])

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingTask) {
        // Update existing task
        await taskAPI.update(editingTask.id, {
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
          assigned_to: taskData.assigned_to,
          contact_id: taskData.contact_id,
          company_id: taskData.company_id,
          type: taskData.type,
          tags: taskData.tags
        })
      } else {
        // Create new task
        const apiTaskData: TaskCreateType = {
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.due_date,
          assigned_to: taskData.assigned_to,
          contact_id: taskData.contact_id,
          contact_name: taskData.contact_name,
          company_id: taskData.company_id,
          company_name: taskData.company_name,
          type: taskData.type,
          tags: taskData.tags
        }
        
        await taskAPI.create(apiTaskData)
      }
      
      setShowCreateTask(false)
      setEditingTask(null)
      // Reload tasks to show the changes
      loadTasks()
    } catch (err) {
      console.error('Failed to save task:', err)
      alert(`Failed to save task: ${handleAPIError(err)}`)
    }
  }

  const handleTaskUpdate = async (taskId: number, updates: Partial<Task>) => {
    try {
      // Convert frontend field names to backend field names for the API
      const apiUpdates: any = {}
      if (updates.title !== undefined) apiUpdates.title = updates.title
      if (updates.description !== undefined) apiUpdates.description = updates.description
      if (updates.status !== undefined) apiUpdates.status = updates.status
      if (updates.priority !== undefined) apiUpdates.priority = updates.priority
      if (updates.due_date !== undefined) apiUpdates.due_date = updates.due_date
      if (updates.assigned_to !== undefined) apiUpdates.assigned_to = updates.assigned_to
      if (updates.contact_id !== undefined) apiUpdates.contact_id = updates.contact_id
      if (updates.contact_name !== undefined) apiUpdates.contact_name = updates.contact_name
      if (updates.company_id !== undefined) apiUpdates.company_id = updates.company_id
      if (updates.company_name !== undefined) apiUpdates.company_name = updates.company_name
      if (updates.type !== undefined) apiUpdates.type = updates.type
      if (updates.tags !== undefined) apiUpdates.tags = updates.tags
      
      await taskAPI.update(taskId, apiUpdates)
      // Reload tasks to show the updated data
      loadTasks()
    } catch (err) {
      console.error('Failed to update task:', err)
      alert(`Failed to update task: ${handleAPIError(err)}`)
    }
  }

  const handleTaskDelete = async (taskId: number) => {
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        await taskAPI.delete(taskId)
        // Reload tasks to reflect the deletion
        loadTasks()
      } catch (err) {
        console.error('Failed to delete task:', err)
        alert(`Failed to delete task: ${handleAPIError(err)}`)
      }
    }
  }

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task)
    setShowCreateTask(true)
  }

  // Since we're using API filtering, no need for client-side filtering
  const filteredTasks = tasks

  // Calculate stats from current filtered tasks
  const stats: TaskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length,
    dueToday: tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false
      const today = new Date().toDateString()
      return new Date(t.due_date).toDateString() === today
    }).length,
    dueThisWeek: tasks.filter(t => {
      if (!t.due_date || t.status === 'completed') return false
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      return new Date(t.due_date) <= weekFromNow && new Date(t.due_date) >= new Date()
    }).length
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage your sales activities and follow-ups</p>
        </div>
        <button
          onClick={() => setShowCreateTask(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Create Task
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-gray-600">{stats.pending}</div>
          <div className="text-sm text-muted-foreground">Pending</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-blue-600">{stats.inProgress}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-green-600">{stats.completed}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-muted-foreground">Overdue</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-orange-600">{stats.dueToday}</div>
          <div className="text-sm text-muted-foreground">Due Today</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-2xl font-semibold text-purple-600">{stats.dueThisWeek}</div>
          <div className="text-sm text-muted-foreground">Due This Week</div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{error}</p>
          <button 
            onClick={loadTasks}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={loading}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            disabled={loading}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            disabled={loading}
            className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="text-sm text-muted-foreground flex items-center">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        </div>
      ) : (
        <TaskList
          tasks={filteredTasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          onTaskEdit={handleTaskEdit}
        />
      )}

      {/* Create/Edit Task Modal */}
      <TaskCreate
        isOpen={showCreateTask}
        onClose={() => {
          setShowCreateTask(false)
          setEditingTask(null)
        }}
        onSave={handleCreateTask}
        existingTask={editingTask}
      />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}