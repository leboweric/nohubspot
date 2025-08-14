'use client';

import { useEffect } from 'react';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const { themeColors, isLoading } = useThemeColors();
  
  // Theme will be applied by the hook
  
  return <>{children}</>;
}