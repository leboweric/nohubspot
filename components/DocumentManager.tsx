"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Folder, FolderOpen, File, Upload, Plus, MoreVertical, 
  Search, Filter, Download, Trash2, Edit2, X, Check,
  FileText, FileSpreadsheet, DollarSign, MessageSquare, 
  Settings, Presentation, ChevronRight, ChevronDown,
  Clock, Tag, AlertCircle, FolderPlus, Move
} from 'lucide-react'
import { getAuthState } from '@/lib/auth'
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DocumentFolder {
  id: number
  name: string
  description?: string
  parent_folder_id?: number
  folder_type: 'smart' | 'custom'
  category?: string
  color?: string
  icon?: string
  sort_order: number
  attachment_count?: number
  subfolders?: DocumentFolder[]
  created_at: string
  updated_at: string
}

interface Attachment {
  id: number
  name: string
  description?: string
  file_size?: number
  file_type?: string
  folder_id?: number
  tags?: string[]
  expiry_date?: string
  version?: number
  uploaded_by?: string
  created_at: string
}

interface DocumentCategory {
  id: number
  name: string
  slug: string
  color: string
  icon: string
  description?: string
}

interface DocumentManagerProps {
  companyId: number
}

// Icon mapping for categories
const CATEGORY_ICONS: { [key: string]: React.ElementType } = {
  FileText: FileText,
  FileSignature: FileText,
  DollarSign: DollarSign,
  MessageSquare: MessageSquare,
  Settings: Settings,
  Presentation: Presentation,
}

