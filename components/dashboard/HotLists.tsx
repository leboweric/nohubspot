"use client"

import Link from "next/link"
import { TrendingUp, AlertTriangle, Trophy, Clock, DollarSign } from "lucide-react"

interface Deal {
  id: number
  title: string
  value: number
  stage: string
  company_name?: string
  days_in_stage?: number
  expected_close_date?: string
}

interface HotListsProps {
  hotDeals: Deal[]
  atRiskDeals: Deal[]
  recentWins: Deal[]
  loading?: boolean
}

export default function HotLists({ hotDeals, atRiskDeals, recentWins, loading }: HotListsProps) {
  const formatValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value.toLocaleString()}`
  }
  
  const getDaysUntilClose = (date: string) => {
    const closeDate = new Date(date)
    const today = new Date()
    const diffTime = closeDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border rounded-lg p-6">
            <div className="animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map(j => (
                  <div key={j} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Hot Deals */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Hot Deals</h3>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        
        {hotDeals.length > 0 ? (
          <div className="space-y-3">
            {hotDeals.slice(0, 5).map(deal => (
              <Link
                key={deal.id}
                href="/pipeline"
                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="font-medium text-sm truncate flex-1 mr-2">{deal.title}</p>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatValue(deal.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{deal.company_name || 'No company'}</span>
                  {deal.expected_close_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getDaysUntilClose(deal.expected_close_date)}d
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hot deals at the moment
          </p>
        )}
        
        {hotDeals.length > 5 && (
          <Link 
            href="/pipeline" 
            className="block text-center text-sm hover:underline mt-4"
            style={{ color: 'var(--color-primary)' }}
          >
            View all {hotDeals.length} hot deals →
          </Link>
        )}
      </div>
      
      {/* At Risk Deals */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">At Risk</h3>
          <AlertTriangle className="w-5 h-5 text-gray-400" />
        </div>
        
        {atRiskDeals.length > 0 ? (
          <div className="space-y-3">
            {atRiskDeals.slice(0, 5).map(deal => (
              <Link
                key={deal.id}
                href="/pipeline"
                className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="font-medium text-sm truncate flex-1 mr-2">{deal.title}</p>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatValue(deal.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{deal.stage}</span>
                  {deal.days_in_stage && deal.days_in_stage > 30 && (
                    <span className="text-gray-600">
                      {deal.days_in_stage}d in stage
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No deals at risk
          </p>
        )}
        
        {atRiskDeals.length > 5 && (
          <Link 
            href="/pipeline" 
            className="block text-center text-sm hover:underline mt-4"
            style={{ color: 'var(--color-primary)' }}
          >
            View all {atRiskDeals.length} at-risk deals →
          </Link>
        )}
      </div>
      
      {/* Recent Wins */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Wins</h3>
          <Trophy className="w-5 h-5 text-gray-400" />
        </div>
        
        {recentWins.length > 0 ? (
          <div className="space-y-3">
            {recentWins.slice(0, 5).map(deal => (
              <div
                key={deal.id}
                className="p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex justify-between items-start mb-1">
                  <p className="font-medium text-sm truncate flex-1 mr-2">{deal.title}</p>
                  <span className="text-sm font-semibold text-gray-700">
                    {formatValue(deal.value)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {deal.company_name || 'No company'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No recent wins yet
          </p>
        )}
        
        {recentWins.length > 5 && (
          <Link 
            href="/pipeline" 
            className="block text-center text-sm hover:underline mt-4"
            style={{ color: 'var(--color-primary)' }}
          >
            View all {recentWins.length} wins →
          </Link>
        )}
      </div>
    </div>
  )
}