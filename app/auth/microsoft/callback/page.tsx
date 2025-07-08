"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { o365IntegrationAPI, handleAPIError } from "@/lib/api"

export default function MicrosoftCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        setStatus('error')
        setMessage(errorDescription || error)
        return
      }

      if (!code) {
        setStatus('error')
        setMessage('No authorization code received')
        return
      }

      try {
        const result = await o365IntegrationAPI.handleCallback(code, state || undefined)
        
        if (result.success) {
          setStatus('success')
          setMessage(`Connected to Office 365 as ${result.email}`)
          
          // Close popup and notify parent window
          if (window.opener) {
            window.opener.postMessage({ type: 'o365-connected', email: result.email }, '*')
            setTimeout(() => window.close(), 2000)
          } else {
            // Redirect if not in popup
            setTimeout(() => router.push('/settings'), 2000)
          }
        } else {
          setStatus('error')
          setMessage(result.message || 'Failed to connect')
        }
      } catch (error) {
        setStatus('error')
        setMessage(handleAPIError(error))
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-6 text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold mb-2">Connecting to Office 365...</h2>
            <p className="text-sm text-muted-foreground">Please wait while we complete the connection</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Successfully Connected!</h2>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <p className="text-xs text-muted-foreground">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Connection Failed</h2>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  )
}