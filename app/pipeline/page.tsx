"use client"

import { useState, useEffect } from "react"
import AuthGuard from "@/components/AuthGuard"
import MainLayout from "@/components/MainLayout"
import KanbanBoard from "@/components/KanbanBoard"
import DealModal from "@/components/DealModal"
import { pipelineAPI, dealAPI, handleAPIError, PipelineStage, Deal, DealCreate } from "@/lib/api"
import PipelineStats from "@/components/pipeline/PipelineStats"
import { 
  LayoutGrid, List, Plus, Download, Filter, Search,
  TrendingUp, DollarSign, Target, Trophy
} from "lucide-react"

export default function PipelinePage() {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedStage, setSelectedStage] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
  const [showDealModal, setShowDealModal] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [defaultStageId, setDefaultStageId] = useState<number | undefined>(undefined)

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

  const handleCreateDeal = (stageId?: number) => {
    setSelectedDeal(null)
    setDefaultStageId(stageId)
    setShowDealModal(true)
  }

  const handleEditDeal = (deal: Deal) => {
    setSelectedDeal(deal)
    setDefaultStageId(undefined)
    setShowDealModal(true)
  }

  const handleSaveDeal = async (dealData: DealCreate) => {
    try {
      setError("")
      
      if (selectedDeal) {
        // Editing existing deal
        const updatedDeal = await dealAPI.updateDeal(selectedDeal.id, dealData)
        setDeals(prevDeals => 
          prevDeals.map(deal => 
            deal.id === selectedDeal.id ? updatedDeal : deal
          )
        )
        setSuccess("Deal updated successfully!")
      } else {
        // Creating new deal
        const newDeal = await dealAPI.createDeal(dealData)
        setDeals(prevDeals => [...prevDeals, newDeal])
        setSuccess("Deal created successfully!")
      }
      
      setTimeout(() => setSuccess(""), 3000)
      
    } catch (err) {
      const errorMessage = handleAPIError(err)
      console.error('Deal save error:', err)
      throw new Error(errorMessage)
    }
  }

  const handleCloseModal = () => {
    setShowDealModal(false)
    setSelectedDeal(null)
    setDefaultStageId(undefined)
  }

  const handleDeleteDeal = async (dealId: number) => {
    try {
      setError("")
      await dealAPI.deleteDeal(dealId)
      
      // Remove deal from local state
      setDeals(prevDeals => prevDeals.filter(deal => deal.id !== dealId))
      
      setSuccess("Deal deleted successfully!")
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      const errorMessage = handleAPIError(err)
      console.error('Deal delete error:', err)
      throw new Error(errorMessage)
    }
  }

  const handleExportDeals = () => {
    try {
      // Create CSV headers
      const headers = [
        'Deal Title',
        'Stage',
        'Value',
        'Currency',
        'Probability %',
        'Weighted Value',
        'Company',
        'Contact',
        'Assigned To',
        'Expected Close Date',
        'Actual Close Date',
        'Status',
        'Description',
        'Notes',
        'Tags',
        'Created Date',
        'Last Updated'
      ]
      
      // Filter active deals if selectedStage is set (for list view)
      const dealsToExport = deals.filter(deal => {
        if (!deal.is_active) return false
        if (viewMode === 'list' && selectedStage !== null) {
          return deal.stage_id === selectedStage
        }
        return true
      })
      
      // Create CSV rows
      const rows = dealsToExport.map(deal => {
        const stage = stages.find(s => s.id === deal.stage_id)
        return [
          deal.title,
          stage?.name || '',
          deal.value.toString(),
          deal.currency,
          deal.probability.toString(),
          (deal.value * deal.probability / 100).toFixed(2),
          deal.company_name || '',
          deal.contact_name || '',
          deal.assignee_name || '',
          deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '',
          deal.actual_close_date ? new Date(deal.actual_close_date).toLocaleDateString() : '',
          deal.is_active ? 'Active' : 'Inactive',
          deal.description || '',
          deal.notes || '',
          deal.tags?.join(', ') || '',
          new Date(deal.created_at).toLocaleDateString(),
          new Date(deal.updated_at).toLocaleDateString()
        ]
      })
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma, newline, or quotes
            const escaped = cell.replace(/"/g, '""')
            return /[,"\n]/.test(cell) ? `"${escaped}"` : escaped
          }).join(',')
        )
      ].join('\n')
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      
      link.setAttribute('href', url)
      link.setAttribute('download', `deals_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up
      URL.revokeObjectURL(url)
      
      // Show success message with context
      const filterInfo = []
      if (viewMode === 'list' && selectedStage !== null) {
        const stage = stages.find(s => s.id === selectedStage)
        if (stage) filterInfo.push(`in ${stage.name} stage`)
      }
      
      const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : ''
      setSuccess(`Successfully exported ${dealsToExport.length} deals${filterText} to CSV!`)
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      console.error('Failed to export deals:', error)
      setError('Failed to export deals. Please try again.')
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
              
              <div className="flex items-center gap-4">
                {/* Export Button */}
                <button
                  onClick={handleExportDeals}
                  disabled={loading || deals.length === 0}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Export to CSV
                </button>
                
                {/* View Toggle */}
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      viewMode === 'kanban'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Board
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    List
                  </button>
                </div>
                
                {/* Create Deal Button */}
                <button
                  onClick={() => handleCreateDeal()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-white hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Plus className="w-4 h-4" />
                  Create Deal
                </button>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="rounded-lg bg-red-50 p-4 mb-6">
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
            <div className="rounded-lg bg-green-50 p-4 mb-6">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* Pipeline Overview */}
          {stages.length > 0 && (
            <div className="space-y-6">
              {/* Enhanced Pipeline Stats - Only the top row */}
              <PipelineStats deals={deals} stages={stages} showOnlyTopRow={true} />

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
                  {stages.map(stage => {
                    // Use color palette based on stage name
                    const getStageColor = () => {
                      switch(stage.name) {
                        case 'Lead': return 'var(--color-primary)';
                        case 'Qualified': return 'var(--color-primary-light)';
                        case 'Proposal': return 'var(--color-accent)';
                        case 'Negotiation': return 'var(--color-secondary-light)';
                        case 'Closed Won': return 'var(--color-secondary)';
                        case 'Closed Lost': return 'var(--color-neutral-400)';
                        default: return 'var(--color-neutral-300)';
                      }
                    }
                    const stageColor = getStageColor();
                    
                    return (
                      <button
                        key={stage.id}
                        onClick={() => setSelectedStage(stage.id)}
                        className={`px-3 py-1 rounded text-sm ${
                          selectedStage === stage.id
                            ? 'text-white'
                            : 'text-gray-700 hover:opacity-80'
                        }`}
                        style={{
                          backgroundColor: selectedStage === stage.id ? stageColor : undefined,
                          border: selectedStage !== stage.id ? `1px solid ${stageColor}` : undefined
                        }}
                      >
                        {stage.name} ({stage.deal_count || 0})
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Conditional View Rendering */}
              {viewMode === 'kanban' ? (
                /* Kanban Board View */
                <div className="h-[calc(100vh-300px)]">
                  <KanbanBoard
                    stages={stages}
                    deals={deals}
                    onDealMove={handleDealMove}
                    onAddDeal={handleCreateDeal}
                    onEditDeal={handleEditDeal}
                    onDeleteDeal={handleDeleteDeal}
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
                            style={{ 
                              borderLeftColor: stage.name === 'Lead' ? 'var(--color-primary)' :
                                             stage.name === 'Qualified' ? 'var(--color-primary-light)' :
                                             stage.name === 'Proposal' ? 'var(--color-accent)' :
                                             stage.name === 'Negotiation' ? 'var(--color-secondary-light)' :
                                             stage.name === 'Closed Won' ? 'var(--color-secondary)' :
                                             stage.name === 'Closed Lost' ? 'var(--color-neutral-400)' :
                                             'var(--color-neutral-300)',
                              borderLeftWidth: '4px' 
                            }}
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
                                  <div 
                                    key={deal.id} 
                                    className="border rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer group relative"
                                    onClick={() => handleEditDeal(deal)}
                                  >
                                    {/* Edit Icon - appears on hover */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </div>

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
                    <button 
                      onClick={() => handleCreateDeal()}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      + Add New Deal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deal Creation/Edit Modal */}
        <DealModal
          isOpen={showDealModal}
          onClose={handleCloseModal}
          onSave={handleSaveDeal}
          onDelete={handleDeleteDeal}
          stages={stages}
          deal={selectedDeal}
          defaultStageId={defaultStageId}
        />
      </MainLayout>
    </AuthGuard>
  )
}