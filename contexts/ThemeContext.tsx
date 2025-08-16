'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { generateColorPalette, applyColorPalette } from '@/lib/color-harmony';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ThemeContextType {
  themeColors: ThemeColors;
  setThemeColors: (colors: ThemeColors) => void;
  fetchThemeColors: () => Promise<void>;
  updateThemeColors: (colors: ThemeColors) => Promise<void>;
  isLoading: boolean;
}

const defaultTheme: ThemeColors = {
  primary: '#3B82F6',
  secondary: '#1E40AF',
  accent: '#60A5FA'
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Utility functions for theme management
const getThemeStorageKey = (orgId?: string) => {
  return orgId ? `orgTheme_${orgId}` : 'orgTheme_default';
};

const saveThemeToLocalStorage = (orgId: string | undefined, theme: ThemeColors) => {
  const key = getThemeStorageKey(orgId);
  localStorage.setItem(key, JSON.stringify(theme));
};

const getThemeFromLocalStorage = (orgId?: string): ThemeColors | null => {
  const key = getThemeStorageKey(orgId);
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeColors, setThemeColors] = useState<ThemeColors>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch theme colors from API
  const fetchThemeColors = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/organization/theme', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const theme: ThemeColors = {
          primary: data.theme_primary_color || defaultTheme.primary,
          secondary: data.theme_secondary_color || defaultTheme.secondary,
          accent: data.theme_accent_color || defaultTheme.accent,
        };
        
        // Save to local storage for faster loading
        const orgId = data.id?.toString();
        if (orgId) {
          saveThemeToLocalStorage(orgId, theme);
        }
        
        setThemeColors(theme);
        applyThemeToDOM(theme);
      }
    } catch (error) {
      console.error('Failed to fetch theme colors:', error);
      // Use cached theme if available
      const cachedTheme = getThemeFromLocalStorage();
      if (cachedTheme) {
        setThemeColors(cachedTheme);
        applyThemeToDOM(cachedTheme);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update theme colors via API
  const updateThemeColors = async (colors: ThemeColors) => {
    try {
      const response = await fetch('/api/organization/theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          theme_primary_color: colors.primary,
          theme_secondary_color: colors.secondary,
          theme_accent_color: colors.accent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const theme: ThemeColors = {
          primary: data.theme_primary_color,
          secondary: data.theme_secondary_color,
          accent: data.theme_accent_color,
        };
        
        // Save to local storage
        const orgId = data.id?.toString();
        if (orgId) {
          saveThemeToLocalStorage(orgId, theme);
        }
        
        setThemeColors(theme);
        applyThemeToDOM(theme);
        
        toast({
          title: 'Theme Updated',
          description: 'Your brand colors have been saved successfully.',
        });
      } else {
        throw new Error('Failed to update theme');
      }
    } catch (error) {
      console.error('Failed to update theme colors:', error);
      toast({
        title: 'Error',
        description: 'Failed to save theme colors. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Apply theme colors to DOM as CSS custom properties
  const applyThemeToDOM = (colors: ThemeColors) => {
    console.log('🎨 COLOR HARMONY v3 - ThemeContext running!');
    const root = document.documentElement;
    
    // Generate complete color palette from primary color
    const palette = generateColorPalette(colors.primary);
    console.log('🎨 Generated palette:', palette); // Debug log
    
    // Apply the generated palette (includes complementary colors)
    const paletteVars = applyColorPalette(colors.primary);
    console.log('🎨 Setting CSS variables:', paletteVars); // Debug log
    Object.entries(paletteVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Override with user's selected secondary/accent if different from generated
    // This allows users to customize beyond the auto-generated palette
    root.style.setProperty('--theme-primary', colors.primary);
    root.style.setProperty('--theme-secondary', palette.secondary); // Use generated complementary
    root.style.setProperty('--theme-accent', palette.accent); // Use generated accent
    
    // Set opacity variations
    root.style.setProperty('--theme-primary-hover', colorPatterns.hover(colors.primary));
    root.style.setProperty('--theme-primary-selected', colorPatterns.selected(colors.primary));
    root.style.setProperty('--theme-primary-background', colorPatterns.background(colors.primary));
    root.style.setProperty('--theme-primary-border', colorPatterns.border(colors.primary));
    
    root.style.setProperty('--theme-secondary-hover', colorPatterns.hover(palette.secondary));
    root.style.setProperty('--theme-accent-background', colorPatterns.background(palette.accent));
    
    // Update the neutral colors to have a hint of the primary
    Object.entries(palette.neutral).forEach(([key, value]) => {
      root.style.setProperty(`--color-neutral-${key}`, value);
    });
  };

  // Load theme on mount
  useEffect(() => {
    // First try to load from localStorage for instant loading
    const cachedTheme = getThemeFromLocalStorage();
    if (cachedTheme) {
      setThemeColors(cachedTheme);
      applyThemeToDOM(cachedTheme);
      setIsLoading(false);
    }
    
    // Then fetch from API to get latest
    fetchThemeColors();
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeColors,
        setThemeColors: (colors) => {
          setThemeColors(colors);
          applyThemeToDOM(colors);
        },
        fetchThemeColors,
        updateThemeColors,
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}