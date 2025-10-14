import * as React from "react"
import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
  className?: string
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = false, children, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm p-6",
        hover && "hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-pointer",
        className
      )} 
      {...props}
    >
      {children}
    </div>
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn("flex flex-col space-y-1.5 -m-6 mb-6 p-6 border-b border-gray-200", className)} 
      {...props} 
    />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 
      ref={ref} 
      className={cn("text-xl font-semibold leading-none tracking-tight text-gray-900", className)} 
      {...props} 
    />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p 
      ref={ref} 
      className={cn("text-sm text-gray-500", className)} 
      {...props} 
    />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn("", className)} 
      {...props} 
    />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div 
      ref={ref} 
      className={cn("flex items-center -m-6 mt-6 p-6 border-t border-gray-200", className)} 
      {...props} 
    />
  ),
)
CardFooter.displayName = "CardFooter"

// Convenience sub-components for better organization
const CardBody = CardContent
CardBody.displayName = "CardBody"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, CardBody }
