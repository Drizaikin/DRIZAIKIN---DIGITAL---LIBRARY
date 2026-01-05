// Theme Context for React
// Requirements: 6.2, 6.3, 6.7, 7.5

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ThemeMode, ThemeColor, preferencesService } from '../services/preferencesService';
import { THEME_COLORS, ThemeColors } from '../constants/themes';

interface ThemeContextValue {
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeColor: (color: ThemeColor) => void;
  toggleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Apply CSS custom properties to document root
function applyCSSCustomProperties(colors: ThemeColors): void {
  const root = document.documentElement;
  // Force style update by setting properties with !important via inline style
  root.style.setProperty('--color-primary', colors.primary);
  root.style.setProperty('--color-accent', colors.accent);
  root.style.setProperty('--color-background', colors.background);
  root.style.setProperty('--color-text', colors.text);
  root.style.setProperty('--color-text-secondary', colors.textSecondary);
  root.style.setProperty('--color-border', colors.border);
  root.style.setProperty('--color-card-bg', colors.cardBg);
  
  // Also update body styles directly for immediate effect
  document.body.style.backgroundColor = colors.background;
  document.body.style.color = colors.text;
}

// Apply dark mode class to document root
function applyDarkModeClass(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Initialize from preferences service
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return preferencesService.getPreferences().themeMode;
  });
  
  const [themeColor, setThemeColorState] = useState<ThemeColor>(() => {
    return preferencesService.getPreferences().themeColor;
  });

  // Get current colors based on theme mode and color
  const colors = THEME_COLORS[themeColor][themeMode];

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyCSSCustomProperties(colors);
    applyDarkModeClass(themeMode === 'dark');
  }, [themeMode, themeColor, colors]);

  // Set theme mode and persist to local storage
  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    preferencesService.setThemeMode(mode);
  }, []);

  // Set theme color and persist to local storage
  const setThemeColor = useCallback((color: ThemeColor) => {
    setThemeColorState(color);
    preferencesService.setThemeColor(color);
  }, []);

  // Toggle between light and dark mode
  const toggleThemeMode = useCallback(() => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newMode);
  }, [themeMode, setThemeMode]);

  const value: ThemeContextValue = {
    themeMode,
    themeColor,
    colors,
    setThemeMode,
    setThemeColor,
    toggleThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use theme context
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { ThemeContext };
