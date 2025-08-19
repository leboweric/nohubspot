"use client"

import React, { useState } from 'react'
import { X, Upload, Lock, Users, Globe, UserCheck, AlertTriangle } from 'lucide-react'
import { getAuthState } from '@/lib/auth'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (file: File, privacy: PrivacySettings) => Promise<void>
  companyId: number
  folderId?: number
  preselectedFile?: File | null
}

interface PrivacySettings {
  privacy_level: 'private' | 'team' | 'public' | 'restricted'
  is_confidential: boolean
  restricted_users?: number[]
}

export default function DocumentUploadModal({ 
  isOpen, 
  onClose, 
  onUpload,
  companyId,
  folderId,
  preselectedFile
}: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(preselectedFile || null)
  const [uploading, setUploading] = useState(false)
  const [privacyLevel, setPrivacyLevel] = useState<PrivacySettings['privacy_level']>('public')
  const [isConfidential, setIsConfidential] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  // Update file when preselectedFile changes
  React.useEffect(() => {
    if (preselectedFile) {
      setFile(preselectedFile)
    }
  }, [preselectedFile])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      await onUpload(file, {
        privacy_level: privacyLevel,
        is_confidential: isConfidential
      })
      
      // Reset form
      setFile(null)
      setPrivacyLevel('public')
      setIsConfidential(false)
      onClose()
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  const privacyOptions = [
    { 
      value: 'private' as const, 
      label: 'Private', 
      icon: Lock, 
      description: 'Only you can view this document',
      color: 'text-red-600'
    },
    { 
      value: 'team' as const, 
      label: 'Team', 
      icon: Users, 
      description: 'All team members can view',
      color: 'text-blue-600'
    },
    { 
      value: 'public' as const, 
      label: 'Public', 
      icon: Globe, 
      description: 'Everyone in organization can view',
      color: 'text-green-600'
    }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {preselectedFile ? 'Set Privacy for Dropped File' : 'Upload Document'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* File Drop Zone - only show if no file is preselected */}
          {!preselectedFile && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
            {file ? (
              <div className="space-y-2">
                <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Choose different file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 mx-auto text-gray-400" />
                <p className="text-gray-600">Drop file here or click to browse</p>
                <label className="inline-block">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    Select File
                  </span>
                </label>
              </div>
            )}
            </div>
          )}
          
          {/* Show file info if preselected */}
          {preselectedFile && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{preselectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(preselectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Settings */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Privacy Settings</h3>
            
            <div className="space-y-2">
              {privacyOptions.map((option) => {
                const Icon = option.icon
                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      privacyLevel === option.value 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="privacy"
                      value={option.value}
                      checked={privacyLevel === option.value}
                      onChange={(e) => setPrivacyLevel(e.target.value as PrivacySettings['privacy_level'])}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${option.color}`} />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Confidential/NDA Checkbox */}
            <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
              isConfidential ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span className="font-medium">Confidential / NDA</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Mark this document as containing confidential or NDA-protected information
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}