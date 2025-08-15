"use client"

import { Project, ProjectStage } from "@/lib/api"
import { 
  Target, DollarSign, Clock, TrendingUp, AlertTriangle, 
  Trophy, Users, Calendar, CheckCircle, Zap
} from "lucide-react"

interface ProjectStatsProps {
  projects: Project[]
  stages: ProjectStage[]
}

export default function ProjectStats({ projects, stages }: ProjectStatsProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  
  // Filter active projects
  const activeProjects = projects.filter(p => p.is_active)
  
  // Calculate project value
  const calculateProjectValue = (project: Project) => {
    if (!project.hourly_rate || !project.projected_hours) return 0
    return project.hourly_rate * project.projected_hours
  }
  
  // Calculate various metrics
  const stats = {
    totalProjects: activeProjects.length,
    totalValue: activeProjects.reduce((sum, project) => sum + calculateProjectValue(project), 0),
    totalHours: activeProjects.reduce((sum, project) => sum + (project.projected_hours || 0), 0),
    actualHours: activeProjects.reduce((sum, project) => sum + (project.actual_hours || 0), 0),
    
    // Completed projects this month
    completedThisMonth: projects.filter(p => 
      p.stage_name === 'Completed' && 
      new Date(p.updated_at) >= thisMonth
    ).length,
    
    // On-track projects (within timeline and budget)
    onTrackProjects: activeProjects.filter(p => {
      if (!p.projected_end_date) return true
      const endDate = new Date(p.projected_end_date)
      const daysToEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const actualHours = p.actual_hours || 0
      const projectedHours = p.projected_hours || 0
      
      // Consider on-track if: not overdue AND (no time logged OR under projected hours)
      return daysToEnd >= 0 && (actualHours === 0 || actualHours <= projectedHours * 1.1)
    }).length,
    
    // At-risk projects (approaching deadline or over budget)
    atRiskProjects: activeProjects.filter(p => {
      const endDate = p.projected_end_date ? new Date(p.projected_end_date) : null
      const actualHours = p.actual_hours || 0
      const projectedHours = p.projected_hours || 0
      
      if (endDate) {
        const daysToEnd = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        // At risk if: due within 7 days OR over projected hours by 10%
        return (daysToEnd > 0 && daysToEnd <= 7) || (projectedHours > 0 && actualHours > projectedHours * 1.1)
      }
      
      return projectedHours > 0 && actualHours > projectedHours * 1.1
    }).length,
    
    // Overdue projects
    overdueProjects: activeProjects.filter(p => {
      if (!p.projected_end_date || p.stage_name === 'Completed') return false
      const endDate = new Date(p.projected_end_date)
      return endDate < today
    }).length,
    
    // Average hourly rate
    averageRate: activeProjects.length > 0 ? 
      activeProjects.reduce((sum, p) => sum + (p.hourly_rate || 0), 0) / activeProjects.length : 0,
  }
  
  // Calculate stage progression rates
  const stageProgression = stages.map((stage, index) => {
    if (index === 0) return null
    const currentStageProjects = activeProjects.filter(p => p.stage_id === stage.id).length
    const previousStageProjects = activeProjects.filter(p => p.stage_id === stages[index - 1].id).length
    const totalPrevious = previousStageProjects + currentStageProjects
    return totalPrevious > 0 ? Math.round((currentStageProjects / totalPrevious) * 100) : 0
  })
  
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }
  
  const formatHours = (hours: number) => {
    if (hours >= 1000) {
      return `${(hours / 1000).toFixed(1)}K hrs`
    }
    return `${hours.toFixed(0)} hrs`
  }
  
  const mainStats = [
    {
      title: "Active Projects",
      value: stats.totalProjects,
      subtitle: `${stats.onTrackProjects} on track`,
      icon: Target,
      useTheme: 'primary'
    },
    {
      title: "Project Value",
      value: formatCurrency(stats.totalValue),
      subtitle: `${formatCurrency(stats.averageRate)}/hr avg rate`,
      icon: DollarSign,
      useTheme: 'success'
    },
    {
      title: "Total Hours",
      value: formatHours(stats.totalHours),
      subtitle: `${formatHours(stats.actualHours)} logged`,
      icon: Clock,
      useTheme: 'warning'
    },
    {
      title: "Completed",
      value: stats.completedThisMonth,
      subtitle: `${Math.round((stats.completedThisMonth / Math.max(1, stats.totalProjects)) * 100)}% completion rate`,
      icon: Trophy,
      useTheme: 'accent'
    }
  ]
  
  // Alert stats for issues
  const alertStats = [
    ...(stats.overdueProjects > 0 ? [{
      title: "Overdue Projects",
      value: stats.overdueProjects,
      subtitle: `${formatCurrency(activeProjects.filter(p => {
        if (!p.projected_end_date || p.stage_name === 'Completed') return false
        const endDate = new Date(p.projected_end_date)
        return endDate < today
      }).reduce((sum, p) => sum + calculateProjectValue(p), 0))} at risk`,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      urgent: true
    }] : []),
    
    ...(stats.atRiskProjects > 0 ? [{
      title: "At Risk Projects",
      value: stats.atRiskProjects,
      subtitle: "Approaching deadlines or over budget",
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      urgent: false
    }] : [])
  ]
  
  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat, index) => {
          const Icon = stat.icon
          
          // Define theme-aware colors (same logic as PipelineStats)
          const getThemeStyles = (theme: string) => {
            switch (theme) {
              case 'primary':
                return {
                  iconBg: 'var(--theme-primary)',
                  cardBg: 'var(--theme-primary-background)',
                  borderColor: 'var(--theme-primary-border)'
                }
              case 'success':
                return {
                  iconBg: '#10b981', // Emerald-500 for success
                  cardBg: 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }
              case 'warning':
                return {
                  iconBg: '#f59e0b', // Amber-500 for warning
                  cardBg: 'rgba(245, 158, 11, 0.1)',
                  borderColor: 'rgba(245, 158, 11, 0.3)'
                }
              case 'accent':
                return {
                  iconBg: 'var(--theme-accent)',
                  cardBg: 'var(--theme-accent-background)',
                  borderColor: 'var(--theme-primary-border)'
                }
              default:
                return {
                  iconBg: 'var(--theme-primary)',
                  cardBg: 'var(--theme-primary-background)',
                  borderColor: 'var(--theme-primary-border)'
                }
            }
          }
          
          const styles = getThemeStyles(stat.useTheme)
          
          return (
            <div 
              key={index} 
              className="border rounded-lg p-4 transition-all hover:shadow-md"
              style={{ 
                backgroundColor: styles.cardBg,
                borderColor: styles.borderColor
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: styles.iconBg }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{stat.value}</div>
                </div>
              </div>
              <div>
                <p className="font-medium text-gray-800 mb-1">{stat.title}</p>
                <p className="text-sm text-gray-600">{stat.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Alert Stats */}
      {alertStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alertStats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className={`${stat.bgColor} border-2 ${stat.urgent ? 'border-red-200 animate-pulse' : 'border-yellow-200'} rounded-lg p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{stat.title}</p>
                      <p className="text-sm text-gray-600">{stat.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Project Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stage Progression */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">Stage Progression</h3>
          </div>
          
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const stageProjects = activeProjects.filter(p => p.stage_id === stage.id).length
              const maxProjects = Math.max(...stages.map(s => activeProjects.filter(p => p.stage_id === s.id).length), 1)
              const percentage = (stageProjects / maxProjects) * 100
              const progressionRate = stageProgression[index]
              
              return (
                <div key={stage.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stage.name}</span>
                    <div className="flex items-center gap-2">
                      <span>{stageProjects} projects</span>
                      {progressionRate !== null && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {progressionRate}% progression
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: 'var(--theme-primary)'
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* Project Health Score */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold">Project Health</h3>
          </div>
          
          {/* Calculate health score */}
          {(() => {
            const healthScore = Math.min(100, Math.round(
              (stats.onTrackProjects / Math.max(1, stats.totalProjects) * 40) +
              (stats.completedThisMonth / Math.max(1, stats.totalProjects) * 30) +
              ((stats.totalProjects - stats.atRiskProjects) / Math.max(1, stats.totalProjects) * 20) +
              ((stats.totalProjects - stats.overdueProjects) / Math.max(1, stats.totalProjects) * 10)
            ))
            
            const getHealthColor = (score: number) => {
              if (score >= 80) return { color: 'text-green-600', bg: 'bg-green-100', label: 'Excellent' }
              if (score >= 60) return { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Good' }
              if (score >= 40) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Fair' }
              return { color: 'text-red-600', bg: 'bg-red-100', label: 'Needs Attention' }
            }
            
            const health = getHealthColor(healthScore)
            
            return (
              <div className="text-center">
                <div className={`text-5xl font-bold mb-2 ${health.color}`}>
                  {healthScore}%
                </div>
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${health.color} ${health.bg} mb-4`}>
                  {health.label}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{stats.onTrackProjects}</div>
                    <div className="text-gray-600">On Track</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{formatCurrency(stats.averageRate)}</div>
                    <div className="text-gray-600">Avg Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{stats.atRiskProjects}</div>
                    <div className="text-gray-600">At Risk</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{stats.overdueProjects}</div>
                    <div className="text-gray-600">Overdue</div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}