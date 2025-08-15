"use client"

import { Deal, PipelineStage } from "@/lib/api"
import { 
  Target, DollarSign, TrendingUp, AlertTriangle, 
  Trophy, Clock, Zap, Calendar
} from "lucide-react"

interface PipelineStatsProps {
  deals: Deal[]
  stages: PipelineStage[]
}

export default function PipelineStats({ deals, stages }: PipelineStatsProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  
  // Filter active deals
  const activeDeals = deals.filter(d => d.is_active)
  
  // Calculate basic metrics first
  const totalValue = activeDeals.reduce((sum, deal) => sum + deal.value, 0)
  
  // Calculate various metrics
  const stats = {
    totalDeals: activeDeals.length,
    totalValue,
    weightedValue: activeDeals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0),
    
    // Won deals this month
    wonThisMonth: deals.filter(d => 
      d.stage_name?.includes('Won') && 
      new Date(d.updated_at) >= thisMonth
    ).length,
    
    // Hot deals (high probability)
    hotDeals: activeDeals.filter(d => d.probability >= 70).length,
    
    // At-risk deals (stalled)
    atRiskDeals: activeDeals.filter(d => {
      const updatedDate = new Date(d.updated_at)
      const daysSinceUpdate = Math.floor((today.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceUpdate > 14
    }).length,
    
    // Closing soon
    closingSoon: activeDeals.filter(d => {
      if (!d.expected_close_date) return false
      const closeDate = new Date(d.expected_close_date)
      const daysToClose = Math.floor((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysToClose >= 0 && daysToClose <= 30
    }).length,
    
    // Overdue deals
    overdueDeals: activeDeals.filter(d => {
      if (!d.expected_close_date || d.stage_name?.includes('Won')) return false
      const closeDate = new Date(d.expected_close_date)
      return closeDate < today
    }).length,
    
    // Average deal size
    averageDealSize: activeDeals.length > 0 ? totalValue / activeDeals.length : 0
  }
  
  // Calculate conversion rates
  const conversionRates = stages.map((stage, index) => {
    if (index === 0) return null
    const currentStageDeals = activeDeals.filter(d => d.stage_id === stage.id).length
    const previousStageDeals = activeDeals.filter(d => d.stage_id === stages[index - 1].id).length
    const totalPrevious = previousStageDeals + currentStageDeals
    return totalPrevious > 0 ? Math.round((currentStageDeals / totalPrevious) * 100) : 0
  })
  
  // Pipeline velocity (average time in each stage)
  const getVelocityColor = (value: number) => {
    if (value <= 7) return 'text-green-600'
    if (value <= 21) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }
  
  const mainStats = [
    {
      title: "Active Deals",
      value: stats.totalDeals,
      subtitle: `${stats.hotDeals} hot prospects`,
      icon: Target,
      useTheme: 'primary'
    },
    {
      title: "Pipeline Value",
      value: formatCurrency(stats.totalValue),
      subtitle: `${formatCurrency(stats.weightedValue)} weighted`,
      icon: DollarSign,
      useTheme: 'success'
    },
    {
      title: "Closing Soon",
      value: stats.closingSoon,
      subtitle: `${formatCurrency(activeDeals.filter(d => {
        if (!d.expected_close_date) return false
        const closeDate = new Date(d.expected_close_date)
        const daysToClose = Math.floor((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return daysToClose >= 0 && daysToClose <= 30
      }).reduce((sum, d) => sum + d.value, 0))} potential`,
      icon: Calendar,
      useTheme: 'warning'
    },
    {
      title: "Won This Month",
      value: stats.wonThisMonth,
      subtitle: `${Math.round((stats.wonThisMonth / Math.max(1, stats.totalDeals)) * 100)}% win rate`,
      icon: Trophy,
      useTheme: 'accent'
    }
  ]
  
  // Alert stats for issues
  const alertStats = [
    ...(stats.overdueDeals > 0 ? [{
      title: "Overdue Deals",
      value: stats.overdueDeals,
      subtitle: `${formatCurrency(activeDeals.filter(d => {
        if (!d.expected_close_date || d.stage_name?.includes('Won')) return false
        const closeDate = new Date(d.expected_close_date)
        return closeDate < today
      }).reduce((sum, d) => sum + d.value, 0))} at risk`,
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      urgent: true
    }] : []),
    
    ...(stats.atRiskDeals > 0 ? [{
      title: "Stalled Deals",
      value: stats.atRiskDeals,
      subtitle: "No activity in 14+ days",
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
          
          // Define theme-aware colors
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
      
      {/* Pipeline Health Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversion Funnel */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold">Stage Conversion</h3>
          </div>
          
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const stageDeals = activeDeals.filter(d => d.stage_id === stage.id).length
              const maxDeals = Math.max(...stages.map(s => activeDeals.filter(d => d.stage_id === s.id).length), 1)
              const percentage = (stageDeals / maxDeals) * 100
              const conversionRate = conversionRates[index]
              
              return (
                <div key={stage.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stage.name}</span>
                    <div className="flex items-center gap-2">
                      <span>{stageDeals} deals</span>
                      {conversionRate !== null && (
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {conversionRate}% conversion
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
        
        {/* Pipeline Health Score */}
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold">Pipeline Health</h3>
          </div>
          
          {/* Calculate health score */}
          {(() => {
            const healthScore = Math.min(100, Math.round(
              (stats.hotDeals / Math.max(1, stats.totalDeals) * 30) +
              (stats.wonThisMonth / Math.max(1, stats.totalDeals) * 25) +
              ((stats.totalDeals - stats.atRiskDeals) / Math.max(1, stats.totalDeals) * 25) +
              ((stats.totalDeals - stats.overdueDeals) / Math.max(1, stats.totalDeals) * 20)
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
                    <div className="font-semibold text-gray-800">{stats.hotDeals}</div>
                    <div className="text-gray-600">Hot Deals</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{formatCurrency(stats.averageDealSize)}</div>
                    <div className="text-gray-600">Avg Deal Size</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{stats.atRiskDeals}</div>
                    <div className="text-gray-600">At Risk</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-800">{stats.overdueDeals}</div>
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