"use client"

import { useState } from "react"
import { Task } from "./types"
import TaskCard from "./TaskCard"
import { 
  Plus, Clock, Play, CheckCircle, AlertTriangle
} from "lucide-react"

interface KanbanColumn {
  id: string
  title: string
  status: string
  color: string
  icon: React.ElementType
  description: string
}

interface KanbanBoardProps {
  tasks: Task[]
  onTaskUpdate: (taskId: number, updates: Partial<Task>) => void
  onTaskDelete: (taskId: number) => void
  onTaskEdit: (task: Task) => void
  onCreateTask?: () => void
}

const columns: KanbanColumn[] = [
  {
    id: 'pending',
    title: 'To Do',
    status: 'pending',
    color: 'bg-gray-50 border-gray-200',
    icon: Clock,
    description: 'Tasks waiting to be started'
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    status: 'in_progress',
    color: 'bg-blue-50 border-blue-200',
    icon: Play,
    description: 'Tasks currently being worked on'
  },
  {
    id: 'completed',
    title: 'Completed',
    status: 'completed',
    color: 'bg-green-50 border-green-200',
    icon: CheckCircle,
    description: 'Finished tasks'
  },
  {
    id: 'overdue',
    title: 'Overdue',
    status: 'overdue',
    color: 'bg-red-50 border-red-200',
    icon: AlertTriangle,
    description: 'Tasks past their due date'
  }
]

export default function KanbanBoard({ 
  tasks, 
  onTaskUpdate, 
  onTaskDelete, 
  onTaskEdit,
  onCreateTask 
}: KanbanBoardProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  
  // Categorize tasks by status and overdue status
  const getTasksForColumn = (columnStatus: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (columnStatus === 'overdue') {
      return tasks.filter(task => {
        if (task.status === 'completed' || !task.due_date) return false
        const dueDate = new Date(task.due_date)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate < today
      })
    }
    
    return tasks.filter(task => {
      // Don't show overdue tasks in other columns
      if (task.due_date && task.status !== 'completed') {
        const dueDate = new Date(task.due_date)
        dueDate.setHours(0, 0, 0, 0)
        if (dueDate < today) return false
      }
      
      return task.status === columnStatus
    })
  }
  
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }
  
  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null)
    }
  }
  
  const handleDrop = (e: React.DragEvent, columnStatus: string) => {
    e.preventDefault()
    setDragOverColumn(null)
    
    if (draggedTask && draggedTask.status !== columnStatus) {
      // Don't allow dropping into overdue column
      if (columnStatus === 'overdue') return
      
      onTaskUpdate(draggedTask.id, { status: columnStatus })
    }
    
    setDraggedTask(null)
  }
  
  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverColumn(null)
  }
  
  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTasks = getTasksForColumn(column.status)
        const isDragOver = dragOverColumn === column.id
        const canDrop = draggedTask && column.status !== 'overdue'
        const Icon = column.icon
        
        const columnClasses = [
          'flex-shrink-0 w-80 rounded-lg border-2 transition-all duration-200',
          column.color,
          isDragOver && canDrop ? 'border-primary border-dashed scale-105' : '',
          isDragOver && !canDrop ? 'border-red-300' : ''
        ].filter(Boolean).join(' ')
        
        return (
          <div
            key={column.id}
            className={columnClasses}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            {/* Column Header */}
            <div className="p-4 border-b border-current border-opacity-20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5" />
                  <h3 className="font-semibold text-gray-800">{column.title}</h3>
                  <span className="px-2 py-1 text-xs bg-white bg-opacity-70 rounded-full font-medium">
                    {columnTasks.length}
                  </span>
                </div>
                
                {column.status === 'pending' && onCreateTask && (
                  <button
                    onClick={onCreateTask}
                    className="p-1 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
                    title="Add task"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600">{column.description}</p>
            </div>
            
            {/* Tasks */}
            <div className="p-4 space-y-3 min-h-32 max-h-96 overflow-y-auto">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  draggable={column.status !== 'overdue'}
                  onDragStart={(e) => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  className={column.status !== 'overdue' ? 'cursor-move' : ''}
                >
                  <TaskCard
                    task={task}
                    onUpdate={onTaskUpdate}
                    onDelete={onTaskDelete}
                    onEdit={onTaskEdit}
                    isDragging={draggedTask?.id === task.id}
                  />
                </div>
              ))}
              
              {/* Empty state */}
              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-2xl mb-2">📋</div>
                  <p className="text-sm">
                    {column.status === 'pending' ? 'No tasks to do' :
                     column.status === 'in_progress' ? 'No tasks in progress' :
                     column.status === 'completed' ? 'No completed tasks' :
                     'No overdue tasks'}
                  </p>
                  {column.status === 'pending' && onCreateTask && (
                    <button
                      onClick={onCreateTask}
                      className="mt-2 text-primary hover:underline text-sm"
                    >
                      Create your first task
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Drop zone indicator */}
            {isDragOver && canDrop && (
              <div className="mx-4 mb-4 p-3 border-2 border-primary border-dashed rounded-lg bg-primary bg-opacity-10">
                <p className="text-center text-primary text-sm font-medium">
                  Drop task here
                </p>
              </div>
            )}
            
            {isDragOver && !canDrop && column.status === 'overdue' && (
              <div className="mx-4 mb-4 p-3 border-2 border-red-300 border-dashed rounded-lg bg-red-50">
                <p className="text-center text-red-600 text-sm font-medium">
                  Cannot move to overdue
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}