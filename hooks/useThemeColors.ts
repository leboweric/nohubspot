'use client';

import { useState, useEffect } from 'react';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

const defaultTheme: ThemeColors = {
  primary: '#3B82F6',
  secondary: '#1E40AF',
  accent: '#60A5FA'
};

// Convert hex to RGBA for opacity control
export const hexToRgba = (hex: string, opacity: number): string => {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Common color patterns from the design document
export const colorPatterns = {
  hover: (color: string) => hexToRgba(color, 0.15),        // 15% for hover backgrounds
  selected: (color: string) => hexToRgba(color, 0.20),     // 20% for selected states
  background: (color: string) => hexToRgba(color, 0.10),   // 10% for subtle backgrounds
  border: (color: string) => hexToRgba(color, 0.40),       // 40% for borders
  disabled: (color: string) => hexToRgba(color, 0.50)      // 50% for disabled states
};

export function useThemeColors() {
  const [themeColors, setThemeColors] = useState<ThemeColors>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTheme = async () => {
      try {
        // First check localStorage for cached theme
        const cachedTheme = localStorage.getItem('orgTheme');
        if (cachedTheme) {
          const parsed = JSON.parse(cachedTheme);
          console.log('useThemeColors: Found cached theme:', parsed);
          setThemeColors(parsed);
          applyThemeToDOM(parsed);
        }

        // Then fetch from API for latest theme
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.log('useThemeColors: No access token, using default theme');
          setIsLoading(false);
          return;
        }

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nothubspot-production.up.railway.app';
        console.log('useThemeColors: Fetching theme from:', `${baseUrl}/api/organization/theme`);
        
        const response = await fetch(`${baseUrl}/api/organization/theme`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('useThemeColors: API response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          const theme: ThemeColors = {
            primary: data.theme_primary_color || defaultTheme.primary,
            secondary: data.theme_secondary_color || defaultTheme.secondary,
            accent: data.theme_accent_color || defaultTheme.accent
          };
          
          console.log('useThemeColors: Fetched theme from API:', theme);
          setThemeColors(theme);
          applyThemeToDOM(theme);
          
          // Cache in localStorage
          localStorage.setItem('orgTheme', JSON.stringify(theme));
        } else {
          console.error('useThemeColors: Failed to fetch theme, status:', response.status);
        }
      } catch (error) {
        console.error('useThemeColors: Failed to fetch theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTheme();
  }, []);

  // Convert hex to HSL for Tailwind CSS
  const hexToHSL = (hex: string): string => {
    // Remove the hash if present
    hex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return `${h} ${s}% ${l}%`;
  };

  // Apply theme colors to DOM as CSS custom properties
  const applyThemeToDOM = (colors: ThemeColors) => {
    console.log('applyThemeToDOM: Applying colors to DOM:', colors);
    const root = document.documentElement;
    
    // Set theme colors for custom use
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-secondary', colors.secondary);
    root.style.setProperty('--theme-accent', colors.accent);
    
    // Set Tailwind CSS variables (HSL format)
    root.style.setProperty('--primary', hexToHSL(colors.primary));
    root.style.setProperty('--secondary', hexToHSL(colors.secondary));
    root.style.setProperty('--accent', hexToHSL(colors.accent));
    
    // Set opacity variations
    root.style.setProperty('--theme-primary-hover', colorPatterns.hover(colors.primary));
    root.style.setProperty('--theme-primary-selected', colorPatterns.selected(colors.primary));
    root.style.setProperty('--theme-primary-background', colorPatterns.background(colors.primary));
    root.style.setProperty('--theme-primary-border', colorPatterns.border(colors.primary));
    
    root.style.setProperty('--theme-secondary-hover', colorPatterns.hover(colors.secondary));
    root.style.setProperty('--theme-accent-background', colorPatterns.background(colors.accent));
    
    // Also update ring and sidebar colors to match
    root.style.setProperty('--ring', hexToHSL(colors.primary));
    root.style.setProperty('--sidebar-primary', hexToHSL(colors.primary));
    
    console.log('applyThemeToDOM: CSS variables set, checking application...');
    console.log('  --theme-primary:', getComputedStyle(root).getPropertyValue('--theme-primary'));
    console.log('  --primary (HSL):', getComputedStyle(root).getPropertyValue('--primary'));
  };

  return {
    themeColors,
    isLoading,
    colorPatterns,
    hexToRgba
  };
}