# Dynamic Color System Documentation

## Overview
This document describes the comprehensive dynamic color system implemented in the NotHubSpot application. The system allows users to select a primary brand color, and automatically generates a complete, harmonious color palette using mathematical color theory principles.

## Core Architecture

### 1. Color Storage and Management

#### Database Storage
- Colors are stored in the organization settings as HEX values
- Three main colors are stored:
  - `theme_primary`: Main brand color (e.g., `#FB923C`)
  - `theme_secondary`: Complementary color
  - `theme_accent`: Accent color for highlights

#### Local Storage Caching
- Theme colors are cached in localStorage for performance
- Key: `organization-theme`
- Updates are detected through polling mechanism

### 2. Color Generation Algorithm

The system uses HSL (Hue, Saturation, Lightness) color space for mathematical calculations:

```typescript
// Convert HEX to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const rgb = hexToRgb(hex)
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  
  let h = 0
  let s = 0
  const l = (max + min) / 2
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / diff + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / diff + 2) / 6
        break
      case b:
        h = ((r - g) / diff + 4) / 6
        break
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}
```

### 3. Color Palette Generation

#### Primary Color Variations
From a single primary color, we generate:

1. **Base Primary**: The user-selected color
2. **Primary Light**: For hover states and backgrounds
   - Formula: `lightness + 10%, opacity: 0.1`
3. **Primary Dark**: For pressed states
   - Formula: `lightness - 10%`
4. **Primary Foreground**: Text color on primary backgrounds
   - Automatically calculated for contrast (white or black)

#### Secondary Color (Complementary)
- **Hue Shift**: +120° on the color wheel
- **Saturation**: Slightly reduced (-10%)
- **Lightness**: Adjusted for balance

```javascript
const secondaryHue = (primaryHSL.h + 120) % 360
const secondaryColor = {
  h: secondaryHue,
  s: Math.max(primaryHSL.s - 10, 20), // Minimum 20% saturation
  l: primaryHSL.l
}
```

#### Accent Color (Triadic)
- **Hue Shift**: +240° on the color wheel
- **Saturation**: Further reduced for subtlety
- **Lightness**: Slightly increased for visibility

```javascript
const accentHue = (primaryHSL.h + 240) % 360
const accentColor = {
  h: accentHue,
  s: Math.max(primaryHSL.s - 20, 15),
  l: Math.min(primaryHSL.l + 10, 85) // Maximum 85% lightness
}
```

### 4. CSS Variable System

#### Root Variables Definition
```css
:root {
  /* Primary Colors */
  --color-primary: #FB923C;
  --color-primary-rgb: 251, 146, 60;
  --color-primary-hsl: 27, 96%, 61%;
  --color-primary-light: rgba(251, 146, 60, 0.1);
  --color-primary-dark: #EA7F2C;
  --color-primary-foreground: #FFFFFF;
  
  /* Secondary Colors */
  --color-secondary: #3CFB92;
  --color-secondary-rgb: 60, 251, 146;
  --color-secondary-hsl: 147, 96%, 61%;
  --color-secondary-light: rgba(60, 251, 146, 0.1);
  --color-secondary-foreground: #000000;
  
  /* Accent Colors */
  --color-accent: #923CFB;
  --color-accent-rgb: 146, 60, 251;
  --color-accent-hsl: 267, 96%, 61%;
  --color-accent-light: rgba(146, 60, 251, 0.1);
  --color-accent-foreground: #FFFFFF;
  
  /* Semantic Colors */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Neutral Colors */
  --color-background: #FFFFFF;
  --color-foreground: #1F2937;
  --color-muted: #9CA3AF;
  --color-muted-foreground: #6B7280;
  --color-border: #E5E7EB;
  
  /* Component Specific */
  --color-card: #FFFFFF;
  --color-card-foreground: #1F2937;
  --color-popover: #FFFFFF;
  --color-popover-foreground: #1F2937;
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #0F172A;
    --color-foreground: #F1F5F9;
    /* ... other dark mode colors */
  }
}
```

### 5. Implementation Pattern

#### Component Usage Examples

##### Button with Dynamic Color
```jsx
// Instead of hardcoded Tailwind classes:
<button className="bg-primary text-primary-foreground">

// Use CSS variables:
<button 
  className="rounded-md transition-all text-white hover:opacity-90"
  style={{ backgroundColor: 'var(--color-primary)' }}
>
  Click Me
</button>
```

##### Link with Dynamic Color
```jsx
// Instead of:
<a className="text-primary hover:underline">

// Use:
<a 
  className="hover:underline"
  style={{ color: 'var(--color-primary)' }}
>
  Link Text
</a>
```

##### Loading Spinner with Dynamic Color
```jsx
// Instead of:
<div className="animate-spin border-b-2 border-primary">

// Use:
<div 
  className="animate-spin border-b-2"
  style={{ borderBottomColor: 'var(--color-primary)' }}
>
</div>
```

