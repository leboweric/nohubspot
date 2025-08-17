"use client"

import React from 'react'

interface NHSLogoProps {
  className?: string
  variant?: 'full' | 'icon' | 'stacked'
  showTagline?: boolean
}

export default function NHSLogo({ 
  className = "h-8", 
  variant = 'full',
  showTagline = false 
}: NHSLogoProps) {
  
  if (variant === 'icon') {
    // Icon only version - just the N in a rounded square
    return (
      <svg 
        className={className}
        viewBox="0 0 40 40" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect 
          width="40" 
          height="40" 
          rx="8" 
          fill="currentColor"
          className="text-primary"
        />
        <path 
          d="M11 28V12H14.5L21 22.5V12H25V28H21.5L15 17.5V28H11Z" 
          fill="white"
        />
      </svg>
    )
  }
  
  if (variant === 'stacked') {
    // Stacked version with icon above text
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <svg 
          className="h-12 w-12"
          viewBox="0 0 40 40" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect 
            width="40" 
            height="40" 
            rx="8" 
            fill="currentColor"
            className="text-primary"
          />
          <path 
            d="M11 28V12H14.5L21 22.5V12H25V28H21.5L15 17.5V28H11Z" 
            fill="white"
          />
        </svg>
        <div className="text-center">
          <div className="font-bold text-xl">NHS</div>
          {showTagline && (
            <div className="text-xs text-muted-foreground">The Simple CRM</div>
          )}
        </div>
      </div>
    )
  }
  
  // Full horizontal version (default)
  return (
    <svg 
      className={className}
      viewBox="0 0 200 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Icon */}
      <rect 
        width="40" 
        height="40" 
        rx="8" 
        fill="currentColor"
        className="text-primary"
      />
      <path 
        d="M11 28V12H14.5L21 22.5V12H25V28H21.5L15 17.5V28H11Z" 
        fill="white"
      />
      
      {/* Text */}
      <text 
        x="50" 
        y="26" 
        fontSize="20" 
        fontWeight="bold" 
        fill="currentColor"
        className="text-foreground"
      >
        NHS
      </text>
      
      {showTagline && (
        <text 
          x="50" 
          y="38" 
          fontSize="10" 
          fill="currentColor"
          className="text-muted-foreground"
        >
          The Simple CRM
        </text>
      )}
    </svg>
  )
}

// Alternative modern logo design - circular with initials
export function NHSLogoModern({ 
  className = "h-10 w-10",
  showText = false 
}: { 
  className?: string
  showText?: boolean 
}) {
  if (showText) {
    return (
      <div className="flex items-center gap-3">
        <div 
          className={`${className} rounded-full flex items-center justify-center font-bold text-white shadow-lg`}
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <span className="text-lg">N</span>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-lg">NHS</span>
          <span className="text-xs text-muted-foreground -mt-1">The Simple CRM</span>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={`${className} rounded-full flex items-center justify-center font-bold text-white shadow-lg`}
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      <span className="text-xl">N</span>
    </div>
  )
}

// Minimal text-based logo for navigation
export function NHSTextLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`font-bold ${className}`}>
      <span style={{ color: 'var(--color-primary)' }}>N</span>
      <span>HS</span>
    </div>
  )
}