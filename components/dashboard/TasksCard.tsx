"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Task, taskAPI, handleAPIError } from "@/lib/api"

export default function TasksCard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get all pending and in-progress tasks
        const [pendingTasks, inProgressTasks] = await Promise.all([
          taskAPI.getAll({
            status: 'pending',
            limit: 100
          }),
          taskAPI.getAll({
            status: 'in_progress',
            limit: 100
          })
        ])
        
        const allTasks = [...pendingTasks, ...inProgressTasks]
        
        // Filter for overdue and today's tasks
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const relevantTasks = allTasks.filter(task => {
          if (!task.due_date) return false
          const dueDate = new Date(task.due_date)
          // Include if overdue or due today
          return dueDate < tomorrow
        })
        
        // Sort by due date (overdue first, then by time)
        relevantTasks.sort((a, b) => {
          const dateA = new Date(a.due_date!)
          const dateB = new Date(b.due_date!)
          return dateA.getTime() - dateB.getTime()
        })
        
        setTasks(relevantTasks)
      } catch (err) {
        setError(handleAPIError(err))
        console.error('Failed to load tasks:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [])

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    
    // Check if overdue
    if (taskDate < today) {
      const daysOverdue = Math.floor((today.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24))
      return {
        text: daysOverdue === 1 ? '1 day overdue' : `${daysOverdue} days overdue`,
        isOverdue: true
      }
    }
    
    // Today
    return {
      text: 'Due today',
      isOverdue: false
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-green-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return '🔴'
      case 'medium':
        return '🟡'
      case 'low':
        return '🟢'
      default:
        return '⚪'
    }
  }

  // Separate overdue and today's tasks for better organization
  const overdueTasks = tasks.filter(task => {
    const date = new Date(task.due_date!)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  })

  const todayTasks = tasks.filter(task => {
    const date = new Date(task.due_date!)
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)
    return date >= startOfToday && date < endOfToday
  })

  const markAsComplete = async (taskId: number) => {
    try {
      await taskAPI.update(taskId, { status: 'completed' })
      // Remove from list
      setTasks(tasks.filter(t => t.id !== taskId))
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg hover:border-gray-300 transition-all">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        <Link 
          href="/tasks" 
          className="text-sm text-primary hover:text-primary/80 transition-colors"
        >
          View All Tasks
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        </div>
      ) : error ? (
        <div className="text-center py-6">
          <p className="text-sm text-red-600 mb-2">Failed to load tasks</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : tasks.length > 0 ? (
        <div className="space-y-4 max-h-64 overflow-y-auto">
          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Overdue ({overdueTasks.length})
              </h3>
              <div className="space-y-2">
                {overdueTasks.map((task) => {
                  const dueInfo = formatDueDate(task.due_date!)
                  return (
                    <div 
                      key={task.id} 
                      className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 border-l-2 border-gray-400 hover:bg-gray-100 transition-colors"
                    >
                      <button
                        onClick={() => markAsComplete(task.id)}
                        className="flex-shrink-0 mt-1 w-4 h-4 border border-gray-300 rounded hover:border-primary transition-colors"
                        title="Mark as complete"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium truncate">{task.title}</h3>
                          <span className="text-xs">{getPriorityIcon(task.priority)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <span>⏰</span>
                            <span className="text-gray-700 font-medium">{dueInfo.text}</span>
                          </div>
                          {(task.contact_name || task.company_name) && (
                            <div className="flex items-center gap-2">
                              <span>👤</span>
                              <span className="truncate">
                                {task.contact_name && task.company_name 
                                  ? `${task.contact_name} (${task.company_name})`
                                  : task.contact_name || task.company_name
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          {todayTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                Due Today ({todayTasks.length})
              </h3>
              <div className="space-y-2">
                {todayTasks.map((task) => {
                  const dueInfo = formatDueDate(task.due_date!)
                  return (
                    <div 
                      key={task.id} 
                      className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <button
                        onClick={() => markAsComplete(task.id)}
                        className="flex-shrink-0 mt-1 w-4 h-4 border border-gray-300 rounded hover:border-primary transition-colors"
                        title="Mark as complete"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium truncate">{task.title}</h3>
                          <span className="text-xs">{getPriorityIcon(task.priority)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <span>📅</span>
                            <span>{dueInfo.text}</span>
                          </div>
                          {(task.contact_name || task.company_name) && (
                            <div className="flex items-center gap-2">
                              <span>👤</span>
                              <span className="truncate">
                                {task.contact_name && task.company_name 
                                  ? `${task.contact_name} (${task.company_name})`
                                  : task.contact_name || task.company_name
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm text-muted-foreground mb-2">No overdue or pending tasks</p>
          <Link 
            href="/tasks" 
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Create a task
          </Link>
        </div>
      )}
    </div>
  )
}