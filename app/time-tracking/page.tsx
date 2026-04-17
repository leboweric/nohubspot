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
  ChevronDown, ChevronRight, DollarSign, Search
} from "lucide-react"

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#1ABC9C',
  '#3498DB', '#9B59B6', '#E91E63', '#00BCD4', '#8BC34A',
  '#FF9800', '#795548', '#607D8B', '#FF5722', '#673AB7',
  '#009688', '#CDDC39', '#FFC107', '#03A9F4', '#4CAF50',
]

function getProjectColor(projectId: number): string {
  return PROJECT_COLORS[projectId % PROJECT_COLORS.length]
}

function fmt(seconds: number): string {
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

interface DayGroup {
  label: string
  key: string
  entries: TimeEntry[]
  totalSeconds: number
}

function groupEntriesByDate(entries: TimeEntry[]): DayGroup[] {
  const groups: Record<string, { label: string; entries: TimeEntry[] }> = {}
  for (const entry of entries) {
    const key = getDateKey(entry.start_time)
    if (!groups[key]) {
      groups[key] = { label: getDateLabel(entry.start_time), entries: [] }
    }
    groups[key].entries.push(entry)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, group]) => ({
      key,
      label: group.label,
      entries: group.entries.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      totalSeconds: group.entries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0),
    }))
    .filter(g => g.totalSeconds > 0 || g.entries.length > 0) // hide empty days
}

function getWeekTotal(entries: TimeEntry[]): number {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
  const sundayEnd = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000)
  return entries
    .filter(e => {
      const d = new Date(e.start_time)
      return d >= monday && d < sundayEnd
    })
    .reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
}

// Determine which days to auto-expand (most recent 7 days with entries)
function getInitialCollapsed(groups: DayGroup[]): Set<string> {
  const collapsed = new Set<string>()
  // Expand first 7 day groups, collapse the rest
  groups.forEach((g, i) => {
    if (i >= 7) collapsed.add(g.key)
  })
  return collapsed
}

// Time Tracking beta access
const ALLOWED = [
  'kharding@strategic-cc.com',
  'elebow@bmhmn.com',
  'elebow@strategic-cc.com',
  'eric@profitbuildernetwork.com',
  'eric.lebow@aiop.one',
  'leboweric@gmail.com',
]

// ── Project Selector (Toggl-style) ──────────────────────────────────────────

