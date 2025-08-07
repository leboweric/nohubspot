"use client"

import { ArrowUp, ArrowDown, TrendingUp, Users, DollarSign, Clock } from "lucide-react"

interface Metric {
  label: string
  value: string | number
  change: number
  changeLabel: string
  icon: React.ElementType
  color: string
  sparklineData?: number[]
}

interface PerformanceMetricsProps {
  metrics: Metric[]
  loading?: boolean
}

export default function PerformanceMetrics({ metrics, loading }: PerformanceMetricsProps) {
  const generateSparkline = (data: number[] = []) => {
    if (data.length === 0) {
      data = [30, 35, 25, 45, 50, 40, 55, 60, 58, 65, 70, 68]
    }
    
    const max = Math.max(...data)
    const min = Math.min(...data)
    const range = max - min || 1
    const width = 100
    const height = 30
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x},${y}`
    }).join(' ')
    
    return (
      <svg className="w-full h-8" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary opacity-50"
        />
        <polyline
          points={`${points} ${width},${height} 0,${height}`}
          fill="currentColor"
          className="text-primary opacity-10"
        />
      </svg>
    )
  }
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        const isPositive = metric.change >= 0
        const ChangeIcon = isPositive ? ArrowUp : ArrowDown
        
        return (
          <div key={index} className="bg-card border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </span>
              <div className={`p-2 rounded-lg ${metric.color}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <div className="mb-2">
              <p className="text-2xl font-bold">{metric.value}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <ChangeIcon className={`w-3 h-3 ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`} />
                <span className={`text-xs font-medium ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}>
                  {Math.abs(metric.change)}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  {metric.changeLabel}
                </span>
              </div>
            </div>
            
            <div className="mt-3">
              {generateSparkline(metric.sparklineData)}
            </div>
          </div>
        )
      })}
    </div>
  )
}