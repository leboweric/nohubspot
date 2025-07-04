"use client"

import { useState, useEffect } from "react"
import SignatureBuilder, { EmailSignature } from "./SignatureBuilder"
import { signatureAPI, handleAPIError } from "@/lib/api"

export const useEmailSignature = () => {
  const [signature, setSignature] = useState<EmailSignature | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Test API connectivity
  const testAPIConnection = async () => {
    try {
      console.log("🔍 Testing API connection to:", process.env.NEXT_PUBLIC_API_URL);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      console.log("✅ API Health Check:", response.status);
      const data = await response.json();
      console.log("✅ Health Data:", data);
    } catch (error) {
      console.error("❌ API Connection Failed:", error);
      console.error("❌ API URL was:", process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
    }
  };

  // Load signature from API with proper error handling
  useEffect(() => {
    // Test API connectivity first
    testAPIConnection();
    const loadSignature = async () => {
      try {
        setLoading(true)
        const apiSignature = await signatureAPI.get()
        console.log('API signature response:', apiSignature)
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
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: typeof error,
          error
        })
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
    // DEBUG: Check API configuration
    console.log("🔍 DEBUG - API Base URL:", process.env.NEXT_PUBLIC_API_URL);
    console.log("🔍 DEBUG - Full API URL:", `${process.env.NEXT_PUBLIC_API_URL}/api/signature`);
    console.log("🔍 DEBUG - Environment:", process.env.NODE_ENV);
    
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
      
      const result = await signatureAPI.createOrUpdate(apiSignatureData)
      console.log('Signature save result:', result)
      setSignature(newSignature)
    } catch (error) {
      console.error('Failed to save email signature:', error)
      
      // Provide more helpful error messages
      let errorMessage = handleAPIError(error)
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.'
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error occurred. Please try again in a moment.'
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.'
      }
      
      throw new Error(errorMessage)
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