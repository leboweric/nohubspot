"use client"
import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { 
  timeTrackingAPI, projectAPI, handleAPIError,
  ProjectMemberRate, Project
} from "@/lib/api"
import { getAuthState } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { 
  DollarSign, Plus, Trash2, Edit2, Check, X, Users, 
  AlertCircle, Settings
} from "lucide-react"

// Time Tracking beta access - restricted to specific users
const TIME_TRACKING_ALLOWED_EMAILS = [
  'kharding@strategic-cc.com',
  'elebow@bmhmn.com',
  'elebow@strategic-cc.com',
  'eric@profitbuildernetwork.com',
  'eric.lebow@aiop.one',
  'leboweric@gmail.com',
]

interface OrgUser {
  id: number
  first_name: string
  last_name: string
  email: string
  role: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function RatesPage() {
  const router = useRouter()
  const { user } = getAuthState()

  useEffect(() => {
    if (user && !TIME_TRACKING_ALLOWED_EMAILS.includes(user.email?.toLowerCase())) {
      router.push('/dashboard')
    }
  }, [user, router])

  if (!user || !TIME_TRACKING_ALLOWED_EMAILS.includes(user.email?.toLowerCase())) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }
  const [rates, setRates] = useState<ProjectMemberRate[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // New rate form
  const [showForm, setShowForm] = useState(false)
  const [formProjectId, setFormProjectId] = useState<number | "">("")
  const [formUserId, setFormUserId] = useState<number | "">("")
  const [formRate, setFormRate] = useState("")

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editRate, setEditRate] = useState("")

  // Filter
  const [filterProjectId, setFilterProjectId] = useState<number | "">("")

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000)
      return () => clearTimeout(t)
    }
  }, [success])

  const loadData = async () => {
    try {
      setLoading(true)
      setError("")
      const [ratesData, projectsData] = await Promise.all([
        timeTrackingAPI.getRates(),
        projectAPI.getProjects({ limit: 200 }),
      ])
      setRates(ratesData)
      setProjects(projectsData)
      
      // Load org users from the users endpoint
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/users`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        })
        if (response.ok) {
          const usersData = await response.json()
          setOrgUsers(usersData)
        }
      } catch (e) {
        // Users endpoint might not be available for non-admins
      }
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRate = async () => {
    if (!formProjectId || !formUserId || !formRate) {
      setError("Please fill in all fields")
      return
    }
    try {
      setError("")
      const newRate = await timeTrackingAPI.createRate({
        project_id: formProjectId as number,
        user_id: formUserId as number,
        consultant_rate: parseFloat(formRate),
      })
      setRates(prev => [...prev, newRate])
      setShowForm(false)
      setFormProjectId("")
      setFormUserId("")
      setFormRate("")
      setSuccess("Rate created successfully")
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleUpdateRate = async (rateId: number) => {
    try {
      setError("")
      const updated = await timeTrackingAPI.updateRate(rateId, {
        consultant_rate: parseFloat(editRate),
      })
      setRates(prev => prev.map(r => r.id === rateId ? updated : r))
      setEditingId(null)
      setSuccess("Rate updated")
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleDeleteRate = async (rateId: number) => {
    if (!confirm("Delete this rate?")) return
    try {
      await timeTrackingAPI.deleteRate(rateId)
      setRates(prev => prev.filter(r => r.id !== rateId))
      setSuccess("Rate deleted")
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const filteredRates = filterProjectId
    ? rates.filter(r => r.project_id === filterProjectId)
    : rates

  // Group rates by project
  const ratesByProject: Record<number, ProjectMemberRate[]> = {}
  for (const rate of filteredRates) {
    if (!ratesByProject[rate.project_id]) ratesByProject[rate.project_id] = []
    ratesByProject[rate.project_id].push(rate)
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Consultant Rates</h1>
              <p className="text-sm text-gray-400 mt-1">
                Set pay rates per consultant per project for billing calculations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/time-tracking"
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                &larr; Back to Timer
              </a>
              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Rate
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-900/30 border border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">How Rates Work</p>
                <p className="text-blue-400">
                  Each project has a <strong>client billing rate</strong> (set on the project&apos;s hourly rate field) used for client invoicing.
                  Here you set the <strong>consultant pay rate</strong> for each team member on each project, used for consultant billing.
                  This dual-rate system lets you track both what you bill clients and what you pay consultants.
                </p>
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="mb-6">
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value ? parseInt(e.target.value) : "")}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm min-w-[250px]"
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.company_name ? `${p.company_name} — ` : ""}{p.title}
                </option>
              ))}
            </select>
          </div>

          {/* New Rate Form */}
          {showForm && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
              <h3 className="text-white font-medium mb-4">Add Consultant Rate</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Project</label>
                  <select
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.company_name ? `${p.company_name} — ` : ""}{p.title}
                        {p.hourly_rate ? ` (Client: $${p.hourly_rate}/hr)` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Consultant</label>
                  <select
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value ? parseInt(e.target.value) : "")}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select Consultant</option>
                    {orgUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Consultant Rate ($/hr)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    placeholder="65.00"
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                >
                  Save Rate
                </button>
              </div>
            </div>
          )}

          {/* Rates List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading rates...</div>
          ) : Object.keys(ratesByProject).length === 0 ? (
            <div className="text-center py-12">
              <Settings className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No rates configured</h3>
              <p className="text-gray-500 text-sm">Add consultant rates to enable billing calculations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(ratesByProject).map(([pid, projectRates]) => {
                const project = projects.find(p => p.id === parseInt(pid))
                return (
                  <div key={pid} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-white font-medium">
                            {project?.title || `Project #${pid}`}
                          </h3>
                          {project?.company_name && (
                            <span className="text-sm text-gray-500">{project.company_name}</span>
                          )}
                        </div>
                        {project?.hourly_rate && (
                          <span className="text-sm text-purple-400">
                            Client Rate: {formatCurrency(project.hourly_rate)}/hr
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-gray-700/50">
                      {projectRates.map(rate => (
                        <div key={rate.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Users className="w-4 h-4 text-gray-500" />
                            <span className="text-white text-sm">{rate.user_name || `User #${rate.user_id}`}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {editingId === rate.id ? (
                              <>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editRate}
                                  onChange={(e) => setEditRate(e.target.value)}
                                  className="w-24 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white text-sm text-right"
                                />
                                <button onClick={() => handleUpdateRate(rate.id)} className="p-1 text-green-400 hover:text-green-300">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:text-gray-300">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="text-green-400 font-mono text-sm">
                                  {formatCurrency(rate.consultant_rate)}/hr
                                </span>
                                <button
                                  onClick={() => { setEditingId(rate.id); setEditRate(rate.consultant_rate.toString()) }}
                                  className="p-1 text-gray-500 hover:text-white"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRate(rate.id)}
                                  className="p-1 text-gray-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
