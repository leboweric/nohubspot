"use client"
import { useState, useEffect, useRef } from "react"
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
  ChevronDown, ChevronRight, ChevronLeft, DollarSign, Search,
  BarChart3, List, CalendarDays
} from "lucide-react"

// ── Constants ───────────────────────────────────────────────────────────────

const COLORS = [
  '#C74440','#D97734','#E8B839','#3DB77A','#2AA89A',
  '#3C8FCC','#8E52A8','#D4357E','#1AABB8','#7DB83A',
  '#E88C2A','#6D4C41','#546E7A','#E05A2B','#5C35A3',
  '#00897B','#B8C42A','#E8A82A','#1A96E0','#43A047',
]

const ALLOWED = [
  'kharding@strategic-cc.com',
  'elebow@bmhmn.com',
  'elebow@strategic-cc.com',
  'eric@profitbuildernetwork.com',
  'eric.lebow@aiop.one',
  'leboweric@gmail.com',
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function color(id: number) { return COLORS[id % COLORS.length] }

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function time12(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true, timeZone:'America/Chicago' })
}

function dateLabel(iso: string) {
  // Use Central Time for date grouping to match Toggl workspace timezone
  const ct = new Date(iso).toLocaleDateString('en-US', { timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' })
  const [mm, dd, yyyy] = ct.split('/')
  const entryDate = new Date(+yyyy, +mm - 1, +dd)
  const nowCt = new Date(new Date().toLocaleDateString('en-US', { timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' }))
  const diff = Math.floor((nowCt.getTime() - entryDate.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'America/Chicago' })
}

function dateKey(iso: string) {
  // Use Central Time for date grouping to match Toggl workspace timezone
  const ct = new Date(iso).toLocaleDateString('en-US', { timeZone:'America/Chicago', year:'numeric', month:'2-digit', day:'2-digit' })
  const [mm, dd, yyyy] = ct.split('/')
  return `${yyyy}-${mm}-${dd}`
}

// ── Entry Grouping (Toggl-style) ────────────────────────────────────────────

interface EntryGroup {
  key: string
  project_id: number | null
  project_title: string | null
  company_name: string | null
  entries: TimeEntry[]
  totalSeconds: number
  is_billable: boolean
}

function groupEntries(entries: TimeEntry[], projects: Project[]): EntryGroup[] {
  const map: Record<string, EntryGroup> = {}
  for (const e of entries) {
    const pid = e.project_id || 0
    const k = `${pid}`
    if (!map[k]) {
      const p = e.project_title ? { title: e.project_title, client: e.company_name }
        : projects.find(p => p.id === e.project_id)
          ? { title: projects.find(p => p.id === e.project_id)!.title, client: projects.find(p => p.id === e.project_id)!.company_name }
          : null
      map[k] = {
        key: k,
        project_id: e.project_id,
        project_title: p?.title || null,
        company_name: p?.client || null,
        entries: [],
        totalSeconds: 0,
        is_billable: false,
      }
    }
    map[k].entries.push(e)
    map[k].totalSeconds += (e.duration_seconds || 0)
    if (e.is_billable) map[k].is_billable = true
  }
  return Object.values(map).sort((a, b) => {
    // Sort by project name first (like Toggl) — groups with same project together
    const aName = (a.project_title || 'zzz').toLowerCase()
    const bName = (b.project_title || 'zzz').toLowerCase()
    if (aName !== bName) return aName.localeCompare(bName)
    // Then by most recent entry time within the same project
    const aTime = Math.max(...a.entries.map(e => new Date(e.start_time).getTime()))
    const bTime = Math.max(...b.entries.map(e => new Date(e.start_time).getTime()))
    return bTime - aTime
  })
}

// ── Day Groups ──────────────────────────────────────────────────────────────

interface DayGroup { label: string; key: string; entries: TimeEntry[]; total: number; entryGroups: EntryGroup[] }

function groupByDate(entries: TimeEntry[], projects: Project[]): DayGroup[] {
  const map: Record<string, { label: string; entries: TimeEntry[] }> = {}
  for (const e of entries) {
    const k = dateKey(e.start_time)
    if (!map[k]) map[k] = { label: dateLabel(e.start_time), entries: [] }
    map[k].entries.push(e)
  }
  return Object.entries(map)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([k, g]) => ({
      key: k, label: g.label,
      entries: g.entries.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
      total: g.entries.reduce((s,e) => s + (e.duration_seconds||0), 0),
      entryGroups: groupEntries(
        g.entries.sort((a,b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()),
        projects
      ),
    }))
    .filter(g => g.total > 0 || g.entries.length > 0)
}

function weekTotal(entries: TimeEntry[]) {
  const now = new Date()
  const dow = now.getDay()
  const off = dow === 0 ? 6 : dow - 1
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off)
  const sun = new Date(mon.getTime() + 7*86400000)
  return entries.filter(e => { const d = new Date(e.start_time); return d >= mon && d < sun })
    .reduce((s,e) => s + (e.duration_seconds||0), 0)
}

function getWeekRange(offset: number) {
  const now = new Date()
  const dow = now.getDay()
  const off = dow === 0 ? 6 : dow - 1
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off + (offset * 7))
  const sun = new Date(mon.getTime() + 6*86400000)
  return { start: mon, end: sun }
}

function formatWeekLabel(offset: number) {
  if (offset === 0) return 'This week'
  const { start, end } = getWeekRange(offset)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`
}

// ── Project Selector ────────────────────────────────────────────────────────

function ProjectPicker({ projects, value, onChange, compact }: {
  projects: Project[]; value?: number; onChange: (id?:number)=>void; compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const sel = projects.find(p => p.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = projects.filter(p => {
    const s = q.toLowerCase()
    return p.title.toLowerCase().includes(s) || (p.company_name||'').toLowerCase().includes(s)
  })
  const byClient: Record<string, Project[]> = {}
  for (const p of filtered) { const c = p.company_name || 'No Client'; if (!byClient[c]) byClient[c] = []; byClient[c].push(p) }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded transition-colors text-left ${
          compact ? 'hover:bg-gray-100 max-w-[300px]' : 'px-3 py-1 hover:bg-gray-100 text-sm min-w-[140px]'
        }`}>
        {sel ? (<>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color(sel.id) }} />
          <span className="truncate text-sm text-gray-700">{sel.title}</span>
        </>) : (
          <span className="text-gray-400 text-sm">{compact ? '+ Project' : 'Add a project'}</span>
        )}
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full right-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Find project..." className="bg-transparent text-sm flex-1 outline-none placeholder-gray-400 text-gray-900" autoFocus />
            </div>
          </div>
          <div className="overflow-y-auto max-h-60">
            <button onClick={() => { onChange(undefined); setOpen(false); setQ("") }}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">No project</button>
            {Object.entries(byClient).sort(([a],[b]) => a.localeCompare(b)).map(([client, ps]) => (
              <div key={client}>
                <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">{client}</div>
                {ps.map(p => (
                  <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); setQ("") }}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 ${p.id === value ? 'bg-blue-50' : ''}`}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color(p.id) }} />
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

// ── Main Component ──────────────────────────────────────────────────────────

export default function TimeTrackingPage() {
  const router = useRouter()
  const { user } = getAuthState()

  useEffect(() => {
    if (user && !ALLOWED.includes(user.email?.toLowerCase())) router.push('/dashboard')
  }, [user, router])

  if (!user || !ALLOWED.includes(user.email?.toLowerCase())) {
    return <AuthGuard><MainLayout><div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div></MainLayout></AuthGuard>
  }

  const [timer, setTimer] = useState<TimeEntry|null>(null)
  const [elapsed, setElapsed] = useState(0)
  const tick = useRef<NodeJS.Timeout|null>(null)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [projects, setProjects] = useState<Project[]>([])
  const [desc, setDesc] = useState("")
  const [projId, setProjId] = useState<number|undefined>()
  const [billable, setBillable] = useState(true)
  const [manual, setManual] = useState(false)
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0])
  const [mStart, setMStart] = useState("09:00")
  const [mEnd, setMEnd] = useState("10:00")
  const [editing, setEditing] = useState<number|null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editProj, setEditProj] = useState<number|undefined>()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [initCollapse, setInitCollapse] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<'list'|'week'>('list')

  // ── Effects ──
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (timer?.is_running) {
      const st = new Date(timer.start_time).getTime()
      const t = () => setElapsed(Math.floor((Date.now() - st) / 1000))
      t(); tick.current = setInterval(t, 1000)
      return () => { if (tick.current) clearInterval(tick.current) }
    } else { setElapsed(0); if (tick.current) clearInterval(tick.current) }
  }, [timer])

  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(""), 3000); return () => clearTimeout(t) } }, [success])
  useEffect(() => { if (error) { const t = setTimeout(() => setError(""), 5000); return () => clearTimeout(t) } }, [error])

  // ── Data ──
  const load = async () => {
    try {
      setLoading(true); setError("")
      const [t, e, p] = await Promise.all([
        timeTrackingAPI.getCurrentTimer(),
        timeTrackingAPI.getEntries({ limit: 500 }),
        projectAPI.getProjects({ limit: 500 })
      ])
      setTimer(t)
      const done = e.filter((x: TimeEntry) => !x.is_running)
      setEntries(done); setProjects(p)
      if (t) { setDesc(t.description||""); setProjId(t.project_id||undefined); setBillable(t.is_billable) }
      if (!initCollapse) {
        const groups = groupByDate(done, p)
        const c = new Set<string>()
        groups.forEach((g,i) => { if (i >= 7) c.add(g.key) })
        setCollapsed(c); setInitCollapse(true)
      }
    } catch (err) { setError(handleAPIError(err)) }
    finally { setLoading(false) }
  }

  // ── Actions ──
  const start = async (d?:string, p?:number, b?:boolean) => {
    try {
      setError("")
      const entry = await timeTrackingAPI.startTimer({
        project_id: p !== undefined ? p : projId,
        description: d !== undefined ? d : desc || undefined,
        is_billable: b !== undefined ? b : billable,
      })
      setTimer(entry)
      if (d !== undefined) setDesc(d)
      if (p !== undefined) setProjId(p)
      if (b !== undefined) setBillable(b)
    } catch (err) { setError(handleAPIError(err)) }
  }

  const stop = async () => {
    try {
      setError("")
      const entry = await timeTrackingAPI.stopTimer()
      setTimer(null); setDesc(""); setProjId(undefined); setBillable(true)
      setEntries(prev => [entry, ...prev])
    } catch (err) { setError(handleAPIError(err)) }
  }

  const addManual = async () => {
    try {
      setError("")
      const entry = await timeTrackingAPI.createEntry({
        start_time: new Date(`${mDate}T${mStart}:00`).toISOString(),
        end_time: new Date(`${mDate}T${mEnd}:00`).toISOString(),
        project_id: projId || undefined,
        description: desc || undefined,
        is_billable: billable,
      })
      setEntries(prev => [entry, ...prev])
      setDesc(""); setProjId(undefined); setSuccess("Time entry added")
    } catch (err) { setError(handleAPIError(err)) }
  }

  const del = async (id: number) => {
    if (!confirm("Delete this time entry?")) return
    try { await timeTrackingAPI.deleteEntry(id); setEntries(prev => prev.filter(e => e.id !== id)) }
    catch (err) { setError(handleAPIError(err)) }
  }

  const update = async (id: number) => {
    try {
      const u = await timeTrackingAPI.updateEntry(id, { description: editDesc||undefined, project_id: editProj||undefined })
      setEntries(prev => prev.map(e => e.id === id ? u : e)); setEditing(null)
    } catch (err) { setError(handleAPIError(err)) }
  }

  const resume = async (e: TimeEntry) => { await start(e.description||"", e.project_id||undefined, e.is_billable) }

  const toggleDay = (k: string) => setCollapsed(prev => {
    const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n
  })

  const toggleGroup = (dayKey: string, groupKey: string) => {
    const k = `${dayKey}:${groupKey}`
    setExpandedGroups(prev => {
      const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n
    })
  }

  // ── Computed ──
  const days = groupByDate(entries, projects)

  // Filter by week if not "all dates"
  const filteredDays = viewMode === 'week' ? (() => {
    const { start, end } = getWeekRange(weekOffset)
    const startStr = dateKey(start.toISOString())
    const endStr = dateKey(end.toISOString())
    return days.filter(d => d.key >= startStr && d.key <= endStr)
  })() : days

  const todayKey = dateKey(new Date().toISOString())
  const todayTot = (days.find(g => g.key === todayKey)?.total || 0) + (timer?.is_running ? elapsed : 0)
  const weekTot = weekTotal(entries) + (timer?.is_running ? elapsed : 0)

  // ── Render ──
  return (
    <AuthGuard>
      <MainLayout>
        <div style={{ minHeight: '100vh', background: '#fff', overflow: 'hidden', maxWidth: '100%' }}>

          {/* ═══════════ TIMER BAR ═══════════ */}
          <div className="sticky top-0 z-30 bg-white" style={{ borderBottom: '1px solid #e5e5e5' }}>
            <div style={{ display:'flex', alignItems:'center', height:56, paddingLeft:20, paddingRight:12, gap:8 }}>
              <input type="text" value={desc}
                onChange={e => { setDesc(e.target.value); if (timer?.is_running) timeTrackingAPI.updateEntry(timer.id, { description: e.target.value }) }}
                placeholder="What are you working on?"
                style={{ flex:'1 1 auto', minWidth:0, border:'none', outline:'none', fontSize:14, color:'#111', background:'transparent' }}
              />
              <ProjectPicker projects={projects} value={projId}
                onChange={id => { setProjId(id); if (timer?.is_running) timeTrackingAPI.updateEntry(timer.id, { project_id: id||null } as any) }} />
              <button onClick={() => { const n = !billable; setBillable(n); if (timer?.is_running) timeTrackingAPI.updateEntry(timer.id, { is_billable: n } as any) }}
                style={{ width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4, color: billable ? '#16a34a' : '#d1d5db', cursor:'pointer', background:'transparent', border:'none' }}
                title={billable ? "Billable" : "Non-billable"}>
                <DollarSign style={{ width:16, height:16 }} />
              </button>
              <div style={{ width:1, height:28, background:'#e5e5e5' }} />
              <span style={{ fontFamily:'ui-monospace, SFMono-Regular, monospace', fontSize:17, minWidth:85, textAlign:'right' as const, fontVariantNumeric:'tabular-nums', color: timer?.is_running ? '#e11d48' : '#9ca3af', fontWeight: timer?.is_running ? 600 : 400 }}>
                {timer?.is_running ? fmt(elapsed) : '0:00:00'}
              </span>
              {timer?.is_running ? (
                <button onClick={stop} style={{ width:36, height:36, borderRadius:'50%', background:'#ef4444', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Stop">
                  <Square style={{ width:14, height:14, color:'#fff', fill:'#fff' }} />
                </button>
              ) : manual ? (
                <button onClick={addManual} style={{ width:36, height:36, borderRadius:'50%', background:'#3b82f6', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Add">
                  <Plus style={{ width:16, height:16, color:'#fff' }} />
                </button>
              ) : (
                <button onClick={() => start()} style={{ width:36, height:36, borderRadius:'50%', background:'#22c55e', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} title="Start">
                  <Play style={{ width:14, height:14, color:'#fff', fill:'#fff', marginLeft:2 }} />
                </button>
              )}
              <button onClick={() => setManual(!manual)}
                style={{ padding:6, borderRadius:4, background: manual ? '#eff6ff' : 'transparent', color: manual ? '#2563eb' : '#9ca3af', border:'none', cursor:'pointer' }}
                title={manual ? "Timer mode" : "Manual mode"}>
                <Clock style={{ width:16, height:16 }} />
              </button>
            </div>
            {manual && (
              <div style={{ display:'flex', alignItems:'center', gap:12, paddingLeft:20, paddingRight:12, paddingBottom:10, paddingTop:4, borderTop:'1px solid #f3f4f6', fontSize:13 }}>
                <span style={{ color:'#9ca3af', fontSize:11 }}>Date:</span>
                <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} style={{ border:'1px solid #d1d5db', borderRadius:4, padding:'3px 8px', fontSize:13, color:'#111' }} />
                <span style={{ color:'#9ca3af', fontSize:11 }}>Start:</span>
                <input type="time" value={mStart} onChange={e => setMStart(e.target.value)} style={{ border:'1px solid #d1d5db', borderRadius:4, padding:'3px 8px', fontSize:13, color:'#111' }} />
                <span style={{ color:'#9ca3af' }}>–</span>
                <span style={{ color:'#9ca3af', fontSize:11 }}>End:</span>
                <input type="time" value={mEnd} onChange={e => setMEnd(e.target.value)} style={{ border:'1px solid #d1d5db', borderRadius:4, padding:'3px 8px', fontSize:13, color:'#111' }} />
              </div>
            )}
          </div>

          {/* ═══════════ DATE NAVIGATION BAR ═══════════ */}
          <div style={{ borderBottom:'1px solid #e5e5e5', background:'#fafafa', display:'flex', alignItems:'center', height:42, paddingLeft:16, paddingRight:16, gap:8, justifyContent:'space-between' }}>
            {/* Left: Week navigation */}
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <button onClick={() => { setViewMode('week'); setWeekOffset(w => w - 1) }}
                style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#6b7280' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                <ChevronLeft style={{ width:14, height:14 }} />
              </button>
              <button onClick={() => { setViewMode(viewMode === 'list' ? 'week' : 'list'); setWeekOffset(0) }}
                style={{ padding:'4px 12px', borderRadius:4, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:13, fontWeight:500, color:'#374151', whiteSpace:'nowrap' as const }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                {viewMode === 'list' ? 'All dates' : formatWeekLabel(weekOffset)}
              </button>
              <button onClick={() => { setViewMode('week'); setWeekOffset(w => w + 1) }}
                style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4, border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', color:'#6b7280' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                <ChevronRight style={{ width:14, height:14 }} />
              </button>
            </div>

            {/* Center: Totals */}
            <div style={{ display:'flex', alignItems:'center', gap:24 }}>
              <span style={{ fontSize:11, letterSpacing:'0.05em', textTransform:'uppercase' as const, color:'#6b7280' }}>
                Today total <span style={{ fontFamily:'ui-monospace, SFMono-Regular, monospace', fontWeight:600, color:'#374151', marginLeft:4, fontSize:12, fontVariantNumeric:'tabular-nums' }}>{fmt(todayTot)}</span>
              </span>
              <span style={{ fontSize:11, letterSpacing:'0.05em', textTransform:'uppercase' as const, color:'#6b7280' }}>
                Week total <span style={{ fontFamily:'ui-monospace, SFMono-Regular, monospace', fontWeight:600, color:'#374151', marginLeft:4, fontSize:12, fontVariantNumeric:'tabular-nums' }}>{fmt(weekTot)}</span>
              </span>
            </div>

            {/* Right: View toggles */}
            <div style={{ display:'flex', alignItems:'center', gap:2, background:'#fff', border:'1px solid #e5e7eb', borderRadius:6, padding:2 }}>
              <button onClick={() => router.push('/time-tracking/reports')}
                style={{ padding:'4px 10px', borderRadius:4, fontSize:12, fontWeight:500, color:'#6b7280', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <BarChart3 style={{ width:13, height:13 }} /> Reports
              </button>
              <div style={{ width:1, height:16, background:'#e5e7eb' }} />
              <button
                style={{ padding:'4px 10px', borderRadius:4, fontSize:12, fontWeight:500, color:'#fff', background:'#4f46e5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <List style={{ width:13, height:13 }} /> List view
              </button>
              <div style={{ width:1, height:16, background:'#e5e7eb' }} />
              <button onClick={() => router.push('/time-tracking/rates')}
                style={{ padding:'4px 10px', borderRadius:4, fontSize:12, fontWeight:500, color:'#6b7280', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <DollarSign style={{ width:13, height:13 }} /> Rates
              </button>
            </div>
          </div>

          {/* ═══════════ MESSAGES ═══════════ */}
          {error && <div style={{ margin:'12px 20px 0', padding:'8px 12px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, color:'#b91c1c', fontSize:13 }}>{error}</div>}
          {success && <div style={{ margin:'12px 20px 0', padding:'8px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, color:'#15803d', fontSize:13 }}>{success}</div>}

          {/* ═══════════ TIME ENTRIES ═══════════ */}
          {loading ? (
            <div style={{ textAlign:'center' as const, padding:'60px 0', color:'#9ca3af' }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-3" />
              Loading time entries...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign:'center' as const, padding:'60px 0' }}>
              <Clock style={{ width:48, height:48, color:'#d1d5db', margin:'0 auto 16px' }} />
              <div style={{ fontSize:15, fontWeight:500, color:'#6b7280', marginBottom:4 }}>No time entries yet</div>
              <div style={{ color:'#9ca3af', fontSize:13 }}>Start the timer or switch to manual mode to begin tracking.</div>
            </div>
          ) : (
            <div>
              {filteredDays.map(day => {
                const isCollapsed = collapsed.has(day.key)
                return (
                  <div key={day.key} style={{ borderBottom:'2px solid #e5e7eb', marginTop:4 }}>

                    {/* ── Day Header ── */}
                    <div onClick={() => toggleDay(day.key)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', height:48, paddingLeft:20, paddingRight:20, cursor:'pointer', userSelect:'none' as const }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <ChevronRight style={{ width:14, height:14, color:'#9ca3af', transition:'transform 0.15s', transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }} />
                        <span style={{ fontSize:14, fontWeight:700, color:'#111827', letterSpacing:'-0.01em' }}>{day.label}</span>
                        <span style={{ fontSize:12, color:'#9ca3af' }}>{day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'}</span>
                      </div>
                      <span style={{ fontSize:14, fontFamily:'ui-monospace, SFMono-Regular, monospace', color:'#374151', fontWeight:500, fontVariantNumeric:'tabular-nums' }}>{fmt(day.total)}</span>
                    </div>

                    {/* ── Entry Groups ── */}
                    {!isCollapsed && day.entryGroups.map(group => {
                      const isGroupExpanded = expandedGroups.has(`${day.key}:${group.key}`)
                      const hasMultiple = group.entries.length > 1
                      const latestEntry = group.entries[0]

                      return (
                        <div key={group.key}>
                          {/* Group summary row */}
                          <div className="group"
                            style={{ display:'grid', gridTemplateColumns:'32px minmax(0,1.2fr) minmax(0,1fr) 24px 160px 72px auto', alignItems:'center', height:50, paddingLeft:20, paddingRight:12, borderTop:'1px solid #f9fafb', width:'100%', boxSizing:'border-box' as const }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                            {/* Count badge or spacer */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {hasMultiple ? (
                                <button onClick={() => toggleGroup(day.key, group.key)}
                                  style={{ width:24, height:24, borderRadius:6, border:'1px solid #e5e7eb', background: isGroupExpanded ? '#eff6ff' : '#fff', color: isGroupExpanded ? '#3b82f6' : '#6b7280', fontSize:11, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = isGroupExpanded ? '#3b82f6' : '#6b7280' }}>
                                  {group.entries.length}
                                </button>
                              ) : null}
                            </div>

                            {/* Description — fixed proportion, truncated */}
                            <div style={{ overflow:'hidden', cursor:'pointer' }}
                              onClick={() => { setEditing(latestEntry.id); setEditDesc(latestEntry.description||""); setEditProj(latestEntry.project_id||undefined) }}>
                              {latestEntry.description ? (
                                <div style={{ fontSize:14, color:'#111', whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' }}>{latestEntry.description}</div>
                              ) : (
                                <div style={{ fontSize:14, color:'#c9c9c9', fontStyle:'italic' }}>Add description</div>
                              )}
                            </div>

                            {/* Project — fixed proportion, truncated */}
                            <div style={{ overflow:'hidden', display:'flex', alignItems:'center', gap:6, paddingLeft:12 }}>
                              {group.project_title && (<>
                                <span style={{ width:8, height:8, borderRadius:'50%', flexShrink:0, background: color(group.project_id || 0) }} />
                                <span style={{ fontSize:13, fontWeight:500, color: color(group.project_id || 0), whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' }}>
                                  {group.project_title}
                                </span>
                                {group.company_name && (
                                  <span style={{ fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis', flexShrink:1, marginLeft:4 }}>
                                    {group.company_name}
                                  </span>
                                )}
                              </>)}
                            </div>

                            {/* Billable icon — fixed 24px */}
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <DollarSign style={{ width:14, height:14, color: group.is_billable ? '#e8a82a' : '#e5e7eb' }} />
                            </div>

                            {/* Time range — fixed 160px */}
                            <span style={{ fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' as const, fontVariantNumeric:'tabular-nums', textAlign:'right' as const }}>
                              {!hasMultiple ? `${time12(latestEntry.start_time)} - ${latestEntry.end_time ? time12(latestEntry.end_time) : '...'}` : ''}
                            </span>

                            {/* Duration — fixed 72px */}
                            <span style={{ fontSize:14, fontFamily:'ui-monospace, SFMono-Regular, monospace', color:'#374151', fontWeight:500, fontVariantNumeric:'tabular-nums', textAlign:'right' as const }}>
                              {fmt(group.totalSeconds)}
                            </span>

                            {/* Hover actions */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:2, marginLeft:4 }}>
                              <button onClick={() => resume(latestEntry)} style={{ padding:4, color:'#d1d5db', background:'transparent', border:'none', cursor:'pointer' }} title="Continue"
                                onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                                <Play style={{ width:14, height:14, fill:'currentColor' }} />
                              </button>
                              <button onClick={() => { setEditing(latestEntry.id); setEditDesc(latestEntry.description||""); setEditProj(latestEntry.project_id||undefined) }}
                                style={{ padding:4, color:'#d1d5db', background:'transparent', border:'none', cursor:'pointer' }} title="Edit"
                                onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                                <Edit2 style={{ width:14, height:14 }} />
                              </button>
                              {!hasMultiple && (
                                <button onClick={() => del(latestEntry.id)} style={{ padding:4, color:'#d1d5db', background:'transparent', border:'none', cursor:'pointer' }} title="Delete"
                                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                                  <Trash2 style={{ width:14, height:14 }} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded individual entries within a group */}
                          {hasMultiple && isGroupExpanded && group.entries.map(entry => {
                            const isEdit = editing === entry.id
                            if (isEdit) {
                              return (
                                <div key={entry.id} style={{ display:'flex', alignItems:'center', gap:8, height:44, paddingLeft:52, paddingRight:12, background:'#fafafa' }}>
                                  <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                    style={{ flex:'1 1 auto', minWidth:0, border:'1px solid #d1d5db', borderRadius:4, padding:'4px 8px', fontSize:13, color:'#111', outline:'none' }}
                                    placeholder="Description" autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') update(entry.id); if (e.key === 'Escape') setEditing(null) }} />
                                  <ProjectPicker projects={projects} value={editProj} onChange={setEditProj} compact />
                                  <button onClick={() => update(entry.id)} style={{ padding:4, color:'#16a34a', background:'transparent', border:'none', cursor:'pointer' }}><Check style={{ width:14, height:14 }} /></button>
                                  <button onClick={() => setEditing(null)} style={{ padding:4, color:'#9ca3af', background:'transparent', border:'none', cursor:'pointer' }}><X style={{ width:14, height:14 }} /></button>
                                </div>
                              )
                            }
                            return (
                              <div key={entry.id} className="group"
                                style={{ display:'grid', gridTemplateColumns:'32px minmax(0,1.2fr) minmax(0,1fr) 24px 160px 72px auto', alignItems:'center', height:44, paddingLeft:52, paddingRight:12, borderTop:'1px solid #f3f4f6', background:'#fafafa', width:'100%', boxSizing:'border-box' as const }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}>
                                {/* Spacer (no badge for sub-entries) */}
                                <div />
                                {/* Description */}
                                <div style={{ overflow:'hidden', cursor:'pointer' }}
                                  onClick={() => { setEditing(entry.id); setEditDesc(entry.description||""); setEditProj(entry.project_id||undefined) }}>
                                  {entry.description ? (
                                    <div style={{ fontSize:13, color:'#374151', whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' }}>{entry.description}</div>
                                  ) : (
                                    <div style={{ fontSize:13, color:'#c9c9c9', fontStyle:'italic' }}>Add description</div>
                                  )}
                                </div>
                                {/* Spacer (project shown at group level) */}
                                <div />
                                {/* Billable icon */}
                                <div style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <DollarSign style={{ width:12, height:12, color: entry.is_billable ? '#e8a82a' : '#e5e7eb' }} />
                                </div>
                                {/* Time range */}
                                <span style={{ fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' as const, fontVariantNumeric:'tabular-nums', textAlign:'right' as const }}>
                                  {time12(entry.start_time)} - {entry.end_time ? time12(entry.end_time) : '...'}
                                </span>
                                {/* Duration */}
                                <span style={{ fontSize:13, fontFamily:'ui-monospace, SFMono-Regular, monospace', color:'#6b7280', fontWeight:500, fontVariantNumeric:'tabular-nums', textAlign:'right' as const }}>
                                  {fmt(entry.duration_seconds||0)}
                                </span>
                                {/* Hover actions */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:2, marginLeft:4 }}>
                                  <button onClick={() => resume(entry)} style={{ padding:3, color:'#d1d5db', background:'transparent', border:'none', cursor:'pointer' }} title="Continue"
                                    onMouseEnter={e => (e.currentTarget.style.color = '#22c55e')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                                    <Play style={{ width:12, height:12, fill:'currentColor' }} />
                                  </button>
                                  <button onClick={() => { setEditing(entry.id); setEditDesc(entry.description||""); setEditProj(entry.project_id||undefined) }}
                                    style={{ padding:3, color:'#d1d5db', background:'transparent', border:'none', cursor:'pointer' }} title="Edit"
                                    onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                                    <Edit2 style={{ width:12, height:12 }} />
                                  </button>
                                  <button onClick={() => del(entry.id)} style={{ padding:3, color:'#d1d5db', background:'transparent', border:'none', cursor:'pointer' }} title="Delete"
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                                    <Trash2 style={{ width:12, height:12 }} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}

                          {/* Single entry edit mode */}
                          {!hasMultiple && editing === latestEntry.id && (
                            <div style={{ display:'flex', alignItems:'center', gap:8, height:44, paddingLeft:52, paddingRight:12, background:'#fafafa', borderTop:'1px solid #f3f4f6' }}>
                              <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                style={{ flex:'1 1 auto', minWidth:0, border:'1px solid #d1d5db', borderRadius:4, padding:'4px 8px', fontSize:13, color:'#111', outline:'none' }}
                                placeholder="Description" autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') update(latestEntry.id); if (e.key === 'Escape') setEditing(null) }} />
                              <ProjectPicker projects={projects} value={editProj} onChange={setEditProj} compact />
                              <button onClick={() => update(latestEntry.id)} style={{ padding:4, color:'#16a34a', background:'transparent', border:'none', cursor:'pointer' }}><Check style={{ width:16, height:16 }} /></button>
                              <button onClick={() => setEditing(null)} style={{ padding:4, color:'#9ca3af', background:'transparent', border:'none', cursor:'pointer' }}><X style={{ width:16, height:16 }} /></button>
                            </div>
                          )}
                        </div>
                      )
                    })}
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
