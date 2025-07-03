"use client"

import { useState, useEffect } from "react"

import { EmailSignature as APIEmailSignature } from "@/lib/api"

export interface EmailSignature {
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  website?: string
  includeImage?: boolean
  imageUrl?: string
  custom_text?: string
  enabled: boolean
}

interface SignatureBuilderProps {
  isOpen: boolean
  onClose: () => void
  onSave: (signature: EmailSignature) => void
  initialSignature?: EmailSignature
}

const defaultSignature: EmailSignature = {
  name: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
  includeImage: false,
  imageUrl: "",
  custom_text: "",
  enabled: true
}

export default function SignatureBuilder({ isOpen, onClose, onSave, initialSignature }: SignatureBuilderProps) {
  const [signature, setSignature] = useState<EmailSignature>(initialSignature || defaultSignature)

  useEffect(() => {
    if (initialSignature) {
      setSignature(initialSignature)
    }
  }, [initialSignature])

  const handleChange = (field: keyof EmailSignature, value: string | boolean) => {
    setSignature(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    onSave(signature)
    onClose()
  }

  const generateSignaturePreview = () => {
    if (!signature.enabled) return ""
    
    let signatureHTML = "\n\n---\n"
    
    if (signature.name) {
      signatureHTML += `${signature.name}\n`
    }
    
    if (signature.title) {
      signatureHTML += `${signature.title}\n`
    }
    
    if (signature.company) {
      signatureHTML += `${signature.company}\n`
    }
    
    if (signature.phone || signature.email) {
      signatureHTML += "\n"
      if (signature.phone) {
        signatureHTML += `📞 ${signature.phone}\n`
      }
      if (signature.email) {
        signatureHTML += `✉️ ${signature.email}\n`
      }
    }
    
    if (signature.website) {
      signatureHTML += `🌐 ${signature.website}\n`
    }
    
    if (signature.custom_text) {
      signatureHTML += `\n${signature.custom_text}\n`
    }
    
    return signatureHTML
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Email Signature Builder</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
          {/* Form */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="enabled"
                checked={signature.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="rounded"
              />
              <label htmlFor="enabled" className="text-sm font-medium">
                Enable email signature
              </label>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                value={signature.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">
                Job Title
              </label>
              <input
                type="text"
                id="title"
                value={signature.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Sales Manager"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium mb-1">
                Company
              </label>
              <input
                type="text"
                id="company"
                value={signature.company}
                onChange={(e) => handleChange('company', e.target.value)}
                placeholder="NotHubSpot CRM"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={signature.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={signature.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john@company.com"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium mb-1">
                Website
              </label>
              <input
                type="url"
                id="website"
                value={signature.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://company.com"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="custom_text" className="block text-sm font-medium mb-1">
                Custom Text
              </label>
              <textarea
                id="custom_text"
                value={signature.custom_text}
                onChange={(e) => handleChange('custom_text', e.target.value)}
                placeholder="Additional text, quotes, disclaimers..."
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Preview</h3>
            <div className="bg-muted p-4 rounded-md min-h-[300px]">
              {signature.enabled ? (
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {generateSignaturePreview() || "Your signature will appear here..."}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Signature is disabled. Enable it to see the preview.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Save Signature
          </button>
        </div>
      </div>
    </div>
  )
}