/**
 * Color Harmony Generator
 * Automatically generates a complete color palette from a single primary color
 */

interface RGB {
  r: number
  g: number
  b: number
}

interface HSL {
  h: number
  s: number
  l: number
}

interface ColorPalette {
  primary: string
  primaryLight: string
  primaryDark: string
  secondary: string
  secondaryLight: string
  secondaryDark: string
  accent: string
  neutral: Record<string, string>
}

// Convert hex to RGB
function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

// Convert RGB to HSL
function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

// Convert HSL to RGB
function hslToRgb(hsl: HSL): RGB {
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

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

// Convert RGB to CSS string
function rgbToString(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

// Adjust lightness
function adjustLightness(hsl: HSL, amount: number): HSL {
  return {
    ...hsl,
    l: Math.max(0, Math.min(100, hsl.l + amount))
  }
}

// Get complementary color
function getComplementary(hsl: HSL): HSL {
  return {
    ...hsl,
    h: (hsl.h + 180) % 360
  }
}

// Get analogous colors
function getAnalogous(hsl: HSL): HSL[] {
  return [
    { ...hsl, h: (hsl.h + 30) % 360 },
    { ...hsl, h: (hsl.h - 30 + 360) % 360 }
  ]
}

// Generate neutral palette from primary
function generateNeutralPalette(primaryHsl: HSL): Record<string, string> {
  // Create an almost completely desaturated version for true neutrals
  // Just a TINY hint of the primary color (2-3% saturation)
  const neutralBase = { 
    ...primaryHsl, 
    s: 2, // Barely any color - just a whisper
    l: 50 // Start from middle gray
  }
  
  return {
    '50': rgbToString(hslToRgb({ ...neutralBase, l: 98 })),  // Almost white
    '100': rgbToString(hslToRgb({ ...neutralBase, l: 96 })),
    '200': rgbToString(hslToRgb({ ...neutralBase, l: 91 })),
    '300': rgbToString(hslToRgb({ ...neutralBase, l: 84 })),
    '400': rgbToString(hslToRgb({ ...neutralBase, l: 64 })),
    '500': rgbToString(hslToRgb({ ...neutralBase, l: 45 })),
    '600': rgbToString(hslToRgb({ ...neutralBase, l: 32 })),
    '700': rgbToString(hslToRgb({ ...neutralBase, l: 24 })),
    '800': rgbToString(hslToRgb({ ...neutralBase, l: 15 })),
    '900': rgbToString(hslToRgb({ ...neutralBase, l: 9 })),   // Almost black
  }
}

/**
 * Generate a complete color palette from a single primary color
 */
export function generateColorPalette(primaryHex: string): ColorPalette {
  const primaryRgb = hexToRgb(primaryHex)
  const primaryHsl = rgbToHsl(primaryRgb)
  
  // Primary variations (keep original but slightly muted)
  const mutedPrimaryHsl = { ...primaryHsl, s: Math.min(primaryHsl.s, 40) } // Cap saturation at 40%
  const primary = rgbToString(hslToRgb(mutedPrimaryHsl))
  const primaryLight = rgbToString(hslToRgb(adjustLightness(mutedPrimaryHsl, 25)))
  const primaryDark = rgbToString(hslToRgb(adjustLightness(mutedPrimaryHsl, -20)))
  
  // Secondary (complementary but VERY muted for subtlety)
  const secondaryHsl = getComplementary(primaryHsl)
  const mutedSecondaryHsl = { 
    ...secondaryHsl, 
    s: 15, // Very low saturation for subtle contrast
    l: 45  // Mid-range lightness
  }
  const secondary = rgbToString(hslToRgb(mutedSecondaryHsl))
  const secondaryLight = rgbToString(hslToRgb(adjustLightness(mutedSecondaryHsl, 20)))
  const secondaryDark = rgbToString(hslToRgb(adjustLightness(mutedSecondaryHsl, -20)))
  
  // Accent (analogous but heavily muted)
  const analogous = getAnalogous(primaryHsl)
  const mutedAccentHsl = { 
    ...analogous[0], 
    s: 20, // Low saturation for professional look
    l: 50  // Neutral lightness
  }
  const accent = rgbToString(hslToRgb(mutedAccentHsl))
  
  // Neutral palette (very subtle hint of primary)
  const neutral = generateNeutralPalette(primaryHsl)
  
  return {
    primary,
    primaryLight,
    primaryDark,
    secondary,
    secondaryLight,
    secondaryDark,
    accent,
    neutral
  }
}

/**
 * Apply generated palette to CSS variables
 */
export function applyColorPalette(primaryHex: string): Record<string, string> {
  const palette = generateColorPalette(primaryHex)
  
  return {
    '--color-primary': palette.primary,
    '--color-primary-light': palette.primaryLight,
    '--color-primary-dark': palette.primaryDark,
    '--color-secondary': palette.secondary,
    '--color-secondary-light': palette.secondaryLight,
    '--color-secondary-dark': palette.secondaryDark,
    '--color-accent': palette.accent,
    ...Object.entries(palette.neutral).reduce((acc, [key, value]) => ({
      ...acc,
      [`--color-neutral-${key}`]: value
    }), {})
  }
}