function ProjectSelector({ 
  projects, selectedProjectId, onSelect, compact = false 
}: { 
  projects: Project[]; selectedProjectId?: number; onSelect: (id?: number) => void; compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const selectedProject = projects.find(p => p.id === selectedProjectId)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    return p.title.toLowerCase().includes(q) || (p.company_name || '').toLowerCase().includes(q)
  })

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
        className={`flex items-center gap-2 rounded transition-colors text-left ${
          compact 
            ? 'px-2 py-1 text-xs hover:bg-gray-100 max-w-[300px]' 
            : 'px-3 py-1.5 hover:bg-gray-100 text-sm min-w-[160px] rounded border border-transparent hover:border-gray-200'
        }`}
      >
        {selectedProject ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getProjectColor(selectedProject.id) }} />
            <span className="truncate text-gray-700">{selectedProject.title}</span>
          </>
        ) : (
          <span className="text-gray-400">{compact ? '+ Project' : 'Add a project'}</span>
        )}
        <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Find project..." className="bg-transparent text-sm flex-1 outline-none placeholder-gray-400 text-gray-900" autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-60">
            <button onClick={() => { onSelect(undefined); setOpen(false); setSearch("") }}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">No project</button>
            {Object.entries(byClient).sort(([a], [b]) => a.localeCompare(b)).map(([client, ps]) => (
              <div key={client}>
                <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{client}</div>
                {ps.map(p => (
                  <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false); setSearch("") }}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 ${p.id === selectedProjectId ? 'bg-blue-50' : ''}`}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getProjectColor(p.id) }} />
                    <span className="text-sm text-gray-900 truncate">{p.title}</span>
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

  useEffect(() => {
    if (user && !ALLOWED.includes(user.email?.toLowerCase())) router.push('/dashboard')
  }, [user, router])

  if (!user || !ALLOWED.includes(user.email?.toLowerCase())) {
    return (
      <AuthGuard><MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </MainLayout></AuthGuard>
    )
  }

  // ── State ──
  const [currentTimer, setCurrentTimer] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [projects, setProjects] = useState<Project[]>([])
  const [timerDescription, setTimerDescription] = useState("")
  const [timerProjectId, setTimerProjectId] = useState<number | undefined>(undefined)
  const [timerBillable, setTimerBillable] = useState(true)
  const [manualMode, setManualMode] = useState(false)
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualStartTime, setManualStartTime] = useState("09:00")
  const [manualEndTime, setManualEndTime] = useState("10:00")
  const [editingEntry, setEditingEntry] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState("")
  const [editProjectId, setEditProjectId] = useState<number | undefined>(undefined)
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set())
  const [initialCollapseSet, setInitialCollapseSet] = useState(false)

  // ── Effects ──
  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (currentTimer?.is_running) {
      const startTime = new Date(currentTimer.start_time).getTime()
      const tick = () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))
      tick()
      timerInterval.current = setInterval(tick, 1000)
      return () => { if (timerInterval.current) clearInterval(timerInterval.current) }
    } else {
      setElapsedSeconds(0)
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
  }, [currentTimer])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t) } }, [error])

  // ── Data Loading ──
  const loadData = async () => {
    try {
      setLoading(true); setError("")
      const [timerData, entriesData, projectsData] = await Promise.all([
        timeTrackingAPI.getCurrentTimer(),
        timeTrackingAPI.getEntries({ limit: 500 }),
        projectAPI.getProjects({ limit: 500 })
      ])
      setCurrentTimer(timerData)
      const completed = entriesData.filter((e: TimeEntry) => !e.is_running)
      setEntries(completed)
      setProjects(projectsData)
      if (timerData) {
        setTimerDescription(timerData.description || "")
        setTimerProjectId(timerData.project_id || undefined)
        setTimerBillable(timerData.is_billable)
      }
      // Auto-collapse: expand first 7 day groups
      if (!initialCollapseSet) {
        const groups = groupEntriesByDate(completed)
        setCollapsedDays(getInitialCollapsed(groups))
        setInitialCollapseSet(true)
      }
    } catch (err) { setError(handleAPIError(err)) }
    finally { setLoading(false) }
  }

  // ── Timer Actions ──
  const handleStartTimer = async (desc?: string, projId?: number, billable?: boolean) => {
    try {
      setError("")
      const entry = await timeTrackingAPI.startTimer({
        project_id: projId !== undefined ? projId : timerProjectId,
        description: desc !== undefined ? desc : timerDescription || undefined,
        is_billable: billable !== undefined ? billable : timerBillable,
      })
      setCurrentTimer(entry)
      if (desc !== undefined) setTimerDescription(desc)
      if (projId !== undefined) setTimerProjectId(projId)
      if (billable !== undefined) setTimerBillable(billable)
    } catch (err) { setError(handleAPIError(err)) }
  }

  const handleStopTimer = async () => {
    try {
      setError("")
      const entry = await timeTrackingAPI.stopTimer()
      setCurrentTimer(null); setTimerDescription(""); setTimerProjectId(undefined); setTimerBillable(true)
      setEntries(prev => [entry, ...prev])
    } catch (err) { setError(handleAPIError(err)) }
  }

  const handleCreateManualEntry = async () => {
    try {
      setError("")
      const entry = await timeTrackingAPI.createEntry({
        start_time: new Date(`${manualDate}T${manualStartTime}:00`).toISOString(),
        end_time: new Date(`${manualDate}T${manualEndTime}:00`).toISOString(),
        project_id: timerProjectId || undefined,
        description: timerDescription || undefined,
        is_billable: timerBillable,
      })
      setEntries(prev => [entry, ...prev])
      setTimerDescription(""); setTimerProjectId(undefined)
      setSuccess("Time entry added")
    } catch (err) { setError(handleAPIError(err)) }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm("Delete this time entry?")) return
    try {
      await timeTrackingAPI.deleteEntry(entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
    } catch (err) { setError(handleAPIError(err)) }
  }

  const handleUpdateEntry = async (entryId: number) => {
    try {
      const updated = await timeTrackingAPI.updateEntry(entryId, {
        description: editDescription || undefined,
        project_id: editProjectId || undefined,
      })
      setEntries(prev => prev.map(e => e.id === entryId ? updated : e))
      setEditingEntry(null)
    } catch (err) { setError(handleAPIError(err)) }
  }

  const handleResumeEntry = async (entry: TimeEntry) => {
    await handleStartTimer(entry.description || "", entry.project_id || undefined, entry.is_billable)
  }

  const toggleDay = (key: string) => {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // ── Computed ──
  const groupedDays = groupEntriesByDate(entries)
  const todayKey = getDateKey(new Date().toISOString())
  const todayTotal = (groupedDays.find(g => g.key === todayKey)?.totalSeconds || 0) + (currentTimer?.is_running ? elapsedSeconds : 0)
  const weekTotal = getWeekTotal(entries) + (currentTimer?.is_running ? elapsedSeconds : 0)

  const getProjectDisplay = (entry: TimeEntry) => {
    if (entry.project_title) return { id: entry.project_id || 0, title: entry.project_title, company: entry.company_name }
    const p = projects.find(p => p.id === entry.project_id)
    if (p) return { id: p.id, title: p.title, company: p.company_name }
    return null
  }

  // ── Render ──
  return (
    <AuthGuard>
      <MainLayout>
        <div className="min-h-screen bg-white">

          {/* ════ TIMER BAR ════ */}
          <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
            <div className="px-5">
              <div className="flex items-center gap-3 h-[52px]">
                {/* Description */}
                <input
                  type="text" value={timerDescription}
                  onChange={(e) => {
                    setTimerDescription(e.target.value)
                    if (currentTimer?.is_running) timeTrackingAPI.updateEntry(currentTimer.id, { description: e.target.value })
                  }}
                  placeholder="What are you working on?"
                  className="flex-1 bg-transparent text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none min-w-0"
                />

                {/* Project selector */}
                <ProjectSelector projects={projects} selectedProjectId={timerProjectId}
                  onSelect={(id) => { setTimerProjectId(id); if (currentTimer?.is_running) timeTrackingAPI.updateEntry(currentTimer.id, { project_id: id || null } as any) }} />

                {/* Billable */}
                <button onClick={() => {
                  const next = !timerBillable; setTimerBillable(next)
                  if (currentTimer?.is_running) timeTrackingAPI.updateEntry(currentTimer.id, { is_billable: next } as any)
                }}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${timerBillable ? 'text-green-600' : 'text-gray-300 hover:text-gray-400'}`}
                  title={timerBillable ? "Billable" : "Non-billable"}>
                  <DollarSign className="w-4 h-4" />
                </button>

                <div className="w-px h-7 bg-gray-200" />

                {/* Timer display */}
                <span className={`font-mono text-lg tabular-nums min-w-[80px] text-right ${currentTimer?.is_running ? 'text-rose-500 font-semibold' : 'text-gray-400'}`}>
                  {currentTimer?.is_running ? fmt(elapsedSeconds) : '0:00:00'}
                </span>

                {/* Start/Stop/Add */}
                {currentTimer?.is_running ? (
                  <button onClick={handleStopTimer} className="w-9 h-9 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors" title="Stop">
                    <Square className="w-3.5 h-3.5 text-white fill-white" />
                  </button>
                ) : manualMode ? (
                  <button onClick={handleCreateManualEntry} className="w-9 h-9 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors" title="Add">
                    <Plus className="w-4 h-4 text-white" />
                  </button>
                ) : (
                  <button onClick={() => handleStartTimer()} className="w-9 h-9 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors" title="Start">
                    <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                  </button>
                )}

                {/* Manual mode */}
                <button onClick={() => setManualMode(!manualMode)}
                  className={`p-1.5 rounded transition-colors ${manualMode ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-500'}`}
                  title={manualMode ? "Timer mode" : "Manual mode"}>
                  <Clock className="w-4 h-4" />
                </button>
              </div>

              {/* Manual mode inputs */}
              {manualMode && (
                <div className="flex items-center gap-3 pb-3 pt-1 border-t border-gray-100 text-sm">
                  <label className="text-xs text-gray-500">Date:</label>
                  <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" />
                  <label className="text-xs text-gray-500">Start:</label>
                  <input type="time" value={manualStartTime} onChange={(e) => setManualStartTime(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" />
                  <span className="text-gray-400">–</span>
                  <label className="text-xs text-gray-500">End:</label>
                  <input type="time" value={manualEndTime} onChange={(e) => setManualEndTime(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900" />
                </div>
              )}
            </div>
          </div>

          {/* ════ STATS BAR ════ */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="px-5 flex items-center h-8">
              <div className="flex items-center gap-6 text-[11px] tracking-wide">
                <span className="text-gray-500 uppercase">
                  Today total{' '}
                  <span className="text-gray-800 font-mono font-semibold ml-1 text-xs">{fmt(todayTotal)}</span>
                </span>
                <span className="text-gray-500 uppercase">
                  Week total{' '}
                  <span className="text-gray-800 font-mono font-semibold ml-1 text-xs">{fmt(weekTotal)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ════ MESSAGES ════ */}
          {error && <div className="mx-5 mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
          {success && <div className="mx-5 mt-3 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">{success}</div>}

          {/* ════ TIME ENTRIES ════ */}
          <div className="px-5 pt-1">
            {loading ? (
              <div className="text-center py-16 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-3" />
                Loading time entries...
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-base font-medium text-gray-500 mb-1">No time entries yet</h3>
                <p className="text-gray-400 text-sm">Start the timer or switch to manual mode to begin tracking.</p>
              </div>
            ) : (
              <div>
                {groupedDays.map((day) => {
                  const collapsed = collapsedDays.has(day.key)
                  return (
                    <div key={day.key} className="border-b border-gray-100 last:border-b-0">
                      {/* ── Day Header ── */}
                      <button onClick={() => toggleDay(day.key)}
                        className="w-full flex items-center justify-between py-2 px-1 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${!collapsed ? 'rotate-90' : ''}`} />
                          <span className="text-[13px] font-semibold text-gray-600">{day.label}</span>
                        </div>
                        <span className="text-[13px] font-mono text-gray-500 tabular-nums">{fmt(day.totalSeconds)}</span>
                      </button>

                      {/* ── Entries ── */}
                      {!collapsed && (
                        <div className="pb-1">
                          {day.entries.map(entry => {
                            const proj = getProjectDisplay(entry)
                            const isEditing = editingEntry === entry.id

                            if (isEditing) {
                              return (
                                <div key={entry.id} className="flex items-center gap-2 py-1 pl-7 pr-2">
                                  <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none min-w-0"
                                    placeholder="Description" autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateEntry(entry.id); if (e.key === 'Escape') setEditingEntry(null) }} />
                                  <ProjectSelector projects={projects} selectedProjectId={editProjectId} onSelect={setEditProjectId} compact />
                                  <button onClick={() => handleUpdateEntry(entry.id)} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingEntry(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                                </div>
                              )
                            }

                            return (
                              <div key={entry.id}
                                className="group flex items-center gap-2 h-[34px] pl-7 pr-2 hover:bg-gray-50 transition-colors">
                                {/* Description */}
                                <div className="flex-1 min-w-0 cursor-pointer truncate"
                                  onClick={() => { setEditingEntry(entry.id); setEditDescription(entry.description || ""); setEditProjectId(entry.project_id || undefined) }}>
                                  {entry.description ? (
                                    <span className="text-[13px] text-gray-900">{entry.description}</span>
                                  ) : (
                                    <span className="text-[13px] text-gray-400 italic">Add description</span>
                                  )}
                                </div>

                                {/* Project pill */}
                                {proj && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0 max-w-[400px] min-w-0">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getProjectColor(proj.id) }} />
                                    <span className="text-[12px] font-medium truncate" style={{ color: getProjectColor(proj.id) }}>
                                      {proj.title}
                                    </span>
                                    {proj.company && (
                                      <span className="text-[11px] text-gray-400 truncate flex-shrink-0">
                                        {proj.company}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Billable */}
                                <DollarSign className={`w-3 h-3 flex-shrink-0 ${entry.is_billable ? 'text-green-500' : 'text-gray-200'}`} />

                                {/* Time range */}
                                <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 tabular-nums hidden md:inline">
                                  {formatTime12(entry.start_time)} - {entry.end_time ? formatTime12(entry.end_time) : '...'}
                                </span>

                                {/* Duration */}
                                <span className="text-[13px] font-mono text-gray-600 min-w-[60px] text-right flex-shrink-0 tabular-nums">
                                  {fmt(entry.duration_seconds || 0)}
                                </span>

                                {/* Hover actions */}
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
                                  <button onClick={() => handleResumeEntry(entry)}
                                    className="p-1 text-gray-300 hover:text-green-500 transition-colors" title="Continue">
                                    <Play className="w-3 h-3 fill-current" />
                                  </button>
                                  <button onClick={() => { setEditingEntry(entry.id); setEditDescription(entry.description || ""); setEditProjectId(entry.project_id || undefined) }}
                                    className="p-1 text-gray-300 hover:text-blue-500 transition-colors" title="Edit">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => handleDeleteEntry(entry.id)}
                                    className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
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
