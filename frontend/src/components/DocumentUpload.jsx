import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Upload, 
  File, 
  X, 
  FileText, 
  Image, 
  FileSpreadsheet,
  Presentation,
  AlertCircle
} from 'lucide-react'
import { api } from '../lib/api'

const FILE_TYPE_OPTIONS = [
  { value: 'quote', label: 'Quote', icon: FileText },
  { value: 'proposal', label: 'Proposal', icon: FileText },
  { value: 'contract', label: 'Contract', icon: FileText },
  { value: 'presentation', label: 'Presentation', icon: Presentation },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'other', label: 'Other', icon: File }
]

const getFileIcon = (filename) => {
  const extension = filename.split('.').pop()?.toLowerCase()
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return Image
  } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return FileSpreadsheet
  } else if (['ppt', 'pptx'].includes(extension)) {
    return Presentation
  } else {
    return FileText
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function DocumentUpload({ contactId, onUploadSuccess, trigger }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fileType, setFileType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (file) => {
    setError('')
    
    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB')
      return
    }
    
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      setError('File type not supported. Please upload PDF, Word, Excel, PowerPoint, or image files.')
      return
    }
    
    setSelectedFile(file)
    
    // Auto-set title to filename without extension
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
    setTitle(nameWithoutExt)
    
    // Auto-detect file type
    if (file.type === 'application/pdf') {
      setFileType('proposal')
    } else if (file.type.includes('word')) {
      setFileType('quote')
    } else if (file.type.includes('sheet') || file.type.includes('excel')) {
      setFileType('quote')
    } else if (file.type.includes('presentation') || file.type.includes('powerpoint')) {
      setFileType('presentation')
    } else if (file.type.startsWith('image/')) {
      setFileType('image')
    } else {
      setFileType('other')
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file')
      return
    }
    
    if (!title.trim()) {
      setError('Please enter a title')
      return
    }
    
    if (!fileType) {
      setError('Please select a file type')
      return
    }
    
    setUploading(true)
    setError('')
    
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', title.trim())
      formData.append('description', description.trim())
      formData.append('file_type', fileType)
      
      const response = await api.uploadDocument(contactId, formData)
      
      if (response.success) {
        // Reset form
        setSelectedFile(null)
        setTitle('')
        setDescription('')
        setFileType('')
        setIsOpen(false)
        
        // Notify parent component
        if (onUploadSuccess) {
          onUploadSuccess(response.data)
        }
      }
    } catch (error) {
      setError(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setTitle('')
    setFileType('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const FileIcon = selectedFile ? getFileIcon(selectedFile.name) : File

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload quotes, proposals, contracts, or other documents for this contact.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>File</Label>
            {!selectedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-1">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="text-xs text-gray-500">
                  PDF, Word, Excel, PowerPoint, or image files up to 100MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv"
                />
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <FileIcon className="h-8 w-8 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeFile}
                      className="flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title"
            />
          </div>
          
          {/* File Type */}
          <div className="space-y-2">
            <Label>Document Type *</Label>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPE_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description or notes"
              rows={3}
            />
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

