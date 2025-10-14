import React from 'react'
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full font-medium border transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "bg-primary-100 text-primary-700 border-primary-200",
        success: "bg-success-50 text-success-700 border-success-200",
        warning: "bg-warning-50 text-warning-700 border-warning-200",
        danger: "bg-danger-50 text-danger-700 border-danger-200",
        info: "bg-info-50 text-info-700 border-info-200",
        secondary: "bg-gray-100 text-gray-700 border-gray-200",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-2.5 py-0.5",
        lg: "text-sm px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
)

export interface BadgeProps 
  extends React.HTMLAttributes<HTMLDivElement>, 
  VariantProps<typeof badgeVariants> {
  children: React.ReactNode
}

function Badge({ 
  className, 
  variant, 
  size,
  children,
  ...props 
}: BadgeProps) {
  return (
    <div 
      className={cn(badgeVariants({ variant, size }), className)} 
      {...props}
    >
      {children}
    </div>
  )
}

// Export named variants for convenience
export const SuccessBadge: React.FC<Omit<BadgeProps, 'variant'>> = (props) => (
  <Badge variant="success" {...props} />
)

export const WarningBadge: React.FC<Omit<BadgeProps, 'variant'>> = (props) => (
  <Badge variant="warning" {...props} />
)

export const DangerBadge: React.FC<Omit<BadgeProps, 'variant'>> = (props) => (
  <Badge variant="danger" {...props} />
)

export const InfoBadge: React.FC<Omit<BadgeProps, 'variant'>> = (props) => (
  <Badge variant="info" {...props} />
)

export const SecondaryBadge: React.FC<Omit<BadgeProps, 'variant'>> = (props) => (
  <Badge variant="secondary" {...props} />
)

export { Badge, badgeVariants }
