"use client"

import { Task } from "./types"
import { 
  Target, Clock, TrendingUp, AlertTriangle, 
  CheckCircle, Calendar, Zap
} from "lucide-react"

interface TaskStatsProps {
  tasks: Task[]
}

export default function TaskStats({ tasks }: TaskStatsProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)
  
  // Calculate various stats
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue: tasks.filter(t => {
      if (t.status === 'completed' || !t.due_date) return false
      const dueDate = new Date(t.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < today
    }).length,
    dueToday: tasks.filter(t => {
      if (t.status === 'completed' || !t.due_date) return false
      const dueDate = new Date(t.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() === today.getTime()
    }).length,
    dueTomorrow: tasks.filter(t => {
      if (t.status === 'completed' || !t.due_date) return false
      const dueDate = new Date(t.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate.getTime() === tomorrow.getTime()
    }).length,
    dueThisWeek: tasks.filter(t => {
      if (t.status === 'completed' || !t.due_date) return false
      const dueDate = new Date(t.due_date)
      return dueDate >= today && dueDate <= weekFromNow
    }).length,
    highPriority: tasks.filter(t => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high')).length
  }
  
  // Calculate completion rate
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  
  // Calculate productivity score (simple algorithm)
  const productivityScore = Math.min(100, Math.round(
    (completionRate * 0.4) + 
    ((stats.total - stats.overdue) / Math.max(1, stats.total) * 60) +
    (stats.inProgress > 0 ? 20 : 0) -
    (stats.overdue * 5)
  ))
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'  
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }
  
  const statCards = [
    {
      title: "Today's Focus",
      value: stats.dueToday,
      subtitle: stats.dueTomorrow > 0 ? `+${stats.dueTomorrow} tomorrow` : 'All caught up tomorrow',
      icon: Target,
      color: stats.dueToday > 0 ? 'bg-orange-500' : 'bg-green-500',
      bgColor: stats.dueToday > 0 ? 'bg-orange-50' : 'bg-green-50'
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      subtitle: `${stats.total - stats.completed - stats.inProgress} pending`,
      icon: Clock,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      title: "Completion Rate",
      value: `${completionRate}%`,
      subtitle: `${stats.completed} of ${stats.total} done`,
      icon: TrendingUp,
      color: completionRate >= 70 ? 'bg-green-500' : completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500',
      bgColor: completionRate >= 70 ? 'bg-green-50' : completionRate >= 50 ? 'bg-yellow-50' : 'bg-red-50'
    },
    {
      title: "Productivity",
      value: `${productivityScore}%`,
      subtitle: productivityScore >= 80 ? 'Excellent!' : productivityScore >= 60 ? 'Good work' : 'Room to improve',
      icon: Zap,
      color: getScoreColor(productivityScore).includes('green') ? 'bg-green-500' : 
            getScoreColor(productivityScore).includes('blue') ? 'bg-blue-500' :
            getScoreColor(productivityScore).includes('yellow') ? 'bg-yellow-500' : 'bg-red-500',
      bgColor: getScoreColor(productivityScore).includes('green') ? 'bg-green-50' : 
               getScoreColor(productivityScore).includes('blue') ? 'bg-blue-50' :
               getScoreColor(productivityScore).includes('yellow') ? 'bg-yellow-50' : 'bg-red-50'
    }
  ]
  
  // Show alert stats if there are issues
  const alertStats = [
    ...(stats.overdue > 0 ? [{
      title: "Overdue",
      value: stats.overdue,
      subtitle: "Need immediate attention",
      icon: AlertTriangle,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      urgent: true
    }] : []),
    ...(stats.highPriority > 0 ? [{
      title: "High Priority",
      value: stats.highPriority,
      subtitle: "Important tasks pending",
      icon: AlertTriangle,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      urgent: false
    }] : [])
  ]
  
  return (
    <div className="space-y-4">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className={`${stat.bgColor} border rounded-lg p-4 transition-all hover:shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}>
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
              <div key={index} className={`${stat.bgColor} border-2 ${stat.urgent ? 'border-red-200 animate-pulse' : 'border-orange-200'} rounded-lg p-4`}>
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
      
      {/* This Week Overview */}
      {stats.dueThisWeek > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">This Week</p>
              <p className="text-sm text-gray-600">
                {stats.dueThisWeek} tasks due this week • Plan your schedule accordingly
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}