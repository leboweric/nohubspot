"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { 
  timeTrackingAPI, projectAPI, handleAPIError, 
  TimeEntry, Project, TimerStartRequest 
} from "@/lib/api"
import { 
  Play, Square, Clock, Plus, Trash2, Edit2, Check, X,
  Calendar, Filter, ChevronDown, DollarSign, Tag
} from "lucide-react"

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatHours(seconds: number): string {
  const hours = seconds / 3600
  return `${hours.toFixed(2)}h`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function groupEntriesByDate(entries: TimeEntry[]): Record<string, TimeEntry[]> {
  const groups: Record<string, TimeEntry[]> = {}
  for (const entry of entries) {
    const dateKey = new Date(entry.start_time).toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    })
    if (!groups[dateKey]) groups[dateKey] = []
    groups[dateKey].push(entry)
  }
  return groups
}

export default function TimeTrackingPage() {
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

  // Manual entry form
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualStartTime, setManualStartTime] = useState("09:00")
  const [manualEndTime, setManualEndTime] = useState("10:00")
  const [manualDescription, setManualDescription] = useState("")
  const [manualProjectId, setManualProjectId] = useState<number | undefined>(undefined)
  const [manualBillable, setManualBillable] = useState(true)

  // Edit state
  const [editingEntry, setEditingEntry] = useState<number | null>(null)
  const [editDescription, setEditDescription] = useState("")
  const [editProjectId, setEditProjectId] = useState<number | undefined>(undefined)

  // Filter state
  const [filterProjectId, setFilterProjectId] = useState<number | undefined>(undefined)
  const [showFilters, setShowFilters] = useState(false)

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

  // Auto-clear success messages
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
      const [timerData, entriesData, projectsData] = await Promise.all([
        timeTrackingAPI.getCurrentTimer(),
        timeTrackingAPI.getEntries({ limit: 50 }),
        projectAPI.getProjects({ limit: 200 })
      ])
      setCurrentTimer(timerData)
      setEntries(entriesData.filter(e => !e.is_running))
      setProjects(projectsData)
      
      // Pre-fill timer form from running timer
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

  const handleStartTimer = async () => {
    try {
      setError("")
      const data: TimerStartRequest = {
        project_id: timerProjectId || undefined,
        description: timerDescription || undefined,
        is_billable: timerBillable,
      }
      const entry = await timeTrackingAPI.startTimer(data)
      setCurrentTimer(entry)
      setSuccess("Timer started")
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
      setSuccess(`Timer stopped — ${formatHours(entry.duration_seconds || 0)} logged`)
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
        project_id: manualProjectId || undefined,
        description: manualDescription || undefined,
        is_billable: manualBillable,
      })
      setEntries(prev => [entry, ...prev])
      setShowManualEntry(false)
      setManualDescription("")
      setManualProjectId(undefined)
      setSuccess("Time entry created")
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const handleDeleteEntry = async (entryId: number) => {
    if (!confirm("Delete this time entry?")) return
    try {
      await timeTrackingAPI.deleteEntry(entryId)
      setEntries(prev => prev.filter(e => e.id !== entryId))
      setSuccess("Entry deleted")
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
      setSuccess("Entry updated")
    } catch (err) {
      setError(handleAPIError(err))
    }
  }

  const startEditing = (entry: TimeEntry) => {
    setEditingEntry(entry.id)
    setEditDescription(entry.description || "")
    setEditProjectId(entry.project_id || undefined)
  }

  const filteredEntries = filterProjectId 
    ? entries.filter(e => e.project_id === filterProjectId)
    : entries

  const groupedEntries = groupEntriesByDate(filteredEntries)

  // Calculate today's total
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  })
  const todayTotal = (groupedEntries[today] || []).reduce(
    (sum, e) => sum + (e.duration_seconds || 0), 0
  ) + (currentTimer?.is_running ? elapsedSeconds : 0)

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Time Tracking</h1>
              <p className="text-sm text-gray-400 mt-1">
                Today: {formatDuration(todayTotal)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowManualEntry(!showManualEntry)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Manual Entry
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filter
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

          {/* Timer Bar */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Description input */}
              <input
                type="text"
                value={timerDescription}
                onChange={(e) => {
                  setTimerDescription(e.target.value)
                  // Update running timer description
                  if (currentTimer?.is_running) {
                    timeTrackingAPI.updateEntry(currentTimer.id, { description: e.target.value })
                  }
                }}
                placeholder="What are you working on?"
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              />
              
              {/* Project selector */}
              <select
                value={timerProjectId || ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined
                  setTimerProjectId(val)
                  if (currentTimer?.is_running) {
                    timeTrackingAPI.updateEntry(currentTimer.id, { project_id: val || null } as any)
                  }
                }}
                className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-3 text-white text-sm min-w-[200px] focus:outline-none focus:border-blue-500"
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.company_name ? `${p.company_name} — ` : ""}{p.title}
                  </option>
                ))}
              </select>

              {/* Billable toggle */}
              <button
                onClick={() => setTimerBillable(!timerBillable)}
                className={`flex items-center gap-1 px-3 py-3 rounded-lg text-sm transition-colors ${
                  timerBillable 
                    ? 'bg-green-900/50 text-green-400 border border-green-700' 
                    : 'bg-gray-900 text-gray-500 border border-gray-600'
                }`}
                title={timerBillable ? "Billable" : "Non-billable"}
              >
                <DollarSign className="w-4 h-4" />
              </button>

              {/* Timer display + start/stop */}
              <div className="flex items-center gap-3">
                <span className={`font-mono text-2xl tabular-nums ${
                  currentTimer?.is_running ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {currentTimer?.is_running ? formatDuration(elapsedSeconds) : '00:00:00'}
                </span>
                
                {currentTimer?.is_running ? (
                  <button
                    onClick={handleStopTimer}
                    className="flex items-center justify-center w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full transition-colors"
                    title="Stop timer"
                  >
                    <Square className="w-5 h-5 text-white fill-white" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartTimer}
                    className="flex items-center justify-center w-12 h-12 bg-green-600 hover:bg-green-500 rounded-full transition-colors"
                    title="Start timer"
                  >
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          {showFilters && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Project</label>
                  <select
                    value={filterProjectId || ""}
                    onChange={(e) => setFilterProjectId(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm min-w-[200px]"
                  >
                    <option value="">All Projects</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.company_name ? `${p.company_name} — ` : ""}{p.title}
                      </option>
                    ))}
                  </select>
                </div>
                {filterProjectId && (
                  <button
                    onClick={() => setFilterProjectId(undefined)}
                    className="text-sm text-blue-400 hover:text-blue-300 mt-5"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Manual Entry Form */}
          {showManualEntry && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
              <h3 className="text-white font-medium mb-4">Add Manual Time Entry</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={manualStartTime}
                    onChange={(e) => setManualStartTime(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End Time</label>
                  <input
                    type="time"
                    value={manualEndTime}
                    onChange={(e) => setManualEndTime(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Project</label>
                  <select
                    value={manualProjectId || ""}
                    onChange={(e) => setManualProjectId(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.company_name ? `${p.company_name} — ` : ""}{p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <input
                  type="text"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="Description"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                />
                <button
                  onClick={() => setManualBillable(!manualBillable)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm ${
                    manualBillable 
                      ? 'bg-green-900/50 text-green-400 border border-green-700' 
                      : 'bg-gray-900 text-gray-500 border border-gray-600'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  {manualBillable ? "Billable" : "Non-billable"}
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateManualEntry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
                >
                  Add Entry
                </button>
              </div>
            </div>
          )}

          {/* Time Entries List */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading time entries...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No time entries yet</h3>
              <p className="text-gray-500 text-sm">Start the timer or add a manual entry to begin tracking time.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([dateLabel, dayEntries]) => {
                const dayTotal = dayEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0)
                return (
                  <div key={dateLabel}>
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-400">{dateLabel}</h3>
                      <span className="text-sm font-mono text-gray-400">
                        Total: {formatHours(dayTotal)}
                      </span>
                    </div>
                    
                    {/* Entries for this day */}
                    <div className="space-y-2">
                      {dayEntries.map(entry => (
                        <div 
                          key={entry.id} 
                          className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:border-gray-600 transition-colors"
                        >
                          {editingEntry === entry.id ? (
                            /* Edit mode */
                            <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                type="text"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                placeholder="Description"
                              />
                              <select
                                value={editProjectId || ""}
                                onChange={(e) => setEditProjectId(e.target.value ? parseInt(e.target.value) : undefined)}
                                className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white text-sm min-w-[180px]"
                              >
                                <option value="">No Project</option>
                                {projects.map(p => (
                                  <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                              </select>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleUpdateEntry(entry.id)}
                                  className="p-2 bg-green-600 hover:bg-green-500 rounded text-white"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingEntry(null)}
                                  className="p-2 bg-gray-600 hover:bg-gray-500 rounded text-white"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <div className="flex items-center gap-3">
                              {/* Description */}
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm truncate">
                                  {entry.description || <span className="text-gray-500 italic">No description</span>}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {entry.project_title && (
                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800">
                                      {entry.project_title}
                                    </span>
                                  )}
                                  {entry.company_name && (
                                    <span className="text-xs text-gray-500">
                                      {entry.company_name}
                                    </span>
                                  )}
                                  {entry.is_billable && (
                                    <DollarSign className="w-3 h-3 text-green-500" />
                                  )}
                                </div>
                              </div>

                              {/* Time range */}
                              <div className="text-right text-sm text-gray-400 whitespace-nowrap">
                                {formatTime(entry.start_time)} — {entry.end_time ? formatTime(entry.end_time) : '...'}
                              </div>

                              {/* Duration */}
                              <div className="text-right font-mono text-sm text-white min-w-[70px]">
                                {formatHours(entry.duration_seconds || 0)}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => startEditing(entry)}
                                  className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                {/* Resume timer with same settings */}
                                <button
                                  onClick={() => {
                                    setTimerDescription(entry.description || "")
                                    setTimerProjectId(entry.project_id || undefined)
                                    setTimerBillable(entry.is_billable)
                                    handleStartTimer()
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-green-400 rounded transition-colors"
                                  title="Resume"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
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
