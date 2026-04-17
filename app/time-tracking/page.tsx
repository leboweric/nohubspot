"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { getAuthState } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { 
  timeTrackingAPI, projectAPI, handleAPIError, 
  TimeEntry, Project, TimerStartRequest 
} from "@/lib/api"
import { 
  Play, Square, Clock, Plus, Trash2, Edit2, Check, X,
  ChevronDown, ChevronRight, DollarSign, MoreVertical, Search
} from "lucide-react"

// ── Helpers ──────────────────────────────────────────────────────────────────

// Project colors (Toggl-style palette)
const PROJECT_COLORS = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C',
  '#3498DB', '#9B59B6', '#E91E63', '#00BCD4', '#8BC34A',
  '#FF9800', '#795548', '#607D8B', '#FF5722', '#673AB7',
  '#009688', '#CDDC39', '#FFC107', '#03A9F4', '#4CAF50',
]

function getProjectColor(projectId: number): string {
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length]
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatDurationHM(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatTime12(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const entryDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`
}

function groupEntriesByDate(entries: TimeEntry[]): { label: string; key: string; entries: TimeEntry[]; totalSeconds: number }[] {
  const groups: Record<string, { label: string; entries: TimeEntry[] }> = {}
  for (const entry of entries) {
    const key = getDateKey(entry.start_time)
    if (!groups[key]) {
      groups[key] = { label: getDateLabel(entry.start_time), entries: [] }
    }
    groups[key].entries.push(entry)
  }
  // Sort by date descending
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, group]) => ({
      key,
      label: group.label,
      entries: group.entries,
      totalSeconds: group.entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0),
    }))
}

// Calculate week total (Mon-Sun containing today)
function getWeekTotal(entries: TimeEntry[]): number {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
  
  return entries
    .filter(e => {
      const d = new Date(e.start_time)
      return d >= monday && d <= new Date(sunday.getTime() + 24 * 60 * 60 * 1000)
    })
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
}

// Time Tracking beta access - restricted to specific users
const TIME_TRACKING_ALLOWED_EMAILS = [
  'kharding@strategic-cc.com',
  'elebow@bmhmn.com',
  'elebow@strategic-cc.com',
  'eric@profitbuildernetwork.com',
  'eric.lebow@aiop.one',
  'leboweric@gmail.com',
]

// ── Project Selector Dropdown (Toggl-style) ─────────────────────────────────

function ProjectSelector({ 
  projects, 
  selectedProjectId, 
  onSelect,
  compact = false 
}: { 
  projects: Project[]
  selectedProjectId?: number
  onSelect: (projectId?: number) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return p.title.toLowerCase().includes(q) || (p.company_name || '').toLowerCase().includes(q)
  })

  // Group by client
  const byClient: Record<string, Project[]> = {}
  for (const p of filtered) {
    const client = p.company_name || 'No Client'
    if (!byClient[client]) byClient[client] = []
    byClient[client].push(p)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-lg transition-colors text-left ${
          compact 
            ? 'px-2 py-1 text-xs hover:bg-gray-700/50 max-w-[280px]' 
            : 'px-3 py-2.5 bg-gray-800/50 border border-gray-700 hover:border-gray-600 text-sm min-w-[200px]'
        }`}
      >
        {selectedProject ? (
          <>
            <span 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
              style={{ backgroundColor: getProjectColor(selectedProject.id) }}
            />
            <span className={`truncate ${compact ? 'text-gray-200' : 'text-white'}`}>
              {selectedProject.title}
            </span>
            {!compact && selectedProject.company_name && (
              <span className="text-gray-500 text-xs truncate ml-1">
                {selectedProject.company_name}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-500">{compact ? '+ Project' : 'Add a project'}</span>
        )}
        <ChevronDown className={`w-3 h-3 text-gray-500 flex-shrink-0 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-700">
            <div className="flex items-center gap-2 bg-gray-900 rounded px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find project..."
                className="bg-transparent text-white text-sm flex-1 outline-none placeholder-gray-500"
                autoFocus
              />
            </div>
          </div>
          {/* Options */}
          <div className="overflow-y-auto max-h-60">
            {/* No project option */}
            <button
              onClick={() => { onSelect(undefined); setOpen(false); setSearch("") }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-700/50 transition-colors"
            >
              No project
            </button>
            {Object.entries(byClient).sort(([a], [b]) => a.localeCompare(b)).map(([client, clientProjects]) => (
              <div key={client}>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800/80 sticky top-0">
                  {client}
                </div>
                {clientProjects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onSelect(p.id); setOpen(false); setSearch("") }}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-700/50 transition-colors ${
                      p.id === selectedProjectId ? 'bg-gray-700/30' : ''
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: getProjectColor(p.id) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{p.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TimeTrackingPage() {
  const router = useRouter()
  const { user } = getAuthState()

  // Redirect unauthorized users
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

  // Timer state
  const [currentTimer, setCurrentTimer] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)

  // Entry list state
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Projects for dropdown
  const [projects, setProjects] = useState<Project[]>([])

  // Timer form state
  const [timerDescription, setTimerDescription] = useState("")
  const [timerProjectId, setTimerProjectId] = useState<number | undefined>(undefined)
  const [timerBillable, setTimerBillable] = useState(true)

  // Manual mode toggle
  const [manualMode, setManualMode] = useState(false)
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualStartTime, setManualStartTime] = useState("09:00")
  const [manualEndTime, setManualEndTime] = useState("10:00")

  // Edit state
  const [editingEntry, setEditingEntry] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState("")
  const [editProjectId, setEditProjectId] = useState<number | undefined>(undefined)

  // Expanded day groups
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  // Timer tick effect
  useEffect(() => {
    if (currentTimer?.is_running) {
      const startTime = new Date(currentTimer.start_time).getTime()
      const updateElapsed = () => {
        const now = Date.now()
        setElapsedSeconds(Math.floor((now - startTime) / 1000))
      }
      updateElapsed()
      timerInterval.current = setInterval(updateElapsed, 1000)
      return () => {
        if (timerInterval.current) clearInterval(timerInterval.current)
      }
    } else {
      setElapsedSeconds(0)
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [currentTimer])

  // Auto-clear messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000)
      return () => clearTimeout(t)
    }
  }, [success])
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000)
      return () => clearTimeout(t)
    }
  }, [error])

  const loadData = async () => {
    try {
      setLoading(true)
      setError("")
      const [timerData, entriesData, projectsData] = await Promise.all([
        timeTrackingAPI.getCurrentTimer(),
        timeTrackingAPI.getEntries({ limit: 200 }),
        projectAPI.getProjects({ limit: 500 })
      ])
      setCurrentTimer(timerData)
      setEntries(entriesData.filter(e => !e.is_running))
      setProjects(projectsData)
      
      if (timerData) {
        setTimerDescription(timerData.description || "")
        setTimerProjectId(timerData.project_id || undefined)
        setTimerBillable(timerData.is_billable)
      }
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleStartTimer = async (desc?: string, projId?: number, billable?: boolean) => {
    try {
      setError("")
      const data: TimerStartRequest = {
        project_id: projId !== undefined ? projId : timerProjectId,
        description: desc !== undefined ? desc : timerDescription || undefined,
        is_billable: billable !== undefined ? billable : timerBillable,
      }
      const entry = await timeTrackingAPI.startTimer(data)
      setCurrentTimer(entry)
      if (desc !== undefined) setTimerDescription(desc)
      if (projId !== undefined) setTimerProjectId(projId)
      if (billable !== undefined) setTimerBillable(billable)
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleStopTimer = async () => {
    try {
      setError("")
      const entry = await timeTrackingAPI.stopTimer()
      setCurrentTimer(null)
      setTimerDescription("")
      setTimerProjectId(undefined)
      setTimerBillable(true)
      setEntries(prev => [entry, ...prev])
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleCreateManualEntry = async () => {
    try {
      setError("")
      const startDateTime = `${manualDate}T${manualStartTime}:00`
      const endDateTime = `${manualDate}T${manualEndTime}:00`
      
      const entry = await timeTrackingAPI.createEntry({
        start_time: new Date(startDateTime).toISOString(),
        end_time: new Date(endDateTime).toISOString(),
        project_id: timerProjectId || undefined,
        description: timerDescription || undefined,
        is_billable: timerBillable,
      })
      setEntries(prev => [entry, ...prev])
      setTimerDescription("")
      setTimerProjectId(undefined)
      setSuccess("Time entry added")
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm("Delete this time entry?")) return
    try {
      await timeTrackingAPI.deleteEntry(entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleUpdateEntry = async (entryId: number) => {
    try {
      const updated = await timeTrackingAPI.updateEntry(entryId, {
        description: editDescription || undefined,
        project_id: editProjectId || undefined,
      })
      setEntries(prev => prev.map(e => e.id === entryId ? updated : e))
      setEditingEntry(null)
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleResumeEntry = async (entry: TimeEntry) => {
    await handleStartTimer(entry.description || "", entry.project_id || undefined, entry.is_billable)
  }

  const toggleDayCollapse = (key: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groupedDays = groupEntriesByDate(entries)
  const todayKey = getDateKey(new Date().toISOString())
  const todayTotal = (groupedDays.find(g => g.key === todayKey)?.totalSeconds || 0) 
    + (currentTimer?.is_running ? elapsedSeconds : 0)
  const weekTotal = getWeekTotal(entries) + (currentTimer?.is_running ? elapsedSeconds : 0)

  const getProjectForEntry = (entry: TimeEntry) => projects.find(p => p.id === entry.project_id)

  return (
    <AuthGuard>
      <MainLayout>
        <div className="min-h-screen bg-gray-950">
          {/* ── Timer Bar (Toggl-style, fixed at top of content) ── */}
          <div className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800 shadow-lg">
            <div className="max-w-full px-4 sm:px-6">
              <div className="flex items-center gap-3 h-16">
                {/* Description input */}
                <input
                  type="text"
                  value={timerDescription}
                  onChange={(e) => {
                    setTimerDescription(e.target.value)
                    if (currentTimer?.is_running) {
                      timeTrackingAPI.updateEntry(currentTimer.id, { description: e.target.value })
                    }
                  }}
                  placeholder="What are you working on?"
                  className="flex-1 bg-transparent text-white text-base placeholder-gray-500 focus:outline-none border-none min-w-0"
                />
                
                {/* Project selector */}
                <ProjectSelector
                  projects={projects}
                  selectedProjectId={timerProjectId}
                  onSelect={(id) => {
                    setTimerProjectId(id)
                    if (currentTimer?.is_running) {
                      timeTrackingAPI.updateEntry(currentTimer.id, { project_id: id || null } as any)
                    }
                  }}
                />

                {/* Billable toggle */}
                <button
                  onClick={() => {
                    const next = !timerBillable
                    setTimerBillable(next)
                    if (currentTimer?.is_running) {
                      timeTrackingAPI.updateEntry(currentTimer.id, { is_billable: next } as any)
                    }
                  }}
                  className={`flex items-center justify-center w-8 h-8 rounded transition-colors flex-shrink-0 ${
                    timerBillable 
                      ? 'text-green-400 hover:text-green-300' 
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                  title={timerBillable ? "Billable" : "Non-billable"}
                >
                  <DollarSign className="w-4 h-4" />
                </button>

                {/* Divider */}
                <div className="w-px h-8 bg-gray-700 flex-shrink-0" />

                {/* Timer display */}
                <span className={`font-mono text-xl tabular-nums flex-shrink-0 min-w-[90px] text-right ${
                  currentTimer?.is_running ? 'text-red-400' : 'text-gray-500'
                }`}>
                  {currentTimer?.is_running ? formatDuration(elapsedSeconds) : '0:00:00'}
                </span>

                {/* Start/Stop button */}
                {currentTimer?.is_running ? (
                  <button
                    onClick={handleStopTimer}
                    className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-400 rounded-full transition-colors flex-shrink-0"
                    title="Stop timer"
                  >
                    <Square className="w-4 h-4 text-white fill-white" />
                  </button>
                ) : manualMode ? (
                  <button
                    onClick={handleCreateManualEntry}
                    className="flex items-center justify-center w-10 h-10 bg-blue-500 hover:bg-blue-400 rounded-full transition-colors flex-shrink-0"
                    title="Add manual entry"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartTimer()}
                    className="flex items-center justify-center w-10 h-10 bg-green-500 hover:bg-green-400 rounded-full transition-colors flex-shrink-0"
                    title="Start timer"
                  >
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  </button>
                )}

                {/* Manual mode toggle */}
                <button
                  onClick={() => setManualMode(!manualMode)}
                  className={`p-1.5 rounded transition-colors flex-shrink-0 ${
                    manualMode ? 'text-blue-400 bg-blue-900/30' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title={manualMode ? "Switch to timer mode" : "Switch to manual mode"}
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>

              {/* Manual mode: date/time inputs */}
              {manualMode && (
                <div className="flex items-center gap-3 pb-3 pt-1 border-t border-gray-800">
                  <label className="text-xs text-gray-500">Date:</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                  />
                  <label className="text-xs text-gray-500">Start:</label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                  />
                  <span className="text-gray-600">–</span>
                  <label className="text-xs text-gray-500">End:</label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Stats Bar (Today Total / Week Total) ── */}
          <div className="border-b border-gray-800 bg-gray-900/50">
            <div className="max-w-full px-4 sm:px-6 flex items-center justify-between h-10">
              <div className="flex items-center gap-6 text-xs">
                <span className="text-gray-500">
                  TODAY TOTAL <span className="text-white font-mono ml-1">{formatDuration(todayTotal)}</span>
                </span>
                <span className="text-gray-500">
                  WEEK TOTAL <span className="text-white font-mono ml-1">{formatDuration(weekTotal)}</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Could add Calendar/List/Timesheet toggle here later */}
              </div>
            </div>
          </div>

          {/* ── Messages ── */}
          {error && (
            <div className="mx-4 sm:mx-6 mt-3 p-2.5 bg-red-900/40 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-4 sm:mx-6 mt-3 p-2.5 bg-green-900/40 border border-green-800 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* ── Time Entries List (grouped by day, Toggl-style) ── */}
          <div className="max-w-full px-4 sm:px-6 py-4">
            {loading ? (
              <div className="text-center py-16 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto mb-3"></div>
                Loading time entries...
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500 mb-2">No time entries yet</h3>
                <p className="text-gray-600 text-sm">Start the timer or switch to manual mode to begin tracking time.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {groupedDays.map((dayGroup) => {
                  const isCollapsed = collapsedDays.has(dayGroup.key)
                  return (
                    <div key={dayGroup.key}>
                      {/* ── Day Header ── */}
                      <button
                        onClick={() => toggleDayCollapse(dayGroup.key)}
                        className="w-full flex items-center justify-between py-3 px-1 group hover:bg-gray-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${!isCollapsed ? 'rotate-90' : ''}`} />
                          <span className="text-sm font-medium text-gray-400">{dayGroup.label}</span>
                        </div>
                        <span className="text-sm font-mono text-gray-300">{formatDurationHM(dayGroup.totalSeconds)}</span>
                      </button>

                      {/* ── Day Entries ── */}
                      {!isCollapsed && (
                        <div className="border-l-2 border-gray-800 ml-2 mb-4">
                          {dayGroup.entries.map(entry => {
                            const project = getProjectForEntry(entry)
                            const isEditing = editingEntry === entry.id

                            return (
                              <div 
                                key={entry.id}
                                className="group flex items-center gap-2 py-2 pl-4 pr-2 hover:bg-gray-900/40 transition-colors border-b border-gray-800/50 last:border-b-0"
                              >
                                {isEditing ? (
                                  /* ── Edit Mode ── */
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <input
                                      type="text"
                                      value={editDescription}
                                      onChange={(e) => setEditDescription(e.target.value)}
                                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm min-w-0"
                                      placeholder="Description"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateEntry(entry.id)
                                        if (e.key === 'Escape') setEditingEntry(null)
                                      }}
                                    />
                                    <ProjectSelector
                                      projects={projects}
                                      selectedProjectId={editProjectId}
                                      onSelect={setEditProjectId}
                                      compact
                                    />
                                    <button
                                      onClick={() => handleUpdateEntry(entry.id)}
                                      className="p-1 text-green-400 hover:text-green-300"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingEntry(null)}
                                      className="p-1 text-gray-500 hover:text-gray-300"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  /* ── View Mode ── */
                                  <>
                                    {/* Description */}
                                    <div 
                                      className="flex-1 min-w-0 cursor-pointer"
                                      onClick={() => {
                                        setEditingEntry(entry.id)
                                        setEditDescription(entry.description || "")
                                        setEditProjectId(entry.project_id || undefined)
                                      }}
                                    >
                                      <span className="text-sm text-white truncate block">
                                        {entry.description || <span className="text-gray-600 italic">Add description</span>}
                                      </span>
                                    </div>

                                    {/* Project badge */}
                                    {project && (
                                      <div className="flex items-center gap-1.5 flex-shrink-0 max-w-[250px]">
                                        <span 
                                          className="w-2 h-2 rounded-full flex-shrink-0" 
                                          style={{ backgroundColor: getProjectColor(project.id) }}
                                        />
                                        <span 
                                          className="text-xs truncate"
                                          style={{ color: getProjectColor(project.id) }}
                                        >
                                          {project.title}
                                        </span>
                                        {project.company_name && (
                                          <span className="text-xs text-gray-600 truncate hidden lg:inline">
                                            {project.company_name}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Billable indicator */}
                                    <DollarSign className={`w-3.5 h-3.5 flex-shrink-0 ${
                                      entry.is_billable ? 'text-green-500' : 'text-gray-700'
                                    }`} />

                                    {/* Time range */}
                                    <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0 hidden sm:inline">
                                      {formatTime12(entry.start_time)} - {entry.end_time ? formatTime12(entry.end_time) : '...'}
                                    </span>

                                    {/* Duration */}
                                    <span className="text-sm font-mono text-gray-300 min-w-[65px] text-right flex-shrink-0">
                                      {formatDurationHM(entry.duration_seconds || 0)}
                                    </span>

                                    {/* Actions (visible on hover) */}
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                      <button
                                        onClick={() => handleResumeEntry(entry)}
                                        className="p-1 text-gray-600 hover:text-green-400 transition-colors"
                                        title="Continue this entry"
                                      >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingEntry(entry.id)
                                          setEditDescription(entry.description || "")
                                          setEditProjectId(entry.project_id || undefined)
                                        }}
                                        className="p-1 text-gray-600 hover:text-blue-400 transition-colors"
                                        title="Edit"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </MainLayout>
    </AuthGuard>
  )
}
