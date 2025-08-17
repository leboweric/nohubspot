"use client"

import Link from "next/link"

interface FunnelStage {
  name: string
  count: number
  value: number
  color: string
}

interface PipelineFunnelProps {
  stages: FunnelStage[]
  loading?: boolean
}

export default function PipelineFunnel({ stages, loading }: PipelineFunnelProps) {
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-6">Pipeline Overview</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  const maxCount = Math.max(...stages.map(s => s.count), 1)
  
  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Pipeline Overview</h2>
        <Link 
          href="/pipeline" 
          className="text-sm hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          View Pipeline →
        </Link>
      </div>
      
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const percentage = (stage.count / maxCount) * 100
          const isFirstOrLast = index === 0 || index === stages.length - 1
          
          return (
            <div key={stage.name} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{stage.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {stage.count} {stage.count === 1 ? 'deal' : 'deals'}
                  </span>
                  <span className="text-sm font-semibold">
                    {formatValue(stage.value)}
                  </span>
                </div>
              </div>
              
              <div className="relative">
                <div className="h-10 rounded-md overflow-hidden" style={{ backgroundColor: 'var(--color-neutral-100)' }}>
                  <div
                    className="h-full transition-all duration-500 ease-out rounded-md"
                    style={{
                      width: `${percentage}%`,
                      minWidth: stage.count > 0 ? '60px' : '0',
                      backgroundColor: index === 0 ? 'var(--color-primary)' : 
                                     index === stages.length - 1 ? 'var(--color-secondary)' : 
                                     index === Math.floor(stages.length / 2) ? 'var(--color-accent)' :
                                     'var(--color-neutral-400)'
                    }}
                  >
                    <div className="h-full flex items-center px-3">
                      <span className="text-xs text-white font-medium whitespace-nowrap">
                        {stage.count > 0 && `${Math.round(percentage)}%`}
                      </span>
                    </div>
                  </div>
                </div>
                
                {!isFirstOrLast && index < stages.length - 1 && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Pipeline</span>
          <span className="font-semibold">
            {formatValue(stages.reduce((sum, s) => sum + s.value, 0))}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-muted-foreground">Total Deals</span>
          <span className="font-semibold">
            {stages.reduce((sum, s) => sum + s.count, 0)}
          </span>
        </div>
      </div>
    </div>
  )
}