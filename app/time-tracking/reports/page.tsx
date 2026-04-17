"use client"
import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { getAuthState } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { 
  timeTrackingAPI, handleAPIError, 
  ConsultantBillingEntry, ClientInvoiceEntry, TimeSummary 
} from "@/lib/api"
import { 
  FileText, Download, Calendar, Users, Building2, 
  DollarSign, Clock, BarChart3, ChevronDown, ChevronRight
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`
}

function getMonthRange(offset: number = 0): { start: string; end: string; label: string } {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const start = d.toISOString().split('T')[0]
  const endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const end = endDate.toISOString().split('T')[0]
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return { start, end, label }
}

export default function TimeTrackingReportsPage() {
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

  const [activeTab, setActiveTab] = useState<'summary' | 'consultant' | 'client'>('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Date range
  const currentMonth = getMonthRange(0)
  const [startDate, setStartDate] = useState(currentMonth.start)
  const [endDate, setEndDate] = useState(currentMonth.end)

  // Report data
  const [summary, setSummary] = useState<TimeSummary | null>(null)
  const [consultantData, setConsultantData] = useState<ConsultantBillingEntry[]>([])
  const [clientData, setClientData] = useState<ClientInvoiceEntry[]>([])

  // Expanded rows
  const [expandedConsultants, setExpandedConsultants] = useState<Set<number>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadReport()
  }, [activeTab, startDate, endDate])

  const loadReport = async () => {
    try {
      setLoading(true)
      setError("")
      
      if (activeTab === 'summary') {
        const data = await timeTrackingAPI.getSummary({ start_date: startDate, end_date: endDate })
        setSummary(data)
      } else if (activeTab === 'consultant') {
        const data = await timeTrackingAPI.getConsultantBillingReport({ start_date: startDate, end_date: endDate })
        setConsultantData(data)
      } else if (activeTab === 'client') {
        const data = await timeTrackingAPI.getClientInvoicingReport({ start_date: startDate, end_date: endDate })
        setClientData(data)
      }
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setLoading(false)
    }
  }

  const setQuickRange = (offset: number) => {
    const range = getMonthRange(offset)
    setStartDate(range.start)
    setEndDate(range.end)
  }

  const toggleConsultant = (userId: number) => {
    setExpandedConsultants(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleProject = (projectId: number) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const val = row[h]
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      }).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportConsultantReport = () => {
    const rows: any[] = []
    for (const consultant of consultantData) {
      for (const entry of consultant.entries) {
        rows.push({
          Consultant: consultant.user_name,
          Date: entry.date.split('T')[0],
          Project: entry.project,
          Description: entry.description,
          Hours: entry.hours,
          Rate: entry.rate,
          Amount: entry.amount
        })
      }
    }
    exportToCSV(rows, `consultant-billing-${startDate}-to-${endDate}.csv`)
  }

  const exportClientReport = () => {
    const rows: any[] = []
    for (const project of clientData) {
      for (const item of project.line_items) {
        rows.push({
          Client: project.company_name,
          Project: project.project_title,
          Consultant: item.consultant_name,
          Week: item.week_label,
          Description: item.description,
          Hours: item.hours,
          Rate: item.rate,
          Amount: item.amount
        })
      }
    }
    exportToCSV(rows, `client-invoicing-${startDate}-to-${endDate}.csv`)
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Time Tracking Reports</h1>
              <p className="text-sm text-gray-500 mt-1">
                {startDate} to {endDate}
              </p>
            </div>
            <a
              href="/time-tracking"
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              &larr; Back to Timer
            </a>
          </div>

          {/* Date Range Selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setQuickRange(0)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">This Month</button>
                <button onClick={() => setQuickRange(-1)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">Last Month</button>
                <button onClick={() => setQuickRange(-2)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">2 Months Ago</button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            {[
              { key: 'summary', label: 'Summary', icon: BarChart3 },
              { key: 'consultant', label: 'Consultant Billing', icon: Users },
              { key: 'client', label: 'Client Invoicing', icon: Building2 },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-12 text-gray-500">Loading report...</div>
          )}

          {/* Summary Tab */}
          {!loading && activeTab === 'summary' && summary && (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <Clock className="w-4 h-4" />
                    Total Hours
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{summary.total_hours}h</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <DollarSign className="w-4 h-4" />
                    Billable Hours
                  </div>
                  <p className="text-2xl font-bold text-green-600">{summary.billable_hours}h</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <FileText className="w-4 h-4" />
                    Entries
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{summary.entry_count}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <BarChart3 className="w-4 h-4" />
                    Billable %
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {summary.total_hours > 0 ? Math.round((summary.billable_hours / summary.total_hours) * 100) : 0}%
                  </p>
                </div>
              </div>

              {/* Project Breakdown */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
                <h3 className="text-gray-900 font-medium mb-4">By Project</h3>
                <div className="space-y-2">
                  {summary.project_breakdown.map((proj, i) => {
                    const hours = proj.total_seconds / 3600
                    const pct = summary.total_seconds > 0 ? (proj.total_seconds / summary.total_seconds) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{proj.project_title}</p>
                        </div>
                        <div className="w-32 bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-blue-500 rounded-full h-2" 
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-16 text-right">{hours.toFixed(1)}h</span>
                        <span className="text-xs text-gray-400 w-12 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Daily Breakdown */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-gray-900 font-medium mb-4">By Day</h3>
                <div className="space-y-1">
                  {summary.daily_breakdown.map((day, i) => {
                    const hours = day.total_seconds / 3600
                    const maxHours = Math.max(...summary.daily_breakdown.map(d => d.total_seconds / 3600))
                    const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24">{new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                          <div 
                            className="bg-green-500 rounded-full h-3" 
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-16 text-right">{hours.toFixed(1)}h</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Consultant Billing Tab */}
          {!loading && activeTab === 'consultant' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={exportConsultantReport}
                  disabled={consultantData.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {consultantData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No billable time entries found for this period.
                </div>
              ) : (
                <div className="space-y-4">
                  {consultantData.map(consultant => (
                    <div key={consultant.user_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Consultant header */}
                      <button
                        onClick={() => toggleConsultant(consultant.user_id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedConsultants.has(consultant.user_id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <Users className="w-5 h-5 text-blue-600" />
                          <span className="text-gray-900 font-medium">{consultant.user_name}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-sm text-gray-500">{formatHours(consultant.total_hours)}</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(consultant.total_amount)}</span>
                        </div>
                      </button>

                      {/* Expanded entries */}
                      {expandedConsultants.has(consultant.user_id) && (
                        <div className="border-t border-gray-200">
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-gray-500 uppercase bg-gray-50">
                                <th className="text-left px-4 py-2">Date</th>
                                <th className="text-left px-4 py-2">Project</th>
                                <th className="text-left px-4 py-2">Description</th>
                                <th className="text-right px-4 py-2">Hours</th>
                                <th className="text-right px-4 py-2">Rate</th>
                                <th className="text-right px-4 py-2">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consultant.entries.map((entry, i) => (
                                <tr key={i} className="border-t border-gray-100 text-sm">
                                  <td className="px-4 py-2 text-gray-500">{entry.date.split('T')[0]}</td>
                                  <td className="px-4 py-2 text-gray-900">{entry.project || '—'}</td>
                                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{entry.description || '—'}</td>
                                  <td className="px-4 py-2 text-right text-gray-500">{entry.hours.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(entry.rate)}</td>
                                  <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(entry.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Grand Total */}
                  <div className="bg-white border-2 border-blue-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <span className="text-gray-900 font-medium">Grand Total</span>
                    <div className="flex items-center gap-6">
                      <span className="text-gray-500">
                        {formatHours(consultantData.reduce((sum, c) => sum + c.total_hours, 0))}
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(consultantData.reduce((sum, c) => sum + c.total_amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Client Invoicing Tab */}
          {!loading && activeTab === 'client' && (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  onClick={exportClientReport}
                  disabled={clientData.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {clientData.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No billable time entries found for this period.
                </div>
              ) : (
                <div className="space-y-4">
                  {clientData.map(project => (
                    <div key={project.project_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Project header */}
                      <button
                        onClick={() => toggleProject(project.project_id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedProjects.has(project.project_id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <Building2 className="w-5 h-5 text-purple-600" />
                          <div className="text-left">
                            <span className="text-gray-900 font-medium">{project.project_title}</span>
                            {project.company_name && (
                              <span className="text-gray-400 text-sm ml-2">({project.company_name})</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-sm text-gray-500">{formatHours(project.total_hours)}</span>
                          <span className="text-xs text-gray-400">@ {formatCurrency(project.client_rate)}/hr</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(project.total_client_amount)}</span>
                        </div>
                      </button>

                      {/* Expanded line items (grouped by consultant + week) */}
                      {expandedProjects.has(project.project_id) && (
                        <div className="border-t border-gray-200">
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-gray-500 uppercase bg-gray-50">
                                <th className="text-left px-4 py-2">Consultant</th>
                                <th className="text-left px-4 py-2">Week</th>
                                <th className="text-left px-4 py-2">Description</th>
                                <th className="text-right px-4 py-2">Hours</th>
                                <th className="text-right px-4 py-2">Rate</th>
                                <th className="text-right px-4 py-2">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {project.line_items.map((item, i) => (
                                <tr key={i} className="border-t border-gray-100 text-sm">
                                  <td className="px-4 py-2 text-gray-900">{item.consultant_name}</td>
                                  <td className="px-4 py-2 text-gray-500">{item.week_label}</td>
                                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{item.description || '—'}</td>
                                  <td className="px-4 py-2 text-right text-gray-500">{item.hours.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-right text-gray-500">{formatCurrency(item.rate)}</td>
                                  <td className="px-4 py-2 text-right text-green-600 font-medium">{formatCurrency(item.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Grand Total */}
                  <div className="bg-white border-2 border-purple-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
                    <span className="text-gray-900 font-medium">Grand Total</span>
                    <div className="flex items-center gap-6">
                      <span className="text-gray-500">
                        {formatHours(clientData.reduce((sum, p) => sum + p.total_hours, 0))}
                      </span>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(clientData.reduce((sum, p) => sum + p.total_client_amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
