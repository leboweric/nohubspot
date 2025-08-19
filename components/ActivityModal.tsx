"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { ActivityCreate, dashboardAPI, handleAPIError } from "@/lib/api"

interface ActivityModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  entityType: 'company' | 'contact'
  entityId: string
  entityName: string
}

export default function ActivityModal({ 
  isOpen, 
  onClose, 
  onSave,
  entityType,
  entityId,
  entityName
}: ActivityModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [activityType, setActivityType] = useState("note")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      alert("Please enter an activity title")
      return
    }

    setSaving(true)
    
    try {
      const activityData: ActivityCreate = {
        title,
        description: description || undefined,
        type: activityType,
        entity_id: entityId
      }
      
      await dashboardAPI.createActivity(activityData)
      
      // Reset form
      setTitle("")
      setDescription("")
      setActivityType("note")
      
      // Call onSave to refresh the activity list
      onSave()
      onClose()
    } catch (error) {
      console.error('Failed to create activity:', error)
      alert(`Failed to create activity: ${handleAPIError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add Activity</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Adding activity for {entityType}: <span className="font-medium">{entityName}</span>
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Activity Type
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="task">Task</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Follow-up call with client"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details about this activity..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg transition-all text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {saving ? 'Saving...' : 'Save Activity'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}