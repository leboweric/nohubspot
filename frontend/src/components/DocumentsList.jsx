import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
  Image, 
  FileSpreadsheet,
  Presentation,
  File,
  MoreVertical,
  Download,
  Edit,
  Trash2,
  Send,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle
} from 'lucide-react'
import { api } from '../lib/api'

const getFileIcon = (mimeType, fileType) => {
  if (mimeType?.startsWith('image/')) {
    return Image
  } else if (mimeType?.includes('sheet') || mimeType?.includes('excel')) {
    return FileSpreadsheet
  } else if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) {
    return Presentation
  } else {
    return FileText
  }
}

const getStatusBadge = (status) => {
  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary', icon: Clock },
    sent: { label: 'Sent', variant: 'default', icon: Send },
    viewed: { label: 'Viewed', variant: 'outline', icon: Eye },
    signed: { label: 'Signed', variant: 'default', icon: CheckCircle },
    rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle }
  }
  
  const config = statusConfig[status] || statusConfig.draft
  const Icon = config.icon
  
  return (
    <Badge variant={config.variant} className="flex items-center space-x-1">
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </Badge>
  )
}

const getFileTypeBadge = (fileType) => {
  const typeConfig = {
    quote: { label: 'Quote', className: 'bg-blue-100 text-blue-800' },
    proposal: { label: 'Proposal', className: 'bg-green-100 text-green-800' },
    contract: { label: 'Contract', className: 'bg-purple-100 text-purple-800' },
    presentation: { label: 'Presentation', className: 'bg-orange-100 text-orange-800' },
    image: { label: 'Image', className: 'bg-pink-100 text-pink-800' },
    other: { label: 'Other', className: 'bg-gray-100 text-gray-800' }
  }
  
  const config = typeConfig[fileType] || typeConfig.other
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatDate = (dateString) => {
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

  const handleDownload = async (document) => {
    try {
      const response = await api.downloadDocument(document.id)
      
      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = document.original_filename
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
      if (response.success && onDocumentUpdate) {
        onDocumentUpdate(response.data)
      }
    } catch (error) {
      console.error('Status update failed:', error)
      // You might want to show a toast notification here
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [documentId]: false }))
    }
  }

  const handleDeleteClick = (document) => {
    setDocumentToDelete(document)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return
    
    try {
      const response = await api.deleteDocument(documentToDelete.id)
      if (response.success && onDocumentDelete) {
        onDocumentDelete(documentToDelete.id)
      }
    } catch (error) {
      console.error('Delete failed:', error)
      // You might want to show a toast notification here
    } finally {
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
    }
  }

  if (!documents || documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
          <p className="text-gray-500">Upload your first quote, proposal, or contract to get started.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((document) => {
          const FileIcon = getFileIcon(document.mime_type, document.file_type)
          const isUpdating = updatingStatus[document.id]
          
          return (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    <FileIcon className="h-8 w-8 text-blue-500" />
                  </div>
                  
                  {/* Document Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {document.title}
                        </h4>
                        <p className="text-xs text-gray-500 truncate">
                          {document.original_filename}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {getFileTypeBadge(document.file_type)}
                          {getStatusBadge(document.status)}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(document)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {document.status === 'draft' && (
                            <DropdownMenuItem 
                              onClick={() => handleStatusUpdate(document.id, 'sent')}
                              disabled={isUpdating}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          
                          {document.status === 'sent' && (
                            <DropdownMenuItem 
                              onClick={() => handleStatusUpdate(document.id, 'viewed')}
                              disabled={isUpdating}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Mark as Viewed
                            </DropdownMenuItem>
                          )}
                          
                          {(document.status === 'viewed' || document.status === 'sent') && (
                            <>
                              <DropdownMenuItem 
                                onClick={() => handleStatusUpdate(document.id, 'signed')}
                                disabled={isUpdating}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark as Signed
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleStatusUpdate(document.id, 'rejected')}
                                disabled={isUpdating}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Mark as Rejected
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClick(document)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Document Details */}
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Size: {formatFileSize(document.file_size)}</span>
                        <span>Uploaded: {formatDate(document.uploaded_at)}</span>
                      </div>
                      
                      {document.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {document.description}
                        </p>
                      )}
                      
                      {document.user && (
                        <p className="text-xs text-gray-500">
                          Uploaded by: {document.user.full_name}
                        </p>
                      )}
                      
                      {/* Status Timestamps */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        {document.sent_at && (
                          <span>Sent: {formatDate(document.sent_at)}</span>
                        )}
                        {document.viewed_at && (
                          <span>Viewed: {formatDate(document.viewed_at)}</span>
                        )}
                        {document.signed_at && (
                          <span>Signed: {formatDate(document.signed_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Delete Confirmation Dialog */}
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

