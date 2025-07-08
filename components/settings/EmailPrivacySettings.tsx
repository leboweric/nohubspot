"use client"

import { useState, useEffect } from "react"
import { handleAPIError } from "@/lib/api"

interface EmailPrivacySettings {
  sync_only_crm_contacts: boolean
  excluded_domains: string[]
  excluded_keywords: string[]
  auto_create_contacts: boolean
}

export default function EmailPrivacySettings() {
  const [settings, setSettings] = useState<EmailPrivacySettings>({
    sync_only_crm_contacts: true,
    excluded_domains: [],
    excluded_keywords: [],
    auto_create_contacts: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [newKeyword, setNewKeyword] = useState("")

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email-privacy-settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to load privacy settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/email-privacy-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        alert('Privacy settings saved successfully')
      } else {
        const error = await response.json()
        alert(`Error: ${error.detail || 'Failed to save settings'}`)
      }
    } catch (error) {
      alert(`Error: ${handleAPIError(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const addDomain = () => {
    if (newDomain && !settings.excluded_domains.includes(newDomain)) {
      setSettings({
        ...settings,
        excluded_domains: [...settings.excluded_domains, newDomain]
      })
      setNewDomain("")
    }
  }

  const removeDomain = (domain: string) => {
    setSettings({
      ...settings,
      excluded_domains: settings.excluded_domains.filter(d => d !== domain)
    })
  }

  const addKeyword = () => {
    if (newKeyword && !settings.excluded_keywords.includes(newKeyword)) {
      setSettings({
        ...settings,
        excluded_keywords: [...settings.excluded_keywords, newKeyword]
      })
      setNewKeyword("")
    }
  }

  const removeKeyword = (keyword: string) => {
    setSettings({
      ...settings,
      excluded_keywords: settings.excluded_keywords.filter(k => k !== keyword)
    })
  }

  if (loading) {
    return <div className="animate-pulse">Loading privacy settings...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Email Privacy Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Control which emails are synced from Office 365 to NotHubSpot
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="sync_only_crm"
            checked={settings.sync_only_crm_contacts}
            onChange={(e) => setSettings({...settings, sync_only_crm_contacts: e.target.checked})}
            className="mt-1"
          />
          <div>
            <label htmlFor="sync_only_crm" className="font-medium">
              Only sync emails for existing CRM contacts
            </label>
            <p className="text-sm text-muted-foreground">
              When enabled, emails from people not in your CRM will be ignored
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="auto_create"
            checked={settings.auto_create_contacts}
            onChange={(e) => setSettings({...settings, auto_create_contacts: e.target.checked})}
            className="mt-1"
            disabled={!settings.sync_only_crm_contacts}
          />
          <div>
            <label htmlFor="auto_create" className="font-medium">
              Auto-create contacts from emails
            </label>
            <p className="text-sm text-muted-foreground">
              Automatically create new contacts when receiving emails from unknown senders
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-2">Excluded Domains</h4>
        <p className="text-sm text-muted-foreground mb-3">
          Emails from these domains will never be synced
        </p>
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addDomain()}
            placeholder="e.g., gmail.com"
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <button
            onClick={addDomain}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.excluded_domains.map(domain => (
            <span
              key={domain}
              className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center space-x-2"
            >
              <span>{domain}</span>
              <button
                onClick={() => removeDomain(domain)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-2">Excluded Keywords</h4>
        <p className="text-sm text-muted-foreground mb-3">
          Emails with these keywords in the subject will not be synced
        </p>
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="e.g., invoice, personal"
            className="flex-1 px-3 py-2 border rounded-md"
          />
          <button
            onClick={addKeyword}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {settings.excluded_keywords.map(keyword => (
            <span
              key={keyword}
              className="px-3 py-1 bg-gray-100 rounded-full text-sm flex items-center space-x-2"
            >
              <span>{keyword}</span>
              <button
                onClick={() => removeKeyword(keyword)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Privacy Settings'}
        </button>
      </div>
    </div>
  )
}