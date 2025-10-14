import React from "react"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-gray-200", className)}
      {...props}
    />
  )
}

// Card-shaped skeleton
function SkeletonCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gray-200 p-6 border border-gray-200 shadow-sm",
        className
      )}
      {...props}
    >
      <div className="space-y-4">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-300 rounded"></div>
          <div className="h-3 bg-gray-300 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  )
}

// Text line skeleton with width variants
interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: 'full' | '3/4' | '1/2' | '1/3' | '1/4'
}

function SkeletonText({
  className,
  width = 'full',
  ...props
}: SkeletonTextProps) {
  const widthClasses = {
    'full': 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
    '1/4': 'w-1/4'
  }
  
  return (
    <div
      className={cn(
        "animate-pulse h-4 bg-gray-200 rounded",
        widthClasses[width],
        className
      )}
      {...props}
    />
  )
}

// Avatar/icon skeleton (circular)
interface SkeletonCircleProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

function SkeletonCircle({
  className,
  size = 'md',
  ...props
}: SkeletonCircleProps) {
  const sizeClasses = {
    'sm': 'h-8 w-8',
    'md': 'h-10 w-10',
    'lg': 'h-12 w-12',
    'xl': 'h-16 w-16'
  }
  
  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200 rounded-full",
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
}

export { Skeleton, SkeletonCard, SkeletonText, SkeletonCircle }