##### Tab/Active State with Dynamic Color
```jsx
// Instead of:
<button className={active ? "border-primary text-primary" : "border-transparent"}>

// Use:
<button 
  className={active ? "" : "border-transparent"}
  style={active ? { 
    borderColor: 'var(--color-primary)', 
    color: 'var(--color-primary)' 
  } : {}}
>
  Tab
</button>
```

### 6. Theme Context Implementation

```typescript
// ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'

interface ThemeColors {
  primary: string
  secondary: string
  accent: string
}

interface ThemeContextType {
  themeColors: ThemeColors
  updateThemeColors: (colors: Partial<ThemeColors>) => void
  colorPatterns: {
    primaryGradient: string
    secondaryGradient: string
    accentGradient: string
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeColors, setThemeColors] = useState<ThemeColors>({
    primary: '#FB923C',
    secondary: '#3CFB92',
    accent: '#923CFB'
  })

  // Apply colors to CSS variables
  const applyThemeToDOM = (colors: ThemeColors) => {
    const root = document.documentElement
    
    // Primary color and variations
    const primaryHSL = hexToHSL(colors.primary)
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-rgb', hexToRgb(colors.primary))
    root.style.setProperty('--color-primary-hsl', `${primaryHSL.h}, ${primaryHSL.s}%, ${primaryHSL.l}%`)
    root.style.setProperty('--color-primary-light', `${colors.primary}1A`) // 10% opacity
    root.style.setProperty('--color-primary-dark', adjustLightness(colors.primary, -10))
    root.style.setProperty('--color-primary-foreground', getContrastColor(colors.primary))
    
    // Secondary and accent colors (similar pattern)
    // ... apply secondary and accent colors
  }

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('organization-theme')
    if (savedTheme) {
      const colors = JSON.parse(savedTheme)
      setThemeColors(colors)
      applyThemeToDOM(colors)
    }
  }, [])

  // Listen for theme changes (polling mechanism)
  useEffect(() => {
    const checkForThemeChanges = () => {
      const savedTheme = localStorage.getItem('organization-theme')
      if (savedTheme) {
        const colors = JSON.parse(savedTheme)
        if (JSON.stringify(colors) !== JSON.stringify(themeColors)) {
          setThemeColors(colors)
          applyThemeToDOM(colors)
        }
      }
    }

    const interval = setInterval(checkForThemeChanges, 1000)
    return () => clearInterval(interval)
  }, [themeColors])

  const updateThemeColors = (colors: Partial<ThemeColors>) => {
    const newColors = { ...themeColors, ...colors }
    setThemeColors(newColors)
    applyThemeToDOM(newColors)
    localStorage.setItem('organization-theme', JSON.stringify(newColors))
  }

  const colorPatterns = {
    primaryGradient: `linear-gradient(135deg, ${themeColors.primary} 0%, ${adjustLightness(themeColors.primary, 10)} 100%)`,
    secondaryGradient: `linear-gradient(135deg, ${themeColors.secondary} 0%, ${adjustLightness(themeColors.secondary, 10)} 100%)`,
    accentGradient: `linear-gradient(135deg, ${themeColors.accent} 0%, ${adjustLightness(themeColors.accent, 10)} 100%)`
  }

  return (
    <ThemeContext.Provider value={{ themeColors, updateThemeColors, colorPatterns }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
```

### 7. Utility Functions

```javascript
// Color manipulation utilities
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

function adjustLightness(hex: string, percent: number): string {
  const hsl = hexToHSL(hex)
  hsl.l = Math.max(0, Math.min(100, hsl.l + percent))
  return hslToHex(hsl)
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex).split(',').map(n => parseInt(n.trim()))
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

function hslToHex(hsl: { h: number; s: number; l: number }): string {
  const h = hsl.h / 360
  const s = hsl.s / 100
  const l = hsl.l / 100
  
  let r, g, b
  
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
```

### 8. Settings Page Color Picker Implementation

```jsx
// Color picker component in settings
<div className="space-y-4">
  <div>
    <label className="block text-sm font-medium mb-2">
      Primary Brand Color
    </label>
    <div className="flex items-center gap-4">
      <input
        type="color"
        value={themeColors.primary}
        onChange={(e) => handleColorChange('primary', e.target.value)}
        className="w-20 h-10 border rounded cursor-pointer"
      />
      <input
        type="text"
        value={themeColors.primary}
        onChange={(e) => handleColorChange('primary', e.target.value)}
        className="px-3 py-2 border rounded-md"
        placeholder="#FB923C"
      />
      <div 
        className="w-24 h-10 rounded-md border"
        style={{ backgroundColor: themeColors.primary }}
      />
    </div>
  </div>
  
  {/* Preview of generated palette */}
  <div className="grid grid-cols-3 gap-4 mt-6">
    <div>
      <p className="text-sm text-gray-600 mb-2">Primary</p>
      <div 
        className="h-20 rounded-md"
        style={{ backgroundColor: 'var(--color-primary)' }}
      />
    </div>
    <div>
      <p className="text-sm text-gray-600 mb-2">Secondary</p>
      <div 
        className="h-20 rounded-md"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      />
    </div>
    <div>
      <p className="text-sm text-gray-600 mb-2">Accent</p>
      <div 
        className="h-20 rounded-md"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />
    </div>
  </div>
</div>
```

