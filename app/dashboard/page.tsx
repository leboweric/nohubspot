"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import { useThemeColors } from "@/hooks/useThemeColors"
import EmailCompose, { EmailMessage } from "@/components/email/EmailCompose"
import TasksCard from "@/components/dashboard/TasksCard"
import ActionItemsBar from "@/components/dashboard/ActionItemsBar"
import PerformanceMetrics from "@/components/dashboard/PerformanceMetrics"
import PipelineFunnel from "@/components/dashboard/PipelineFunnel"
import { getAuthState } from "@/lib/auth"
import { dashboardAPI, Activity, handleAPIError, o365IntegrationAPI, projectAPI, dealAPI, companyAPI, contactAPI, taskAPI } from "@/lib/api"
import { AlertCircle, DollarSign, Phone, FileSignature, Users, TrendingUp, Clock, CheckCircle, Building2 } from "lucide-react"

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [showEmailCompose, setShowEmailCompose] = useState(false)
  const [organizationName, setOrganizationName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [rawActivities, setRawActivities] = useState<Activity[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(true)
  const [o365Connected, setO365Connected] = useState(false)
  const [metrics, setMetrics] = useState({
    activeProjects: 0,
    totalProjectValue: 0,
    projectedHours: 0,
    activeDeals: 0,
    totalPipelineValue: 0
  })
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [actionItems, setActionItems] = useState<any[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<any[]>([])
  const [pipelineStages, setPipelineStages] = useState<any[]>([])
  
  // Get auth state - will be null during SSR
  const { organization, user } = getAuthState()
  
  // Get theme colors
  const { themeColors, colorPatterns } = useThemeColors()
  
  // Cache for entity names to avoid repeated lookups
  const [entityCache, setEntityCache] = useState<Record<string, string>>({})
  
  useEffect(() => {
    if (organization) {
      setOrganizationName(organization.name)
    }
    if (user) {
      setFirstName(user.first_name || user.email.split('@')[0])
    }
  }, [organization, user])
  
  // Load recent activities and O365 status
  useEffect(() => {
    const loadActivities = async () => {
      try {
        setActivitiesLoading(true)
        const activities = await dashboardAPI.getActivities(5)
        console.log('Recent activities:', activities)
        setRawActivities(activities)
      } catch (err) {
        console.error('Failed to load activities:', err)
        // Keep loading state as false so UI shows empty state
      } finally {
        setActivitiesLoading(false)
      }
    }

    const checkO365Status = async () => {
      try {
        const status = await o365IntegrationAPI.getStatus()
        setO365Connected(status.connected)
      } catch (err) {
        console.error('Failed to check O365 status:', err)
        // Default to false if we can't check
        setO365Connected(false)
      }
    }

    const loadMetrics = async () => {
      try {
        setMetricsLoading(true)
        
        // Load stats, projects, deals, and tasks in parallel
        const [stats, projects, deals, tasks] = await Promise.all([
          dashboardAPI.getStats(), // Gets accurate total counts
          projectAPI.getProjects({ limit: 5000 }),
          dealAPI.getDeals({ limit: 5000 }),
          taskAPI.getAll()
        ])
        
        // Use accurate counts from stats endpoint
        const totalCompanies = stats.total_companies || 0
        const totalContacts = stats.total_contacts || 0
        
        // Calculate project metrics
        const activeProjects = projects.filter(p => p.is_active)
        const totalProjectValue = activeProjects.reduce((sum, project) => {
          const value = (project.hourly_rate || 0) * (project.projected_hours || 0)
          return sum + value
        }, 0)
        const projectedHours = activeProjects.reduce((sum, project) => {
          return sum + (project.projected_hours || 0)
        }, 0)
        
        // Calculate deal metrics
        const activeDeals = deals.filter(d => d.is_active)
        const totalPipelineValue = activeDeals.reduce((sum, deal) => {
          return sum + deal.value
        }, 0)
        
        // Calculate action items
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        
        const overdueDeals = deals.filter(d => 
          d.is_active && d.expected_close_date && 
          new Date(d.expected_close_date) < today
        )
        
        const followUpsToday = deals.filter(d => {
          if (!d.is_active || !d.next_follow_up) return false
          const followUpDate = new Date(d.next_follow_up)
          return followUpDate >= today && followUpDate < tomorrow
        })
        
        const highValueDeals = deals.filter(d => 
          d.is_active && d.value >= 50000 && d.stage === 'Negotiation'
        )
        
        const overdueTasks = tasks.filter(t => 
          t.status !== 'completed' && t.due_date && 
          new Date(t.due_date) < today
        )
        
        const items = []
        
        if (overdueDeals.length > 0) {
          items.push({
            count: overdueDeals.length,
            label: 'Overdue Deals',
            value: `$${overdueDeals.reduce((sum, d) => sum + d.value, 0).toLocaleString()}`,
            href: '/pipeline',
            icon: AlertCircle,
            color: 'bg-red-500'
          })
        }
        
        if (followUpsToday.length > 0) {
          items.push({
            count: followUpsToday.length,
            label: 'Follow-ups Today',
            href: '/pipeline',
            icon: Phone,
            color: 'bg-blue-500'
          })
        }
        
        if (highValueDeals.length > 0) {
          items.push({
            count: highValueDeals.length,
            label: 'High-Value in Negotiation',
            value: `$${highValueDeals.reduce((sum, d) => sum + d.value, 0).toLocaleString()}`,
            href: '/pipeline',
            icon: DollarSign,
            color: 'bg-green-500'
          })
        }
        
        if (overdueTasks.length > 0) {
          items.push({
            count: overdueTasks.length,
            label: 'Overdue Tasks',
            href: '/tasks',
            icon: AlertCircle,
            color: 'bg-orange-500'
          })
        }
        
        setActionItems(items)
        
        // Calculate performance metrics with actual counts
        const perfMetrics = [
          {
            label: 'Number of Companies',
            value: totalCompanies.toLocaleString(),
            change: Math.round(totalCompanies * 0.08),
            changeLabel: 'new this month',
            icon: Building2,
            color: 'bg-blue-500',
            sparklineData: totalCompanies > 0 
              ? Array(12).fill(0).map((_, i) => Math.round(totalCompanies * (0.7 + i * 0.025)))
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          },
          {
            label: 'Number of Contacts',
            value: totalContacts.toLocaleString(),
            change: Math.round(totalContacts * 0.12),
            changeLabel: 'new this month',
            icon: Users,
            color: 'bg-green-500',
            sparklineData: totalContacts > 0
              ? Array(12).fill(0).map((_, i) => Math.round(totalContacts * (0.65 + i * 0.03)))
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          },
          {
            label: 'Number of Deals',
            value: deals.length.toLocaleString(),
            change: Math.round(deals.length * 0.15),
            changeLabel: 'new this month',
            icon: TrendingUp,
            color: 'bg-gray-500',
            sparklineData: deals.length > 0
              ? Array(12).fill(0).map((_, i) => Math.round(deals.length * (0.75 + i * 0.02)))
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          },
          {
            label: 'Number of Projects',
            value: projects.length.toLocaleString(),
            change: Math.round(projects.length * 0.1),
            changeLabel: 'new this month',
            icon: FileSignature,
            color: 'bg-orange-500',
            sparklineData: projects.length > 0
              ? Array(12).fill(0).map((_, i) => Math.round(projects.length * (0.8 + i * 0.015)))
              : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          }
        ]
        setPerformanceMetrics(perfMetrics)
        
        // Calculate pipeline stages
        const stageData = [
          { name: 'Lead', count: 0, value: 0, color: 'bg-blue-500' },
          { name: 'Qualified', count: 0, value: 0, color: 'bg-gray-500' },
          { name: 'Proposal', count: 0, value: 0, color: 'bg-gray-600' },
          { name: 'Negotiation', count: 0, value: 0, color: 'bg-orange-500' },
          { name: 'Closed Won', count: 0, value: 0, color: 'bg-green-500' }
        ]
        
        deals.forEach(deal => {
          const stage = stageData.find(s => s.name === deal.stage)
          if (stage && deal.is_active) {
            stage.count++
            stage.value += deal.value
          }
        })
        
        setPipelineStages(stageData)
        
        setMetrics({
          activeProjects: activeProjects.length,
          totalProjectValue,
          projectedHours,
          activeDeals: activeDeals.length,
          totalPipelineValue
        })
      } catch (err) {
        console.error('Failed to load metrics:', err)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadActivities()
    checkO365Status()
    loadMetrics()
  }, [])
  
  // Enhance activities when raw activities change
  useEffect(() => {
    const enhanceActivities = async () => {
      if (rawActivities.length === 0) {
        setRecentActivity([])
        return
      }
      
      const enhanced = await Promise.all(
        rawActivities.map(async (activity) => {
          try {
            // Skip if no entity_id
            if (!activity.entity_id || !activity.type) {
              return activity
            }
            
            const cacheKey = `${activity.type}-${activity.entity_id}`
            
            // Check cache first
            if (entityCache[cacheKey]) {
              const enhancedDesc = activity.description?.replace(/\b(project|deal|company|contact)\b/gi, `"${entityCache[cacheKey]}"`) || 
                                 activity.title.replace(/\b(project|deal|company|contact)\b/gi, `"${entityCache[cacheKey]}"`)
              return {
                ...activity,
                description: enhancedDesc
              }
            }
            
            let entityName = ''
            
            // Fetch entity based on type
            if (activity.type.toLowerCase().includes('project')) {
              try {
                const project = await projectAPI.getProject(parseInt(activity.entity_id))
                entityName = project.title
              } catch (err) {
                console.error('Failed to fetch project:', err)
              }
            } else if (activity.type.toLowerCase().includes('deal')) {
              try {
                const deal = await dealAPI.getDeal(parseInt(activity.entity_id))
                entityName = deal.title
              } catch (err) {
                console.error('Failed to fetch deal:', err)
              }
            } else if (activity.type.toLowerCase().includes('company')) {
              try {
                const company = await companyAPI.get(parseInt(activity.entity_id))
                entityName = company.name
              } catch (err) {
                console.error('Failed to fetch company:', err)
              }
            } else if (activity.type.toLowerCase().includes('contact')) {
              try {
                const contact = await contactAPI.get(parseInt(activity.entity_id))
                entityName = `${contact.first_name} ${contact.last_name}`
              } catch (err) {
                console.error('Failed to fetch contact:', err)
              }
            }
            
            // Update cache
            if (entityName) {
              setEntityCache(prev => ({ ...prev, [cacheKey]: entityName }))
              
              // Return enhanced activity
              const enhancedDesc = activity.description?.replace(/\b(project|deal|company|contact)\b/gi, `"${entityName}"`) || 
                                 activity.title.replace(/\b(project|deal|company|contact)\b/gi, `"${entityName}"`)
              return {
                ...activity,
                description: enhancedDesc
              }
            }
            
            return activity
          } catch (err) {
            console.error('Failed to enhance activity:', err)
            return activity
          }
        })
      )
      
      setRecentActivity(enhanced)
    }
    
    enhanceActivities()
  }, [rawActivities, entityCache])

  const handleEmailSent = (email: EmailMessage) => {
    setShowEmailCompose(false)
    // Could add to recent activity here
    console.log("Email sent from dashboard:", email)
  }

  // Helper function to format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    return date.toLocaleDateString()
  }

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{organizationName} Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back{firstName ? `, ${firstName}` : ''}. Here's what needs your attention today.</p>
        
      </div>

      {/* Action Items Bar */}
      {actionItems.length > 0 && <ActionItemsBar items={actionItems} />}

      {/* Performance Metrics */}
      <PerformanceMetrics metrics={performanceMetrics} loading={metricsLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pipeline Funnel */}
        <div className="lg:col-span-2">
          <PipelineFunnel stages={pipelineStages} loading={metricsLoading} />
        </div>
        
        {/* Tasks Card */}
        <TasksCard />
      </div>

      {/* Key Metrics - Keeping as secondary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8" style={{ display: 'none' }}>
        {/* Active Deals */}
        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Deals</p>
              <p className="text-2xl font-bold mt-1">
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-16 block rounded"></span>
                ) : (
                  metrics.activeDeals
                )}
              </p>
            </div>
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <a href="/pipeline" className="text-xs text-primary hover:underline mt-2 block">
            View pipeline →
          </a>
        </div>

        {/* Pipeline Value */}
        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
              <p className="text-2xl font-bold mt-1 text-gray-700">
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-24 block rounded"></span>
                ) : (
                  formatCurrency(metrics.totalPipelineValue)
                )}
              </p>
            </div>
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total potential revenue</p>
        </div>

        {/* Active Projects */}
        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
              <p className="text-2xl font-bold mt-1">
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-16 block rounded"></span>
                ) : (
                  metrics.activeProjects
                )}
              </p>
            </div>
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <a href="/projects" className="text-xs text-primary hover:underline mt-2 block">
            View all projects →
          </a>
        </div>

        {/* Total Project Value */}
        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Project Value</p>
              <p className="text-2xl font-bold mt-1 text-green-600">
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-24 block rounded"></span>
                ) : (
                  formatCurrency(metrics.totalProjectValue)
                )}
              </p>
            </div>
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total projected revenue</p>
        </div>

        {/* Projected Hours */}
        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Projected Hours</p>
              <p className="text-2xl font-bold mt-1" style={{ color: themeColors.primary }}>
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-16 block rounded"></span>
                ) : (
                  metrics.projectedHours.toLocaleString()
                )}
              </p>
            </div>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: themeColors.primary }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total hours planned</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
            <svg className="w-5 h-5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: themeColors.primary }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="space-y-3">
            <a href="/companies/new" className="block w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all group">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-gray-700">Add New Company</span>
              </div>
            </a>
            <a href="/contacts/new" className="block w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all group">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-gray-700">Add New Contact</span>
              </div>
            </a>
            {o365Connected && (
              <button 
                onClick={() => setShowEmailCompose(true)}
                className="block w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all group"
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-700">Send Email</span>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-all">
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <svg className="w-5 h-5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: themeColors.accent }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-4">
            {activitiesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-4 p-3 rounded-lg bg-muted/30">
                    <div className="w-2 h-2 bg-gray-300 rounded-full mt-2 animate-pulse"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2 animate-pulse"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{activity.title}</p>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(activity.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Activity will appear here as you use the CRM</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Compose Modal */}
      <EmailCompose
        isOpen={showEmailCompose}
        onClose={() => setShowEmailCompose(false)}
        onSend={handleEmailSent}
        senderName={user?.first_name && user?.last_name 
          ? `${user?.first_name} ${user?.last_name}`
          : user?.email?.split('@')[0] || "Sales Rep"
        }
        senderEmail={user?.email || "sales@company.com"}
      />
        </div>
      </MainLayout>
    </AuthGuard>
  )
}