"use client"

import React, { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Deal } from '@/lib/api'
import { Paperclip, Upload, X, Loader2, File, MessageSquare } from 'lucide-react'
import { getAuthState } from '@/lib/auth'
import DealUpdates from './DealUpdates'

interface Attachment {
  id: number
  name: string
  description?: string
  file_size?: number
  file_type?: string
  file_url?: string
  created_at: string
  uploaded_by?: string
}

interface DealCardProps {
  deal: Deal
  isDragging?: boolean
  onEdit?: (deal: Deal) => void
  onUpdate?: () => void
}

export default function DealCardWithAttachments({ deal, isDragging = false, onEdit, onUpdate }: DealCardProps) {
  const [showAttachments, setShowAttachments] = useState(false)
  const [showUpdates, setShowUpdates] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [attachmentCount, setAttachmentCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { token } = getAuthState()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: deal.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return 'text-green-600 bg-green-50 border-green-200'
    if (probability >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    if (probability >= 25) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const loadAttachments = async () => {
    setLoadingAttachments(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/deals/${deal.id}/attachments`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAttachments(data)
        setAttachmentCount(data.length)
      }
    } catch (error) {
      console.error('Failed to load attachments:', error)
    } finally {
      setLoadingAttachments(false)
    }
  }

  const handleAttachmentClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowAttachments(!showAttachments)
    
    if (!showAttachments && attachments.length === 0) {
      await loadAttachments()
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)
    setUploadSuccess(false)
    
    try {
      // Show file size warning for large files
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        if (!confirm(`This file is ${formatFileSize(file.size)}. Large files may take time to upload. Continue?`)) {
          setUploading(false)
          return
        }
      }
      
      // Simulate progress for better UX (since fetch doesn't support upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)
      
      // Upload actual file
      const formData = new FormData()
      formData.append('file', file)
      
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/deals/${deal.id}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      clearInterval(progressInterval)
      
      if (response.ok) {
        setUploadProgress(100)
        setUploadSuccess(true)
        await loadAttachments()
        if (onUpdate) onUpdate()
        
        // Show success for 2 seconds
        setTimeout(() => {
          setUploadSuccess(false)
          setUploadProgress(0)
        }, 2000)
      } else {
        alert('Upload failed. Please try again.')
        console.error('Upload failed')
      }
    } catch (error) {
      alert('Upload failed. Please check your connection and try again.')
      console.error('Failed to upload file:', error)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDownloadAttachment = async (attachment: Attachment, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const downloadUrl = `${baseUrl}/api/attachments/${attachment.id}/download`
      
      // Fetch with authentication
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        // Convert to blob and trigger download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = attachment.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Download failed')
      }
    } catch (error) {
      console.error('Failed to download attachment:', error)
    }
  }

  const handleDeleteAttachment = async (attachmentId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this attachment?')) return
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'
      const response = await fetch(`${baseUrl}/api/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await loadAttachments()
        if (onUpdate) onUpdate()
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onEdit) {
      onEdit(deal)
    }
  }

  const cardClasses = `
    bg-white border rounded-lg p-3 cursor-grab active:cursor-grabbing
    hover:shadow-md transition-shadow relative group
    ${isDragging || isSortableDragging ? 'shadow-lg opacity-90' : ''}
    ${isSortableDragging ? 'z-50' : ''}
  `.trim()

  // Count attachments on mount
  React.useEffect(() => {
    loadAttachments()
  }, [])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cardClasses}
    >
      <div {...attributes} {...listeners}>
        {/* Edit Button */}
        {onEdit && (
          <button
            onClick={handleEdit}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md rounded-full p-1 hover:bg-gray-50 z-10"
            title="Edit project"
          >
            <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}

        {/* Deal Header */}
        <div className="mb-2">
          <h4 className="font-semibold text-sm text-gray-900 truncate">
            {deal.title}
          </h4>
          <div className="flex items-center justify-between mt-1">
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(deal.value || 0, deal.currency)}
            </div>
            {deal.probability !== undefined && (
              <div className={`px-2 py-1 rounded text-xs font-medium border ${getProbabilityColor(deal.probability)}`}>
                {deal.probability}%
              </div>
            )}
          </div>
        </div>

        {/* Deal Details */}
        <div className="space-y-1 text-xs text-gray-600">
          {deal.company_name && (
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
              <span className="truncate">Company: {deal.company_name}</span>
            </div>
          )}
          
          {deal.contact_name && (
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
              <span className="truncate">Contact: {deal.contact_name}</span>
            </div>
          )}
          
          {deal.expected_close_date && (
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
              <span className="truncate">
                Expected Close: {formatDate(deal.expected_close_date)}
              </span>
            </div>
          )}
          
          {deal.assignee_name && (
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2"></span>
              <span className="truncate">Assigned to: {deal.assignee_name}</span>
            </div>
          )}
        </div>

        {/* Attachment and Updates Buttons */}
        <div className="mt-3 pt-2 border-t border-gray-100 space-y-1">
          <button
            onClick={handleAttachmentClick}
            className="flex items-center justify-between w-full text-xs text-gray-600 hover:text-blue-600 transition-colors"
          >
            <div className="flex items-center">
              {loadingAttachments && !showAttachments ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Paperclip className="w-3 h-3 mr-1" />
              )}
              <span>Attachments {attachmentCount > 0 && `(${attachmentCount})`}</span>
            </div>
            <svg
              className={`w-3 h-3 transform transition-transform ${showAttachments ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <button
            onClick={() => setShowUpdates(!showUpdates)}
            className="flex items-center justify-between w-full text-xs text-gray-600 hover:text-blue-600 transition-colors"
          >
            <div className="flex items-center">
              <MessageSquare className="w-3 h-3 mr-1" />
              <span>Updates</span>
            </div>
            <svg
              className={`w-3 h-3 transform transition-transform ${showUpdates ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Attachments Panel */}
      {showAttachments && (
        <div className="mt-3 pt-3 border-t border-gray-200" onClick={(e) => e.stopPropagation()}>
          {loadingAttachments ? (
            <div className="text-xs text-gray-500 text-center py-2">Loading attachments...</div>
          ) : (
            <>
              {/* Upload Button and Progress */}
              {uploading ? (
                <div className="w-full mb-2 px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600">
                      {uploadSuccess ? '✅ Upload complete!' : 'Uploading...'}
                    </span>
                    <span className="text-gray-500">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        uploadSuccess ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleFileSelect}
                  disabled={uploading}
                  className="w-full mb-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center text-xs text-gray-600 hover:text-blue-600"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  <span>Upload File</span>
                </button>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.xls,.ppt,.pptx"
              />

              {/* Attachments List */}
              {attachments.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors group"
                    >
                      <button
                        onClick={(e) => handleDownloadAttachment(attachment, e)}
                        className="flex items-center flex-1 min-w-0 text-left hover:text-blue-600"
                        title="Download attachment"
                      >
                        <File className="w-3 h-3 mr-2 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-700 truncate underline">
                            {attachment.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatFileSize(attachment.file_size)}
                            {attachment.uploaded_by && ` • ${attachment.uploaded_by}`}
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleDeleteAttachment(attachment.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded ml-2"
                        title="Delete attachment"
                      >
                        <X className="w-3 h-3 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-2">
                  No attachments yet
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Updates Panel */}
      {showUpdates && (
        <DealUpdates 
          dealId={deal.id} 
          onClose={() => setShowUpdates(false)}
        />
      )}
    </div>
  )
}