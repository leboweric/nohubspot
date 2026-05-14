"use client"

import { useState, useEffect } from "react"
import {
  Zap, Link2, Copy, Check, RefreshCw, Eye, EyeOff,
  ChevronDown, ChevronUp, BarChart2, AlertCircle, CheckCircle,
  ExternalLink, Database, Linkedin
} from "lucide-react"
import { leadSourceAPI, LeadSourceSettings, GeneratedApiKey, LeadImportLog } from "@/lib/api"

// ─── Small utility: copy-to-clipboard button ───────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
    </button>
  )
}

// ─── Stat pill ──────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
      <BarChart2 className="w-3 h-3" />
      {label}: <strong>{value}</strong>
    </span>
  )
}

// ─── Source badge ────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    clay: "bg-orange-100 text-orange-700",
    surfe: "bg-blue-100 text-blue-700",
    linkedin: "bg-sky-100 text-sky-700",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[source] ?? "bg-gray-100 text-gray-600"}`}>
      {source}
    </span>
  )
}

// ─── Action badge ─────────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string | null }) {
  const colors: Record<string, string> = {
    created: "bg-green-100 text-green-700",
    updated: "bg-yellow-100 text-yellow-700",
    skipped: "bg-gray-100 text-gray-500",
    error: "bg-red-100 text-red-700",
  }
  const a = action ?? "unknown"
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[a] ?? "bg-gray-100 text-gray-600"}`}>
      {a}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function LeadSourceIntegration() {
  const [settings, setSettings] = useState<LeadSourceSettings | null>(null)
  const [logs, setLogs] = useState<LeadImportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Generated keys (shown once after generation)
  const [newClayKey, setNewClayKey] = useState<GeneratedApiKey | null>(null)
  const [newLinkedInKey, setNewLinkedInKey] = useState<GeneratedApiKey | null>(null)
  const [newApolloKey, setNewApolloKey] = useState<GeneratedApiKey | null>(null)

  // Surfe API key input
  const [surfeKeyInput, setSurfeKeyInput] = useState("")
  const [showSurfeKey, setShowSurfeKey] = useState(false)

  // Log panel toggle
  const [showLogs, setShowLogs] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)

  // ── Load settings on mount ──────────────────────────────────
  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      setLoading(true)
      const data = await leadSourceAPI.getSettings()
      setSettings(data)
    } catch (e: any) {
      setError(e.message || "Failed to load lead source settings")
    } finally {
      setLoading(false)
    }
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      const data = await leadSourceAPI.getLogs(50)
      setLogs(data)
    } catch (e: any) {
      setError(e.message || "Failed to load import logs")
    } finally {
      setLogsLoading(false)
    }
  }

  // ── Toggle a source on/off ──────────────────────────────────
  async function toggleSource(source: "clay" | "surfe" | "linkedin" | "apollo", enabled: boolean) {
    if (!settings) return
    setSaving(true)
    setError("")
    try {
      const updated = await leadSourceAPI.updateSettings({ [`${source}_enabled`]: enabled })
      setSettings(updated)
      setSuccess(`${source.charAt(0).toUpperCase() + source.slice(1)} integration ${enabled ? "enabled" : "disabled"}`)
      setTimeout(() => setSuccess(""), 3000)
    } catch (e: any) {
      setError(e.message || "Failed to update settings")
    } finally {
      setSaving(false)
    }
  }

  // ── Generate a new API key ──────────────────────────────────
  async function generateKey(source: "clay" | "linkedin" | "apollo") {
    setSaving(true)
    setError("")
    try {
      const result = await leadSourceAPI.generateKey(source)
      if (source === "clay") setNewClayKey(result)
      else if (source === "apollo") setNewApolloKey(result)
      else setNewLinkedInKey(result)
      await loadSettings()
      setSuccess(`New ${source} API key generated. Copy it now — it won't be shown again.`)
    } catch (e: any) {
      setError(e.message || "Failed to generate key")
    } finally {
      setSaving(false)
    }
  }

  // ── Save Surfe API key ──────────────────────────────────────
  async function saveSurfeKey() {
    if (!surfeKeyInput.trim()) return
    setSaving(true)
    setError("")
    try {
      const updated = await leadSourceAPI.updateSettings({
        surfe_api_key: surfeKeyInput.trim(),
        surfe_enabled: true,
      })
      setSettings(updated)
      setSurfeKeyInput("")
      setSuccess("Surfe API key saved and integration enabled.")
      setTimeout(() => setSuccess(""), 3000)
    } catch (e: any) {
      setError(e.message || "Failed to save Surfe API key")
    } finally {
      setSaving(false)
    }
  }

  // ── Format date ─────────────────────────────────────────────
  function fmt(iso: string | null) {
    if (!iso) return "Never"
    return new Date(iso).toLocaleString()
  }

  if (loading) {
    return (
      <div className="bg-white border rounded-lg p-6 flex items-center justify-center gap-3 text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading lead source settings…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center gap-3 mb-1">
          <Database className="w-5 h-5 text-gray-600" />
          <h2 className="text-base font-semibold">Lead Source Integrations</h2>
        </div>
        <p className="text-sm text-gray-500 ml-8">
          Push enriched leads from Clay, Surfe, or LinkedIn Sales Navigator directly into your CRM.
          Each source uses a unique webhook URL secured by a Bearer API key.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* ── CLAY ─────────────────────────────────────────────── */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {/* Clay orange dot logo placeholder */}
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              C
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Clay</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${settings?.clay_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {settings?.clay_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Use Clay's HTTP API action to push enriched leads directly into your CRM.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatPill label="Imported" value={settings?.clay_total_imported ?? 0} />
                <StatPill label="Last import" value={fmt(settings?.clay_last_import_at ?? null)} />
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSource("clay", !settings?.clay_enabled)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings?.clay_enabled ? "bg-green-500" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.clay_enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Clay webhook credentials */}
        <div className="border-t bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Webhook Configuration</p>

          {/* Webhook URL */}
          {settings?.clay_webhook_url && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Webhook URL (paste into Clay HTTP API action)</label>
              <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
                <span className="flex-1">{settings.clay_webhook_url}</span>
                <CopyButton text={settings.clay_webhook_url} />
              </div>
            </div>
          )}

          {/* Newly generated key — shown once */}
          {newClayKey && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-semibold text-yellow-800 mb-1">⚠ Copy your API key now — it will not be shown again.</p>
              <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
                <span className="flex-1">{newClayKey.api_key}</span>
                <CopyButton text={newClayKey.api_key} />
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                In Clay, set the HTTP API action header: <code className="bg-yellow-100 px-1 rounded">Authorization: Bearer {newClayKey.api_key}</code>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => generateKey("clay")}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              {settings?.clay_webhook_url ? "Regenerate API Key" : "Generate API Key & Webhook URL"}
            </button>
            <a
              href="https://university.clay.com/docs/http-api-integration-overview"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Clay Docs
            </a>
          </div>

          {/* Clay field mapping guide */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">Clay field mapping guide</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1 border border-gray-200">Clay Column Name</th>
                    <th className="text-left px-2 py-1 border border-gray-200">CRM Field</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["first_name", "Contact First Name"],
                    ["last_name", "Contact Last Name"],
                    ["email", "Contact Email"],
                    ["phone", "Contact Phone"],
                    ["title", "Contact Job Title"],
                    ["linkedin_url", "Stored in Notes"],
                    ["company_name", "Company Name (auto-created)"],
                    ["company_domain / company_website", "Company Website"],
                    ["company_industry", "Company Industry"],
                    ["company_city / company_state", "Company Location"],
                  ].map(([clay, crm]) => (
                    <tr key={clay} className="border-b border-gray-100">
                      <td className="px-2 py-1 font-mono border border-gray-200">{clay}</td>
                      <td className="px-2 py-1 border border-gray-200">{crm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      {/* ── SURFE ────────────────────────────────────────────── */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow"
              style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Surfe</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${settings?.surfe_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {settings?.surfe_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Trigger Surfe's enrichment API from your CRM and receive results via webhook.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatPill label="Enriched" value={settings?.surfe_total_enriched ?? 0} />
                <StatPill label="Last enrichment" value={fmt(settings?.surfe_last_enrichment_at ?? null)} />
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSource("surfe", !settings?.surfe_enabled)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings?.surfe_enabled ? "bg-green-500" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.surfe_enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        <div className="border-t bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">API Key Configuration</p>

          {/* Surfe API key input */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Your Surfe API Key</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-1 bg-white border rounded px-3 py-2">
                <input
                  type={showSurfeKey ? "text" : "password"}
                  value={surfeKeyInput}
                  onChange={e => setSurfeKeyInput(e.target.value)}
                  placeholder="Paste your Surfe API key here…"
                  className="flex-1 text-xs outline-none bg-transparent"
                />
                <button onClick={() => setShowSurfeKey(!showSurfeKey)} className="text-gray-400 hover:text-gray-600">
                  {showSurfeKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={saveSurfeKey}
                disabled={saving || !surfeKeyInput.trim()}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Get your key from <a href="https://app.surfe.com/settings/api" target="_blank" rel="noopener noreferrer" className="underline">Surfe Settings → API Access</a>.
            </p>
          </div>

          {/* Webhook URL for Surfe */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Webhook URL (set as notificationOptions.webhookUrl in Surfe API calls)</label>
            <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
              <span className="flex-1">{`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/surfe/enrichment`}</span>
              <CopyButton text={`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/surfe/enrichment`} />
            </div>
          </div>

          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">How Surfe enrichment works</summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside text-gray-500">
              <li>A contact is created in your CRM (manually or via Clay/LinkedIn import).</li>
              <li>Your code calls <code className="bg-gray-100 px-1 rounded">POST /v2/people/enrich</code> on the Surfe API, passing the contact's name, company domain, and <strong>externalID = contact.id</strong>.</li>
              <li>Surfe finds the email and phone, then POSTs results to the webhook URL above.</li>
              <li>The CRM automatically updates the contact with the verified email and phone number.</li>
            </ol>
          </details>
        </div>
      </div>

      {/* ── LINKEDIN SALES NAVIGATOR ─────────────────────────── */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow"
              style={{ background: "linear-gradient(135deg, #0077b5, #005885)" }}>
              <Linkedin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">LinkedIn Sales Navigator</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${settings?.linkedin_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {settings?.linkedin_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Push LinkedIn profiles into your CRM via Zapier, Make, n8n, or a browser extension.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatPill label="Imported" value={settings?.linkedin_total_imported ?? 0} />
                <StatPill label="Last import" value={fmt(settings?.linkedin_last_import_at ?? null)} />
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSource("linkedin", !settings?.linkedin_enabled)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${settings?.linkedin_enabled ? "bg-green-500" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings?.linkedin_enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        <div className="border-t bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Webhook Configuration</p>

          {/* Webhook URL */}
          {settings?.linkedin_enabled && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Webhook URL (paste into Zapier / Make / n8n)</label>
              <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
                <span className="flex-1">{`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/linkedin/import`}</span>
                <CopyButton text={`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/linkedin/import`} />
              </div>
            </div>
          )}

          {/* Newly generated key */}
          {newLinkedInKey && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-semibold text-yellow-800 mb-1">⚠ Copy your API key now — it will not be shown again.</p>
              <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
                <span className="flex-1">{newLinkedInKey.api_key}</span>
                <CopyButton text={newLinkedInKey.api_key} />
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                In Zapier/Make, add the header: <code className="bg-yellow-100 px-1 rounded">Authorization: Bearer {newLinkedInKey.api_key}</code>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => generateKey("linkedin")}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              {settings?.linkedin_enabled ? "Regenerate API Key" : "Generate API Key & Enable"}
            </button>
          </div>

          {/* Integration options */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">Integration options</summary>
            <div className="mt-2 space-y-2">
              <div className="p-2 bg-white border rounded">
                <p className="font-medium text-gray-700">Option 1 — Zapier / Make / n8n (Recommended)</p>
                <p className="text-gray-500 mt-1">
                  Use LinkedIn Sales Navigator's native Zapier trigger "New Lead" or export a CSV, then map fields and POST to the webhook URL above with the Bearer token.
                </p>
              </div>
              <div className="p-2 bg-white border rounded">
                <p className="font-medium text-gray-700">Option 2 — Clay Pipeline</p>
                <p className="text-gray-500 mt-1">
                  Import your LinkedIn Sales Navigator list into Clay, enrich it, then use the Clay HTTP API action to push to the Clay webhook above. This gives you enriched emails + phones before they hit the CRM.
                </p>
              </div>
              <div className="p-2 bg-white border rounded">
                <p className="font-medium text-gray-700">Option 3 — Browser Extension (Advanced)</p>
                <p className="text-gray-500 mt-1">
                  A custom Tampermonkey or Chrome extension can add a "Save to CRM" button on LinkedIn profile pages, POSTing the visible profile data to the webhook URL.
                </p>
              </div>
            </div>
          </details>

          {/* Field mapping */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">LinkedIn field mapping guide</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1 border border-gray-200">LinkedIn / Zapier Field</th>
                    <th className="text-left px-2 py-1 border border-gray-200">CRM Field</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["first_name", "Contact First Name"],
                    ["last_name", "Contact Last Name"],
                    ["full_name", "Split into first + last automatically"],
                    ["email", "Contact Email"],
                    ["phone", "Contact Phone"],
                    ["title", "Contact Job Title"],
                    ["headline", "Stored in Notes"],
                    ["linkedin_url", "Stored in Notes"],
                    ["company_name", "Company Name (auto-created)"],
                    ["company_website", "Company Website"],
                    ["company_industry", "Company Industry"],
                    ["company_size", "Stored in Notes"],
                    ["location", "Stored in Notes"],
                    ["notes", "Contact Notes"],
                  ].map(([li, crm]) => (
                    <tr key={li} className="border-b border-gray-100">
                      <td className="px-2 py-1 font-mono border border-gray-200">{li}</td>
                      <td className="px-2 py-1 border border-gray-200">{crm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      {/* ── APOLLO.IO ─────────────────────────────────────────── */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
              A
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Apollo.io</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  settings?.apollo_enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {settings?.apollo_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Push contacts from Apollo sequences directly into your CRM via native webhooks or Zapier.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatPill label="Imported" value={settings?.apollo_total_imported ?? 0} />
                <StatPill label="Last import" value={fmt(settings?.apollo_last_import_at ?? null)} />
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleSource("apollo", !settings?.apollo_enabled)}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              settings?.apollo_enabled ? "bg-green-500" : "bg-gray-200"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              settings?.apollo_enabled ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>

        <div className="border-t bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Webhook Configuration</p>

          {/* Webhook URL */}
          {settings?.apollo_webhook_url && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Webhook URL (paste into Apollo → Settings → Integrations → Webhooks)</label>
              <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
                <span className="flex-1">{settings.apollo_webhook_url}</span>
                <CopyButton text={settings.apollo_webhook_url} />
              </div>
            </div>
          )}

          {/* Newly generated key — shown once */}
          {newApolloKey && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-semibold text-yellow-800 mb-1">⚠ Copy your API key now — it will not be shown again.</p>
              <div className="flex items-center gap-1 bg-white border rounded px-3 py-2 font-mono text-xs text-gray-700 break-all">
                <span className="flex-1">{newApolloKey.api_key}</span>
                <CopyButton text={newApolloKey.api_key} />
              </div>
              <p className="text-xs text-yellow-700 mt-2">
                In Apollo Webhooks, set the custom header: <code className="bg-yellow-100 px-1 rounded">Authorization: Bearer {newApolloKey.api_key}</code>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => generateKey("apollo")}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
              {settings?.apollo_webhook_url ? "Regenerate API Key" : "Generate API Key & Webhook URL"}
            </button>
            <a
              href="https://app.apollo.io/#/settings/integrations/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Apollo Webhooks
            </a>
          </div>

          {/* Apollo setup guide */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">Apollo setup guide</summary>
            <div className="mt-2 space-y-2">
              <div className="p-2 bg-white border rounded">
                <p className="font-medium text-gray-700">Option 1 — Apollo Native Webhooks (Recommended)</p>
                <ol className="mt-1 space-y-1 list-decimal list-inside text-gray-500">
                  <li>Generate your API key above and copy the Webhook URL.</li>
                  <li>In Apollo, go to <strong>Settings → Integrations → Webhooks</strong>.</li>
                  <li>Create a new webhook, paste the URL, and subscribe to <code className="bg-gray-100 px-1 rounded">contact.created</code>, <code className="bg-gray-100 px-1 rounded">contact.updated</code>, and <code className="bg-gray-100 px-1 rounded">contact.stage_changed</code>.</li>
                  <li>Add a custom header: <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;your_key&gt;</code>.</li>
                  <li>Contacts will flow into your CRM automatically as your salespeople work in Apollo.</li>
                </ol>
              </div>
              <div className="p-2 bg-white border rounded">
                <p className="font-medium text-gray-700">Option 2 — Zapier / Make Automation</p>
                <p className="text-gray-500 mt-1">
                  Use the Apollo Zapier trigger ("New Contact" or "Contact Stage Changed"), map fields, and POST to the webhook URL with the Authorization header. Useful if you want to filter by sequence, owner, or stage before importing.
                </p>
              </div>
              <div className="p-2 bg-white border rounded">
                <p className="font-medium text-gray-700">Option 3 — Clay Pipeline (Enrichment First)</p>
                <p className="text-gray-500 mt-1">
                  Export your Apollo contact list into Clay, run enrichment (verified emails, phones, LinkedIn), then use Clay's HTTP API action to push the enriched records to the Clay webhook above. Best for material handling prospects where data quality matters.
                </p>
              </div>
            </div>
          </details>

          {/* Field mapping */}
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">Apollo field mapping guide</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-2 py-1 border border-gray-200">Apollo Field</th>
                    <th className="text-left px-2 py-1 border border-gray-200">CRM Field</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["first_name", "Contact First Name"],
                    ["last_name", "Contact Last Name"],
                    ["email", "Contact Email"],
                    ["mobile_phone / phone", "Contact Phone (mobile preferred)"],
                    ["title", "Contact Job Title"],
                    ["linkedin_url", "Stored in Notes"],
                    ["organization_name / company_name", "Company Name (auto-created)"],
                    ["company_domain", "Company Website"],
                    ["company_industry", "Company Industry"],
                    ["seniority", "Stored in Notes"],
                    ["department", "Stored in Notes"],
                    ["stage", "Stored in Notes (Apollo sequence stage)"],
                    ["owner_email", "Stored in Notes (salesperson)"],
                    ["apollo_id", "Stored in Notes (for dedup reference)"],
                    ["city / state / country", "Stored in Notes"],
                    ["company_employee_count", "Stored in Notes"],
                  ].map(([apollo, crm]) => (
                    <tr key={apollo} className="border-b border-gray-100">
                      <td className="px-2 py-1 font-mono border border-gray-200">{apollo}</td>
                      <td className="px-2 py-1 border border-gray-200">{crm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      {/* ── IMPORT LOG ───────────────────────────────────────── */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setShowLogs(!showLogs)
            if (!showLogs && logs.length === 0) loadLogs()
          }}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm">Import Activity Log</span>
            <span className="text-xs text-gray-400">(last 50 events)</span>
          </div>
          {showLogs ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showLogs && (
          <div className="border-t">
            {logsLoading ? (
              <div className="p-4 flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading logs…
              </div>
            ) : logs.length === 0 ? (
              <div className="p-4 text-sm text-gray-400 text-center">No import activity yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Time</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Source</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Action</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Contact ID</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2"><SourceBadge source={log.source} /></td>
                        <td className="px-3 py-2"><ActionBadge action={log.action} /></td>
                        <td className="px-3 py-2 text-gray-500">{log.contact_id ?? "—"}</td>
                        <td className="px-3 py-2 text-red-500 max-w-xs truncate">{log.error_message ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
