"use client"

import { useState, useEffect } from "react"
import { Task } from "@/lib/api"
import { getAuthState } from "@/lib/auth"
import ModernSelect from "@/components/ui/ModernSelect"

interface TaskCreateProps {
  isOpen: boolean
  onClose: () => void
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void
  existingTask?: Task | null
  contactId?: number
  contactName?: string
  companyId?: number
  companyName?: string
}

export default function TaskCreate({ 
  isOpen, 
  onClose, 
  onSave, 
  existingTask,
  contactId, 
  contactName, 
  companyId, 
  companyName 
}: TaskCreateProps) {
  const { user } = getAuthState()
  const currentUserName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'Sales Rep'
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "pending" as Task['status'],
    priority: "medium" as Task['priority'],
    due_date: "",
    assigned_to: currentUserName,
    type: "other" as Task['type'],
    tags: [] as string[]
  })

  const [tagInput, setTagInput] = useState("")

  // Populate form when editing existing task
  useEffect(() => {
    if (existingTask) {
      setFormData({
        title: existingTask.title,
        description: existingTask.description || "",
        status: existingTask.status,
        priority: existingTask.priority,
        due_date: existingTask.due_date ? new Date(existingTask.due_date).toISOString().split('T')[0] : "",
        assigned_to: currentUserName,
        type: existingTask.type,
        tags: existingTask.tags || []
      })
    } else {
      // Reset form for new task
      setFormData({
        title: "",
        description: "",
        status: "pending",
        priority: "medium",
        due_date: "",
        assigned_to: currentUserName,
        type: "other",
        tags: []
      })
    }
  }, [existingTask, currentUserName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const task: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      ...formData,
      due_date: formData.due_date || undefined,
      contact_id: existingTask?.contact_id || contactId,
      contact_name: existingTask?.contact_name || contactName,
      company_id: existingTask?.company_id || companyId,
      company_name: existingTask?.company_name || companyName
    }
    
    onSave(task)
    
    // Reset form
    setFormData({
      title: "",
      description: "",
      status: "pending",
      priority: "medium",
      due_date: "",
      assigned_to: process.env.NEXT_PUBLIC_DEFAULT_SENDER_NAME || "Sales Rep",
      type: "other",
      tags: []
    })
    setTagInput("")
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      })
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{existingTask ? 'Edit Task' : 'Create New Task'}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Task Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Call prospect, Send proposal, etc."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="type" className="block text-sm font-medium mb-1">
                Task Type
              </label>
              <ModernSelect
                value={formData.type}
                onChange={(value) => setFormData(prev => ({ ...prev, type: value as 'call' | 'email' | 'meeting' | 'follow_up' | 'demo' | 'proposal' | 'other' }))}
                options={[
                  { value: "call", label: "Call" },
                  { value: "email", label: "Email" },
                  { value: "meeting", label: "Meeting" },
                  { value: "follow_up", label: "Follow Up" },
                  { value: "demo", label: "Demo" },
                  { value: "proposal", label: "Proposal" },
                  { value: "other", label: "Other" }
                ]}
                placeholder="Select task type"
              />
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium mb-1">
                Priority
              </label>
              <ModernSelect
                value={formData.priority}
                onChange={(value) => setFormData(prev => ({ ...prev, priority: value as 'low' | 'medium' | 'high' | 'urgent' }))}
                options={[
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" }
                ]}
                placeholder="Select priority"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="due_date" className="block text-sm font-medium mb-1">
                Due Date
              </label>
              <input
                type="datetime-local"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

          </div>

          {(contactName || companyName) && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Related to:</p>
              {contactName && <p className="text-sm text-muted-foreground">Contact: {contactName}</p>}
              {companyName && <p className="text-sm text-muted-foreground">Company: {companyName}</p>}
            </div>
          )}

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Task details, notes, or additional context..."
            />
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Add a tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 border rounded-md hover:bg-accent transition-colors"
              >
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-primary/70"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}