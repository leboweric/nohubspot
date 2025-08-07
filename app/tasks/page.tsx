"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import TaskList from "@/components/tasks/TaskList"
import TaskCreate from "@/components/tasks/TaskCreate"
import KanbanBoard from "@/components/tasks/KanbanBoard"
import TaskStats from "@/components/tasks/TaskStats"
import { taskAPI, Task, TaskCreate as TaskCreateType, handleAPIError } from "@/lib/api"
import ModernSelect from "@/components/ui/ModernSelect"
import { 
  LayoutGrid, List, Calendar, Plus, Filter, Search,
  CheckSquare, Users, Clock, BarChart3, Download
} from "lucide-react"


export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState("")
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'calendar'>('board')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<number[]>([])

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

  const handleBulkAction = (action: string) => {
    if (selectedTasks.length === 0) return
    
    switch (action) {
      case 'complete':
        selectedTasks.forEach(taskId => {
          handleTaskUpdate(taskId, { status: 'completed' })
        })
        break
      case 'delete':
        if (confirm(`Delete ${selectedTasks.length} selected tasks?`)) {
          selectedTasks.forEach(taskId => {
            handleTaskDelete(taskId)
          })
        }
        break
    }
    setSelectedTasks([])
  }

  const handleExportTasks = () => {
    try {
      const headers = ['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Assigned To', 'Contact', 'Company', 'Tags']
      const rows = filteredTasks.map(task => [
        task.title,
        task.description || '',
        task.status,
        task.priority,
        task.due_date || '',
        task.assigned_to || '',
        task.contact_name || '',
        task.company_name || '',
        task.tags?.join(', ') || ''
      ])
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(cell => {
            const escaped = String(cell).replace(/"/g, '""')
            return /[,"\n]/.test(String(cell)) ? `"${escaped}"` : escaped
          }).join(',')
        )
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `tasks_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      alert(`Successfully exported ${filteredTasks.length} tasks to CSV!`)
    } catch (error) {
      console.error('Failed to export tasks:', error)
      alert('Failed to export tasks. Please try again.')
    }
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold">Tasks</h1>
              <p className="text-muted-foreground mt-1">Manage your sales activities and follow-ups</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-md p-1">
                <button
                  onClick={() => setViewMode('board')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'board' 
                      ? 'bg-white shadow-sm text-primary' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Board View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-white shadow-sm text-primary' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'calendar' 
                      ? 'bg-white shadow-sm text-primary' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  title="Calendar View"
                  disabled
                >
                  <Calendar className="w-4 h-4" />
                </button>
              </div>
              
              {/* Export */}
              <button
                onClick={handleExportTasks}
                disabled={loading || filteredTasks.length === 0}
                className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              
              {/* Create Task */}
              <button
                onClick={() => setShowCreateTask(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            </div>
          </div>

          {/* Enhanced Stats */}
          <div className="mb-8">
            <TaskStats tasks={tasks} />
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

          {/* Filters and Bulk Actions */}
          <div className="bg-card border rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Filters & Search</span>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Filter className={`w-4 h-4 transition-colors ${
                    showFilters ? 'text-primary' : 'text-gray-500'
                  }`} />
                </button>
              </div>
              
              {/* Bulk Actions */}
              {selectedTasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedTasks.length} selected</span>
                  <button
                    onClick={() => handleBulkAction('complete')}
                    className="flex items-center gap-1 px-2 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    <CheckSquare className="w-3 h-3" />
                    Complete
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="flex items-center gap-1 px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setSelectedTasks([])}
                    className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            
            <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 ${showFilters ? '' : 'hidden'}`}>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
                className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              
              <ModernSelect
                value={filterStatus}
                onChange={(value) => setFilterStatus(value as string)}
                disabled={loading}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "pending", label: "Pending" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "completed", label: "Completed" },
                  { value: "cancelled", label: "Cancelled" }
                ]}
                placeholder="Filter by status"
              />

              <ModernSelect
                value={filterPriority}
                onChange={(value) => setFilterPriority(value as string)}
                disabled={loading}
                options={[
                  { value: "all", label: "All Priority" },
                  { value: "urgent", label: "Urgent" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" }
                ]}
                placeholder="Filter by priority"
              />

              <div className="text-sm text-muted-foreground flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" />
                {filteredTasks.length} of {tasks.length} tasks
              </div>
            </div>
          </div>

          {/* Task Views */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading tasks...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Board View */}
              {viewMode === 'board' && (
                <KanbanBoard
                  tasks={filteredTasks}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskDelete={handleTaskDelete}
                  onTaskEdit={handleTaskEdit}
                  onCreateTask={() => setShowCreateTask(true)}
                />
              )}
              
              {/* List View */}
              {viewMode === 'list' && (
                <TaskList
                  tasks={filteredTasks}
                  onTaskUpdate={handleTaskUpdate}
                  onTaskDelete={handleTaskDelete}
                  onTaskEdit={handleTaskEdit}
                />
              )}
              
              {/* Calendar View - Placeholder */}
              {viewMode === 'calendar' && (
                <div className="bg-card border rounded-lg p-12 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Calendar View</h3>
                  <p className="text-muted-foreground">Calendar view coming soon! View tasks organized by due dates.</p>
                  <button
                    onClick={() => setViewMode('board')}
                    className="mt-4 text-primary hover:underline"
                  >
                    Switch to Board View
                  </button>
                </div>
              )}
            </div>
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