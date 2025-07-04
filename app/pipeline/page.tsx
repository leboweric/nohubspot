"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import KanbanBoard from "@/components/KanbanBoard"
import { pipelineAPI, dealAPI, handleAPIError, PipelineStage, Deal } from "@/lib/api"

export default function PipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedStage, setSelectedStage] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')

  useEffect(() => {
    loadPipelineData()
  }, [])

  const loadPipelineData = async () => {
    try {
      setLoading(true)
      setError("")
      
      // Load stages first
      const stagesData = await pipelineAPI.getStages()
      setStages(stagesData)
      
      // If no stages exist, offer to create defaults
      if (stagesData.length === 0) {
        setError("No pipeline stages found. Would you like to create default stages?")
        return
      }
      
      // Load all deals
      const dealsData = await dealAPI.getDeals({ limit: 100 })
      setDeals(dealsData)
      
    } catch (err) {
      setError(handleAPIError(err))
    } finally {
      setLoading(false)
    }
  }

  const initializeDefaultStages = async () => {
    try {
      setLoading(true)
      setError("")
      
      const result = await pipelineAPI.initializeDefaultStages()
      setSuccess(result.message)
      
      // Reload data
      await loadPipelineData()
      
    } catch (err) {
      setError(handleAPIError(err))
      setLoading(false)
    }
  }

  const getDealsForStage = (stageId: number) => {
    return deals.filter(deal => deal.stage_id === stageId && deal.is_active)
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value)
  }

  const handleDealMove = async (dealId: number, newStageId: number) => {
    try {
      setError("")
      // Optimistically update the UI
      setDeals(prevDeals => 
        prevDeals.map(deal => 
          deal.id === dealId ? { ...deal, stage_id: newStageId } : deal
        )
      )
      
      // Update the deal in the backend
      await dealAPI.updateDeal(dealId, { stage_id: newStageId })
      
      // Show success message briefly
      setSuccess("Deal moved successfully!")
      setTimeout(() => setSuccess(""), 2000)
      
    } catch (err) {
      setError(handleAPIError(err))
      // Revert the optimistic update by reloading data
      await loadPipelineData()
    }
  }

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading pipeline...</p>
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    )
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold">Sales Pipeline</h1>
                <p className="text-muted-foreground mt-1">
                  Track your deals through each stage of the sales process
                </p>
              </div>
              
              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'kanban'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 Board
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📄 List
                </button>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-red-700">{error}</div>
                {error.includes("create default stages") && (
                  <button
                    onClick={initializeDefaultStages}
                    className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                  >
                    Create Default Stages
                  </button>
                )}
              </div>
            </div>
          )}
          
          {success && (
            <div className="rounded-md bg-green-50 p-4 mb-6">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* Pipeline Overview */}
          {stages.length > 0 && (
            <div className="space-y-6">
              {/* Pipeline Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-primary">
                    {deals.filter(d => d.is_active).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active Deals</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(
                      deals
                        .filter(d => d.is_active)
                        .reduce((sum, deal) => sum + deal.value, 0)
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Pipeline Value</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(
                      deals
                        .filter(d => d.is_active)
                        .reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0)
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Weighted Value</div>
                </div>
                <div className="bg-card border rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {deals.filter(d => d.is_active && d.stage_name?.includes('Won')).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Won This Month</div>
                </div>
              </div>

              {/* Stage Filters - Only show in list view */}
              {viewMode === 'list' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedStage(null)}
                    className={`px-3 py-1 rounded text-sm ${
                      selectedStage === null
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    All Stages
                  </button>
                  {stages.map(stage => (
                    <button
                      key={stage.id}
                      onClick={() => setSelectedStage(stage.id)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedStage === stage.id
                          ? 'text-white'
                          : 'text-muted-foreground hover:opacity-80'
                      }`}
                      style={{
                        backgroundColor: selectedStage === stage.id ? stage.color : undefined,
                        border: selectedStage !== stage.id ? `1px solid ${stage.color}` : undefined
                      }}
                    >
                      {stage.name} ({stage.deal_count || 0})
                    </button>
                  ))}
                </div>
              )}

              {/* Conditional View Rendering */}
              {viewMode === 'kanban' ? (
                /* Kanban Board View */
                <div className="h-[calc(100vh-400px)]">
                  <KanbanBoard
                    stages={stages}
                    deals={deals}
                    onDealMove={handleDealMove}
                    onAddDeal={() => {
                      // TODO: Open deal creation modal
                      console.log('Add new deal')
                    }}
                  />
                </div>
              ) : (
                /* List View */
                <div className="space-y-6">
                  {stages
                    .filter(stage => selectedStage === null || stage.id === selectedStage)
                    .map(stage => {
                      const stageDeals = getDealsForStage(stage.id)
                      
                      return (
                        <div key={stage.id} className="bg-card border rounded-lg">
                          <div 
                            className="px-6 py-4 border-b"
                            style={{ borderLeftColor: stage.color, borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold">{stage.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {stageDeals.length} deals • {formatCurrency(
                                    stageDeals.reduce((sum, deal) => sum + deal.value, 0)
                                  )}
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Weighted Value</div>
                                <div className="font-semibold">
                                  {formatCurrency(
                                    stageDeals.reduce((sum, deal) => sum + (deal.value * deal.probability / 100), 0)
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="p-6">
                            {stageDeals.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                No deals in this stage
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {stageDeals.map(deal => (
                                  <div key={deal.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-sm">{deal.title}</h4>
                                        <div className="text-2xl font-bold text-primary mt-1">
                                          {formatCurrency(deal.value, deal.currency)}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                          {deal.probability}% probability
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                                      {deal.contact_name && (
                                        <div>Contact: {deal.contact_name}</div>
                                      )}
                                      {deal.company_name && (
                                        <div>Company: {deal.company_name}</div>
                                      )}
                                      {deal.assignee_name && (
                                        <div>Assigned: {deal.assignee_name}</div>
                                      )}
                                      {deal.expected_close_date && (
                                        <div>
                                          Close: {new Date(deal.expected_close_date).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                  {/* Quick Actions for List View */}
                  <div className="flex justify-center">
                    <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                      + Add New Deal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </MainLayout>
    </AuthGuard>
  )
}