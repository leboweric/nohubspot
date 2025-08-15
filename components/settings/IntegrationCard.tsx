"use client"

import { useState } from "react"
import { 
  CheckCircle, AlertCircle, XCircle, Settings, 
  Calendar, Mail, Users, Zap, ExternalLink
} from "lucide-react"

interface IntegrationFeature {
  name: string
  enabled: boolean
  icon: React.ElementType
  description: string
}

interface IntegrationCardProps {
  name: string
  description: string
  icon: React.ElementType
  connected: boolean
  connectedEmail?: string
  lastSync?: string
  features?: IntegrationFeature[]
  onConnect?: () => void
  onDisconnect?: () => void
  onConfigure?: () => void
  canConfigure?: boolean
  testStatus?: 'success' | 'failed' | null
}

export default function IntegrationCard({
  name,
  description,
  icon: Icon,
  connected,
  connectedEmail,
  lastSync,
  features = [],
  onConnect,
  onDisconnect,
  onConfigure,
  canConfigure = false,
  testStatus
}: IntegrationCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getStatusColor = () => {
    if (!connected) return 'text-gray-500'
    if (testStatus === 'failed') return 'text-orange-500'
    return 'text-green-500'
  }
  
  const getStatusIcon = () => {
    if (!connected) return XCircle
    if (testStatus === 'failed') return AlertCircle
    return CheckCircle
  }
  
  const StatusIcon = getStatusIcon()
  
  const getLastSyncText = () => {
    if (!lastSync) return 'Never synced'
    
    const syncDate = new Date(lastSync)
    const now = new Date()
    const diffMs = now.getTime() - syncDate.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays > 1) return syncDate.toLocaleDateString()
    if (diffHours > 0) return `${diffHours} hours ago`
    if (diffMinutes > 0) return `${diffMinutes} minutes ago`
    return 'Just now'
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:shadow-lg hover:border-gray-300 transition-all duration-200">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-md">
            <Icon className="w-6 h-6" />
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{name}</h3>
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              </div>
              
              {/* Status */}
              <div className="flex items-center gap-2">
                <StatusIcon className={`w-5 h-5 ${getStatusColor()}`} />
                <span className={`text-sm font-medium ${getStatusColor()}`}>
                  {connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>
            
            {/* Connection Details */}
            {connected && (
              <div className="mt-3 space-y-1">
                {connectedEmail && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-3 h-3" />
                    <span>{connectedEmail}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="w-3 h-3" />
                  <span>Last sync: {getLastSyncText()}</span>
                </div>
                {testStatus === 'failed' && (
                  <div className="flex items-center gap-2 text-sm text-orange-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>Connection test failed</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-4">
          {connected ? (
            <>
              {onDisconnect && (
                <button
                  onClick={onDisconnect}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              )}
              {canConfigure && onConfigure && (
                <button
                  onClick={onConfigure}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Configure
                </button>
              )}
              {features.length > 0 && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {showDetails ? 'Hide Features' : 'View Features'}
                </button>
              )}
            </>
          ) : (
            <>
              {onConnect && (
                <button
                  onClick={onConnect}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Connect
                </button>
              )}
              {canConfigure && onConfigure && (
                <button
                  onClick={onConfigure}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Setup Required
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Features Details */}
      {showDetails && features.length > 0 && (
        <div className="p-6">
          <h4 className="font-medium text-gray-900 mb-3">Available Features</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {features.map((feature, index) => {
              const FeatureIcon = feature.icon
              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    feature.enabled 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className={`p-1 rounded ${
                    feature.enabled ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <FeatureIcon className="w-3 h-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${
                      feature.enabled ? 'text-green-900' : 'text-gray-700'
                    }`}>
                      {feature.name}
                    </div>
                    <div className={`text-xs mt-1 ${
                      feature.enabled ? 'text-green-700' : 'text-gray-600'
                    }`}>
                      {feature.description}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    feature.enabled 
                      ? 'bg-green-200 text-green-800' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {feature.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}