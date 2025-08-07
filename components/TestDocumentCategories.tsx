"use client"

import React, { useState } from 'react'
import { getAuthState } from '@/lib/auth'

export default function TestDocumentCategories() {
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
  const { token } = getAuthState()
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nohubspot-production.up.railway.app'

  const runTest = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${baseUrl}/api/document-categories/test`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      setTestResult(data)
    } catch (error) {
      setTestResult({ error: error.toString() })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Document Categories Test</h2>
      
      <button
        onClick={runTest}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Run Test'}
      </button>
      
      {testResult && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}