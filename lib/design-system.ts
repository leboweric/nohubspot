/**
 * Centralized Design System
 * All colors are defined here as a single source of truth
 */

export const designTokens = {
  // Neutral palette - used for most UI elements
  neutral: {
    50: 'rgb(249, 250, 251)',
    100: 'rgb(243, 244, 246)', 
    200: 'rgb(229, 231, 235)',
    300: 'rgb(209, 213, 219)',
    400: 'rgb(156, 163, 175)',
    500: 'rgb(107, 114, 128)',
    600: 'rgb(75, 85, 99)',
    700: 'rgb(55, 65, 81)',
    800: 'rgb(31, 41, 55)',
    900: 'rgb(17, 24, 39)',
  },

  // Semantic colors - minimal use, only when necessary
  semantic: {
    success: {
      light: 'rgb(243, 250, 247)',
      DEFAULT: 'rgb(156, 163, 175)', // Gray instead of green
      dark: 'rgb(107, 114, 128)',
    },
    warning: {
      light: 'rgb(254, 252, 251)',
      DEFAULT: 'rgb(156, 163, 175)', // Gray instead of yellow
      dark: 'rgb(107, 114, 128)',
    },
    error: {
      light: 'rgb(254, 250, 250)',
      DEFAULT: 'rgb(156, 163, 175)', // Gray instead of red
      dark: 'rgb(107, 114, 128)',
    },
    info: {
      light: 'rgb(248, 250, 252)',
      DEFAULT: 'rgb(156, 163, 175)', // Gray instead of blue
      dark: 'rgb(107, 114, 128)',
    },
  },

  // Component-specific tokens
  components: {
    badge: {
      background: 'rgb(243, 244, 246)',
      text: 'rgb(55, 65, 81)',
      border: 'rgb(229, 231, 235)',
    },
    priority: {
      high: 'rgb(75, 85, 99)',
      medium: 'rgb(156, 163, 175)',
      low: 'rgb(209, 213, 219)',
    },
    status: {
      active: 'rgb(243, 244, 246)',
      inactive: 'rgb(249, 250, 251)',
      pending: 'rgb(229, 231, 235)',
    },
    progress: {
      background: 'rgb(229, 231, 235)',
      fill: 'rgb(107, 114, 128)',
    },
  },
} as const

// Export individual color scales for Tailwind compatibility
export const colors = {
  gray: designTokens.neutral,
  success: designTokens.semantic.success,
  warning: designTokens.semantic.warning,
  error: designTokens.semantic.error,
  info: designTokens.semantic.info,
}

// Utility function to get CSS variables
export function getCSSVariables() {
  const vars: Record<string, string> = {}
  
  // Neutral colors
  Object.entries(designTokens.neutral).forEach(([key, value]) => {
    vars[`--color-neutral-${key}`] = value
  })
  
  // Semantic colors
  Object.entries(designTokens.semantic).forEach(([name, shades]) => {
    Object.entries(shades).forEach(([shade, value]) => {
      const key = shade === 'DEFAULT' ? name : `${name}-${shade}`
      vars[`--color-${key}`] = value
    })
  })
  
  // Component colors
  Object.entries(designTokens.components).forEach(([component, tokens]) => {
    Object.entries(tokens).forEach(([key, value]) => {
      vars[`--color-${component}-${key}`] = value
    })
  })
  
  return vars
}

// Helper to apply design tokens to any color prop
export function getColor(path: string): string {
  const keys = path.split('.')
  let value: any = designTokens
  
  for (const key of keys) {
    value = value[key]
    if (!value) return designTokens.neutral[500] // fallback
  }
  
  return value
}