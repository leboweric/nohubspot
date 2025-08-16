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
          style={{ color: index === 0 ? 'var(--color-primary-light)' : index === 1 ? 'var(--color-secondary-light)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-300)' }}
        />
        <polyline
          points={`${points} ${width},${height} 0,${height}`}
          fill="currentColor"
          style={{ color: index === 0 ? 'var(--color-primary-light)' : index === 1 ? 'var(--color-secondary-light)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-100)', opacity: 0.3 }}
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
          <div key={index} 
            className="bg-white border rounded-lg p-6 hover:shadow-lg transition-all"
            style={{ 
              borderColor: index === 0 ? 'var(--color-primary-light)' : index === 1 ? 'var(--color-secondary-light)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-200)',
              borderWidth: '1px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = index === 0 ? 'var(--color-primary)' : index === 1 ? 'var(--color-secondary)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-300)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = index === 0 ? 'var(--color-primary-light)' : index === 1 ? 'var(--color-secondary-light)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-200)'
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                {metric.label}
              </span>
              <Icon className="w-4 h-4" style={{ color: index === 0 ? 'var(--color-primary)' : index === 1 ? 'var(--color-secondary)' : index === 2 ? 'var(--color-accent)' : 'var(--color-neutral-400)' }} />
            </div>
            
            <div className="mb-2">
              <p className="text-2xl font-bold">{metric.value}</p>
            </div>
            
            <div className="flex items-center gap-1">
              <ChangeIcon className={`w-3 h-3 ${
                isPositive ? 'text-gray-500' : 'text-gray-500'
              }`} />
              <span className="text-xs text-gray-500">
                {Math.abs(metric.change)}%
              </span>
              <span className="text-xs text-gray-400 ml-1">
                {metric.changeLabel}
              </span>
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