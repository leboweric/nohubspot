"use client"

import React, { useState, useEffect } from 'react'
import { getAuthState } from '@/lib/auth'
import { AlertCircle, TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react'

interface DealUpdate {
  id: number
  deal_id: number
  title: string
  description?: string
  update_type: 'status' | 'progress' | 'risk' | 'decision'
  deal_health?: 'green' | 'yellow' | 'red'
  probability_change?: number
  value_change?: number
  created_by_name?: string
  created_at: string
}

interface DealUpdatesProps {
  dealId: number
  onClose?: () => void
}

export default function DealUpdates({ dealId, onClose }: DealUpdatesProps) {
  const [updates, setUpdates] = useState<DealUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    update_type: 'status' as DealUpdate['update_type'],
    deal_health: '' as DealUpdate['deal_health'] | '',
    probability_change: 0,
    value_change: 0
  })
  const [submitting, setSubmitting] = useState(false)
  const { token } = getAuthState()

  useEffect(() => {
    loadUpdates()
  }, [dealId])

  const loadUpdates = async () => {
    setLoading(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/deals/${dealId}/updates`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUpdates(data)
      }
    } catch (error) {
      console.error('Failed to load updates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        update_type: formData.update_type,
        deal_health: formData.deal_health || undefined,
        probability_change: formData.probability_change || undefined,
        value_change: formData.value_change || undefined
      }
      
      const response = await fetch(`${baseUrl}/api/deals/${dealId}/updates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      
      if (response.ok) {
        await loadUpdates()
        setShowAddForm(false)
        setFormData({
          title: '',
          description: '',
          update_type: 'status',
          deal_health: '',
          probability_change: 0,
          value_change: 0
        })
      }
    } catch (error) {
      console.error('Failed to create update:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (updateId: number) => {
    if (!confirm('Are you sure you want to delete this update?')) return
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/deals/${dealId}/updates/${updateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        await loadUpdates()
      }
    } catch (error) {
      console.error('Failed to delete update:', error)
    }
  }

  const getHealthColor = (health?: string) => {
    switch (health) {
      case 'green': return 'text-green-600 bg-green-50'
      case 'yellow': return 'text-yellow-600 bg-yellow-50'
      case 'red': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'status': return <Activity className="w-4 h-4" />
      case 'progress': return <TrendingUp className="w-4 h-4" />
      case 'risk': return <AlertCircle className="w-4 h-4" />
      case 'decision': return <DollarSign className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60))
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
      }
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Deal Updates</h4>
        <button
          onClick={() => setShowAddForm(true)}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          + Add Update
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Update title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
            
            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
            
            <div className="grid grid-cols-2 gap-2">
              <select
                value={formData.update_type}
                onChange={(e) => setFormData({ ...formData, update_type: e.target.value as DealUpdate['update_type'] })}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="status">Status Update</option>
                <option value="progress">Progress</option>
                <option value="risk">Risk</option>
                <option value="decision">Decision</option>
              </select>
              
              <select
                value={formData.deal_health}
                onChange={(e) => setFormData({ ...formData, deal_health: e.target.value as DealUpdate['deal_health'] | '' })}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Health Status</option>
                <option value="green">🟢 Green</option>
                <option value="yellow">🟡 Yellow</option>
                <option value="red">🔴 Red</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Probability Change (%)</label>
                <input
                  type="number"
                  value={formData.probability_change}
                  onChange={(e) => setFormData({ ...formData, probability_change: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="-100"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 mb-1">Value Change ($)</label>
                <input
                  type="number"
                  value={formData.value_change}
                  onChange={(e) => setFormData({ ...formData, value_change: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Update'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-xs text-gray-500 text-center py-2">Loading updates...</div>
      ) : updates.length > 0 ? (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {updates.map((update) => (
            <div key={update.id} className="p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getTypeIcon(update.update_type)}
                    <span className="text-xs font-medium text-gray-900">{update.title}</span>
                    {update.deal_health && (
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getHealthColor(update.deal_health)}`}>
                        {update.deal_health}
                      </span>
                    )}
                  </div>
                  
                  {update.description && (
                    <p className="text-xs text-gray-600 mb-1">{update.description}</p>
                  )}
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {update.probability_change !== undefined && update.probability_change !== 0 && (
                      <span className={`flex items-center ${update.probability_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {update.probability_change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {update.probability_change > 0 ? '+' : ''}{update.probability_change}%
                      </span>
                    )}
                    {update.value_change !== undefined && update.value_change !== 0 && (
                      <span className={`flex items-center ${update.value_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <DollarSign className="w-3 h-3" />
                        {update.value_change > 0 ? '+' : ''}{update.value_change.toLocaleString()}
                      </span>
                    )}
                    <span>{update.created_by_name}</span>
                    <span>•</span>
                    <span>{formatDate(update.created_at)}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDelete(update.id)}
                  className="ml-2 text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete update"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-500 text-center py-4">
          No updates yet. Add the first update to track deal progress.
        </div>
      )}
    </div>
  )
}