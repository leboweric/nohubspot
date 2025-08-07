"use client"

import { useState } from "react"
import Link from "next/link"
import { Task } from "./types"
import { 
  Calendar, Clock, AlertCircle, CheckCircle, User, Building2,
  MoreVertical, Edit, Trash2, Flag, Users
} from "lucide-react"

interface TaskCardProps {
  task: Task
  onUpdate: (taskId: number, updates: Partial<Task>) => void
  onDelete: (taskId: number) => void
  onEdit: (task: Task) => void
  isDragging?: boolean
}

export default function TaskCard({ task, onUpdate, onDelete, onEdit, isDragging }: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }
  
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return AlertCircle
      case 'high': return Flag
      default: return Flag
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'in_progress': return 'text-blue-600'
      case 'pending': return 'text-gray-600'
      case 'cancelled': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }
  
  const getDueDateStatus = () => {
    if (!task.due_date) return null
    
    const dueDate = new Date(task.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)
    
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (task.status === 'completed') {
      return { text: 'Completed', color: 'text-green-600 bg-green-100' }
    } else if (diffDays < 0) {
      return { text: `Overdue ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`, color: 'text-red-600 bg-red-100' }
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'text-orange-600 bg-orange-100' }
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-600 bg-yellow-100' }
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, color: 'text-blue-600 bg-blue-100' }
    } else {
      return { text: dueDate.toLocaleDateString(), color: 'text-gray-600 bg-gray-100' }
    }
  }
  
  const dueDateStatus = getDueDateStatus()
  const PriorityIcon = getPriorityIcon(task.priority)
  
  const handleStatusChange = (newStatus: string) => {
    onUpdate(task.id, { status: newStatus })
  }
  
  return (
    <div className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
      isDragging ? 'opacity-50 rotate-3 scale-105' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Priority indicator */}
          <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)} flex-shrink-0`}></div>
          
          {/* Task completion checkbox */}
          <button
            onClick={() => handleStatusChange(task.status === 'completed' ? 'pending' : 'completed')}
            className="flex-shrink-0"
          >
            {task.status === 'completed' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <div className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-primary transition-colors"></div>
            )}
          </button>
          
          {/* Priority icon for urgent/high */}
          {(task.priority === 'urgent' || task.priority === 'high') && (
            <PriorityIcon className={`w-4 h-4 ${
              task.priority === 'urgent' ? 'text-red-500' : 'text-orange-500'
            }`} />
          )}
        </div>
        
        {/* Menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-500" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 w-48 bg-white rounded-md shadow-lg z-20 border">
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onEdit(task)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-100 text-left"
                >
                  <Edit className="w-4 h-4" />
                  Edit Task
                </button>
                <hr className="my-1" />
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDelete(task.id)
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Task
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Task title */}
      <h3 className={`font-medium mb-2 ${
        task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
      }`}>
        {task.title}
      </h3>
      
      {/* Task description */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}
      
      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}
      
      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          {/* Due date */}
          {dueDateStatus && (
            <span className={`px-2 py-1 rounded-full ${dueDateStatus.color}`}>
              {dueDateStatus.text}
            </span>
          )}
          
          {/* Contact/Company links */}
          <div className="flex items-center gap-2">
            {task.contact_name && (
              <Link
                href={`/contacts/${task.contact_id}`}
                className="flex items-center gap-1 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <User className="w-3 h-3" />
                <span className="truncate max-w-20">{task.contact_name}</span>
              </Link>
            )}
            
            {task.company_name && (
              <Link
                href={`/companies/${task.company_id}`}
                className="flex items-center gap-1 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <Building2 className="w-3 h-3" />
                <span className="truncate max-w-20">{task.company_name}</span>
              </Link>
            )}
          </div>
        </div>
        
        {/* Assigned to */}
        {task.assigned_to && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span className="truncate max-w-16">{task.assigned_to}</span>
          </div>
        )}
      </div>
    </div>
  )
}