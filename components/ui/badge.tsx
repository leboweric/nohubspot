import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--color-primary-light)] text-[var(--color-primary-dark)] hover:bg-[var(--color-primary)] hover:text-white",
        secondary: "border-transparent bg-[var(--color-secondary-light)] text-[var(--color-secondary-dark)] hover:bg-[var(--color-secondary)] hover:text-white",
        destructive: "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "text-foreground border-[var(--color-neutral-300)]",
        success: "border-transparent bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] hover:bg-[var(--color-neutral-200)]",
        warning: "border-transparent bg-[var(--color-accent)] text-[var(--color-neutral-900)] hover:bg-[var(--color-accent)] hover:opacity-80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