### 9. Migration Guide for Existing Codebase

#### Step 1: Find and Replace Hardcoded Colors
Search for these patterns and replace them:

```bash
# Find Tailwind color classes
grep -r "bg-primary\|text-primary\|border-primary" --include="*.tsx" --include="*.jsx"

# Common replacements:
bg-primary → style={{ backgroundColor: 'var(--color-primary)' }}
text-primary → style={{ color: 'var(--color-primary)' }}
border-primary → style={{ borderColor: 'var(--color-primary)' }}
bg-primary/90 → style={{ backgroundColor: 'var(--color-primary)', opacity: 0.9 }}
hover:bg-primary → onMouseEnter/onMouseLeave with style changes
```

#### Step 2: Update Component Patterns
```jsx
// Before (Tailwind hardcoded)
<button className="bg-blue-500 text-white hover:bg-blue-600">

// After (Dynamic)
<button 
  className="text-white transition-all hover:opacity-90"
  style={{ backgroundColor: 'var(--color-primary)' }}
>
```

#### Step 3: Handle Conditional Styling
```jsx
// Before
className={`${active ? 'text-blue-500 border-blue-500' : 'text-gray-500'}`}

// After
className={`${active ? '' : 'text-gray-500'}`}
style={active ? { 
  color: 'var(--color-primary)', 
  borderColor: 'var(--color-primary)' 
} : {}}
```

### 10. Advanced Features

#### Gradient Generation
```javascript
// Generate gradients from theme colors
const gradients = {
  primary: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`,
  rainbow: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 50%, var(--color-accent) 100%)`,
  subtle: `linear-gradient(135deg, var(--color-primary-light) 0%, transparent 100%)`
}
```

#### Automatic Contrast Checking
```javascript
// Ensure WCAG AA compliance
function checkContrast(bg: string, fg: string): boolean {
  const bgLum = getLuminance(bg)
  const fgLum = getLuminance(fg)
  const contrast = (Math.max(bgLum, fgLum) + 0.05) / (Math.min(bgLum, fgLum) + 0.05)
  return contrast >= 4.5 // WCAG AA standard
}
```

#### Theme Presets
```javascript
const themePresets = {
  orange: { primary: '#FB923C', secondary: '#3CFB92', accent: '#923CFB' },
  blue: { primary: '#3B82F6', secondary: '#F63B82', accent: '#82F63B' },
  green: { primary: '#10B981', secondary: '#B91043', accent: '#4310B9' },
  purple: { primary: '#8B5CF6', secondary: '#F65C8B', accent: '#5CF68B' }
}
```

### 11. Performance Considerations

1. **CSS Variable Performance**: CSS variables are computed at runtime but cached by the browser
2. **localStorage Polling**: Use 1-second intervals to detect theme changes
3. **Debouncing**: Debounce color picker changes to avoid excessive updates
4. **Memoization**: Memoize color calculations in React components

### 12. Browser Compatibility

- CSS Variables: Supported in all modern browsers (IE11 requires polyfill)
- HSL Colors: Universally supported
- localStorage: Universally supported
- Color Input: HTML5 feature, fallback to text input for older browsers

### 13. Testing Strategy

```javascript
// Test color generation
describe('Color System', () => {
  test('generates correct complementary color', () => {
    const primary = '#FB923C'
    const secondary = generateSecondaryColor(primary)
    expect(secondary).toBe('#3CFB92')
  })
  
  test('ensures text contrast', () => {
    const bg = '#FB923C'
    const fg = getContrastColor(bg)
    expect(checkContrast(bg, fg)).toBe(true)
  })
})
```

## Summary

This color system provides:
1. **User Control**: Simple color picker for primary brand color
2. **Automatic Harmony**: Mathematical generation of complementary colors
3. **Consistency**: CSS variables ensure colors are consistent across the app
4. **Accessibility**: Automatic contrast calculations for text readability
5. **Performance**: Efficient caching and updates
6. **Flexibility**: Easy to extend with new color variations
7. **Maintainability**: Centralized color management

The system transforms a single user-selected color into a complete, professional color palette that maintains visual harmony while ensuring accessibility and brand consistency throughout the application.