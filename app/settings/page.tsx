"use client"

import { useState } from "react"
import SignatureBuilder, { EmailSignature } from "@/components/signature/SignatureBuilder"
import { useEmailSignature } from "@/components/signature/SignatureManager"

export default function SettingsPage() {
  const [showSignatureBuilder, setShowSignatureBuilder] = useState(false)
  const { signature, saveSignature } = useEmailSignature()

  const handleSaveSignature = (newSignature: EmailSignature) => {
    saveSignature(newSignature)
    setShowSignatureBuilder(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your CRM preferences and configurations</p>
      </div>

      <div className="space-y-6">
        {/* Email Signature Section */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">Email Signature</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your email signature that will be automatically added to all outgoing emails
              </p>
            </div>
            <button
              onClick={() => setShowSignatureBuilder(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {signature ? 'Edit Signature' : 'Create Signature'}
            </button>
          </div>

          {signature && signature.enabled ? (
            <div>
              <h3 className="text-sm font-medium mb-2">Current Signature Preview:</h3>
              <div className="bg-muted p-4 rounded-md">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {(() => {
                    let preview = ""
                    if (signature.name) preview += `${signature.name}\n`
                    if (signature.title) preview += `${signature.title}\n`
                    if (signature.company) preview += `${signature.company}\n`
                    if (signature.phone || signature.email) {
                      preview += "\n"
                      if (signature.phone) preview += `📞 ${signature.phone}\n`
                      if (signature.email) preview += `✉️ ${signature.email}\n`
                    }
                    if (signature.website) preview += `🌐 ${signature.website}\n`
                    if (signature.customText) preview += `\n${signature.customText}\n`
                    return preview || "No signature configured"
                  })()}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              {signature ? 'Email signature is disabled' : 'No email signature configured'}
            </div>
          )}
        </div>

        {/* Email Settings Section */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Email Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Default Sender Name</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {process.env.NEXT_PUBLIC_DEFAULT_SENDER_NAME || 'Sales Rep'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure this in your environment variables
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Default Sender Email</label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {process.env.NEXT_PUBLIC_DEFAULT_SENDER_EMAIL || 'sales@company.com'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Configure this in your environment variables
              </p>
            </div>
          </div>
        </div>

        {/* System Settings Section */}
        <div className="bg-card border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">System Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data Storage</label>
              <div className="text-sm text-muted-foreground">
                Currently using browser localStorage for data persistence. In production, this would connect to your backend database.
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email Provider</label>
              <div className="text-sm text-muted-foreground">
                SendGrid integration configured for email sending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Builder Modal */}
      <SignatureBuilder
        isOpen={showSignatureBuilder}
        onClose={() => setShowSignatureBuilder(false)}
        onSave={handleSaveSignature}
        initialSignature={signature || undefined}
      />
    </div>
  )
}