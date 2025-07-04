"use client"

import { useState, useEffect } from "react"
import SignatureBuilder, { EmailSignature } from "./SignatureBuilder"
import { signatureAPI, handleAPIError } from "@/lib/api"

export const useEmailSignature = () => {
  const [signature, setSignature] = useState<EmailSignature | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load signature from API with proper error handling
  useEffect(() => {
    const loadSignature = async () => {
      try {
        setLoading(true)
        const apiSignature = await signatureAPI.get()
        if (apiSignature) {
          // Convert API signature to component signature
          const componentSignature: EmailSignature = {
            name: apiSignature.name || "",
            title: apiSignature.title || "",
            company: apiSignature.company || "",
            phone: apiSignature.phone || "",
            email: apiSignature.email || "",
            website: apiSignature.website || "",
            includeImage: false, // Not in API yet
            imageUrl: "", // Not in API yet
            custom_text: apiSignature.custom_text || "",
            enabled: apiSignature.enabled
          }
          setSignature(componentSignature)
        }
      } catch (error) {
        console.error('Failed to load email signature:', error)
        // Don't throw error - just fail silently to avoid logout loop
        // The signature will remain null and can be created later
      } finally {
        setLoading(false)
        setIsLoaded(true)
      }
    }

    loadSignature()
  }, [])

  // Save signature to API
  const saveSignature = async (newSignature: EmailSignature) => {
    try {
      setLoading(true)
      // Convert component signature to API signature
      const apiSignatureData = {
        name: newSignature.name,
        title: newSignature.title,
        company: newSignature.company,
        phone: newSignature.phone,
        email: newSignature.email,
        website: newSignature.website,
        custom_text: newSignature.custom_text,
        enabled: newSignature.enabled
      }
      
      await signatureAPI.createOrUpdate(apiSignatureData)
      setSignature(newSignature)
    } catch (error) {
      console.error('Failed to save email signature:', error)
      throw new Error(handleAPIError(error))
    } finally {
      setLoading(false)
    }
  }

  // Generate signature text for emails
  const getSignatureText = () => {
    if (!signature || !signature.enabled) return ""
    
    let signatureText = "\n\n---\n"
    
    if (signature.name) {
      signatureText += `${signature.name}\n`
    }
    
    if (signature.title) {
      signatureText += `${signature.title}\n`
    }
    
    if (signature.company) {
      signatureText += `${signature.company}\n`
    }
    
    if (signature.phone || signature.email) {
      signatureText += "\n"
      if (signature.phone) {
        signatureText += `📞 ${signature.phone}\n`
      }
      if (signature.email) {
        signatureText += `✉️ ${signature.email}\n`
      }
    }
    
    if (signature.website) {
      signatureText += `🌐 ${signature.website}\n`
    }
    
    if (signature.custom_text) {
      signatureText += `\n${signature.custom_text}\n`
    }
    
    return signatureText
  }

  return {
    signature,
    isLoaded,
    loading,
    saveSignature,
    getSignatureText
  }
}

interface SignatureManagerProps {
  children: React.ReactNode
}

export default function SignatureManager({ children }: SignatureManagerProps) {
  const [showSignatureBuilder, setShowSignatureBuilder] = useState(false)
  const { signature, saveSignature } = useEmailSignature()

  const handleSaveSignature = (newSignature: EmailSignature) => {
    saveSignature(newSignature)
    setShowSignatureBuilder(false)
  }

  return (
    <>
      {children}
      
      {/* Signature Builder Modal */}
      <SignatureBuilder
        isOpen={showSignatureBuilder}
        onClose={() => setShowSignatureBuilder(false)}
        onSave={handleSaveSignature}
        initialSignature={signature || undefined}
      />
    </>
  )
}