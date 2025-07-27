"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import EmailCompose, { EmailMessage } from "@/components/email/EmailCompose"
import DailySummaryCard from "@/components/dashboard/DailySummaryCard"
import TasksCard from "@/components/dashboard/TasksCard"
import { getAuthState } from "@/lib/auth"
import { dashboardAPI, Activity, handleAPIError, o365IntegrationAPI, projectAPI, dealAPI } from "@/lib/api"

// Force dynamic rendering to prevent static generation issues with auth
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [showEmailCompose, setShowEmailCompose] = useState(false)
  const [organizationName, setOrganizationName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
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
  
  // Get auth state - will be null during SSR
  const { organization, user } = getAuthState()
  
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
        setRecentActivity(activities)
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
        
        // Load projects and deals in parallel
        const [projects, deals] = await Promise.all([
          projectAPI.getProjects({ limit: 1000 }),
          dealAPI.getDeals({ limit: 1000 })
        ])
        
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
        <p className="text-muted-foreground mt-1">Welcome back{firstName ? `, ${firstName}` : ''}. Here's your CRM overview.</p>
      </div>

      {/* AI Daily Summary */}
      <div className="mb-8">
        <DailySummaryCard />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
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
            <div className="text-3xl">📋</div>
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
            <div className="text-3xl">💰</div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total projected revenue</p>
        </div>

        {/* Projected Hours */}
        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Projected Hours</p>
              <p className="text-2xl font-bold mt-1 text-blue-600">
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-16 block rounded"></span>
                ) : (
                  metrics.projectedHours.toLocaleString()
                )}
              </p>
            </div>
            <div className="text-3xl">⏱️</div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total hours planned</p>
        </div>

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
            <div className="text-3xl">🎯</div>
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
              <p className="text-2xl font-bold mt-1 text-purple-600">
                {metricsLoading ? (
                  <span className="animate-pulse bg-gray-200 h-8 w-24 block rounded"></span>
                ) : (
                  formatCurrency(metrics.totalPipelineValue)
                )}
              </p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total potential revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks */}
        <TasksCard />

        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-semibold mb-6 flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
            Quick Actions
          </h2>
          <div className="space-y-3">
            <a href="/companies/new" className="block w-full text-left px-4 py-3 border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all group">
              <div className="flex items-center">
                <span className="text-blue-600 mr-3">🏢</span>
                <span className="group-hover:text-blue-700">Add New Company</span>
              </div>
            </a>
            <a href="/contacts/new" className="block w-full text-left px-4 py-3 border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all group">
              <div className="flex items-center">
                <span className="text-green-600 mr-3">👤</span>
                <span className="group-hover:text-green-700">Add New Contact</span>
              </div>
            </a>
            {o365Connected && (
              <button 
                onClick={() => setShowEmailCompose(true)}
                className="block w-full text-left px-4 py-3 border border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-all group"
              >
                <div className="flex items-center">
                  <span className="text-purple-600 mr-3">✉️</span>
                  <span className="group-hover:text-purple-700">Send Email</span>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <h2 className="text-lg font-semibold mb-6 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
            Recent Activity
          </h2>
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
                <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
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