// Folder Tree Item Component
function FolderTreeItem({ 
  folder, 
  level = 0, 
  selectedFolderId, 
  onFolderSelect,
  onFolderEdit,
  onFolderDelete 
}: {
  folder: DocumentFolder
  level?: number
  selectedFolderId?: number | null
  onFolderSelect: (folder: DocumentFolder | null) => void
  onFolderEdit?: (folder: DocumentFolder) => void
  onFolderDelete?: (folderId: number) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const isSelected = selectedFolderId === folder.id
  
  const IconComponent = folder.icon ? CATEGORY_ICONS[folder.icon] || Folder : Folder

  return (
    <div>
      <div
        className={`
          flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer
          hover:bg-gray-100 group transition-colors
          ${isSelected ? 'bg-blue-50 text-blue-600' : ''}
        `}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onFolderSelect(folder)}
      >
        <div className="flex items-center flex-1">
          {folder.subfolders && folder.subfolders.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="mr-1"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          <IconComponent 
            className="w-4 h-4 mr-2" 
            style={{ color: folder.color || undefined }}
          />
          <span className="text-sm font-medium">{folder.name}</span>
          {folder.attachment_count !== undefined && folder.attachment_count > 0 && (
            <span className="ml-2 text-xs text-gray-500">({folder.attachment_count})</span>
          )}
        </div>
        
        {folder.folder_type === 'custom' && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border">
                <button
                  onClick={() => {
                    onFolderEdit?.(folder)
                    setShowMenu(false)
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Folder
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete folder "${folder.name}"? Files will be moved to parent folder.`)) {
                      onFolderDelete?.(folder.id)
                    }
                    setShowMenu(false)
                  }}
                  className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Folder
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {isExpanded && folder.subfolders && folder.subfolders.length > 0 && (
        <div>
          {folder.subfolders.map(subfolder => (
            <FolderTreeItem
              key={subfolder.id}
              folder={subfolder}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onFolderSelect={onFolderSelect}
              onFolderEdit={onFolderEdit}
              onFolderDelete={onFolderDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Draggable File Item Component
function FileItem({ 
  file, 
  onDownload, 
  onDelete, 
  onEdit 
}: { 
  file: Attachment
  onDownload: (file: Attachment) => void
  onDelete: (fileId: number) => void
  onEdit: (file: Attachment) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: file.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <File className="w-8 h-8 text-gray-400" />
    if (fileType.includes('pdf')) return <FileText className="w-8 h-8 text-red-500" />
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) 
      return <FileSpreadsheet className="w-8 h-8 text-green-500" />
    if (fileType.includes('presentation') || fileType.includes('powerpoint'))
      return <Presentation className="w-8 h-8 text-orange-500" />
    return <File className="w-8 h-8 text-gray-400" />
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-move group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getFileIcon(file.file_type)}
          <div className="flex-1">
            <h4 className="font-medium text-sm text-gray-900 truncate">{file.name}</h4>
            {file.description && (
              <p className="text-xs text-gray-600 mt-1">{file.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              <span>{formatFileSize(file.file_size)}</span>
              <span>{new Date(file.created_at).toLocaleDateString()}</span>
              {file.version && file.version > 1 && (
                <span className="text-blue-600">v{file.version}</span>
              )}
            </div>
            {file.tags && file.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {file.tags.map((tag, index) => (
                  <span key={index} className="px-2 py-0.5 bg-gray-100 text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {file.expiry_date && (
              <div className="flex items-center mt-2 text-xs text-orange-600">
                <AlertCircle className="w-3 h-3 mr-1" />
                Expires: {new Date(file.expiry_date).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
        
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-10 border">
              <button
                onClick={() => {
                  onDownload(file)
                  setShowMenu(false)
                }}
                className="flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </button>
              <button
                onClick={() => {
                  onEdit(file)
                  setShowMenu(false)
                }}
                className="flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Details
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${file.name}"?`)) {
                    onDelete(file.id)
                  }
                  setShowMenu(false)
                }}
                className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DocumentManager({ companyId }: DocumentManagerProps) {
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [selectedFolder, setSelectedFolder] = useState<DocumentFolder | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingFolders, setLoadingFolders] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [draggedFile, setDraggedFile] = useState<Attachment | null>(null)
  const [initialized, setInitialized] = useState(false)
  
  const { token } = getAuthState()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Load folders and categories on mount
  useEffect(() => {
    if (!initialized) {
      loadFolders()
      loadCategories()
      setInitialized(true)
    }
  }, [companyId])

  // Load attachments when folder changes
  useEffect(() => {
    if (initialized && !loadingFolders) {
      loadAttachments(selectedFolder?.id || null)
    }
  }, [selectedFolder, initialized])

  const loadFolders = async (skipInit = false) => {
    setLoadingFolders(true)
    try {
      const response = await fetch(`${baseUrl}/api/companies/${companyId}/folders`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Loaded folders:', data)
        setFolders(data)
        
        // Initialize default folders if none exist (only once)
        if (data.length === 0 && !skipInit) {
          console.log('No folders found, initializing defaults...')
          const initialized = await initializeDefaultFolders()
          // Only reload if initialization was successful
          if (initialized) {
            await loadFolders(true) // Skip init on reload to prevent loop
          }
        }
      } else {
        console.error('Failed to load folders, status:', response.status)
      }
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      setLoadingFolders(false)
    }
  }

  const loadCategories = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/document-categories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadAttachments = async (folderId: number | null) => {
    setLoadingFiles(true)
    try {
      const url = folderId 
        ? `${baseUrl}/api/folders/${folderId}/attachments`
        : `${baseUrl}/api/companies/${companyId}/attachments`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setAttachments(data)
      }
    } catch (error) {
      console.error('Failed to load attachments:', error)
    } finally {
      setLoadingFiles(false)
    }
  }

  const initializeDefaultFolders = async () => {
    try {
      console.log('Initializing default folders for company:', companyId)
      
      // First ensure categories exist
      const ensureResponse = await fetch(`${baseUrl}/api/document-categories/ensure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const ensureResult = await ensureResponse.json()
      console.log('Categories ensure response:', ensureResult)
      console.log('Response details:', {
        hasError: !!ensureResult.error,
        error: ensureResult.error,
        hasCategories: !!ensureResult.categories,
        categoriesLength: ensureResult.categories?.length,
        message: ensureResult.message
      })
      
      if (ensureResult.error) {
        console.error('Error ensuring categories:', ensureResult.error)
        
        // Check if it's a table not found error
        if (ensureResult.error.includes('not found') || ensureResult.error.includes('does not exist')) {
          alert('Document management tables are not set up. Please run the database migration:\n\nIn pgAdmin, run the SQL from backend/migrations/add_document_management.sql')
        } else {
          alert(`Failed to setup document categories: ${ensureResult.error}`)
        }
        return false
      }
      
      if (!ensureResult.categories || ensureResult.categories.length === 0) {
        console.error('No categories were created or found')
        console.log('Full response was:', JSON.stringify(ensureResult))
        alert(`No document categories found. Server message: ${ensureResult.message || 'Unknown error'}`)
        return false
      }
      
      // Now initialize folders
      const response = await fetch(`${baseUrl}/api/companies/${companyId}/folders/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      const result = await response.json()
      console.log('Initialize folders response:', result)
      
      if (result.error) {
        console.error('Error creating folders:', result.error)
        
        // If folders already exist, that's ok
        if (result.error.includes('already exist')) {
          console.log('Folders already exist for this company')
          return true
        }
        
        alert(`Failed to create folders: ${result.error}`)
        return false
      }
      
      // Check if folders were actually created
      if (result.folders && result.folders.length > 0) {
        console.log('Successfully created', result.folders.length, 'folders')
        return true
      } else {
        console.warn('No folders were created but no error was returned')
        console.log('Full response:', result)
        
        // If no folders were created but also no error, it might mean they already exist
        if (result.message && result.message.includes('0 default folders')) {
          // Try to reload to check if folders exist
          return false
        }
        
        return false
      }
    } catch (error) {
      console.error('Failed to initialize folders:', error)
      alert(`Failed to initialize folders: ${error}`)
      return false
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    if (selectedFolder) {
      formData.append('folder_id', selectedFolder.id.toString())
    }

    try {
      const response = await fetch(`${baseUrl}/api/companies/${companyId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        await loadAttachments(selectedFolder?.id || null)
        await loadFolders() // Refresh folder counts
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      const response = await fetch(`${baseUrl}/api/companies/${companyId}/folders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_id: companyId,
          name: newFolderName,
          parent_folder_id: selectedFolder?.id,
          folder_type: 'custom'
        })
      })

      if (response.ok) {
        await loadFolders()
        setShowNewFolderDialog(false)
        setNewFolderName('')
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleDeleteFolder = async (folderId: number) => {
    try {
      const response = await fetch(`${baseUrl}/api/folders/${folderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await loadFolders()
        if (selectedFolder?.id === folderId) {
          setSelectedFolder(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    try {
      const response = await fetch(`${baseUrl}/api/attachments/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await loadAttachments(selectedFolder?.id || null)
        await loadFolders() // Refresh folder counts
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const handleDownloadFile = async (file: Attachment) => {
    try {
      const response = await fetch(`${baseUrl}/api/attachments/${file.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download file:', error)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const fileId = event.active.id as number
    const file = attachments.find(a => a.id === fileId)
    setDraggedFile(file || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedFile(null)

    if (!over || !active) return

    const fileId = active.id as number
    const targetFolderId = over.id as number

    // Find if we're dropping on a folder
    const targetFolder = folders.find(f => f.id === targetFolderId)
    if (!targetFolder) return

    try {
      const response = await fetch(`${baseUrl}/api/attachments/${fileId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attachment_id: fileId,
          folder_id: targetFolderId
        })
      })

      if (response.ok) {
        await loadAttachments(selectedFolder?.id || null)
        await loadFolders() // Refresh folder counts
      }
    } catch (error) {
      console.error('Failed to move file:', error)
    }
  }

  const filteredAttachments = attachments.filter(file =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[600px] bg-white rounded-lg border">
        {/* Sidebar - Folder Tree */}
        <div className="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
          <div className="mb-4 space-y-2">
            <button
              onClick={() => setShowNewFolderDialog(true)}
              className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </button>
            
            {folders.length === 0 && (
              <button
                onClick={initializeDefaultFolders}
                className="w-full flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
              >
                Initialize Smart Folders
              </button>
            )}
          </div>

          <div className="space-y-1">
            <div
              className={`
                flex items-center px-2 py-1.5 rounded-md cursor-pointer
                hover:bg-gray-100 ${!selectedFolder ? 'bg-blue-50 text-blue-600' : ''}
              `}
              onClick={() => setSelectedFolder(null)}
            >
              <Folder className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">All Files</span>
            </div>

            {folders.map(folder => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                selectedFolderId={selectedFolder?.id}
                onFolderSelect={setSelectedFolder}
                onFolderDelete={handleDeleteFolder}
              />
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {selectedFolder ? selectedFolder.name : 'All Documents'}
              </h2>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer flex items-center">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Files Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {loadingFiles ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading files...</div>
              </div>
            ) : filteredAttachments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Folder className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No documents found</p>
                <p className="text-sm mt-1">Upload files or adjust your search</p>
              </div>
            ) : (
              <SortableContext
                items={filteredAttachments.map(a => a.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAttachments.map(file => (
                    <FileItem
                      key={file.id}
                      file={file}
                      onDownload={handleDownloadFile}
                      onDelete={handleDeleteFile}
                      onEdit={() => {}}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </div>
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowNewFolderDialog(false)
                  setNewFolderName('')
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <DragOverlay>
        {draggedFile ? (
          <div className="bg-white border rounded-lg p-4 shadow-lg opacity-80">
            <div className="flex items-center space-x-2">
              <File className="w-6 h-6 text-gray-400" />
              <span className="text-sm font-medium">{draggedFile.name}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}