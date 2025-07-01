import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  FileText, 
  Download, 
  MoreVertical, 
  Trash2, 
  Eye, 
  Send, 
  CheckCircle, 
  XCircle,
  Clock
} from 'lucide-react'
import { api } from '@/lib/api'

const statusConfig = {
  draft: { 
    label: 'Draft', 
    color: 'bg-gray-100 text-gray-800', 
    icon: Clock 
  },
  sent: { 
    label: 'Sent', 
    color: 'bg-blue-100 text-blue-800', 
    icon: Send 
  },
  viewed: { 
    label: 'Viewed', 
    color: 'bg-yellow-100 text-yellow-800', 
    icon: Eye 
  },
  signed: { 
    label: 'Signed', 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle 
  },
  rejected: { 
    label: 'Rejected', 
    color: 'bg-red-100 text-red-800', 
    icon: XCircle 
  }
}

const typeConfig = {
  quote: { label: 'Quote', color: 'bg-purple-100 text-purple-800' },
  proposal: { label: 'Proposal', color: 'bg-blue-100 text-blue-800' },
  contract: { label: 'Contract', color: 'bg-green-100 text-green-800' },
  presentation: { label: 'Presentation', color: 'bg-orange-100 text-orange-800' },
  image: { label: 'Image', color: 'bg-pink-100 text-pink-800' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800' }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function DocumentsList({ documents, onDocumentUpdate, onDocumentDelete }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState({})

  const handleDownload = async (doc) => {
    try {
      const response = await api.downloadDocument(doc.id)
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = doc.original_filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
      // You might want to show a toast notification here
    }
  }

  const handleStatusUpdate = async (documentId, newStatus) => {
    setUpdatingStatus(prev => ({ ...prev, [documentId]: true }))
    
    try {
      const response = await api.updateDocumentStatus(documentId, newStatus)
      if (response.success) {
        onDocumentUpdate(response.data)
      }
    } catch (error) {
      console.error('Failed to update document status:', error)
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [documentId]: false }))
    }
  }

  const handleDeleteClick = (doc) => {
    setDocumentToDelete(doc)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return
    
    try {
      await api.deleteDocument(documentToDelete.id)
      onDocumentDelete(documentToDelete.id)
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="mx-auto h-12 w-12 mb-4 text-gray-300" />
        <p>No documents uploaded yet</p>
        <p className="text-sm">Upload your first quote, proposal, or contract to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {documents.map((doc) => {
          const statusInfo = statusConfig[doc.status] || statusConfig.draft
          const typeInfo = typeConfig[doc.file_type] || typeConfig.other
          const StatusIcon = statusInfo.icon

          return (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {doc.title}
                        </h4>
                        <Badge className={typeInfo.color}>
                          {typeInfo.label}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {doc.original_filename}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Size: {formatFileSize(doc.file_size)}</span>
                        <span>Uploaded: {formatDate(doc.uploaded_at)}</span>
                        {doc.uploader_name && (
                          <span>By: {doc.uploader_name}</span>
                        )}
                      </div>
                      
                      {doc.description && (
                        <p className="text-sm text-gray-600 mt-2">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Badge className={`${statusInfo.color} flex items-center space-x-1`}>
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusInfo.label}</span>
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDownload(doc)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        
                        {doc.status === 'draft' && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusUpdate(doc.id, 'sent')}
                            disabled={updatingStatus[doc.id]}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Mark as Sent
                          </DropdownMenuItem>
                        )}
                        
                        {doc.status === 'sent' && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusUpdate(doc.id, 'viewed')}
                            disabled={updatingStatus[doc.id]}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Mark as Viewed
                          </DropdownMenuItem>
                        )}
                        
                        {(doc.status === 'viewed' || doc.status === 'sent') && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => handleStatusUpdate(doc.id, 'signed')}
                              disabled={updatingStatus[doc.id]}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Signed
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleStatusUpdate(doc.id, 'rejected')}
                              disabled={updatingStatus[doc.id]}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Mark as Rejected
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(doc)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

