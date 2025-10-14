import React from 'react'
import { Badge, type BadgeProps } from './badge'
import { cn } from '@/lib/utils'

// Deal stage badges
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export function DealStageBadge({ 
  stage, 
  ...props 
}: { stage: DealStage } & Omit<BadgeProps, 'variant'>) {
  const variants: Record<DealStage, BadgeProps['variant']> = {
    lead: 'info',
    qualified: 'info',
    proposal: 'warning',
    negotiation: 'warning',
    won: 'success',
    lost: 'danger'
  }
  
  const labels: Record<DealStage, string> = {
    lead: 'Lead',
    qualified: 'Qualified',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    won: 'Won',
    lost: 'Lost'
  }
  
  return (
    <Badge variant={variants[stage]} {...props}>
      {labels[stage]}
    </Badge>
  )
}

// Project stage badges
export type ProjectStage = 'planning' | 'in-progress' | 'review' | 'completed' | 'on-hold'

export function ProjectStageBadge({ 
  stage, 
  ...props 
}: { stage: ProjectStage } & Omit<BadgeProps, 'variant'>) {
  const variants: Record<ProjectStage, BadgeProps['variant']> = {
    'planning': 'info',
    'in-progress': 'warning',
    'review': 'warning',
    'completed': 'success',
    'on-hold': 'secondary'
  }
  
  const labels: Record<ProjectStage, string> = {
    'planning': 'Planning',
    'in-progress': 'In Progress',
    'review': 'Review',
    'completed': 'Completed',
    'on-hold': 'On Hold'
  }
  
  return (
    <Badge variant={variants[stage]} {...props}>
      {labels[stage]}
    </Badge>
  )
}

// Task priority badges
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

export function TaskPriorityBadge({ 
  priority, 
  ...props 
}: { priority: TaskPriority } & Omit<BadgeProps, 'variant' | 'className'>) {
  const variants: Record<TaskPriority, BadgeProps['variant']> = {
    low: 'secondary',
    medium: 'warning',
    high: 'danger',
    critical: 'danger'
  }
  
  const labels: Record<TaskPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical'
  }
  
  return (
    <Badge 
      variant={variants[priority]} 
      className={cn(
        priority === 'critical' && 'animate-pulse'
      )}
      {...props}
    >
      {labels[priority]}
    </Badge>
  )
}

// Task status badges
export type TaskStatus = 'todo' | 'in-progress' | 'done'

export function TaskStatusBadge({ 
  status, 
  ...props 
}: { status: TaskStatus } & Omit<BadgeProps, 'variant'>) {
  const variants: Record<TaskStatus, BadgeProps['variant']> = {
    'todo': 'secondary',
    'in-progress': 'info',
    'done': 'success'
  }
  
  const labels: Record<TaskStatus, string> = {
    'todo': 'To Do',
    'in-progress': 'In Progress',
    'done': 'Done'
  }
  
  return (
    <Badge variant={variants[status]} {...props}>
      {labels[status]}
    </Badge>
  )
}

// Generic status badge for custom statuses
export function StatusBadge({ 
  status, 
  variant = 'default',
  ...props 
}: { status: string; variant?: BadgeProps['variant'] } & Omit<BadgeProps, 'variant' | 'children'>) {
  return (
    <Badge variant={variant} {...props}>
      {status}
    </Badge>
  )
}

export default StatusBadge